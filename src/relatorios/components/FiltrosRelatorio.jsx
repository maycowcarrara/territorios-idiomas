import React from 'react';
import { cardBaseClass } from '../../uiClasses';
import {
    RELATORIO_TERRITORIOS,
    RELATORIO_ENDERECOS,
    STATUS_ARQUIVADO,
    FILTRO_TODOS,
    FILTRO_ARQUIVADOS_SEM,
    FILTRO_ARQUIVADOS_SOMENTE
} from '../constants/relatorioConstants';
import { TERRITORIO_STATUS } from '../../territorioContext';
import { ENDERECO_STATUS } from '../../enderecoModel';

export function FiltrosRelatorio({
    relatorioAtivo,
    trocarRelatorio,
    total,
    territorios,
    ocupados,
    enderecosAtivos,
    enderecosRelatorio,
    pessoasFiltradas,
    finalizados,
    arquivados,
    livres,
    aplicarFiltroRapido,
    busca,
    setBusca,
    statusFiltro,
    alterarStatusFiltro,
    idiomaFiltro,
    setIdiomaFiltro,
    opcoesIdioma,
    bairroFiltro,
    setBairroFiltro,
    opcoesBairro,
    classeFiltro,
    setClasseFiltro,
    opcoesClasse,
    arquivadosFiltro,
    alterarArquivadosFiltro,
    filtrosAtivos,
    limparFiltros,
    dadosProcessados
}) {
    return (
        <>
            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-5">
                <div onClick={() => aplicarFiltroRapido('total')} className={`${cardBaseClass} cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md`}>
                    <p className="text-xs font-bold text-slate-400 uppercase">Total da visão</p>
                    <p className="text-3xl font-black text-slate-700">{total}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Clique para incluir arquivados</p>
                </div>
                <div onClick={() => trocarRelatorio(RELATORIO_TERRITORIOS)} className="cursor-pointer rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md">
                    <p className="text-xs font-bold text-blue-400 uppercase">Territórios</p>
                    <p className="text-3xl font-black text-blue-700">{territorios.length}</p>
                    <p className="text-[10px] text-blue-400 mt-1">{ocupados} em trabalho</p>
                </div>
                <div onClick={() => trocarRelatorio(RELATORIO_ENDERECOS)} className="cursor-pointer rounded-2xl border border-green-100 bg-green-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-green-100 hover:shadow-md">
                    <p className="text-xs font-bold text-green-500 uppercase">Endereços ativos</p>
                    <p className="text-3xl font-black text-green-700">{enderecosAtivos}</p>
                    <p className="text-[10px] text-green-500 mt-1">{enderecosRelatorio.length} cadastrados</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                    <p className="text-xs font-bold text-emerald-500 uppercase">Pessoas filtradas</p>
                    <p className="text-3xl font-black text-emerald-700">{pessoasFiltradas}</p>
                    <p className="text-[10px] text-emerald-500 mt-1">{finalizados} territórios finalizados</p>
                </div>
                <div onClick={() => aplicarFiltroRapido(STATUS_ARQUIVADO)} className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-md">
                    <p className="text-xs font-bold text-slate-500 uppercase">Arquivados</p>
                    <p className="text-3xl font-black text-slate-700">{arquivados}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{livres} territórios disponíveis</p>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className={`${cardBaseClass} mb-6 p-4`}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr),150px,150px,150px,160px,150px,auto] xl:items-end">
                    <div className="w-full md:col-span-2 xl:col-span-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Busca
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </span>
                            <input type="text" placeholder="Buscar código, endereço, bairro ou dirigente..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" value={busca} onChange={(e) => setBusca(e.target.value)} />
                        </div>
                    </div>
                    <div className="w-full">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Status
                        </label>
                        <select value={statusFiltro} onChange={(e) => alterarStatusFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value={FILTRO_TODOS}>Todos</option>
                            {relatorioAtivo === RELATORIO_TERRITORIOS ? (
                                <>
                                    <option value="livre">Livres</option>
                                    <option value="ocupado">Em andamento</option>
                                    <option value={TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO}>Aguardando finalização</option>
                                    <option value={TERRITORIO_STATUS.FINALIZADO}>Finalizados</option>
                                    <option value={STATUS_ARQUIVADO}>Arquivados</option>
                                </>
                            ) : (
                                <>
                                    <option value={ENDERECO_STATUS.ATIVO}>Ativos</option>
                                    <option value={STATUS_ARQUIVADO}>Arquivados</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Idioma
                        </label>
                        <select value={idiomaFiltro} onChange={(e) => setIdiomaFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value={FILTRO_TODOS}>Todos</option>
                            {opcoesIdioma.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Bairro
                        </label>
                        <select value={bairroFiltro} onChange={(e) => setBairroFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value={FILTRO_TODOS}>Todos</option>
                            {opcoesBairro.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Classe
                        </label>
                        <select value={classeFiltro} onChange={(e) => setClasseFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value={FILTRO_TODOS}>Todas</option>
                            {opcoesClasse.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Arquivados
                        </label>
                        <select value={arquivadosFiltro} onChange={(e) => alterarArquivadosFiltro(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value={FILTRO_ARQUIVADOS_SEM}>Ocultar</option>
                            <option value={FILTRO_TODOS}>Incluir</option>
                            <option value={FILTRO_ARQUIVADOS_SOMENTE}>Somente</option>
                        </select>
                    </div>
                    <div className="w-full xl:w-auto">
                        <div className="hidden xl:block text-[11px] font-bold uppercase tracking-wide text-transparent mb-1 select-none">
                            Ações
                        </div>
                        {filtrosAtivos ? (
                            <button onClick={limparFiltros} className="w-full px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-1 font-semibold">✕ Limpar</button>
                        ) : (
                            <div className="hidden xl:block h-[42px]"></div>
                        )}
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400">
                    <span>{dadosProcessados.length} registro{dadosProcessados.length === 1 ? '' : 's'} exibido{dadosProcessados.length === 1 ? '' : 's'}</span>
                    <span className="text-slate-300">|</span>
                    <span>{pessoasFiltradas} pessoa{pessoasFiltradas === 1 ? '' : 's'} no filtro atual</span>
                </div>
            </div>
        </>
    );
}
