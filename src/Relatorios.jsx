import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { useSistema } from './useSistema';
import { getSistemaTheme } from './sistema';
import { useUiFeedback } from './uiFeedback';
import { AppPage, PageHeader } from './uiPrimitives';
import { buttonClass } from './uiClasses';
import { TERRITORIO_STATUS } from './territorioContext';
import {
    calculateGrupoEnderecoStats,
    ENDERECO_CLASSES,
    ENDERECO_STATUS,
    formatEnderecoCodigoExibicao,
    formatGrupoEnderecoCodigoExibicao,
    formatGrupoEnderecoNomeExibicao,
    getEnderecosCollectionRef,
    getGrupoEnderecoProgresso,
    getGruposEnderecoCollectionRef,
    GRUPO_ENDERECO_STATUS
} from './enderecoModel';
import { resolveBairroNomeOficial } from './bairrosSbs';

import {
    STATUS_ARQUIVADO,
    RELATORIO_TERRITORIOS,
    RELATORIO_ENDERECOS,
    FILTRO_TODOS,
    FILTRO_ARQUIVADOS_SEM,
    FILTRO_ARQUIVADOS_SOMENTE
} from './relatorios/constants/relatorioConstants';
import {
    toDateValue,
    formatDateValue,
    getDiasDesde,
    getGrupoEnderecoIdentityKey,
    getCodigoOrdenacao,
    getUltimaEdicaoTexto,
    processarHistorico,
    getGrupoEnderecoBoundsStr,
    getGrupoEnderecoCentro,
    getGrupoEnderecoStatusRelatorio,
    getGrupoEnderecoCanonicalKeys,
    getEnderecoClasseLabel,
    normalizeFiltroOptionValue,
    normalizeBairroFiltroValue,
    uniqueSortedOptions,
    getStatusArquivadoFiltroMatch,
    formatarTempo,
    getStatusVisual
} from './relatorios/utils/relatorioUtils';
import { gerarExportacaoPdfRelatorio } from './relatorios/utils/relatorioPdfExport';
import { FiltrosRelatorio } from './relatorios/components/FiltrosRelatorio';
import { RelatorioResultados } from './relatorios/components/RelatorioResultados';
const Relatorios = () => {
    const [territorios, setTerritorios] = useState([]);
    const [enderecosRelatorio, setEnderecosRelatorio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportandoPdf, setExportandoPdf] = useState(false);
    const [erroCarregamento, setErroCarregamento] = useState('');
    const [reloadSeq, setReloadSeq] = useState(0);
    const { config: contextoSistema, loading: carregandoSistema } = useSistema();
    const { notify } = useUiFeedback();
    const temaSistema = getSistemaTheme(contextoSistema);

    // --- ESTADO PARA MULTI-EXPANSÃO ---
    const [linhasExpandidas, setLinhasExpandidas] = useState([]);

    // --- ESTADOS DE FILTRO E ORDENAÇÃO ---
    const [relatorioAtivo, setRelatorioAtivo] = useState(RELATORIO_TERRITORIOS);
    const [busca, setBusca] = useState('');
    const [statusFiltro, setStatusFiltro] = useState(FILTRO_TODOS);
    const [tempoFiltro, setTempoFiltro] = useState(FILTRO_TODOS);
    const [idiomaFiltro, setIdiomaFiltro] = useState(FILTRO_TODOS);
    const [bairroFiltro, setBairroFiltro] = useState(FILTRO_TODOS);
    const [classeFiltro, setClasseFiltro] = useState(FILTRO_TODOS);
    const [arquivadosFiltro, setArquivadosFiltro] = useState(FILTRO_ARQUIVADOS_SEM);
    const [sortConfig, setSortConfig] = useState({ key: 'diasParado', direction: 'desc' });

    useEffect(() => {
        if (carregandoSistema) return;

        let ativo = true;

        const carregarDados = async () => {
            if (ativo) {
                setLoading(true);
                setErroCarregamento('');
            }
            try {
                const [
                    gruposEnderecoSnapshot,
                    enderecosSnapshot
                ] = await Promise.all([
                    getDocs(getGruposEnderecoCollectionRef(db)),
                    getDocs(getEnderecosCollectionRef(db))
                ]);

                const enderecos = enderecosSnapshot.docs.map((enderecoDoc) => ({
                    id: enderecoDoc.id,
                    ...enderecoDoc.data()
                }));
                const enderecosPorId = new Map(enderecos.map((endereco) => [endereco.id, endereco]));
                const enderecosPorGrupo = new Map();
                const enderecosAtivosPorGrupo = new Map();
                const addEnderecoGrupo = (mapa, endereco) => {
                    const key = getGrupoEnderecoIdentityKey(endereco.grupoId || endereco.grupoCodigo);
                    if (!key) return;
                    if (!mapa.has(key)) {
                        mapa.set(key, []);
                    }
                    mapa.get(key).push(endereco);
                };

                enderecos.forEach((endereco) => {
                    addEnderecoGrupo(enderecosPorGrupo, endereco);
                    if (endereco.status !== ENDERECO_STATUS.ARQUIVADO) {
                        addEnderecoGrupo(enderecosAtivosPorGrupo, endereco);
                    }
                });

                const gruposRegistrados = new Set();
                const gruposEnderecoDocs = gruposEnderecoSnapshot.docs.map((grupoDoc) => ({
                    id: grupoDoc.id,
                    ...grupoDoc.data()
                }));

                gruposEnderecoDocs.forEach((grupo) => {
                    getGrupoEnderecoCanonicalKeys(grupo).forEach((key) => gruposRegistrados.add(key));
                });

                const gruposSinteticos = [];
                enderecosAtivosPorGrupo.forEach((enderecosGrupo, grupoKey) => {
                    if (gruposRegistrados.has(grupoKey)) return;
                    const primeiroEndereco = enderecosGrupo[0] || {};
                    const codigo = primeiroEndereco.grupoCodigo || primeiroEndereco.grupoId || grupoKey;
                    gruposSinteticos.push({
                        id: grupoKey,
                        codigo,
                        nome: `Território ${formatGrupoEnderecoCodigoExibicao(codigo) || codigo}`,
                        status: GRUPO_ENDERECO_STATUS.ATIVO,
                        enderecoIds: enderecosGrupo.map((endereco) => endereco.id).filter(Boolean),
                        enderecos_visitados: [],
                        sintetico: true
                    });
                });

                const gruposEnderecoRelatorio = [...gruposEnderecoDocs, ...gruposSinteticos].map((grupo) => {
                    const enderecoIdsGrupo = Array.isArray(grupo.enderecoIds) ? grupo.enderecoIds : [];
                    const enderecosPorIds = enderecoIdsGrupo.map((enderecoId) => enderecosPorId.get(enderecoId)).filter(Boolean);
                    const enderecosPorChaves = getGrupoEnderecoCanonicalKeys(grupo)
                        .flatMap((key) => enderecosPorGrupo.get(key) || []);
                    const enderecosRelacionados = [...new Map(
                        [...enderecosPorIds, ...enderecosPorChaves].map((endereco) => [endereco.id, endereco])
                    ).values()];
                    const enderecosAtivosGrupo = enderecosRelacionados.filter((endereco) => endereco.status !== ENDERECO_STATUS.ARQUIVADO);
                    const statsRuntime = enderecosAtivosGrupo.length ? calculateGrupoEnderecoStats(enderecosAtivosGrupo) : null;
                    const grupoCompleto = statsRuntime ? { ...grupo, ...statsRuntime } : grupo;
                    const progresso = getGrupoEnderecoProgresso(grupoCompleto);
                    const statusOperacional = getGrupoEnderecoStatusRelatorio(grupoCompleto);
                    const totalEnderecos = progresso.totalEnderecos;
                    const visitadosExibicao = progresso.isFinalizado ? totalEnderecos : progresso.visitadosExibicao;
                    const porcentagem = progresso.isFinalizado && totalEnderecos > 0
                        ? 100
                        : progresso.percentualExibicao;
                    const statusVisual = getStatusVisual(statusOperacional, porcentagem);
                    const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
                    const nomeExibicao = formatGrupoEnderecoNomeExibicao(grupo.nome, grupo.codigo || grupo.id);
                    const dataUltimaObj = toDateValue(grupo.ultimaConclusao);
                    const dataCriacaoObj = toDateValue(grupo.criadoEm);
                    const nuncaTrabalhado = !dataUltimaObj;
                    const diasParado = dataUltimaObj
                        ? getDiasDesde(dataUltimaObj)
                        : (dataCriacaoObj ? getDiasDesde(dataCriacaoObj) : Number.POSITIVE_INFINITY);
                    const dataDesigObj = grupo.designadoPara ? toDateValue(grupo.dataDesignacao) : null;
                    const dataRefEdicao = toDateValue(grupo.ultimaAlteracao) || dataDesigObj;
                    const { diasSemEdicao, ultimaEdicaoTexto } = getUltimaEdicaoTexto({
                        dataRef: dataRefEdicao,
                        hasDesignacao: Boolean(grupo.designadoPara)
                    });
                    const centro = getGrupoEnderecoCentro(grupoCompleto);
                    const totalEstrangeiros = Math.max(0, Math.trunc(Number(grupoCompleto.totalEstrangeiros) || 0));
                    const idiomaId = normalizeFiltroOptionValue(grupoCompleto.idiomaId || enderecosRelacionados[0]?.idiomaId);
                    const idiomaNome = String(grupoCompleto.idiomaNome || enderecosRelacionados[0]?.idiomaNome || '').trim();
                    const bairrosGrupo = uniqueSortedOptions(
                        enderecosRelacionados,
                        (endereco) => endereco.bairro,
                        (endereco) => resolveBairroNomeOficial(endereco.bairro),
                        normalizeBairroFiltroValue
                    );
                    const bairro = String(resolveBairroNomeOficial(grupoCompleto.bairro || (bairrosGrupo.length === 1 ? bairrosGrupo[0].label : ''))).trim();
                    const bairroKey = normalizeBairroFiltroValue(bairro);
                    const classeOptions = uniqueSortedOptions(
                        enderecosRelacionados,
                        (endereco) => endereco.classe || ENDERECO_CLASSES.CONFIRMADO,
                        (endereco) => getEnderecoClasseLabel(endereco.classe || ENDERECO_CLASSES.CONFIRMADO)
                    );
                    const classeIds = classeOptions.map((option) => option.value);
                    const classeResumo = classeOptions.length
                        ? classeOptions.map((option) => option.label).join(', ')
                        : '-';
                    const totalEnderecosArquivados = enderecosRelacionados.filter((endereco) => endereco.status === ENDERECO_STATUS.ARQUIVADO).length;

                    return {
                        ...grupoCompleto,
                        id: `grupo_endereco__${grupo.id}`,
                        grupoDocId: grupo.id,
                        numeroId: codigoExibicao || grupo.id,
                        tipoRelatorio: 'grupo_endereco',
                        codigoOrdenacao: getCodigoOrdenacao(codigoExibicao || grupo.id),
                        nome: nomeExibicao,
                        idiomaId,
                        idiomaNome,
                        bairro,
                        bairroKey,
                        classeIds,
                        classeResumo,
                        lat: centro?.lat,
                        lng: centro?.lng,
                        diasParado,
                        nuncaTrabalhado,
                        diasSemEdicao,
                        ultimaEdicaoTexto,
                        totalEnderecos,
                        totalEstrangeiros,
                        porcentagem,
                        dataUltimaStr: formatDateValue(grupo.ultimaConclusao),
                        dataUltimaObj,
                        dataDesigStr: dataDesigObj ? dataDesigObj.toLocaleDateString('pt-BR') : '-',
                        dataDesigObj,
                        historicoLista: processarHistorico(grupo.historico),
                        status: statusOperacional,
                        statusLabel: statusVisual.label,
                        statusBadgeClass: statusVisual.badgeClass,
                        statusDetailClass: statusVisual.detailClass,
                        statusStyle: statusVisual.style,
                        progressoTexto: `${visitadosExibicao}/${totalEnderecos} endereços`,
                        resumoOperacional: `${totalEnderecos} endereço${totalEnderecos === 1 ? '' : 's'} ativo${totalEnderecos === 1 ? '' : 's'} | ${totalEstrangeiros} pessoa${totalEstrangeiros === 1 ? '' : 's'}`,
                        totalEnderecosCadastrados: enderecosRelacionados.length,
                        totalEnderecosArquivados,
                        boundsStr: getGrupoEnderecoBoundsStr(grupoCompleto)
                    };
                });

                const gruposPorChave = new Map();
                gruposEnderecoRelatorio.forEach((grupo) => {
                    [
                        grupo.grupoDocId,
                        grupo.codigo,
                        grupo.numeroId
                    ].filter(Boolean).forEach((value) => {
                        gruposPorChave.set(getGrupoEnderecoIdentityKey(value), grupo);
                    });
                });

                const enderecosRelatorioLista = enderecos.map((endereco) => {
                    const codigoExibicao = formatEnderecoCodigoExibicao(endereco.codigo || endereco.id);
                    const statusArquivado = endereco.status === ENDERECO_STATUS.ARQUIVADO;
                    const classe = normalizeFiltroOptionValue(endereco.classe || ENDERECO_CLASSES.CONFIRMADO);
                    const grupoKey = getGrupoEnderecoIdentityKey(endereco.grupoId || endereco.grupoCodigo);
                    const grupo = grupoKey ? gruposPorChave.get(grupoKey) : null;
                    const dataUltimaObj = toDateValue(endereco.atualizadoEm) || toDateValue(endereco.criadoEm);
                    const idiomaNome = String(endereco.idiomaNome || '').trim();
                    const bairro = String(resolveBairroNomeOficial(endereco.bairro)).trim();
                    const bairroKey = normalizeBairroFiltroValue(bairro);
                    const totalEstrangeiros = Math.max(0, Math.trunc(Number(endereco.quantidadeEstrangeiros) || 0));

                    return {
                        id: `endereco__${endereco.id}`,
                        enderecoDocId: endereco.id,
                        tipoRelatorio: 'endereco',
                        numeroId: codigoExibicao || endereco.codigo || endereco.id,
                        codigoOrdenacao: getCodigoOrdenacao(codigoExibicao || endereco.codigo || endereco.id),
                        nome: endereco.endereco || `Endereço ${codigoExibicao || endereco.id}`,
                        enderecoTexto: endereco.endereco || '-',
                        informacao: endereco.informacao || endereco.observacao || '',
                        idiomaId: normalizeFiltroOptionValue(endereco.idiomaId),
                        idiomaNome,
                        bairro,
                        bairroKey,
                        classeIds: [classe],
                        classeResumo: getEnderecoClasseLabel(classe),
                        status: statusArquivado ? STATUS_ARQUIVADO : ENDERECO_STATUS.ATIVO,
                        statusLabel: statusArquivado ? 'Arquivado' : 'Ativo',
                        statusBadgeClass: statusArquivado
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : 'bg-teal-100 text-teal-700 border border-teal-200',
                        statusDetailClass: statusArquivado ? 'text-slate-500' : 'text-teal-700',
                        statusStyle: null,
                        lat: endereco.lat,
                        lng: endereco.lng,
                        grupoCodigo: endereco.grupoCodigo || grupo?.numeroId || '',
                        grupoNome: grupo?.nome || '',
                        designadoNome: grupo?.designadoNome || endereco.grupoDesignadoPara || '',
                        dataDesigStr: grupo?.dataDesigStr || '-',
                        dataDesigObj: grupo?.dataDesigObj || null,
                        dataUltimaStr: formatDateValue(dataUltimaObj),
                        dataUltimaObj,
                        diasParado: dataUltimaObj ? getDiasDesde(dataUltimaObj) : Number.POSITIVE_INFINITY,
                        nuncaTrabalhado: !dataUltimaObj,
                        diasSemEdicao: 0,
                        ultimaEdicaoTexto: dataUltimaObj ? formatarTempo(getDiasDesde(dataUltimaObj)) : 'Sem dados',
                        totalEnderecos: 1,
                        totalEstrangeiros,
                        porcentagem: statusArquivado ? 0 : 100,
                        progressoTexto: `${totalEstrangeiros} pessoa${totalEstrangeiros === 1 ? '' : 's'}`,
                        resumoOperacional: `${idiomaNome || 'Idioma não informado'} | ${bairro || 'Bairro não informado'} | ${getEnderecoClasseLabel(classe)}`,
                        historicoLista: [],
                        boundsStr: null
                    };
                });

                if (ativo) {
                    setTerritorios(gruposEnderecoRelatorio);
                    setEnderecosRelatorio(enderecosRelatorioLista);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                if (ativo) {
                    setTerritorios([]);
                    setEnderecosRelatorio([]);
                    setErroCarregamento(String(error?.message || 'Não foi possível carregar o relatório agora.'));
                    setLoading(false);
                }
            }
        };

        carregarDados();

        return () => {
            ativo = false;
        };
    }, [carregandoSistema, reloadSeq]);

    const toggleLinha = (id) => {
        setLinhasExpandidas(prev => {
            if (prev.includes(id)) return prev.filter(item => item !== id);
            else return [...prev, id];
        });
    };

    const toggleTodas = () => {
        const todosVisiveisIds = dadosProcessados.map(t => t.id);
        const todasAbertas = todosVisiveisIds.every(id => linhasExpandidas.includes(id));
        if (todasAbertas) setLinhasExpandidas([]);
        else setLinhasExpandidas(todosVisiveisIds);
    };

    const limparFiltros = () => {
        setBusca('');
        setStatusFiltro(FILTRO_TODOS);
        setTempoFiltro(FILTRO_TODOS);
        setIdiomaFiltro(FILTRO_TODOS);
        setBairroFiltro(FILTRO_TODOS);
        setClasseFiltro(FILTRO_TODOS);
        setArquivadosFiltro(FILTRO_ARQUIVADOS_SEM);
        setSortConfig({ key: 'diasParado', direction: 'desc' });
        setLinhasExpandidas([]);
    };

    const trocarRelatorio = (tipo) => {
        setRelatorioAtivo(tipo);
        setStatusFiltro(FILTRO_TODOS);
        setTempoFiltro(FILTRO_TODOS);
        setLinhasExpandidas([]);
        setSortConfig(tipo === RELATORIO_ENDERECOS
            ? { key: 'numeroId', direction: 'asc' }
            : { key: 'diasParado', direction: 'desc' });
    };

    const alterarStatusFiltro = (value) => {
        setStatusFiltro(value);
        if (value === STATUS_ARQUIVADO) {
            setArquivadosFiltro(FILTRO_ARQUIVADOS_SOMENTE);
        } else if (arquivadosFiltro === FILTRO_ARQUIVADOS_SOMENTE) {
            setArquivadosFiltro(FILTRO_ARQUIVADOS_SEM);
        }
    };

    const alterarArquivadosFiltro = (value) => {
        setArquivadosFiltro(value);
        if (value === FILTRO_ARQUIVADOS_SOMENTE && statusFiltro !== STATUS_ARQUIVADO) {
            setStatusFiltro(FILTRO_TODOS);
        }
        if (value === FILTRO_ARQUIVADOS_SEM && statusFiltro === STATUS_ARQUIVADO) {
            setStatusFiltro(FILTRO_TODOS);
        }
    };

    const aplicarFiltroRapido = (tipo) => {
        limparFiltros();
        if (tipo === 'total') setArquivadosFiltro(FILTRO_TODOS);
        if (tipo === 'livre') setStatusFiltro('livre');
        if (tipo === 'ocupado') setStatusFiltro('ocupado');
        if (tipo === 'aguardando_finalizacao') setStatusFiltro(TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO);
        if (tipo === 'finalizado') setStatusFiltro(TERRITORIO_STATUS.FINALIZADO);
        if (tipo === STATUS_ARQUIVADO) {
            setStatusFiltro(STATUS_ARQUIVADO);
            setArquivadosFiltro(FILTRO_ARQUIVADOS_SOMENTE);
        }
        if (tipo === 'criticos') setTempoFiltro('4_meses');
    };

    const dadosBase = relatorioAtivo === RELATORIO_ENDERECOS ? enderecosRelatorio : territorios;
    const opcoesIdioma = uniqueSortedOptions([...territorios, ...enderecosRelatorio], (item) => item.idiomaId, (item) => item.idiomaNome || item.idiomaId);
    const opcoesBairro = uniqueSortedOptions(
        [...territorios, ...enderecosRelatorio],
        (item) => item.bairro,
        (item) => resolveBairroNomeOficial(item.bairro),
        normalizeBairroFiltroValue
    );
    const opcoesClasse = Object.values(ENDERECO_CLASSES).map((classe) => ({
        value: classe,
        label: getEnderecoClasseLabel(classe)
    }));

    const dadosProcessados = (() => {
        let dados = [...dadosBase];
        if (statusFiltro !== FILTRO_TODOS) dados = dados.filter(t => t.status === statusFiltro);
        dados = dados.filter(t => getStatusArquivadoFiltroMatch(t, arquivadosFiltro));
        if (idiomaFiltro !== FILTRO_TODOS) dados = dados.filter(t => normalizeFiltroOptionValue(t.idiomaId) === idiomaFiltro);
        if (bairroFiltro !== FILTRO_TODOS) dados = dados.filter(t => t.bairroKey === bairroFiltro);
        if (classeFiltro !== FILTRO_TODOS) dados = dados.filter(t => Array.isArray(t.classeIds) && t.classeIds.includes(classeFiltro));
        if (tempoFiltro === '2_meses') dados = dados.filter(t => t.diasParado > 60);
        if (tempoFiltro === '4_meses') dados = dados.filter(t => t.diasParado > 120);
        if (tempoFiltro === '6_meses') dados = dados.filter(t => t.diasParado > 180);

        if (busca) {
            const termo = busca.toLowerCase();
            dados = dados.filter(t => {
                const nomeLower = t.nome ? t.nome.toLowerCase() : '';
                const idString = t.numeroId ? t.numeroId.toString() : '';
                const responsavelLower = t.designadoNome ? t.designadoNome.toLowerCase() : '';
                const bairroLower = t.bairro ? t.bairro.toLowerCase() : '';
                const bairroKeyLower = t.bairroKey || '';
                const idiomaLower = t.idiomaNome ? t.idiomaNome.toLowerCase() : '';
                const classeLower = t.classeResumo ? t.classeResumo.toLowerCase() : '';
                const enderecoLower = t.enderecoTexto ? t.enderecoTexto.toLowerCase() : '';
                return nomeLower.includes(termo) ||
                    idString.includes(termo) ||
                    responsavelLower.includes(termo) ||
                    bairroLower.includes(termo) ||
                    bairroKeyLower.includes(normalizeBairroFiltroValue(termo)) ||
                    idiomaLower.includes(termo) ||
                    classeLower.includes(termo) ||
                    enderecoLower.includes(termo);
            });
        }

        if (sortConfig.key) {
            dados.sort((a, b) => {
                let aValue = sortConfig.key === 'numeroId' ? a.codigoOrdenacao : a[sortConfig.key];
                let bValue = sortConfig.key === 'numeroId' ? b.codigoOrdenacao : b[sortConfig.key];
                if (aValue === null || aValue === undefined || aValue === '-') return 1;
                if (bValue === null || bValue === undefined || bValue === '-') return -1;
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return dados;
    })();

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <span className="text-gray-300 ml-1 text-[10px]">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1 text-[10px]">▲</span> : <span className="text-blue-600 ml-1 text-[10px]">▼</span>;
    };

    const total = dadosBase.length;
    const ocupados = territorios.filter(t => t.status === 'ocupado' || t.status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO).length;
    const livres = territorios.filter(t => t.status === 'livre').length;
    const finalizados = territorios.filter(t => t.status === TERRITORIO_STATUS.FINALIZADO).length;
    const arquivados = dadosBase.filter(t => t.status === STATUS_ARQUIVADO).length;
    const enderecosAtivos = enderecosRelatorio.filter(t => t.status !== STATUS_ARQUIVADO).length;
    const pessoasFiltradas = dadosProcessados.reduce((totalPessoas, item) => totalPessoas + (Number(item.totalEstrangeiros) || 0), 0);
    const filtrosAtivos = busca ||
        statusFiltro !== FILTRO_TODOS ||
        tempoFiltro !== FILTRO_TODOS ||
        idiomaFiltro !== FILTRO_TODOS ||
        bairroFiltro !== FILTRO_TODOS ||
        classeFiltro !== FILTRO_TODOS ||
        arquivadosFiltro !== FILTRO_ARQUIVADOS_SEM;
    // --- PDF ---
    const exportarPDF = async () => {
        if (exportandoPdf) return;
        await gerarExportacaoPdfRelatorio({
            relatorioAtivo,
            dadosProcessados,
            tempoFiltro,
            busca,
            arquivadosFiltro,
            statusFiltro,
            idiomaFiltro,
            bairroFiltro,
            classeFiltro,
            notify,
            setExportandoPdf
        });
    };

    if (loading || carregandoSistema) return <div className="flex h-screen items-center justify-center bg-slate-50 text-blue-600 font-bold">Carregando dados...</div>;

    return (
        <AppPage>
                <PageHeader
                    eyebrow="Relatórios"
                    title={relatorioAtivo === RELATORIO_ENDERECOS ? 'Relatório de Endereços' : 'Relatório de Territórios'}
                    subtitle="Filtre a base administrativa por idioma, bairro, classe e arquivamento sem alterar os fluxos operacionais."
                    chips={(
                        <>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                                <span>Relatório:</span>
                                <span>{relatorioAtivo === RELATORIO_ENDERECOS ? 'Endereços cadastrados' : 'Territórios de idiomas'}</span>
                            </span>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${temaSistema.panelBg} ${temaSistema.panelText} ${temaSistema.panelBorder}`}>
                                <span>Fonte</span>
                                <span>Firestore atual</span>
                            </span>
                        </>
                    )}
                    actions={(
                        <>
                        <Link 
                            to="/app" 
                            className={buttonClass('secondary', 'order-1 sm:order-2')}
                        >
                            ← Voltar ao Mapa
                        </Link>
                        <button 
                            onClick={exportarPDF} 
                            disabled={exportandoPdf}
                            className={buttonClass('dangerSoft', 'group order-2 disabled:cursor-wait sm:order-1')}
                            title={exportandoPdf ? "Gerando PDF..." : "Baixar Relatório em PDF"}
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-red-200">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M14.25 3.75H7.5a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V8.25l-3.75-4.5Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M14.25 3.75v4.5H18" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="m12 10.5 2.25 2.25L12 15m2.25-2.25H8.75" />
                                </svg>
                            </span>
                            <span className="min-w-0 flex-1 text-center">
                                <span className="flex items-center justify-center gap-2">
                                    <span className="text-sm font-extrabold tracking-[0.06em] uppercase">Baixar PDF</span>
                                    <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-600">
                                        PDF
                                    </span>
                                </span>
                                <span className="mt-0.5 block text-xs font-medium text-red-600/80">
                                    {exportandoPdf ? 'Gerando arquivo...' : 'Exportar relatório atual'}
                                </span>
                            </span>
                        </button>
                        </>
                    )}
                />

                <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <button
                        type="button"
                        onClick={() => trocarRelatorio(RELATORIO_TERRITORIOS)}
                        className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${relatorioAtivo === RELATORIO_TERRITORIOS ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        Territórios
                        <span className="ml-2 rounded-md bg-white/20 px-2 py-0.5 text-xs">{territorios.length}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => trocarRelatorio(RELATORIO_ENDERECOS)}
                        className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${relatorioAtivo === RELATORIO_ENDERECOS ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        Endereços
                        <span className="ml-2 rounded-md bg-white/20 px-2 py-0.5 text-xs">{enderecosRelatorio.length}</span>
                    </button>
                </div>

                {erroCarregamento && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-bold">Não foi possível carregar o relatório.</p>
                                <p className="mt-1 text-red-600">{erroCarregamento}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReloadSeq((value) => value + 1)}
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-100"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    </div>
                )}

                <FiltrosRelatorio
                    relatorioAtivo={relatorioAtivo}
                    trocarRelatorio={trocarRelatorio}
                    total={total}
                    territorios={territorios}
                    ocupados={ocupados}
                    enderecosAtivos={enderecosAtivos}
                    enderecosRelatorio={enderecosRelatorio}
                    pessoasFiltradas={pessoasFiltradas}
                    finalizados={finalizados}
                    arquivados={arquivados}
                    livres={livres}
                    aplicarFiltroRapido={aplicarFiltroRapido}
                    busca={busca}
                    setBusca={setBusca}
                    statusFiltro={statusFiltro}
                    alterarStatusFiltro={alterarStatusFiltro}
                    idiomaFiltro={idiomaFiltro}
                    setIdiomaFiltro={setIdiomaFiltro}
                    opcoesIdioma={opcoesIdioma}
                    bairroFiltro={bairroFiltro}
                    setBairroFiltro={setBairroFiltro}
                    opcoesBairro={opcoesBairro}
                    classeFiltro={classeFiltro}
                    setClasseFiltro={setClasseFiltro}
                    opcoesClasse={opcoesClasse}
                    arquivadosFiltro={arquivadosFiltro}
                    alterarArquivadosFiltro={alterarArquivadosFiltro}
                    filtrosAtivos={filtrosAtivos}
                    limparFiltros={limparFiltros}
                    dadosProcessados={dadosProcessados}
                />

                <RelatorioResultados
                    dadosProcessados={dadosProcessados}
                    linhasExpandidas={linhasExpandidas}
                    relatorioAtivo={relatorioAtivo}
                    toggleLinha={toggleLinha}
                    toggleTodas={toggleTodas}
                    handleSort={handleSort}
                    getSortIcon={getSortIcon}
                />
        </AppPage>
    );
};

export default Relatorios;
