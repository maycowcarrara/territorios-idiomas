import React from 'react';
import { Link } from 'react-router-dom';
import { cn, cardBaseClass } from '../../uiClasses';
import { TERRITORIO_STATUS } from '../../territorioContext';
import {
    RELATORIO_TERRITORIOS,
    RELATORIO_ENDERECOS
} from '../constants/relatorioConstants';
import {
    buildMapaLinkSearch,
    formatarTempoTerritorio,
    getCorTempo
} from '../utils/relatorioUtils';

export function RelatorioResultados({
    dadosProcessados,
    linhasExpandidas,
    relatorioAtivo,
    toggleLinha,
    toggleTodas,
    handleSort,
    getSortIcon
}) {
    return (
        <>
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
                            {relatorioAtivo === RELATORIO_ENDERECOS ? (
                                <>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Idioma</span>
                                        <span className="font-medium text-right max-w-[60%] truncate">{t.idiomaNome || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Bairro</span>
                                        <span className="font-medium text-right max-w-[60%] truncate">{t.bairro || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Classe</span>
                                        <span className="font-medium">{t.classeResumo}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Território</span>
                                        <span className="font-medium text-right max-w-[60%] truncate">{t.grupoCodigo || '-'}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Responsável</span>
                                        <span className="font-medium text-right max-w-[60%] truncate">{t.designadoNome || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Designado em</span>
                                        <span className="font-medium">{t.dataDesigStr}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-1">
                                        <span className="text-slate-400 text-xs">Classe(s)</span>
                                        <span className="font-medium text-right max-w-[60%]">{t.classeResumo}</span>
                                    </div>
                                </>
                            )}
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

                        {relatorioAtivo === RELATORIO_TERRITORIOS && (
                            <button
                                onClick={() => toggleLinha(t.id)}
                                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold uppercase rounded flex items-center justify-center gap-2 transition-colors"
                            >
                                {linhasExpandidas.includes(t.id) ? 'Ocultar Histórico' : 'Ver Histórico'}
                                <span>{linhasExpandidas.includes(t.id) ? '▲' : '▼'}</span>
                            </button>
                        )}

                        {relatorioAtivo === RELATORIO_TERRITORIOS && linhasExpandidas.includes(t.id) && (
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
                                {relatorioAtivo === RELATORIO_TERRITORIOS && (
                                    <th className="px-4 py-3 w-10 text-center cursor-pointer hover:bg-slate-100" onClick={toggleTodas} title="Expandir/Recolher Todos">
                                        <span className="text-lg font-bold">
                                            {linhasExpandidas.length > 0 && linhasExpandidas.length === dadosProcessados.length ? '−' : '+'}
                                        </span>
                                    </th>
                                )}
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('numeroId')}>Cód. {getSortIcon('numeroId')}</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('nome')}>{relatorioAtivo === RELATORIO_ENDERECOS ? 'Endereço' : 'Nome'} {getSortIcon('nome')}</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('status')}>Status {getSortIcon('status')}</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('idiomaNome')}>Idioma {getSortIcon('idiomaNome')}</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('bairro')}>Bairro {getSortIcon('bairro')}</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('classeResumo')}>Classe {getSortIcon('classeResumo')}</th>
                                {relatorioAtivo === RELATORIO_TERRITORIOS ? (
                                    <>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('porcentagem')}>Progresso {getSortIcon('porcentagem')}</th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('designadoNome')}>Responsável {getSortIcon('designadoNome')}</th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dataDesigObj')}>Designado em {getSortIcon('dataDesigObj')}</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dataUltimaObj')}>Conclusão {getSortIcon('dataUltimaObj')}</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('diasParado')}>Tempo Parado {getSortIcon('diasParado')}</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('totalEstrangeiros')}>Pessoas {getSortIcon('totalEstrangeiros')}</th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('grupoCodigo')}>Território {getSortIcon('grupoCodigo')}</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dataUltimaObj')}>Atualização {getSortIcon('dataUltimaObj')}</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {dadosProcessados.map((t) => (
                                <React.Fragment key={t.id}>
                                    <tr
                                        className={`hover:bg-slate-50 transition-colors ${relatorioAtivo === RELATORIO_TERRITORIOS ? 'cursor-pointer' : ''} ${linhasExpandidas.includes(t.id) ? 'bg-blue-50' : ''}`}
                                        onClick={() => {
                                            if (relatorioAtivo === RELATORIO_TERRITORIOS) toggleLinha(t.id);
                                        }}
                                    >
                                        {relatorioAtivo === RELATORIO_TERRITORIOS && (
                                            <td className="px-4 py-3 text-center text-slate-400">
                                                {t.historicoLista.length > 0
                                                    ? (linhasExpandidas.includes(t.id) ? '▼' : '▶')
                                                    : <span className="opacity-20">●</span>}
                                            </td>
                                        )}
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
                                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">{t.idiomaNome || '-'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{t.bairro || '-'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{t.classeResumo || '-'}</td>
                                        {relatorioAtivo === RELATORIO_TERRITORIOS ? (
                                            <>
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
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-600">{t.totalEstrangeiros}</td>
                                                <td className="px-4 py-3 text-xs text-slate-600">{t.grupoCodigo || '-'}</td>
                                                <td className="px-4 py-3 text-right text-slate-500 text-xs">{t.dataUltimaStr}</td>
                                            </>
                                        )}
                                    </tr>

                                    {relatorioAtivo === RELATORIO_TERRITORIOS && linhasExpandidas.includes(t.id) && (
                                        <tr className="bg-slate-50 animate-fade-in">
                                            <td colSpan="12" className="p-0">
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
                                <tr><td colSpan={relatorioAtivo === RELATORIO_TERRITORIOS ? 12 : 9} className="p-8 text-center text-slate-400">Nenhum registro encontrado com os filtros atuais.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
