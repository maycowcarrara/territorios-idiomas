import { exportarPdfParaDispositivo } from '../../pdfExport';
import { buildPublicAppRouteUrl } from '../../publicAppUrl';
import { TERRITORIO_STATUS } from '../../territorioContext';
import {
    RELATORIO_ENDERECOS,
    STATUS_ARQUIVADO,
    FILTRO_ARQUIVADOS_SEM,
    FILTRO_ARQUIVADOS_SOMENTE
} from '../constants/relatorioConstants';
import { buildMapaLinkSearch, formatarTempoTerritorio } from './relatorioUtils';

export async function gerarExportacaoPdfRelatorio({
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
}) {
    setExportandoPdf(true);
    try {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]);

        const doc = new jsPDF();
        const tituloRelatorio = relatorioAtivo === RELATORIO_ENDERECOS
            ? 'Relatório de Endereços'
            : 'Relatório de Territórios de Idiomas';

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
        const textoArquivados = arquivadosFiltro === FILTRO_ARQUIVADOS_SEM
            ? 'Ocultar arquivados'
            : (arquivadosFiltro === FILTRO_ARQUIVADOS_SOMENTE ? 'Somente arquivados' : 'Todos');
        doc.text(`Filtros: Status (${statusFiltro}) | Tempo (${textoTempoFiltro}) | Arquivados (${textoArquivados}) | ${textoFiltro}`, 14, 36);
        doc.text(`Idioma (${idiomaFiltro}) | Bairro (${bairroFiltro}) | Classe (${classeFiltro})`, 14, 41);

        const tableColumn = relatorioAtivo === RELATORIO_ENDERECOS
            ? ["Cód.", "Endereço", "Status", "Idioma", "Bairro", "Classe", "Pessoas", "Território"]
            : ["Cód.", "Nome", "Status", "Idioma", "Bairro", "Classes", "Progresso", "Histórico / Ciclos", "Ult. Conclusão", "Tempo Parado"];
        const tableRows = [];

        dadosProcessados.forEach(t => {
            if (relatorioAtivo === RELATORIO_ENDERECOS) {
                const mapSearch = buildMapaLinkSearch(t);
                const hasLink = !!mapSearch;
                tableRows.push([
                    t.numeroId,
                    { content: t.enderecoTexto || t.nome, styles: { textColor: hasLink ? [0, 0, 255] : [0, 0, 0] } },
                    t.statusLabel,
                    t.idiomaNome || '-',
                    t.bairro || '-',
                    t.classeResumo || '-',
                    String(t.totalEstrangeiros || 0),
                    t.grupoCodigo || '-'
                ]);
                return;
            }

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
                t.idiomaNome || '-',
                t.bairro || '-',
                t.classeResumo || '-',
                t.progressoTexto,
                textoHistorico,
                t.dataUltimaStr,
                formatarTempoTerritorio(t)
            ]);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
            columnStyles: relatorioAtivo === RELATORIO_ENDERECOS
                ? { 1: { cellWidth: 62 } }
                : { 7: { cellWidth: 58 } },
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

        const nomeArquivo = relatorioAtivo === RELATORIO_ENDERECOS
            ? 'Relatorio_Enderecos_Idiomas.pdf'
            : 'Relatorio_Territorios_Idiomas.pdf';
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
}
