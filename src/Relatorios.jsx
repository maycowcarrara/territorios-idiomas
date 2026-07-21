import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { exportarPdfParaDispositivo } from './pdfExport';
import { buildPublicAppRouteUrl } from './publicAppUrl';
import { useSistema } from './useSistema';
import { getSistemaTheme } from './sistema';
import { useUiFeedback } from './uiFeedback';
import { AppPage, PageHeader } from './uiPrimitives';
import { buttonClass, cardBaseClass, cn } from './uiClasses';
import { TERRITORIO_STATUS } from './territorioContext';
import {
    calculateGrupoEnderecoStats,
    ENDERECO_STATUS,
    formatGrupoEnderecoCodigoExibicao,
    formatGrupoEnderecoNomeExibicao,
    getEnderecosCollectionRef,
    getGrupoEnderecoProgresso,
    getGruposEnderecoCollectionRef,
    GRUPO_ENDERECO_STATUS
} from './enderecoModel';

const STATUS_ARQUIVADO = 'arquivado';

const toDateValue = (value) => {
    if (!value) return null;
    const date = value.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateValue = (value) => {
    const date = toDateValue(value);
    return date ? date.toLocaleDateString('pt-BR') : '-';
};

const getDiasDesde = (date) => {
    if (!date) return 0;
    return Math.ceil(Math.abs(new Date() - date) / (1000 * 60 * 60 * 24));
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const getGrupoEnderecoIdentityKey = (value) => {
    const texto = normalizeKey(value);
    const match = texto.match(/^(?:t-|g_)?0*(\d+)$/i);
    return match ? `n:${Number.parseInt(match[1], 10)}` : texto;
};

const getCodigoOrdenacao = (value) => {
    const match = String(value || '').match(/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

const getUltimaEdicaoTexto = ({ dataRef, hasDesignacao }) => {
    if (!hasDesignacao) return { diasSemEdicao: 0, ultimaEdicaoTexto: 'Sem dados' };

    const referencia = dataRef || new Date();
    const diferencaMs = Math.abs(new Date() - referencia);
    const diferencaMinutos = Math.floor(diferencaMs / (1000 * 60));
    const diferencaHoras = Math.floor(diferencaMs / (1000 * 60 * 60));
    const diasSemEdicao = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

    if (diferencaMinutos < 2) {
        return { diasSemEdicao, ultimaEdicaoTexto: 'agora mesmo' };
    }

    if (diferencaMinutos < 60) {
        return { diasSemEdicao, ultimaEdicaoTexto: `há ${diferencaMinutos} min` };
    }

    if (diferencaHoras < 24) {
        return { diasSemEdicao, ultimaEdicaoTexto: `há ${diferencaHoras} h` };
    }

    if (diasSemEdicao === 1) {
        return { diasSemEdicao, ultimaEdicaoTexto: 'ontem' };
    }

    return { diasSemEdicao, ultimaEdicaoTexto: `há ${diasSemEdicao} dias` };
};

const processarHistorico = (historico) => {
    if (!Array.isArray(historico)) return [];

    return historico
        .map((item) => {
            const inicio = toDateValue(item.dataInicio) || toDateValue(item.dataRetirada) || new Date();
            const fim = toDateValue(item.dataTermino) || toDateValue(item.dataDevolucao) || new Date();
            const listaNomes = Array.isArray(item.responsaveis)
                ? item.responsaveis.join(', ')
                : (item.responsavel || 'Desconhecido');

            return {
                nomes: listaNomes,
                inicio: inicio && !Number.isNaN(inicio.getTime()) ? inicio.toLocaleDateString('pt-BR') : '?',
                termino: fim && !Number.isNaN(fim.getTime()) ? fim.toLocaleDateString('pt-BR') : '?',
                timestampFim: fim || new Date(0)
            };
        })
        .sort((a, b) => b.timestampFim - a.timestampFim)
        .slice(0, 10);
};

const getGrupoEnderecoBoundsStr = (grupo) => {
    const bounds = grupo?.bounds;
    if (!bounds) return null;

    const { minLat, minLng, maxLat, maxLng } = bounds;
    if (![minLat, minLng, maxLat, maxLng].every((value) => Number.isFinite(Number(value)))) {
        return null;
    }

    return `${minLat},${minLng},${maxLat},${maxLng}`;
};

const getGrupoEnderecoCentro = (grupo) => {
    const lat = Number(grupo?.centro?.lat);
    const lng = Number(grupo?.centro?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
    }

    const bounds = grupo?.bounds;
    if (!bounds) return null;

    const minLat = Number(bounds.minLat);
    const minLng = Number(bounds.minLng);
    const maxLat = Number(bounds.maxLat);
    const maxLng = Number(bounds.maxLng);
    if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) {
        return null;
    }

    return {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2
    };
};

const getGrupoEnderecoStatusRelatorio = (grupo) => {
    const status = grupo?.status || GRUPO_ENDERECO_STATUS.ATIVO;
    if (status === GRUPO_ENDERECO_STATUS.ARQUIVADO) return STATUS_ARQUIVADO;
    if (status === GRUPO_ENDERECO_STATUS.FINALIZADO) return TERRITORIO_STATUS.FINALIZADO;
    if (grupo?.designadoPara && getGrupoEnderecoProgresso(grupo).completo) {
        return TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO;
    }
    return grupo?.designadoPara ? 'ocupado' : 'livre';
};

const getGrupoEnderecoCanonicalKeys = (grupo) => [
    getGrupoEnderecoIdentityKey(grupo?.id),
    getGrupoEnderecoIdentityKey(grupo?.codigo)
].filter(Boolean);

const buildMapaLinkSearch = (registro) => {
    if (registro.boundsStr) {
        return `bounds=${encodeURIComponent(registro.boundsStr)}`;
    }

    if (Number.isFinite(Number(registro.lat)) && Number.isFinite(Number(registro.lng))) {
        return new URLSearchParams({
            lat: String(registro.lat),
            lng: String(registro.lng),
            z: '17'
        }).toString();
    }

    return '';
};

const Relatorios = () => {
    const [territorios, setTerritorios] = useState([]);
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
    const [busca, setBusca] = useState('');
    const [statusFiltro, setStatusFiltro] = useState('todos');
    const [tempoFiltro, setTempoFiltro] = useState('todos');
    const [sortConfig, setSortConfig] = useState({ key: 'diasParado', direction: 'desc' });

    const getStatusVisual = (status, porcentagem) => {
        if (status === STATUS_ARQUIVADO) {
            return {
                label: 'Arquivado',
                badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
                detailClass: 'text-slate-500',
                style: null,
                progressoTexto: 'Fora do mapa padrão'
            };
        }

        if (status === TERRITORIO_STATUS.FINALIZADO) {
            return {
                label: 'Finalizado',
                badgeClass: 'bg-green-100 text-green-700 border border-green-200',
                detailClass: 'text-green-600',
                style: null,
                progressoTexto: 'Concluído oficialmente'
            };
        }

        if (status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO) {
            return {
                label: 'Aguardando',
                badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
                detailClass: 'text-yellow-700',
                style: null,
                progressoTexto: '100% aguardando confirmação'
            };
        }

        if (status === 'ocupado') {
            return {
                label: 'Ocupado',
                badgeClass: null,
                detailClass: 'text-slate-400',
                style: {
                    background: `linear-gradient(90deg, #15803d ${porcentagem}%, #3b82f6 ${porcentagem}%)`,
                    textShadow: '0px 1px 1px rgba(0,0,0,0.3)'
                },
                progressoTexto: `${porcentagem}% concluído`
            };
        }

        return {
            label: 'Livre',
            badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
            detailClass: 'text-slate-400',
            style: null,
            progressoTexto: 'Disponível'
        };
    };

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
                    getDocs(query(
                        getEnderecosCollectionRef(db),
                        where('status', '==', ENDERECO_STATUS.ATIVO)
                    ))
                ]);

                const enderecos = enderecosSnapshot.docs.map((enderecoDoc) => ({
                    id: enderecoDoc.id,
                    ...enderecoDoc.data()
                }));
                const enderecosPorGrupo = new Map();

                enderecos.forEach((endereco) => {
                    if (endereco.status === ENDERECO_STATUS.ARQUIVADO) return;
                    const key = getGrupoEnderecoIdentityKey(endereco.grupoId || endereco.grupoCodigo);
                    if (!key) return;
                    if (!enderecosPorGrupo.has(key)) {
                        enderecosPorGrupo.set(key, []);
                    }
                    enderecosPorGrupo.get(key).push(endereco);
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
                enderecosPorGrupo.forEach((enderecosGrupo, grupoKey) => {
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
                    const enderecosGrupo = getGrupoEnderecoCanonicalKeys(grupo)
                        .flatMap((key) => enderecosPorGrupo.get(key) || []);
                    const enderecosUnicos = [...new Map(enderecosGrupo.map((endereco) => [endereco.id, endereco])).values()];
                    const statsRuntime = enderecosUnicos.length ? calculateGrupoEnderecoStats(enderecosUnicos) : null;
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

                    return {
                        id: `grupo_endereco__${grupo.id}`,
                        numeroId: codigoExibicao || grupo.id,
                        ...grupoCompleto,
                        tipoRelatorio: 'grupo_endereco',
                        codigoOrdenacao: getCodigoOrdenacao(codigoExibicao || grupo.id),
                        nome: nomeExibicao,
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
                        resumoOperacional: `${totalEnderecos} endereço${totalEnderecos === 1 ? '' : 's'} | ${totalEstrangeiros} pessoa${totalEstrangeiros === 1 ? '' : 's'}`,
                        boundsStr: getGrupoEnderecoBoundsStr(grupoCompleto)
                    };
                });

                const lista = gruposEnderecoRelatorio;

                if (ativo) {
                    setTerritorios(lista);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                if (ativo) {
                    setTerritorios([]);
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

    const formatarTempo = (dias) => {
        if (!Number.isFinite(Number(dias))) return "Nunca";
        if (dias === 0) return "Hoje";
        if (dias < 30) return `${dias} dias`;
        const meses = Math.floor(dias / 30);
        const restoDias = dias % 30;
        let texto = `${meses} ${meses > 1 ? 'meses' : 'mês'}`;
        if (restoDias > 0) texto += ` e ${restoDias} ${restoDias > 1 ? 'dias' : 'dia'}`;
        return texto;
    };

    const formatarTempoTerritorio = (territorio) => (
        territorio?.nuncaTrabalhado ? 'Nunca' : formatarTempo(territorio?.diasParado || 0)
    );

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
        setStatusFiltro('todos');
        setTempoFiltro('todos');
        setSortConfig({ key: 'diasParado', direction: 'desc' });
        setLinhasExpandidas([]);
    };

    const aplicarFiltroRapido = (tipo) => {
        limparFiltros();
        if (tipo === 'livre') setStatusFiltro('livre');
        if (tipo === 'ocupado') setStatusFiltro('ocupado');
        if (tipo === 'aguardando_finalizacao') setStatusFiltro(TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO);
        if (tipo === 'finalizado') setStatusFiltro(TERRITORIO_STATUS.FINALIZADO);
        if (tipo === STATUS_ARQUIVADO) setStatusFiltro(STATUS_ARQUIVADO);
        if (tipo === 'criticos') setTempoFiltro('4_meses');
    };

    const dadosProcessados = (() => {
        let dados = [...territorios];
        if (statusFiltro !== 'todos') dados = dados.filter(t => t.status === statusFiltro);
        if (tempoFiltro === '2_meses') dados = dados.filter(t => t.diasParado > 60);
        if (tempoFiltro === '4_meses') dados = dados.filter(t => t.diasParado > 120);
        if (tempoFiltro === '6_meses') dados = dados.filter(t => t.diasParado > 180);

        if (busca) {
            const termo = busca.toLowerCase();
            dados = dados.filter(t => {
                const nomeLower = t.nome ? t.nome.toLowerCase() : '';
                const idString = t.numeroId ? t.numeroId.toString() : '';
                const responsavelLower = t.designadoNome ? t.designadoNome.toLowerCase() : '';
                return nomeLower.includes(termo) || idString.includes(termo) || responsavelLower.includes(termo);
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

    const total = territorios.length;
    const ocupados = territorios.filter(t => t.status === 'ocupado' || t.status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO).length;
    const livres = territorios.filter(t => t.status === 'livre').length;
    const finalizados = territorios.filter(t => t.status === TERRITORIO_STATUS.FINALIZADO).length;
    const arquivados = territorios.filter(t => t.status === STATUS_ARQUIVADO).length;
    const getCorTempo = (dias) => {
        if (!Number.isFinite(Number(dias))) return 'bg-orange-600 text-white';
        if (dias > 180) return 'bg-orange-600 text-white';
        if (dias > 120) return 'bg-orange-500 text-white';
        if (dias > 60) return 'bg-orange-300 text-orange-900';
        if (dias > 0) return 'bg-orange-100 text-orange-800';
        return 'bg-slate-100 text-slate-500';
    };

    // --- PDF ---
    const exportarPDF = async () => {
        if (exportandoPdf) return;

        setExportandoPdf(true);
        try {
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable')
            ]);

            const doc = new jsPDF();
            const tituloRelatorio = 'Relatório de Territórios de Idiomas';

            doc.setFontSize(18);
            doc.text(tituloRelatorio, 14, 20);
            doc.setFontSize(10);
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
            doc.text('Fonte: endereços e territórios cadastrados', 14, 31);

            doc.setFontSize(8);
            doc.setTextColor(100);

            let textoTempoFiltro = "Todos";
            if (tempoFiltro === '2_meses') textoTempoFiltro = "+2 Meses";
            if (tempoFiltro === '4_meses') textoTempoFiltro = "+4 Meses";
            if (tempoFiltro === '6_meses') textoTempoFiltro = "+6 Meses";

            const textoFiltro = busca ? `Busca: "${busca}"` : "Sem busca";
            doc.text(`Filtros: Status (${statusFiltro}) | Tempo (${textoTempoFiltro}) | ${textoFiltro}`, 14, 36);

            const tableColumn = ["Cód.", "Nome", "Status", "Progresso", "Histórico / Ciclos", "Ult. Conclusão", "Tempo Parado"];
            const tableRows = [];

            dadosProcessados.forEach(t => {
                let textoHistorico = "";
                let statusTexto = 'Livre';

                if (t.status === 'ocupado') {
                    statusTexto = `Em andamento (${t.porcentagem}%) - Ult. Ed: ${t.ultimaEdicaoTexto}`;
                    let atuais = t.designadoNome;
                    if (t.cicloAtual && Array.isArray(t.cicloAtual.responsaveis)) {
                        atuais = t.cicloAtual.responsaveis.join(", ");
                    }
                    textoHistorico += `[EM ANDAMENTO]\nDirigentes: ${atuais}\nDesde: ${t.dataDesigStr}\n\n`;
                } else if (t.status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO) {
                    statusTexto = `Aguardando finalização (100%) - Ult. Ed: ${t.ultimaEdicaoTexto}`;
                    textoHistorico += `[AGUARDANDO FINALIZACAO]\nDirigente: ${t.designadoNome || '-'}\nDesde: ${t.dataDesigStr}\n\n`;
                } else if (t.status === TERRITORIO_STATUS.FINALIZADO) {
                    statusTexto = `Finalizado em ${t.dataUltimaStr}`;
                    textoHistorico += `[FINALIZADO]\nUltima conclusao: ${t.dataUltimaStr}\n\n`;
                } else if (t.status === STATUS_ARQUIVADO) {
                    statusTexto = 'Arquivado';
                    textoHistorico += `[ARQUIVADO]\n${t.resumoOperacional || 'Fora do mapa padrão'}\n\n`;
                } else {
                    textoHistorico += "LIVRE\n";
                }

                if (t.resumoOperacional) {
                    textoHistorico += `Resumo: ${t.resumoOperacional}\n`;
                }

                if (t.historicoLista && t.historicoLista.length > 0) {
                    textoHistorico += "-- HISTÓRICO --\n";
                    t.historicoLista.forEach(h => {
                        textoHistorico += `• Início: ${h.inicio} - Dirigentes: ${h.nomes} - Término: ${h.termino}\n`;
                    });
                } else {
                    textoHistorico += "\n(Sem histórico)";
                }

                const mapSearch = buildMapaLinkSearch(t);
                const hasLink = !!mapSearch;

                tableRows.push([
                    t.numeroId,
                    { content: t.nome, styles: { textColor: hasLink ? [0, 0, 255] : [0, 0, 0] } },
                    statusTexto,
                    t.progressoTexto,
                    textoHistorico,
                    t.dataUltimaStr,
                    formatarTempoTerritorio(t)
                ]);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
                headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
                columnStyles: {
                    4: { cellWidth: 72 }
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const t = dadosProcessados[data.row.index];
                        const mapSearch = t ? buildMapaLinkSearch(t) : '';
                        if (mapSearch) {
                            const deepLink = buildPublicAppRouteUrl('/app') + `?${mapSearch}`;
                            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: deepLink });
                        }
                    }
                }
            });

            const nomeArquivo = 'Relatorio_Territorios_Idiomas.pdf';
            const resultadoExportacao = await exportarPdfParaDispositivo(doc, nomeArquivo);

            if (resultadoExportacao.modo === 'share') {
                notify({
                    title: 'PDF pronto',
                    message: 'O Android abriu as opções para salvar ou compartilhar o relatório.',
                    variant: 'success'
                });
            }
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            notify({
                title: 'Falha ao gerar PDF',
                message: 'Não foi possível exportar o relatório agora. Tente novamente.',
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setExportandoPdf(false);
        }
    };

    if (loading || carregandoSistema) return <div className="flex h-screen items-center justify-center bg-slate-50 text-blue-600 font-bold">Carregando dados...</div>;

    return (
        <AppPage>
                <PageHeader
                    eyebrow="Relatórios"
                    title="Relatório de Territórios"
                    subtitle="Gerencie, filtre e veja o histórico com a mesma leitura visual do restante do app."
                    chips={(
                        <>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                                <span>Relatório:</span>
                                <span>Territórios de idiomas</span>
                            </span>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${temaSistema.panelBg} ${temaSistema.panelText} ${temaSistema.panelBorder}`}>
                                <span>Fonte</span>
                                <span>Endereços cadastrados</span>
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

                {/* CARDS DE RESUMO */}
                <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-5">
                    <div onClick={() => aplicarFiltroRapido('total')} className={`${cardBaseClass} cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md`}>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total</p>
                        <p className="text-3xl font-black text-slate-700">{total}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Clique para ver todos</p>
                    </div>
                    <div onClick={() => aplicarFiltroRapido('ocupado')} className="cursor-pointer rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md">
                        <p className="text-xs font-bold text-blue-400 uppercase">Em trabalho</p>
                        <p className="text-3xl font-black text-blue-700">{ocupados}</p>
                        <p className="text-[10px] text-blue-400 mt-1">Clique para filtrar</p>
                    </div>
                    <div onClick={() => aplicarFiltroRapido('livre')} className="cursor-pointer rounded-2xl border border-green-100 bg-green-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-green-100 hover:shadow-md">
                        <p className="text-xs font-bold text-green-500 uppercase">Disponíveis</p>
                        <p className="text-3xl font-black text-green-700">{livres}</p>
                        <p className="text-[10px] text-green-500 mt-1">Clique para filtrar</p>
                    </div>
                    <div onClick={() => aplicarFiltroRapido('finalizado')} className="cursor-pointer rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md">
                        <p className="text-xs font-bold text-emerald-500 uppercase">Finalizados</p>
                        <p className="text-3xl font-black text-emerald-700">{finalizados}</p>
                        <p className="text-[10px] text-emerald-500 mt-1">Clique para filtrar</p>
                    </div>
                    <div onClick={() => aplicarFiltroRapido(STATUS_ARQUIVADO)} className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-md">
                        <p className="text-xs font-bold text-slate-500 uppercase">Arquivados</p>
                        <p className="text-3xl font-black text-slate-700">{arquivados}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Clique para filtrar</p>
                    </div>
                </div>

                {/* BARRA DE FILTROS */}
                <div className={`${cardBaseClass} mb-6 p-4`}>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr),210px,150px,auto] lg:items-end">
                        <div className="w-full">
                            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                Busca
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </span>
                                <input type="text" placeholder="Buscar nome, código ou dirigente..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" value={busca} onChange={(e) => setBusca(e.target.value)} />
                            </div>
                        </div>
                        <div className="w-full">
                            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                Status
                            </label>
                            <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                                <option value="todos">Status: Todos</option>
                                <option value="livre">Apenas Livres</option>
                                <option value="ocupado">Em andamento</option>
                                <option value={TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO}>Aguardando finalização</option>
                                <option value={TERRITORIO_STATUS.FINALIZADO}>Finalizados</option>
                                <option value={STATUS_ARQUIVADO}>Arquivados</option>
                            </select>
                        </div>
                        <div className="w-full">
                            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                Tempo
                            </label>
                            <select value={tempoFiltro} onChange={(e) => setTempoFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                                <option value="todos">Tempo: Todos</option>
                                <option value="2_meses">+2 Meses</option>
                                <option value="4_meses">+4 Meses</option>
                                <option value="6_meses">+6 Meses</option>
                            </select>
                        </div>
                        <div className="w-full lg:w-auto">
                            <div className="hidden lg:block text-[11px] font-bold uppercase tracking-wide text-transparent mb-1 select-none">
                                Ações
                            </div>
                            {(busca || statusFiltro !== 'todos' || tempoFiltro !== 'todos') ? (
                                <button onClick={limparFiltros} className="w-full px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-1 font-semibold">✕ Limpar</button>
                            ) : (
                                <div className="hidden lg:block h-[42px]"></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- MODO MOBILE: CARDS (VISÍVEL APENAS EM CELULAR) --- */}
                <div className="md:hidden space-y-4">
                    {dadosProcessados.map((t) => (
                        <div key={t.id} className={`bg-white rounded-xl shadow border border-slate-200 p-4 transition-all ${linhasExpandidas.includes(t.id) ? 'ring-2 ring-blue-100' : ''}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-500 mb-1">
                                        #{t.numeroId}
                                    </span>
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight">
                                        {buildMapaLinkSearch(t) ? (
                                            <Link 
                                                to={`/app?${buildMapaLinkSearch(t)}`} 
                                                className="text-blue-600 hover:underline"
                                            >
                                                {t.nome}
                                            </Link>
                                        ) : t.nome}
                                    </h3>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {t.status === 'ocupado' ? (
                                        <div className="flex flex-col items-end">
                                            <span 
                                                className="inline-flex items-center justify-between px-3 py-1 rounded-full text-[10px] font-bold text-white border border-white/20 uppercase shadow-sm min-w-[100px]"
                                                style={t.statusStyle}
                                                title={`${t.porcentagem}% Concluído`}
                                            >
                                                <span>{t.statusLabel}</span>
                                                <span className="opacity-50 text-[9px] ml-1">{t.porcentagem}%</span>
                                            </span>
                                            <span className={`text-[9px] mt-0.5 ${t.diasSemEdicao > 10 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                                {t.diasSemEdicao > 10 && '⚠️ '}Edição: {t.ultimaEdicaoTexto}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase min-w-[100px] ${t.statusBadgeClass}`}>
                                            {t.statusLabel}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-slate-600 mb-4">
                                <div className="flex justify-between border-b border-slate-50 pb-1">
                                    <span className="text-slate-400 text-xs">Responsável</span>
                                    <span className="font-medium text-right max-w-[60%] truncate">{t.designadoNome || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-50 pb-1">
                                    <span className="text-slate-400 text-xs">Designado em</span>
                                    <span className="font-medium">{t.dataDesigStr}</span>
                                </div>
                                {t.resumoOperacional && (
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Resumo</span>
                                        <span className="font-medium text-right max-w-[60%]">{t.resumoOperacional}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b border-slate-50 pb-1">
                                    <span className="text-slate-400 text-xs">Progresso</span>
                                    <span className="font-medium">{t.progressoTexto}</span>
                                </div>
                                {t.status !== 'ocupado' && t.status !== TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO && (
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Última Conclusão</span>
                                        <span className="font-medium">{t.dataUltimaStr}</span>
                                    </div>
                                )}
                                {t.status !== 'ocupado' && t.status !== TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-xs">Tempo Parado</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCorTempo(t.diasParado)}`}>
                                            {formatarTempoTerritorio(t)}
                                        </span>
                                    </div>
                                )}
                                {t.status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-xs">Situação</span>
                                        <span className="font-medium text-yellow-700">Falta confirmar o encerramento</span>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => toggleLinha(t.id)}
                                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold uppercase rounded flex items-center justify-center gap-2 transition-colors"
                            >
                                {linhasExpandidas.includes(t.id) ? 'Ocultar Histórico' : 'Ver Histórico'}
                                <span>{linhasExpandidas.includes(t.id) ? '▲' : '▼'}</span>
                            </button>

                            {linhasExpandidas.includes(t.id) && (
                                <div className="mt-3 pt-3 border-t border-slate-100 animate-fade-in">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Histórico Recente</h4>
                                    {t.historicoLista.length > 0 ? (
                                        <div className="space-y-2">
                                            {t.historicoLista.map((hist, idx) => (
                                                <div key={idx} className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-slate-500">{hist.inicio}</span>
                                                        <span className="text-green-600 font-bold">→ {hist.termino}</span>
                                                    </div>
                                                    <div className="text-slate-700 font-medium">{hist.nomes}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Sem histórico.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {dadosProcessados.length === 0 && (
                        <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                            Nenhum território encontrado.
                        </div>
                    )}
                </div>

                {/* --- MODO DESKTOP: TABELA (VISÍVEL APENAS EM TELAS GRANDES) --- */}
                <div className={cn(cardBaseClass, 'hidden overflow-hidden md:block')}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 w-10 text-center cursor-pointer hover:bg-slate-100" onClick={toggleTodas} title="Expandir/Recolher Todos">
                                        <span className="text-lg font-bold">
                                            {linhasExpandidas.length > 0 && linhasExpandidas.length === dadosProcessados.length ? '−' : '+'}
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('numeroId')}>Cód. {getSortIcon('numeroId')}</th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('nome')}>Nome {getSortIcon('nome')}</th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('status')}>Status {getSortIcon('status')}</th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('porcentagem')}>Progresso {getSortIcon('porcentagem')}</th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('designadoNome')}>Responsável {getSortIcon('designadoNome')}</th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dataDesigObj')}>Designado em {getSortIcon('dataDesigObj')}</th>
                                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dataUltimaObj')}>Conclusão {getSortIcon('dataUltimaObj')}</th>
                                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('diasParado')}>Tempo Parado {getSortIcon('diasParado')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {dadosProcessados.map((t) => (
                                    <React.Fragment key={t.id}>
                                        <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${linhasExpandidas.includes(t.id) ? 'bg-blue-50' : ''}`} onClick={() => toggleLinha(t.id)}>
                                            <td className="px-4 py-3 text-center text-slate-400">
                                                {t.historicoLista.length > 0
                                                    ? (linhasExpandidas.includes(t.id) ? '▼' : '▶')
                                                    : <span className="opacity-20">●</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-slate-400 font-bold">{t.numeroId}</td>
                                            
                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                {buildMapaLinkSearch(t) ? (
                                                    <Link 
                                                        to={`/app?${buildMapaLinkSearch(t)}`} 
                                                        className="text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                                                        onClick={(e) => e.stopPropagation()} 
                                                    >
                                                        {t.nome}
                                                    </Link>
                                                ) : (
                                                    t.nome
                                                )}
                                            </td>
                                            
                                            <td className="px-4 py-3">
                                                {t.status === 'ocupado' ? (
                                                    <div className="flex flex-col items-start">
                                                        <span 
                                                            className="inline-flex items-center justify-between gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-white border border-white/20 uppercase shadow-sm min-w-[100px]"
                                                            style={t.statusStyle}
                                                            title={`${t.porcentagem}% Concluído`}
                                                        >
                                                            <span>{t.statusLabel}</span>
                                                            <span className="opacity-50 text-[9px]">{t.porcentagem}%</span>
                                                        </span>
                                                        <span className={`text-[9px] ml-1 mt-0.5 ${t.diasSemEdicao > 10 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                                            {t.diasSemEdicao > 10 && '⚠️ '}Ult. ed: {t.ultimaEdicaoTexto}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase min-w-[100px] ${t.statusBadgeClass}`}>{t.statusLabel}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-600">{t.progressoTexto}</td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {t.designadoNome || '-'}
                                                {(t.status === 'ocupado' || t.status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO) && t.cicloAtual && t.cicloAtual.responsaveis && t.cicloAtual.responsaveis.length > 1 && (
                                                    <span className="text-[10px] text-blue-500 ml-1">(+ {t.cicloAtual.responsaveis.length - 1} outros)</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{t.dataDesigStr}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{t.dataUltimaStr}</td>

                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${getCorTempo(t.diasParado)}`}>
                                                    {formatarTempoTerritorio(t)}
                                                </span>
                                            </td>
                                        </tr>

                                        {linhasExpandidas.includes(t.id) && (
                                            <tr className="bg-slate-50 animate-fade-in">
                                                <td colSpan="9" className="p-0">
                                                    <div className="p-4 border-b border-slate-200 shadow-inner">
                                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                                        📜 Histórico de Ciclos
                                                            </h4>
                                                            {t.resumoOperacional && (
                                                                <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                                                    {t.resumoOperacional}
                                                                </p>
                                                            )}
                                                            {t.historicoLista.length > 0 ? (
                                                                <table className="w-full text-xs text-left">
                                                                    <thead>
                                                                        <tr className="text-slate-400 border-b border-slate-100">
                                                                            <th className="py-2 pl-2">Início</th>
                                                                            <th className="py-2">Dirigentes (Ciclo Completo)</th>
                                                                            <th className="py-2">Término</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {t.historicoLista.map((hist, index) => (
                                                                            <tr key={index} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                                                                <td className="py-2 pl-2 text-slate-500">{hist.inicio}</td>
                                                                                <td className="py-2 font-medium text-slate-700">{hist.nomes}</td>
                                                                                <td className="py-2 text-green-600 font-medium">{hist.termino}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 italic p-2">Nenhum histórico registrado para este território ainda.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {dadosProcessados.length === 0 && (
                                    <tr><td colSpan="9" className="p-8 text-center text-slate-400">Nenhum território encontrado com os filtros atuais.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
        </AppPage>
    );
};

export default Relatorios;
