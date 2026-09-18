import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useSistema } from './useSistema';
import { getDefaultSistemaConfig, slugifyCampanha } from './sistema';
import { getTerritorioContextCollectionRef } from './territorioContext';
import { useUiFeedback } from './uiFeedback';
import { enviarComunicadoPeloRelay, relayDisponivel } from './notificationRelay';
import { useOnlineStatus } from './useOnlineStatus';
import { AppPage, PageHeader } from './uiPrimitives';
import { buttonClass } from './uiClasses';
import { ensureUsuarioAprovado, formatWhatsappDigits, isValidUsuarioEmail, isValidWhatsappDigits } from './usuariosModel';
import {
    DEFAULT_ENDERECO_CONFIG,
    getEnderecoCodigoPadraoFromConfig,
    getEnderecoConfigRef,
    getEnderecoConfigForIdioma,
    getEnderecoIdiomasAtivos,
    getGrupoEnderecoCodigoPadraoFromConfig,
    normalizeEnderecoConfig
} from './enderecoConfig';
import {
    ADDRESS_SEARCH_REGION_PRESET,
    normalizeAddressSearchCityKey,
    normalizeAddressSearchConfig,
    unionAddressSearchViewboxes
} from './addressSearchConfig';
import { lookupAddressSearchCityArea } from './addressSearchCityLookup';
import { searchAddresses } from './addressSearch';
import {
    ENDERECOS_COLLECTION,
    GRUPOS_ENDERECOS_COLLECTION,
    importarEnderecosCsvNovos,
    isCodigoManualValido
} from './enderecoModel';
import {
    analyzeEnderecoCsvImport,
    applyEnderecoCsvGeocoding
} from './enderecoCsvImport';

import {
    ADMIN_OFFLINE_MESSAGE,
    ADMIN_OFFLINE_ACTION_CLASS,
    LAST_IMPORT_HIGHLIGHT_STORAGE_KEY,
    ADMIN_TABS,
    UF_OPTIONS
} from './admin/constants/adminConstants';
import {
    getEnderecoConfigFormIdiomas,
    criarEnderecoIdiomaForm
} from './admin/utils/adminUtils';
import { UsuariosTab } from './admin/tabs/UsuariosTab';
import { PadroesTab } from './admin/tabs/PadroesTab';
import { CampanhasTab } from './admin/tabs/CampanhasTab';
import { ComunicadosTab } from './admin/tabs/ComunicadosTab';

const AdminPanel = () => {
    const isOnline = useOnlineStatus();
    const [usuarios, setUsuarios] = useState([]);
    const [campanhas, setCampanhas] = useState([]);
    const [campanhaTitulo, setCampanhaTitulo] = useState('');
    const [campanhaSlug, setCampanhaSlug] = useState('');
    const [salvandoCampanha, setSalvandoCampanha] = useState(false);
    const [campanhaParaExcluir, setCampanhaParaExcluir] = useState(null);
    const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
    const [carregandoResumoExclusao, setCarregandoResumoExclusao] = useState(false);
    const [registrosCampanhaParaExcluir, setRegistrosCampanhaParaExcluir] = useState(0);
    const [excluindoCampanha, setExcluindoCampanha] = useState(false);
    const { config: contextoSistema } = useSistema();
    const { notify, confirm } = useUiFeedback();
    const adminActionsDisabled = !isOnline;

    const ensureOnlineAdminAction = () => {
        if (isOnline) return true;

        notify({
            title: 'Administração bloqueada offline',
            message: ADMIN_OFFLINE_MESSAGE,
            variant: 'warning',
            durationMs: 7000
        });
        return false;
    };

    // Estados para NOVO usuário
    const [novoEmail, setNovoEmail] = useState('');
    const [novoNome, setNovoNome] = useState('');
    const [novoWhats, setNovoWhats] = useState('');
    const [loadingAdd, setLoadingAdd] = useState(false);
    const [comunicadoGeral, setComunicadoGeral] = useState('');
    const [enviandoComunicado, setEnviandoComunicado] = useState(false);
    const [destinoComunicado, setDestinoComunicado] = useState('todos');
    const [activeTab, setActiveTab] = useState('usuarios');
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('todos');
    const [cadastroAberto, setCadastroAberto] = useState(false);
    const [enderecoConfig, setEnderecoConfig] = useState(DEFAULT_ENDERECO_CONFIG);
    const [enderecoConfigForm, setEnderecoConfigForm] = useState(DEFAULT_ENDERECO_CONFIG);
    const [salvandoEnderecoConfig, setSalvandoEnderecoConfig] = useState(false);
    const [municipiosBuscaEndereco, setMunicipiosBuscaEndereco] = useState([]);
    const [carregandoMunicipiosBuscaEndereco, setCarregandoMunicipiosBuscaEndereco] = useState(false);
    const [calculandoAreaBuscaEndereco, setCalculandoAreaBuscaEndereco] = useState(false);
    const [municipioBuscaEnderecoTexto, setMunicipioBuscaEnderecoTexto] = useState('');
    const [enderecoCsvPreview, setEnderecoCsvPreview] = useState(null);
    const [enderecoCsvContext, setEnderecoCsvContext] = useState(null);
    const [enderecoCsvGeocodeStatus, setEnderecoCsvGeocodeStatus] = useState({});
    const [verificandoPlanilha, setVerificandoPlanilha] = useState(false);
    const [buscandoPinsPlanilha, setBuscandoPinsPlanilha] = useState(false);
    const [importandoPlanilha, setImportandoPlanilha] = useState(false);
    const [salvandoPlanilhaCsvUrl, setSalvandoPlanilhaCsvUrl] = useState(false);
    const enderecoBuscaUfSelecionada = normalizeAddressSearchConfig(enderecoConfigForm.buscaEndereco).uf;

    // Estados para EDIÇÃO inline
    const [editandoId, setEditandoId] = useState(null);
    const [dadosEditados, setDadosEditados] = useState({});

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            const lista = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Ordenar: Pendentes primeiro, depois Admins, depois resto
            lista.sort((a, b) => {
                if (a.role === 'aguardando' && b.role !== 'aguardando') return -1;
                if (a.role !== 'aguardando' && b.role === 'aguardando') return 1;
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return a.nome?.localeCompare(b.nome);
            });
            setUsuarios(lista);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "campanhas"), (snapshot) => {
            const lista = snapshot.docs.map((campanhaDoc) => ({
                id: campanhaDoc.id,
                ...campanhaDoc.data()
            }));

            lista.sort((a, b) => {
                const dataA = a.atualizadaEm?.seconds || a.criadaEm?.seconds || 0;
                const dataB = b.atualizadaEm?.seconds || b.criadaEm?.seconds || 0;
                return dataB - dataA;
            });

            setCampanhas(lista);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        if (activeTab !== 'padroes') return undefined;

        const uf = enderecoBuscaUfSelecionada;
        const cacheKey = `territorios-idiomas.municipios.${uf}`;
        let ativo = true;

        try {
            const cached = window.sessionStorage?.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setMunicipiosBuscaEndereco(parsed);
                    setCarregandoMunicipiosBuscaEndereco(false);
                    return undefined;
                }
            }
        } catch {
            // Cache is best effort.
        }

        const controller = new AbortController();
        setCarregandoMunicipiosBuscaEndereco(true);

        fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, {
            signal: controller.signal
        })
            .then((response) => {
                if (!response.ok) throw new Error('IBGE indisponível.');
                return response.json();
            })
            .then((payload) => {
                if (!ativo) return;
                const municipios = Array.isArray(payload)
                    ? payload.map((municipio) => String(municipio?.nome || '').trim()).filter(Boolean)
                    : [];
                setMunicipiosBuscaEndereco(municipios);
                try {
                    window.sessionStorage?.setItem(cacheKey, JSON.stringify(municipios));
                } catch {
                    // Cache is best effort.
                }
            })
            .catch((error) => {
                if (error?.name === 'AbortError' || !ativo) return;
                console.error('Erro ao carregar municípios do IBGE:', error);
                setMunicipiosBuscaEndereco([]);
            })
            .finally(() => {
                if (ativo) setCarregandoMunicipiosBuscaEndereco(false);
            });

        return () => {
            ativo = false;
            controller.abort();
        };
    }, [activeTab, enderecoBuscaUfSelecionada]);

    useEffect(() => {
        const unsub = onSnapshot(getEnderecoConfigRef(db), (snapshot) => {
            const config = normalizeEnderecoConfig(snapshot.exists() ? snapshot.data() : DEFAULT_ENDERECO_CONFIG);
            setEnderecoConfig(config);
            setEnderecoConfigForm(config);
        }, (error) => {
            console.error('Erro ao carregar padrões de endereços:', error);
            const config = normalizeEnderecoConfig(DEFAULT_ENDERECO_CONFIG);
            setEnderecoConfig(config);
            setEnderecoConfigForm(config);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        let ativo = true;

        const carregarResumoExclusao = async () => {
            if (!campanhaParaExcluir) {
                setConfirmacaoExclusao('');
                setRegistrosCampanhaParaExcluir(0);
                setCarregandoResumoExclusao(false);
                return;
            }

            setConfirmacaoExclusao('');
            setCarregandoResumoExclusao(true);

            try {
                const contextoQuery = query(
                    getTerritorioContextCollectionRef(db),
                    where("contextoId", "==", campanhaParaExcluir.id)
                );
                const snapshot = await getDocs(contextoQuery);

                if (ativo) {
                    setRegistrosCampanhaParaExcluir(snapshot.size);
                }
            } catch (error) {
                console.error("Erro ao carregar resumo da campanha para exclusão:", error);
                if (ativo) {
                    setRegistrosCampanhaParaExcluir(0);
                }
            } finally {
                if (ativo) {
                    setCarregandoResumoExclusao(false);
                }
            }
        };

        carregarResumoExclusao();

        return () => {
            ativo = false;
        };
    }, [campanhaParaExcluir]);

    // --- ADICIONAR NOVO ---
    const handleAdicionar = async (e) => {
        e.preventDefault();
        if (!ensureOnlineAdminAction()) return;
        if (!novoEmail) return;

        if (!isValidUsuarioEmail(novoEmail)) {
            notify({
                title: 'E-mail inválido',
                message: 'Por favor, verifique o formato informado.',
                variant: 'warning'
            });
            return;
        }

        const whatsLimpo = formatWhatsappDigits(novoWhats);
        if (!isValidWhatsappDigits(novoWhats)) {
            notify({
                title: 'WhatsApp inválido',
                message: 'O número deve ter DDD + 8 ou 9 dígitos.',
                variant: 'warning'
            });
            return;
        }

        setLoadingAdd(true);
        const emailFormatado = novoEmail.trim().toLowerCase();

        try {
            await ensureUsuarioAprovado(db, {
                email: emailFormatado,
                nome: novoNome || 'Novo Dirigente',
                whatsapp: whatsLimpo,
                origem: 'admin-panel'
            });
            setNovoEmail('');
            setNovoNome('');
            setNovoWhats('');
            setCadastroAberto(false);
            notify({
                title: 'Usuário cadastrado',
                message: 'Usuário adicionado com sucesso.',
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao adicionar:", error);
            notify({
                title: 'Cadastro bloqueado',
                message: 'Verifique suas permissões e tente novamente.',
                variant: 'error'
            });
        }
        setLoadingAdd(false);
    };

    // --- AÇÕES RÁPIDAS (ATUALIZADO COM CONFIRMAÇÃO) ---
    const mudarRole = async (user, novaRole) => {
        if (!ensureOnlineAdminAction()) return;
        const nomeUsuario = user.nome || user.id;
        const aprovandoUsuario = user.role === 'aguardando' && novaRole === 'comum';
        const promovendoAdmin = novaRole === 'admin';
        const rebaixandoAdmin = user.role === 'admin' && novaRole === 'comum';
        const alerta = aprovandoUsuario
            ? `Deseja aprovar o acesso de ${nomeUsuario} como dirigente?`
            : promovendoAdmin
                ? `⚠️ ATENÇÃO: Você está prestes a tornar ${nomeUsuario} um ADMINISTRADOR.\n\nEle terá acesso total ao sistema, incluindo edição e exclusão de dados.\n\nDeseja continuar?`
                : `Deseja remover as permissões de administrador de ${nomeUsuario}?`;

        if (!(await confirm({
            title: aprovandoUsuario ? 'Aprovar usuário' : promovendoAdmin ? 'Promover para admin' : 'Remover permissão de admin',
            message: alerta,
            tone: promovendoAdmin || rebaixandoAdmin ? 'warning' : 'info',
            confirmLabel: aprovandoUsuario ? 'Aprovar' : promovendoAdmin ? 'Promover' : 'Remover'
        }))) {
            return;
        }

        try {
            await updateDoc(doc(db, "usuarios", user.id), { role: novaRole });
        } catch {
            notify({
                title: 'Permissão não alterada',
                message: 'Não foi possível mudar a permissão agora.',
                variant: 'error'
            });
        }
    };

    const remover = async (email) => {
        if (!ensureOnlineAdminAction()) return;
        if (!(await confirm({
            title: 'Excluir usuário',
            message: `Tem certeza que deseja excluir definitivamente o usuário ${email}?\n\nEssa ação não pode ser desfeita.`,
            tone: 'danger',
            confirmLabel: 'Excluir'
        }))) {
            return;
        }

        try {
            await deleteDoc(doc(db, "usuarios", email));
        } catch {
            notify({
                title: 'Usuário não removido',
                message: 'Não foi possível remover esse usuário agora.',
                variant: 'error'
            });
        }
    };

    // --- LÓGICA DE EDIÇÃO ---
    const iniciarEdicao = (user) => {
        setEditandoId(user.id);
        setDadosEditados({ ...user });
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setDadosEditados({});
    };

    const salvarEdicao = async () => {
        if (!editandoId) return;
        if (!ensureOnlineAdminAction()) return;

        try {
            await updateDoc(doc(db, "usuarios", editandoId), {
                nome: dadosEditados.nome,
                whatsapp: dadosEditados.whatsapp
            });
            setEditandoId(null);
        } catch (error) {
            console.error(error);
            notify({
                title: 'Edição não salva',
                message: 'Não foi possível salvar as alterações.',
                variant: 'error'
            });
        }
    };

    const handleEditChange = (campo, valor) => {
        setDadosEditados(prev => ({ ...prev, [campo]: valor }));
    };

    const handleEnderecoConfigChange = (campo, valor) => {
        setEnderecoConfigForm((current) => ({
            ...current,
            [campo]: valor
        }));
    };

    const atualizarBuscaEnderecoConfig = (updates) => {
        setEnderecoConfigForm((current) => {
            const atual = normalizeAddressSearchConfig(current.buscaEndereco);
            const viewbox = updates.viewbox
                ? { ...atual.viewbox, ...updates.viewbox }
                : atual.viewbox;

            return {
                ...current,
                buscaEndereco: normalizeAddressSearchConfig({
                    ...atual,
                    ...updates,
                    viewbox
                })
            };
        });
    };

    const aplicarPresetBuscaEnderecoRegional = () => {
        setEnderecoConfigForm((current) => ({
            ...current,
            buscaEndereco: normalizeAddressSearchConfig(ADDRESS_SEARCH_REGION_PRESET)
        }));
        setMunicipioBuscaEnderecoTexto('');
    };

    const selecionarUfBuscaEndereco = (uf) => {
        setEnderecoConfigForm((current) => {
            const atual = normalizeAddressSearchConfig(current.buscaEndereco);
            return {
                ...current,
                buscaEndereco: normalizeAddressSearchConfig({
                    ...atual,
                    uf,
                    cidades: uf === ADDRESS_SEARCH_REGION_PRESET.uf ? ADDRESS_SEARCH_REGION_PRESET.cidades : [],
                    areas: uf === ADDRESS_SEARCH_REGION_PRESET.uf ? undefined : [],
                    viewbox: uf === ADDRESS_SEARCH_REGION_PRESET.uf ? ADDRESS_SEARCH_REGION_PRESET.viewbox : atual.viewbox
                })
            };
        });
        setMunicipioBuscaEnderecoTexto('');
        setMunicipiosBuscaEndereco([]);
    };

    const adicionarMunicipioBuscaEndereco = async (nomeMunicipio = municipioBuscaEnderecoTexto) => {
        const nome = String(nomeMunicipio || '').trim();
        if (!nome) return;
        if (!ensureOnlineAdminAction()) return;

        const atual = normalizeAddressSearchConfig(enderecoConfigForm.buscaEndereco);
        const jaExiste = atual.areas.some((area) => normalizeAddressSearchCityKey(area.cidade) === normalizeAddressSearchCityKey(nome));
        if (jaExiste) {
            setMunicipioBuscaEnderecoTexto('');
            return;
        }

        setCalculandoAreaBuscaEndereco(true);
        try {
            const controller = new AbortController();
            const area = await lookupAddressSearchCityArea({
                uf: atual.uf,
                cidade: nome,
                margemKm: atual.margemKm,
                signal: controller.signal
            });

            if (!area) {
                notify({
                    title: 'Município não localizado',
                    message: 'Não consegui calcular a área desse município. Confira o nome ou tente novamente.',
                    variant: 'warning',
                    durationMs: 7000
                });
                return;
            }

            setEnderecoConfigForm((current) => {
                const currentBusca = normalizeAddressSearchConfig(current.buscaEndereco);
                const areas = [...currentBusca.areas, area];

                return {
                    ...current,
                    buscaEndereco: normalizeAddressSearchConfig({
                        ...currentBusca,
                        cidades: areas.map((item) => item.cidade),
                        areas,
                        viewbox: unionAddressSearchViewboxes(areas, currentBusca.viewbox)
                    })
                };
            });
            setMunicipioBuscaEnderecoTexto('');
        } catch (error) {
            console.error('Erro ao calcular área do município:', error);
            notify({
                title: 'Área não calculada',
                message: String(error?.message || 'Não foi possível calcular a área desse município agora.'),
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setCalculandoAreaBuscaEndereco(false);
        }
    };

    const removerMunicipioBuscaEndereco = (nomeMunicipio) => {
        setEnderecoConfigForm((current) => {
            const atual = normalizeAddressSearchConfig(current.buscaEndereco);
            const areas = atual.areas.filter((area) => normalizeAddressSearchCityKey(area.cidade) !== normalizeAddressSearchCityKey(nomeMunicipio));

            return {
                ...current,
                buscaEndereco: normalizeAddressSearchConfig({
                    ...atual,
                    cidades: areas.map((area) => area.cidade),
                    areas,
                    viewbox: unionAddressSearchViewboxes(areas, atual.viewbox)
                })
            };
        });
    };

    const selecionarIdiomaPadraoEndereco = (idiomaId) => {
        setEnderecoConfigForm((current) => {
            const idiomas = getEnderecoConfigFormIdiomas(current);
            const idiomaSelecionado = idiomas.find((idioma) => idioma.id === idiomaId) || idiomas[0];

            return {
                ...current,
                idiomaPadraoId: idiomaSelecionado?.id || idiomaId,
                idiomaPadraoNome: idiomaSelecionado?.nome || current.idiomaPadraoNome,
                prefixoEnderecoPadrao: idiomaSelecionado?.codigoPrefixoEndereco || current.prefixoEnderecoPadrao,
                prefixoTerritorioPadrao: idiomaSelecionado?.codigoPrefixoTerritorio || current.prefixoTerritorioPadrao,
                idiomas
            };
        });
    };

    const handleEnderecoIdiomaChange = (index, campo, valor) => {
        setEnderecoConfigForm((current) => {
            const idiomas = getEnderecoConfigFormIdiomas(current);
            const atual = idiomas[index] || criarEnderecoIdiomaForm(index + 1);
            const atualizado = {
                ...atual,
                [campo]: campo === 'id'
                    ? String(valor || '').trim().toLowerCase()
                    : campo === 'codigoPrefixoEndereco' || campo === 'codigoPrefixoTerritorio'
                        ? String(valor || '').toUpperCase()
                        : valor
            };
            const proximosIdiomas = idiomas.map((idioma, idiomaIndex) => (
                idiomaIndex === index ? atualizado : idioma
            ));
            const idiomaPadraoAtualizado = atual.id && atual.id === current.idiomaPadraoId;

            return {
                ...current,
                idiomaPadraoId: idiomaPadraoAtualizado ? atualizado.id : current.idiomaPadraoId,
                idiomaPadraoNome: idiomaPadraoAtualizado ? atualizado.nome : current.idiomaPadraoNome,
                prefixoEnderecoPadrao: idiomaPadraoAtualizado ? atualizado.codigoPrefixoEndereco : current.prefixoEnderecoPadrao,
                prefixoTerritorioPadrao: idiomaPadraoAtualizado ? atualizado.codigoPrefixoTerritorio : current.prefixoTerritorioPadrao,
                idiomas: proximosIdiomas
            };
        });
    };

    const adicionarEnderecoIdioma = () => {
        setEnderecoConfigForm((current) => {
            const idiomas = getEnderecoConfigFormIdiomas(current);
            const proximaOrdem = Math.max(0, ...idiomas.map((idioma) => Number(idioma.ordem) || 0)) + 1;

            return {
                ...current,
                idiomas: [
                    ...idiomas,
                    criarEnderecoIdiomaForm(proximaOrdem)
                ]
            };
        });
    };

    const removerEnderecoIdioma = (index) => {
        setEnderecoConfigForm((current) => {
            const idiomas = getEnderecoConfigFormIdiomas(current);
            const proximosIdiomas = idiomas.filter((_, idiomaIndex) => idiomaIndex !== index);
            const idiomaPadraoAindaExiste = proximosIdiomas.some((idioma) => idioma.id === current.idiomaPadraoId);
            const proximoPadrao = idiomaPadraoAindaExiste
                ? proximosIdiomas.find((idioma) => idioma.id === current.idiomaPadraoId)
                : proximosIdiomas.find((idioma) => idioma.ativo) || proximosIdiomas[0];

            return {
                ...current,
                idiomaPadraoId: proximoPadrao?.id || current.idiomaPadraoId,
                idiomaPadraoNome: proximoPadrao?.nome || current.idiomaPadraoNome,
                prefixoEnderecoPadrao: proximoPadrao?.codigoPrefixoEndereco || current.prefixoEnderecoPadrao,
                prefixoTerritorioPadrao: proximoPadrao?.codigoPrefixoTerritorio || current.prefixoTerritorioPadrao,
                idiomas: proximosIdiomas.length ? proximosIdiomas : getEnderecoConfigFormIdiomas(DEFAULT_ENDERECO_CONFIG)
            };
        });
    };

    const salvarEnderecoConfig = async (event) => {
        event.preventDefault();
        if (!ensureOnlineAdminAction()) return;

        const idiomasForm = getEnderecoConfigFormIdiomas(enderecoConfigForm);
        const idiomaIdsPreenchidos = idiomasForm.map((idioma) => idioma.id).filter(Boolean);
        const idiomaIdDuplicado = idiomaIdsPreenchidos.find((idiomaId, index, list) => list.indexOf(idiomaId) !== index);

        if (idiomaIdDuplicado) {
            notify({
                title: 'Idioma duplicado',
                message: `O ID ${idiomaIdDuplicado} aparece mais de uma vez. Use um ID único para cada idioma.`,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        const configBase = normalizeEnderecoConfig({
            ...enderecoConfig,
            ...enderecoConfigForm,
            idiomas: idiomasForm,
            tiposEndereco: enderecoConfig.tiposEndereco
        });
        const idiomasAtivos = getEnderecoIdiomasAtivos(configBase);
        const idiomaPadrao = idiomasAtivos.find((idioma) => idioma.id === configBase.idiomaPadraoId) || idiomasAtivos[0];

        if (!idiomaPadrao) {
            notify({
                title: 'Idioma obrigatório',
                message: 'Mantenha pelo menos um idioma ativo para os cadastros.',
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        const configNormalizada = getEnderecoConfigForIdioma({
            ...configBase,
            idiomaPadraoId: idiomaPadrao.id
        }, idiomaPadrao.id);
        const idiomaInvalido = idiomasAtivos.find((idioma) => {
            const configIdioma = getEnderecoConfigForIdioma(configBase, idioma.id);
            return !isCodigoManualValido(getEnderecoCodigoPadraoFromConfig(configIdioma)) ||
                !isCodigoManualValido(getGrupoEnderecoCodigoPadraoFromConfig(configIdioma));
        });

        if (idiomaInvalido) {
            notify({
                title: 'Prefixo inválido',
                message: `Os prefixos de ${idiomaInvalido.nome} precisam gerar códigos com hífen, como ES-SBS-001 e ES-SBS-T001.`,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setSalvandoEnderecoConfig(true);
        try {
            await setDoc(getEnderecoConfigRef(db), {
                ...configNormalizada,
                atualizadaEm: new Date()
            }, { merge: true });
            notify({
                title: 'Padrões salvos',
                message: 'Os próximos cadastros de endereço e território usarão estes padrões.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao salvar padrões de cadastro:', error);
            notify({
                title: 'Padrões não salvos',
                message: String(error?.message || 'Não foi possível salvar os padrões agora.'),
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setSalvandoEnderecoConfig(false);
        }
    };

    const salvarPlanilhaCsvUrl = async () => {
        if (!ensureOnlineAdminAction()) return;

        const planilhaCsvUrl = String(enderecoConfigForm.planilhaCsvUrl || '').trim();
        if (!planilhaCsvUrl) {
            notify({
                title: 'Link da planilha obrigatório',
                message: 'Informe o link CSV publicado antes de salvar.',
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setSalvandoPlanilhaCsvUrl(true);
        try {
            await setDoc(getEnderecoConfigRef(db), {
                planilhaCsvUrl,
                planilhaCsvAtualizadaEm: new Date()
            }, { merge: true });
            notify({
                title: 'URL da planilha salva',
                message: 'Somente a configuração do link CSV foi gravada.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao salvar URL da planilha:', error);
            notify({
                title: 'URL não salva',
                message: String(error?.message || 'Não foi possível salvar o link da planilha agora.'),
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setSalvandoPlanilhaCsvUrl(false);
        }
    };

    const carregarContextoImportacaoEnderecos = async () => {
        const [enderecosSnapshot, gruposSnapshot] = await Promise.all([
            getDocs(collection(db, ENDERECOS_COLLECTION)),
            getDocs(collection(db, GRUPOS_ENDERECOS_COLLECTION))
        ]);

        return {
            existingEnderecos: enderecosSnapshot.docs.map((snapshot) => ({
                id: snapshot.id,
                ...snapshot.data()
            })),
            existingGrupos: gruposSnapshot.docs.map((snapshot) => ({
                id: snapshot.id,
                ...snapshot.data()
            }))
        };
    };

    const verificarPlanilhaEnderecos = async () => {
        if (!ensureOnlineAdminAction()) return;

        const planilhaCsvUrl = String(enderecoConfigForm.planilhaCsvUrl || '').trim();
        if (!planilhaCsvUrl) {
            notify({
                title: 'Link da planilha obrigatório',
                message: 'Informe o link CSV publicado antes de verificar.',
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setVerificandoPlanilha(true);
        try {
            const [response, contexto] = await Promise.all([
                fetch(planilhaCsvUrl, { cache: 'no-store' }),
                carregarContextoImportacaoEnderecos()
            ]);

            if (!response.ok) {
                throw new Error('Não foi possível baixar o CSV publicado.');
            }

            const csvText = await response.text();
            const config = normalizeEnderecoConfig(enderecoConfigForm);
            const preview = analyzeEnderecoCsvImport({
                csvText,
                config,
                ...contexto
            });

            setEnderecoCsvContext({
                ...contexto,
                config
            });
            setEnderecoCsvGeocodeStatus({});
            setEnderecoCsvPreview(preview);
            notify({
                title: 'Planilha verificada',
                message: `${preview.totals.total} linha(s), ${preview.totals.aplicar} pronta(s) para aplicar.`,
                variant: preview.totals.conflitos || preview.totals.invalidos ? 'warning' : 'success',
                durationMs: 7000
            });
        } catch (error) {
            console.error('Erro ao verificar planilha de endereços:', error);
            setEnderecoCsvPreview(null);
            notify({
                title: 'Verificação indisponível',
                message: String(error?.message || 'Não foi possível verificar a planilha agora.'),
                variant: 'error',
                durationMs: 8000
            });
        } finally {
            setVerificandoPlanilha(false);
        }
    };

    const buscarPinsPlanilhaRows = async (rows) => {
        if (!enderecoCsvPreview || !enderecoCsvContext) return;
        if (!ensureOnlineAdminAction()) return;

        const rowsParaBusca = rows.filter((row) => row?.action === 'sem-coordenada' && row.geocodeQuery);
        if (!rowsParaBusca.length) return;

        setBuscandoPinsPlanilha(true);
        const coordinatesByRowKey = {};
        const statusUpdates = {};
        let resolvidos = 0;
        let pendentes = 0;

        try {
            setEnderecoCsvGeocodeStatus((current) => {
                const next = { ...current };
                rowsParaBusca.forEach((row) => {
                    next[row.rowKey] = {
                        state: 'buscando',
                        message: 'Buscando pin com a query preparada.'
                    };
                });
                return next;
            });

            for (const row of rowsParaBusca) {
                const results = await searchAddresses(row.geocodeQuery, {
                    searchConfig: enderecoCsvContext.config.buscaEndereco
                });
                if (results.length === 1) {
                    coordinatesByRowKey[row.rowKey] = {
                        lat: results[0].lat,
                        lng: results[0].lng
                    };
                    statusUpdates[row.rowKey] = {
                        state: 'resolvido',
                        message: 'Resultado único aceito dentro da área configurada.'
                    };
                    resolvidos += 1;
                } else {
                    statusUpdates[row.rowKey] = {
                        state: 'pendente',
                        message: results.length
                            ? 'Mais de um resultado possível; revise manualmente.'
                            : 'Nenhum resultado confiável dentro da área configurada.'
                    };
                    pendentes += 1;
                }
            }

            setEnderecoCsvPreview(applyEnderecoCsvGeocoding(enderecoCsvPreview, {
                coordinatesByRowKey,
                ...enderecoCsvContext
            }));
            setEnderecoCsvGeocodeStatus((current) => ({
                ...current,
                ...statusUpdates
            }));
            notify({
                title: 'Busca de pins concluída',
                message: `${resolvidos} pin(s) resolvido(s). ${pendentes} linha(s) continuam para revisão.`,
                variant: pendentes ? 'warning' : 'success',
                durationMs: 8000
            });
        } catch (error) {
            console.error('Erro ao buscar pins da planilha:', error);
            setEnderecoCsvGeocodeStatus((current) => {
                const next = { ...current };
                rowsParaBusca.forEach((row) => {
                    next[row.rowKey] = {
                        state: 'erro',
                        message: String(error?.message || 'Busca interrompida.')
                    };
                });
                return next;
            });
            notify({
                title: 'Busca interrompida',
                message: String(error?.message || 'Não foi possível buscar os pins faltantes agora.'),
                variant: 'error',
                durationMs: 8000
            });
        } finally {
            setBuscandoPinsPlanilha(false);
        }
    };

    const buscarPinsFaltantesPlanilha = async () => {
        const semCoordenada = enderecoCsvPreview?.rows?.filter((row) => row.action === 'sem-coordenada') || [];
        await buscarPinsPlanilhaRows(semCoordenada);
    };

    const buscarPinLinhaPlanilha = async (row) => {
        await buscarPinsPlanilhaRows([row]);
    };

    const inserirNovosEnderecosPlanilha = async () => {
        if (!enderecoCsvPreview) return;
        if (!ensureOnlineAdminAction()) return;

        const user = auth.currentUser;
        if (!user?.email) {
            notify({
                title: 'Sessão necessária',
                message: 'Entre novamente para inserir os endereços.',
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        const confirmar = await confirm({
            title: 'Aplicar importação',
            message: `Aplicar ${enderecoCsvPreview.totals.inserir} inserção(ões) e ${enderecoCsvPreview.totals.atualizar} atualização(ões) da prévia atual?`,
            tone: 'warning',
            confirmLabel: 'Aplicar'
        });

        if (!confirmar) return;

        setImportandoPlanilha(true);
        try {
            const resultado = await importarEnderecosCsvNovos(db, {
                preview: enderecoCsvPreview,
                user: {
                    ...user,
                    isAdmin: true,
                    role: 'admin'
                }
            });
            notify({
                title: 'Endereços importados',
                message: `${resultado.enderecosInseridos} inserido(s), ${resultado.enderecosAtualizados} atualizado(s), ${resultado.territoriosCriados} território(s) criado(s) e ${resultado.territoriosAtualizados} recalculado(s).`,
                variant: 'success',
                durationMs: 9000
            });
            try {
                window.localStorage?.setItem(LAST_IMPORT_HIGHLIGHT_STORAGE_KEY, JSON.stringify({
                    importacaoId: resultado.importacaoId,
                    enderecoIds: resultado.enderecosAfetadosIds || [],
                    savedAt: Date.now()
                }));
                window.dispatchEvent(new CustomEvent('enderecos-importacao-highlight-updated'));
            } catch {
                // Destaque no mapa é apenas conveniência local.
            }
            setEnderecoCsvPreview(null);
            setEnderecoCsvContext(null);
            setEnderecoCsvGeocodeStatus({});
        } catch (error) {
            console.error('Erro ao importar endereços da planilha:', error);
            notify({
                title: 'Importação não concluída',
                message: String(error?.message || 'Não foi possível inserir os endereços agora. Verifique a prévia novamente.'),
                variant: 'error',
                durationMs: 9000
            });
        } finally {
            setImportandoPlanilha(false);
        }
    };

    const enviarComunicadoGeral = async (e) => {
        e.preventDefault();
        if (!ensureOnlineAdminAction()) return;

        const mensagem = comunicadoGeral.trim();
        const destinatarios = usuarios.filter((user) => user.role === 'admin' || user.role === 'comum');
        const admins = usuarios.filter((user) => user.role === 'admin');

        if (!mensagem) {
            notify({
                title: 'Mensagem obrigatoria',
                message: 'Digite a mensagem do comunicado.',
                variant: 'warning'
            });
            return;
        }

        if (destinoComunicado === 'admins' && admins.length === 0) {
            notify({
                title: 'Sem destinatarios',
                message: 'Não há administradores para receber o comunicado.',
                variant: 'warning'
            });
            return;
        }

        if (destinoComunicado === 'todos' && destinatarios.length === 0) {
            notify({
                title: 'Sem destinatarios',
                message: 'Não há usuários aprovados para receber o comunicado.',
                variant: 'warning'
            });
            return;
        }

        const totalDestino = destinoComunicado === 'admins' ? admins.length : destinatarios.length;
        const rotuloDestino = destinoComunicado === 'admins' ? 'admin(s)' : 'usuário(s)';

        if (!(await confirm({
            title: 'Enviar comunicado',
            message: `Enviar este comunicado para ${totalDestino} ${rotuloDestino}?`,
            tone: 'warning',
            confirmLabel: 'Enviar'
        }))) {
            return;
        }

        setEnviandoComunicado(true);

        try {
            let resultadoRelay = null;

            if (relayDisponivel()) {
                resultadoRelay = await enviarComunicadoPeloRelay({
                    destino: destinoComunicado,
                    mensagem
                });
            } else {
                const agora = new Date();
                if (destinoComunicado === 'admins') {
                    const batchSize = 400;

                    for (let index = 0; index < admins.length; index += batchSize) {
                        const batch = writeBatch(db);
                        admins
                            .slice(index, index + batchSize)
                            .forEach((admin) => {
                                const notificacaoRef = doc(collection(db, "notificacoes"));
                                batch.set(notificacaoRef, {
                                    para: admin.id,
                                    texto: mensagem,
                                    data: agora,
                                    lida: false,
                                    tipo: 'comunicado',
                                    origem: 'admin'
                                });
                            });

                        await batch.commit();
                    }
                } else {
                    const batchSize = 400;

                    for (let index = 0; index < destinatarios.length; index += batchSize) {
                        const batch = writeBatch(db);

                        destinatarios
                            .slice(index, index + batchSize)
                            .forEach((user) => {
                                const notificacaoRef = doc(collection(db, "notificacoes"));
                                batch.set(notificacaoRef, {
                                    para: user.id,
                                    texto: mensagem,
                                    data: agora,
                                    lida: false,
                                    tipo: 'comunicado',
                                    origem: 'admin'
                                });
                            });

                        await batch.commit();
                    }
                }
            }

            setComunicadoGeral('');
            notify({
                title: 'Comunicado enviado',
                message: resultadoRelay
                    ? `Comunicado enviado para ${resultadoRelay.destinatarios ?? totalDestino} ${rotuloDestino}. Push ${resultadoRelay.canal ?? 'relay'}: ${resultadoRelay.pushesEnviados ?? 0} enviado(s), ${resultadoRelay.pushesFalharam ?? 0} falha(s).`
                    : `Comunicado enviado para ${totalDestino} ${rotuloDestino}.`,
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao enviar comunicado geral:", error);
            notify({
                title: 'Envio indisponível',
                message: String(error?.message || 'Não foi possível enviar o comunicado geral.'),
                variant: 'error'
            });
        } finally {
            setEnviandoComunicado(false);
        }
    };

    const ativarCampanha = async ({ id, titulo }) => {
        if (!ensureOnlineAdminAction()) return;
        setSalvandoCampanha(true);

        try {
            const agora = new Date();
            await setDoc(doc(db, "campanhas", id), {
                id,
                titulo,
                atualizadaEm: agora,
                criadaEm: agora
            }, { merge: true });

            await setDoc(doc(db, "configuracoes", "sistema"), {
                contextoAtivoId: id,
                contextoAtivoTipo: 'campanha',
                contextoAtivoTitulo: titulo,
                contextoAtivoCor: 'violet',
                campanhaAtiva: true,
                campanha_ativa: id,
                nome_campanha: titulo,
                atualizadaEm: agora
            }, { merge: true });

            setCampanhaTitulo('');
            setCampanhaSlug('');
            notify({
                title: 'Campanha ativada',
                message: `Campanha "${titulo}" ativada com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao ativar campanha:", error);
            notify({
                title: 'Campanha não ativada',
                message: 'Não foi possível ativar a campanha.',
                variant: 'error'
            });
        } finally {
            setSalvandoCampanha(false);
        }
    };

    const handleCriarCampanha = async (e) => {
        e.preventDefault();
        const titulo = campanhaTitulo.trim();
        const id = slugifyCampanha(campanhaSlug || titulo);

        if (!titulo) {
            notify({
                title: 'Titulo obrigatorio',
                message: 'Informe o título da campanha.',
                variant: 'warning'
            });
            return;
        }

        if (!id) {
            notify({
                title: 'Identificador inválido',
                message: 'Não consegui gerar um identificador válido para a campanha.',
                variant: 'error'
            });
            return;
        }

        await ativarCampanha({ id, titulo });
    };

    const voltarModoNormal = async () => {
        if (!ensureOnlineAdminAction()) return;
        if (!(await confirm({
            title: 'Desativar campanha',
            message: 'Voltar o sistema para a pregação normal agora?',
            tone: 'warning',
            confirmLabel: 'Voltar ao normal'
        }))) return;

        setSalvandoCampanha(true);
        try {
            const configNormal = getDefaultSistemaConfig();
            await setDoc(doc(db, "configuracoes", "sistema"), {
                ...configNormal,
                campanha_ativa: configNormal.contextoAtivoId,
                nome_campanha: '',
                atualizadaEm: new Date()
            }, { merge: true });
            notify({
                title: 'Modo normal ativo',
                message: 'Sistema voltou para o modo normal.',
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao voltar para o modo normal:", error);
            notify({
                title: 'Mudança não concluída',
                message: 'Não foi possível voltar para o modo normal.',
                variant: 'error'
            });
        } finally {
            setSalvandoCampanha(false);
        }
    };

    const abrirModalExclusaoCampanha = (campanha) => {
        setCampanhaParaExcluir(campanha);
    };

    const fecharModalExclusaoCampanha = (forcar = false) => {
        if (excluindoCampanha && !forcar) return;
        setCampanhaParaExcluir(null);
        setConfirmacaoExclusao('');
        setRegistrosCampanhaParaExcluir(0);
        setCarregandoResumoExclusao(false);
    };

    const excluirCampanha = async () => {
        if (!campanhaParaExcluir) return;
        if (!ensureOnlineAdminAction()) return;

        if (contextoSistema.contextoAtivoId === campanhaParaExcluir.id) {
            notify({
                title: 'Campanha em uso',
                message: 'Desative a campanha antes de excluir.',
                variant: 'warning'
            });
            return;
        }

        if (confirmacaoExclusao.trim() !== campanhaParaExcluir.id) {
            notify({
                title: 'Confirmação incompleta',
                message: 'Digite o identificador exato da campanha para confirmar a exclusão.',
                variant: 'warning'
            });
            return;
        }

        setExcluindoCampanha(true);

        try {
            const campanhaExcluida = campanhaParaExcluir;
            const contextoQuery = query(
                getTerritorioContextCollectionRef(db),
                where("contextoId", "==", campanhaParaExcluir.id)
            );
            const contextoSnapshot = await getDocs(contextoQuery);
            const refsParaExcluir = [
                ...contextoSnapshot.docs.map((docSnapshot) => docSnapshot.ref),
                doc(db, "campanhas", campanhaParaExcluir.id)
            ];

            const batchSize = 400;
            for (let index = 0; index < refsParaExcluir.length; index += batchSize) {
                const batch = writeBatch(db);
                refsParaExcluir
                    .slice(index, index + batchSize)
                    .forEach((docRef) => batch.delete(docRef));
                await batch.commit();
            }

            fecharModalExclusaoCampanha(true);
            notify({
                title: 'Campanha excluída',
                message: `Campanha "${campanhaExcluida.titulo || campanhaExcluida.id}" excluída com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao excluir campanha:", error);
            notify({
                title: 'Exclusão não concluída',
                message: 'Não foi possível excluir a campanha.',
                variant: 'error'
            });
        } finally {
            setExcluindoCampanha(false);
        }
    };

    // --- CONTADORES ---
    const totalUsers = usuarios.length;
    const totalAdmins = usuarios.filter((u) => u.role === 'admin').length;
    const usuariosPendentes = usuarios.filter((u) => u.role === 'aguardando');
    const totalPendentes = usuariosPendentes.length;
    const totalAprovados = usuarios.filter((u) => u.role === 'admin' || u.role === 'comum').length;
    const totalDestinoComunicado = destinoComunicado === 'admins' ? totalAdmins : totalAprovados;
    const buscaUsuario = userSearch.trim().toLowerCase();
    const usuariosFiltrados = usuarios.filter((user) => {
        const correspondePerfil = userRoleFilter === 'todos' || user.role === userRoleFilter;
        const conteudoBusca = `${user.nome || ''} ${user.id || ''} ${user.whatsapp || ''}`.toLowerCase();
        const correspondeBusca = !buscaUsuario || conteudoBusca.includes(buscaUsuario);

        return correspondePerfil && correspondeBusca;
    });
    const enderecoConfigIdiomasAtivos = getEnderecoIdiomasAtivos(enderecoConfig);
    const enderecoConfigFormNormalizada = normalizeEnderecoConfig(enderecoConfigForm);
    const enderecoConfigFormIdiomas = getEnderecoConfigFormIdiomas(enderecoConfigForm);
    const enderecoConfigFormIdiomasAtivos = enderecoConfigFormNormalizada.idiomas.filter((idioma) => idioma.ativo);
    const enderecoConfigFormIdiomaPadrao = enderecoConfigFormIdiomasAtivos.find((idioma) => idioma.id === enderecoConfigFormNormalizada.idiomaPadraoId) ||
        enderecoConfigFormIdiomasAtivos[0] ||
        enderecoConfigFormNormalizada.idiomas[0];
    const enderecoConfigFormIdiomaPadraoResolvida = getEnderecoConfigForIdioma(enderecoConfigFormNormalizada, enderecoConfigFormIdiomaPadrao?.id);
    const buscaEnderecoConfigForm = normalizeAddressSearchConfig(enderecoConfigFormNormalizada.buscaEndereco);
    const municipiosBuscaEnderecoSelecionados = buscaEnderecoConfigForm.cidades;
    const municipioBuscaTextoNormalizado = normalizeAddressSearchCityKey(municipioBuscaEnderecoTexto);
    const municipiosBuscaEnderecoSugestoes = municipiosBuscaEndereco
        .filter((municipio) => !municipiosBuscaEnderecoSelecionados.some((cidade) => normalizeAddressSearchCityKey(cidade) === normalizeAddressSearchCityKey(municipio)))
        .filter((municipio) => !municipioBuscaTextoNormalizado || normalizeAddressSearchCityKey(municipio).includes(municipioBuscaTextoNormalizado))
        .slice(0, 8);
    const adminTabs = ADMIN_TABS.map((tab) => {
        if (tab.id === 'usuarios') {
            return {
                ...tab,
                badge: totalPendentes > 0 ? `${totalPendentes} pend.` : `${totalUsers}`
            };
        }

        if (tab.id === 'campanhas') {
            return {
                ...tab,
                badge: contextoSistema.campanhaAtiva ? 'ativa' : `${campanhas.length}`
            };
        }

        if (tab.id === 'padroes') {
            return {
                ...tab,
                badge: enderecoConfigIdiomasAtivos.length > 1
                    ? `${enderecoConfigIdiomasAtivos.length} idi.`
                    : enderecoConfig.idiomaPadraoId.toUpperCase()
            };
        }

        if (tab.id === 'comunicados') {
            return {
                ...tab,
                badge: `${totalDestinoComunicado}`
            };
        }

        return tab;
    });


    return (
        <AppPage>
                <PageHeader
                    eyebrow="Administração"
                    title="Painel de Controle"
                    subtitle="Usuários, campanhas e comunicados com uma visão limpa para decisões rápidas."
                    actions={(
                        <>
                            <div className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {isOnline ? 'Online' : 'Offline'}
                            </div>
                            <Link to="/app" className={buttonClass('secondary')}>
                                ← Voltar ao Mapa
                            </Link>
                        </>
                    )}
                />

                {!isOnline && (
                    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 shadow-sm">
                        {ADMIN_OFFLINE_MESSAGE}
                    </div>
                )}

                <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Dirigentes</p>
                            <p className="mt-1 text-lg font-black text-slate-800">{totalUsers}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Admins</p>
                            <p className="mt-1 text-lg font-black text-blue-700">{totalAdmins}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pendentes</p>
                            <p className={`mt-1 text-lg font-black ${totalPendentes > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>{totalPendentes}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Modo</p>
                            <p className="mt-1 truncate text-[13px] font-black text-violet-700">
                                {contextoSistema.campanhaAtiva ? contextoSistema.contextoAtivoTitulo : 'Pregação normal'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <div className="overflow-x-auto">
                        <div className="flex min-w-max gap-2">
                            {adminTabs.map((tab) => {
                                const ativa = activeTab === tab.id;

                                return (
                                    <button
                                        key={tab.id}
                                        id={`tab-${tab.id}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={ativa}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`min-w-[160px] rounded-xl border px-3 py-2 text-left transition-all ${ativa ? 'border-slate-900 bg-slate-900 text-white' : 'border-transparent bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${ativa ? 'bg-white/15' : 'bg-slate-100'}`}>
                                                    {tab.icon}
                                                </span>
                                                <p className="text-xs font-bold">{tab.label}</p>
                                            </div>
                                            {tab.badge ? (
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${ativa ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
                                                    {tab.badge}
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {activeTab === 'usuarios' && (
                <UsuariosTab
                    totalPendentes={totalPendentes}
                    usuariosPendentes={usuariosPendentes}
                    userRoleFilter={userRoleFilter}
                    setUserRoleFilter={setUserRoleFilter}
                    userSearch={userSearch}
                    setUserSearch={setUserSearch}
                    usuariosFiltrados={usuariosFiltrados}
                    totalUsers={totalUsers}
                    cadastroAberto={cadastroAberto}
                    setCadastroAberto={setCadastroAberto}
                    novoNome={novoNome}
                    setNovoNome={setNovoNome}
                    novoEmail={novoEmail}
                    setNovoEmail={setNovoEmail}
                    novoWhats={novoWhats}
                    setNovoWhats={setNovoWhats}
                    loadingAdd={loadingAdd}
                    handleAdicionar={handleAdicionar}
                    mudarRole={mudarRole}
                    remover={remover}
                    iniciarEdicao={iniciarEdicao}
                    cancelarEdicao={cancelarEdicao}
                    editandoId={editandoId}
                    dadosEditados={dadosEditados}
                    handleEditChange={handleEditChange}
                    salvarEdicao={salvarEdicao}
                    adminActionsDisabled={adminActionsDisabled}
                />
            )}

            {activeTab === 'padroes' && (
                <PadroesTab
                    enderecoConfig={enderecoConfig}
                    enderecoConfigForm={enderecoConfigForm}
                    setEnderecoConfigForm={setEnderecoConfigForm}
                    salvandoEnderecoConfig={salvandoEnderecoConfig}
                    salvarEnderecoConfig={salvarEnderecoConfig}
                    enderecoConfigFormIdiomaPadrao={enderecoConfigFormIdiomaPadrao}
                    enderecoConfigFormIdiomaPadraoResolvida={enderecoConfigFormIdiomaPadraoResolvida}
                    enderecoConfigFormIdiomasAtivos={enderecoConfigFormIdiomasAtivos}
                    enderecoConfigFormIdiomas={enderecoConfigFormIdiomas}
                    selecionarIdiomaPadraoEndereco={selecionarIdiomaPadraoEndereco}
                    adicionarEnderecoIdioma={adicionarEnderecoIdioma}
                    handleEnderecoIdiomaChange={handleEnderecoIdiomaChange}
                    removerEnderecoIdioma={removerEnderecoIdioma}
                    handleEnderecoConfigChange={handleEnderecoConfigChange}
                    salvarPlanilhaCsvUrl={salvarPlanilhaCsvUrl}
                    salvandoPlanilhaCsvUrl={salvandoPlanilhaCsvUrl}
                    verificarPlanilhaEnderecos={verificarPlanilhaEnderecos}
                    verificandoPlanilha={verificandoPlanilha}
                    inserirNovosEnderecosPlanilha={inserirNovosEnderecosPlanilha}
                    importandoPlanilha={importandoPlanilha}
                    enderecoCsvPreview={enderecoCsvPreview}
                    buscarPinsFaltantesPlanilha={buscarPinsFaltantesPlanilha}
                    buscandoPinsPlanilha={buscandoPinsPlanilha}
                    buscarPinLinhaPlanilha={buscarPinLinhaPlanilha}
                    enderecoCsvGeocodeStatus={enderecoCsvGeocodeStatus}
                    buscaEnderecoConfigForm={buscaEnderecoConfigForm}
                    aplicarPresetBuscaEnderecoRegional={aplicarPresetBuscaEnderecoRegional}
                    selecionarUfBuscaEndereco={selecionarUfBuscaEndereco}
                    atualizarBuscaEnderecoConfig={atualizarBuscaEnderecoConfig}
                    municipioBuscaEnderecoTexto={municipioBuscaEnderecoTexto}
                    setMunicipioBuscaEnderecoTexto={setMunicipioBuscaEnderecoTexto}
                    adicionarMunicipioBuscaEndereco={adicionarMunicipioBuscaEndereco}
                    removerMunicipioBuscaEndereco={removerMunicipioBuscaEndereco}
                    municipiosBuscaEnderecoSugestoes={municipiosBuscaEnderecoSugestoes}
                    calculandoAreaBuscaEndereco={calculandoAreaBuscaEndereco}
                    carregandoMunicipiosBuscaEndereco={carregandoMunicipiosBuscaEndereco}
                    adminActionsDisabled={adminActionsDisabled}
                />
            )}

            {activeTab === 'campanhas' && (
                <CampanhasTab
                    campanhas={campanhas}
                    campanhaTitulo={campanhaTitulo}
                    setCampanhaTitulo={setCampanhaTitulo}
                    campanhaSlug={campanhaSlug}
                    setCampanhaSlug={setCampanhaSlug}
                    salvandoCampanha={salvandoCampanha}
                    handleCriarCampanha={handleCriarCampanha}
                    ativarCampanha={ativarCampanha}
                    voltarModoNormal={voltarModoNormal}
                    abrirModalExclusaoCampanha={abrirModalExclusaoCampanha}
                    fecharModalExclusaoCampanha={fecharModalExclusaoCampanha}
                    campanhaParaExcluir={campanhaParaExcluir}
                    confirmacaoExclusao={confirmacaoExclusao}
                    setConfirmacaoExclusao={setConfirmacaoExclusao}
                    carregandoResumoExclusao={carregandoResumoExclusao}
                    registrosCampanhaParaExcluir={registrosCampanhaParaExcluir}
                    excluindoCampanha={excluindoCampanha}
                    excluirCampanha={excluirCampanha}
                    contextoSistema={contextoSistema}
                    adminActionsDisabled={adminActionsDisabled}
                />
            )}

            {activeTab === 'comunicados' && (
                <ComunicadosTab
                    comunicadoGeral={comunicadoGeral}
                    setComunicadoGeral={setComunicadoGeral}
                    destinoComunicado={destinoComunicado}
                    setDestinoComunicado={setDestinoComunicado}
                    enviandoComunicado={enviandoComunicado}
                    enviarComunicadoGeral={enviarComunicadoGeral}
                    totalDestinoComunicado={totalDestinoComunicado}
                    totalAprovados={totalAprovados}
                    totalAdmins={totalAdmins}
                    adminActionsDisabled={adminActionsDisabled}
                />
            )}
        </AppPage>
    );
};

export default AdminPanel;
