import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { loadMapaData } from './mapData';
import { buildFeatureIndex, getFeatureBoundsStr, getTerritorioQuadrasCount } from './mapaUtils';
import { exportarPdfParaDispositivo } from './pdfExport';
import { buildPublicAppRouteUrl } from './publicAppUrl';
import { useSistema } from './useSistema';
import { getSistemaTheme, isNormalContext, NORMAL_CONTEXT_ID } from './sistema';
import { normalizeTerritorioNome } from './territorioNome';
import { useUiFeedback } from './uiFeedback';
import { AppPage, PageHeader } from './uiPrimitives';
import { buttonClass, cardBaseClass, cn } from './uiClasses';
import {
    getTerritorioContextCollectionRef,
    getTerritorioNumeroFromDocId,
    getTerritorioProgresso,
    getTerritorioStatusOperacional,
    mergeTerritorioData,
    TERRITORIO_STATUS
} from './territorioContext';

const Relatorios = () => {
    const [territorios, setTerritorios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportandoPdf, setExportandoPdf] = useState(false);
    const [campanhas, setCampanhas] = useState([]);
    const [contextoSelecionadoId, setContextoSelecionadoId] = useState(null);
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

    const contextoRelatorioId = contextoSelecionadoId || contextoSistema.contextoAtivoId || NORMAL_CONTEXT_ID;
    const contextoRelatorio = isNormalContext(contextoRelatorioId)
        ? { id: NORMAL_CONTEXT_ID, titulo: 'Pregação normal', tipo: 'normal' }
        : {
            id: contextoRelatorioId,
            titulo: campanhas.find((campanha) => campanha.id === contextoRelatorioId)?.titulo || contextoRelatorioId,
            tipo: 'campanha'
        };

    const getStatusVisual = (status, porcentagem) => {
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
        const unsubscribe = onSnapshot(collection(db, "campanhas"), (snapshot) => {
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

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (carregandoSistema) return;
        if (contextoSelecionadoId !== null) return;
        setContextoSelecionadoId(contextoSistema.contextoAtivoId || NORMAL_CONTEXT_ID);
    }, [carregandoSistema, contextoSelecionadoId, contextoSistema.contextoAtivoId]);

    useEffect(() => {
        if (carregandoSistema || !contextoRelatorioId) return;

        let ativo = true;

        const carregarDados = async () => {
            if (ativo) {
                setLoading(true);
            }
            try {
                const geoData = await loadMapaData();
                const featureMap = buildFeatureIndex(geoData);
                const territoriosBaseSnapshot = await getDocs(collection(db, "territorios"));
                const baseMap = new Map();

                territoriosBaseSnapshot.forEach((territorioDoc) => {
                    baseMap.set(getTerritorioNumeroFromDocId(territorioDoc.id), territorioDoc.data());
                });

                const contextoMap = new Map();
                if (!isNormalContext(contextoRelatorioId)) {
                    const contextoSnapshot = await getDocs(query(
                        getTerritorioContextCollectionRef(db),
                        where("contextoId", "==", contextoRelatorioId)
                    ));

                    contextoSnapshot.forEach((territorioDoc) => {
                        const data = territorioDoc.data();
                        const numeroId = data.territorioNumero || getTerritorioNumeroFromDocId(territorioDoc.id);
                        contextoMap.set(numeroId, data);
                    });
                }

                const numeros = Array.from(featureMap.keys()).sort((a, b) => a - b);
                const lista = numeros.map((numeroId) => {
                    const feature = featureMap.get(numeroId);
                    const nomeSeguro = normalizeTerritorioNome(feature?.properties?.nome, `Território ${numeroId}`);
                    const data = mergeTerritorioData({
                        contextoId: contextoRelatorioId,
                        nomeFallback: nomeSeguro,
                        baseData: baseMap.get(numeroId),
                        stateData: isNormalContext(contextoRelatorioId) ? baseMap.get(numeroId) : contextoMap.get(numeroId)
                    });

                    let totalQuadras = 1;
                    let porcentagem = 0;
                    const boundsStr = getFeatureBoundsStr(feature);

                    if (feature) {
                        totalQuadras = getTerritorioQuadrasCount(feature);
                        const progresso = getTerritorioProgresso(data, totalQuadras);
                        porcentagem = progresso.percentualExibicao;
                    }

                    const statusOperacional = getTerritorioStatusOperacional(data, totalQuadras);
                    const statusVisual = getStatusVisual(statusOperacional, porcentagem);

                    let diasParado = 0;
                    let dataUltimaStr = '-';
                    let dataUltimaObj = null;
                    if (data.ultimaConclusao) {
                        dataUltimaObj = data.ultimaConclusao.toDate ? data.ultimaConclusao.toDate() : new Date(data.ultimaConclusao);
                        diasParado = Math.ceil(Math.abs(new Date() - dataUltimaObj) / (1000 * 60 * 60 * 24));
                        dataUltimaStr = dataUltimaObj.toLocaleDateString('pt-BR');
                    }

                    let dataDesigStr = '-';
                    let dataDesigObj = null;
                    if (data.designadoPara && data.dataDesignacao) {
                        dataDesigObj = data.dataDesignacao.toDate ? data.dataDesignacao.toDate() : new Date(data.dataDesignacao);
                        dataDesigStr = dataDesigObj.toLocaleDateString('pt-BR');
                    }

                    let diasSemEdicao = 0;
                    let ultimaEdicaoTexto = "Sem dados";
                    if (data.designadoPara) {
                        let dataRef = null;
                        if (data.ultimaAlteracao) {
                            dataRef = data.ultimaAlteracao.toDate ? data.ultimaAlteracao.toDate() : new Date(data.ultimaAlteracao);
                        } else if (dataDesigObj) {
                            dataRef = dataDesigObj;
                        } else {
                            dataRef = new Date();
                        }

                        const agora = new Date();
                        const diferencaMs = Math.abs(agora - dataRef);
                        const diferencaMinutos = Math.floor(diferencaMs / (1000 * 60));
                        const diferencaHoras = Math.floor(diferencaMs / (1000 * 60 * 60));
                        diasSemEdicao = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

                        if (diferencaMinutos < 2) {
                            ultimaEdicaoTexto = "agora mesmo";
                        } else if (diferencaMinutos < 60) {
                            ultimaEdicaoTexto = `há ${diferencaMinutos} min`;
                        } else if (diferencaHoras < 24) {
                            ultimaEdicaoTexto = `há ${diferencaHoras} h`;
                        } else if (diasSemEdicao === 1) {
                            ultimaEdicaoTexto = "ontem";
                        } else {
                            ultimaEdicaoTexto = `há ${diasSemEdicao} dias`;
                        }
                    }

                    let historicoProcessado = [];
                    if (data.historico && Array.isArray(data.historico)) {
                        historicoProcessado = data.historico.map(h => {
                            const inicio = h.dataInicio?.toDate ? h.dataInicio.toDate() : (h.dataRetirada?.toDate ? h.dataRetirada.toDate() : new Date());
                            const fim = h.dataTermino?.toDate ? h.dataTermino.toDate() : (h.dataDevolucao?.toDate ? h.dataDevolucao.toDate() : new Date());
                            const inicioStr = !isNaN(inicio) ? inicio.toLocaleDateString('pt-BR') : '?';
                            const fimStr = !isNaN(fim) ? fim.toLocaleDateString('pt-BR') : '?';
                            const listaNomes = Array.isArray(h.responsaveis) ? h.responsaveis.join(", ") : (h.responsavel || "Desconhecido");
                            return { nomes: listaNomes, inicio: inicioStr, termino: fimStr, timestampFim: fim };
                        });
                        historicoProcessado.sort((a, b) => b.timestampFim - a.timestampFim);
                        historicoProcessado = historicoProcessado.slice(0, 10);
                    }

                    return {
                        id: isNormalContext(contextoRelatorioId) ? `t_${numeroId}` : `${contextoRelatorioId}__t_${numeroId}`,
                        numeroId,
                        ...data,
                        nome: nomeSeguro,
                        diasParado,
                        diasSemEdicao,
                        ultimaEdicaoTexto,
                        totalQuadras,
                        porcentagem,
                        dataUltimaStr,
                        dataUltimaObj,
                        dataDesigStr,
                        dataDesigObj,
                        historicoLista: historicoProcessado,
                        status: statusOperacional,
                        statusLabel: statusVisual.label,
                        statusBadgeClass: statusVisual.badgeClass,
                        statusDetailClass: statusVisual.detailClass,
                        statusStyle: statusVisual.style,
                        progressoTexto: statusVisual.progressoTexto,
                        boundsStr
                    };
                });

                if (ativo) {
                    setTerritorios(lista);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                if (ativo) {
                    setLoading(false);
                }
            }
        };

        carregarDados();

        return () => {
            ativo = false;
        };
    }, [carregandoSistema, contextoRelatorioId]);

    const formatarTempo = (dias) => {
        if (dias === 0) return "Hoje";
        if (dias < 30) return `${dias} dias`;
        const meses = Math.floor(dias / 30);
        const restoDias = dias % 30;
        let texto = `${meses} ${meses > 1 ? 'meses' : 'mês'}`;
        if (restoDias > 0) texto += ` e ${restoDias} ${restoDias > 1 ? 'dias' : 'dia'}`;
        return texto;
    };

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
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
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
    const getCorTempo = (dias) => {
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
            const tituloRelatorio = contextoRelatorio.tipo === 'campanha'
                ? `Relatório de Territórios - ${contextoRelatorio.titulo}`
                : "Relatório de Territórios - Pregação normal";

            doc.setFontSize(18);
            doc.text(tituloRelatorio, 14, 20);
            doc.setFontSize(10);
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
            doc.text(`Contexto: ${contextoRelatorio.titulo}`, 14, 31);

            doc.setFontSize(8);
            doc.setTextColor(100);

            let textoTempoFiltro = "Todos";
            if (tempoFiltro === '2_meses') textoTempoFiltro = "+2 Meses";
            if (tempoFiltro === '4_meses') textoTempoFiltro = "+4 Meses";
            if (tempoFiltro === '6_meses') textoTempoFiltro = "+6 Meses";

            const textoFiltro = busca ? `Busca: "${busca}"` : "Sem busca";
            doc.text(`Filtros: Status (${statusFiltro}) | Tempo (${textoTempoFiltro}) | ${textoFiltro}`, 14, 36);

            const tableColumn = ["Cód.", "Nome", "Status / Progresso", "Histórico / Ciclos", "Ult. Conclusão", "Tempo Parado"];
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
                } else {
                    textoHistorico += "LIVRE\n";
                }

                if (t.historicoLista && t.historicoLista.length > 0) {
                    textoHistorico += "-- HISTÓRICO --\n";
                    t.historicoLista.forEach(h => {
                        textoHistorico += `• Início: ${h.inicio} - Dirigentes: ${h.nomes} - Término: ${h.termino}\n`;
                    });
                } else {
                    textoHistorico += "\n(Sem histórico)";
                }

                const hasLink = !!t.boundsStr;

                tableRows.push([
                    t.numeroId,
                    { content: t.nome, styles: { textColor: hasLink ? [0, 0, 255] : [0, 0, 0] } },
                    statusTexto,
                    textoHistorico,
                    t.dataUltimaStr,
                    t.diasParado > 0 ? formatarTempo(t.diasParado) : 'Nunca'
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
                    3: { cellWidth: 80 }
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const t = dadosProcessados[data.row.index];
                        if (t && t.boundsStr) {
                            const deepLink = buildPublicAppRouteUrl('/app', { bounds: t.boundsStr });
                            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: deepLink });
                        }
                    }
                }
            });

            const nomeArquivo = isNormalContext(contextoRelatorioId)
                ? 'Relatorio_Territorios_Normal.pdf'
                : `Relatorio_${contextoRelatorio.id}.pdf`;
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
                                <span>{contextoRelatorio.titulo}</span>
                            </span>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${temaSistema.panelBg} ${temaSistema.panelText} ${temaSistema.panelBorder}`}>
                                <span>{contextoSistema.campanhaAtiva ? '📢' : '🗺️'}</span>
                                <span>Modo atual: {contextoSistema.contextoAtivoTitulo}</span>
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

                {/* CARDS DE RESUMO */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                </div>

                {/* BARRA DE FILTROS */}
                <div className={`${cardBaseClass} mb-6 p-4`}>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px,minmax(0,1fr),210px,150px,auto] lg:items-end">
                        <div className="w-full">
                            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                Contexto do relatório
                            </label>
                            <select
                                value={contextoRelatorioId}
                                onChange={(e) => {
                                    setContextoSelecionadoId(e.target.value);
                                    setLinhasExpandidas([]);
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value={NORMAL_CONTEXT_ID}>Pregação normal</option>
                                {campanhas.map((campanha) => (
                                    <option key={campanha.id} value={campanha.id}>
                                        {campanha.titulo || campanha.id}
                                    </option>
                                ))}
                            </select>
                        </div>
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
                                        {t.boundsStr ? (
                                            <Link 
                                                to={`/app?bounds=${t.boundsStr}`} 
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
                                            {formatarTempo(t.diasParado)}
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
                                                {t.boundsStr ? (
                                                    <Link 
                                                        to={`/app?bounds=${t.boundsStr}`} 
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
                                                    {formatarTempo(t.diasParado)}
                                                </span>
                                            </td>
                                        </tr>

                                        {linhasExpandidas.includes(t.id) && (
                                            <tr className="bg-slate-50 animate-fade-in">
                                                <td colSpan="8" className="p-0">
                                                    <div className="p-4 border-b border-slate-200 shadow-inner">
                                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                                        📜 Histórico de Ciclos
                                                            </h4>
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
                                    <tr><td colSpan="8" className="p-8 text-center text-slate-400">Nenhum território encontrado com os filtros atuais.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
        </AppPage>
    );
};

export default Relatorios;
