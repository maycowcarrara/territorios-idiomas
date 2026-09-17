import React from 'react';
import { formatEnderecoCodigoExibicao } from '../../enderecoModel';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';

export const GrupoEnderecosModal = ({
    isOpen,
    grupoCodigo,
    grupoNome,
    enderecos,
    visitados,
    podeExecutar,
    loading,
    onClose,
    onToggleVisitado,
    onNavigate
}) => {
    const modalRef = useLeafletDomEventIsolation();

    if (!isOpen) return null;

    return (
        <div
            ref={modalRef}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in"
            style={{ zIndex: 9999 }}
            onClick={(event) => {
                stopMapDomEvent(event);
                onClose();
            }}
            onMouseDown={stopMapDomEvent}
        >
            <div
                className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl border border-slate-200/80"
                onClick={stopMapDomEvent}
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
                    <div>
                        <h3 className="text-base font-black leading-tight text-slate-900">Endereços do {grupoCodigo}</h3>
                        <p className="mt-0.5 text-xs font-medium leading-tight text-slate-500">{grupoNome}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-50"
                        aria-label="Fechar endereços"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="max-h-[62vh] overflow-y-auto p-4">
                    <div className="space-y-2.5">
                        {enderecos.map((endereco) => {
                            const feito = visitados.has(endereco.id);
                            return (
                                <div
                                    key={endereco.id}
                                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2.5 rounded-xl border p-3 text-sm transition-all ${feito ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900' : 'border-slate-200/80 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300'}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onToggleVisitado(endereco)}
                                        disabled={!podeExecutar || loading}
                                        className="flex min-w-0 items-start gap-3 rounded-lg text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                                        aria-label={`${feito ? 'Desmarcar' : 'Marcar como pregado'} ${formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}`}
                                    >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border text-xs font-black transition-colors ${feito ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                                        <span className="min-w-0">
                                            <span className="block font-black leading-tight text-slate-800">{formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}</span>
                                            <span className="mt-0.5 block text-xs font-medium leading-snug text-slate-600">{endereco.endereco || 'Sem endereço'}</span>
                                            <span className="mt-1 block text-[11px] font-semibold text-slate-400">{endereco.quantidadeEstrangeiros || 0} estrangeiro(s)</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(endereco)}
                                        className="self-stretch flex items-center justify-center rounded-xl border border-blue-200/80 bg-white px-3 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 active:scale-95"
                                        aria-label={`Navegar para ${formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}`}
                                    >
                                        Navegar
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {!podeExecutar && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-center text-xs font-semibold text-slate-500">
                        Marcação somente leitura.
                    </div>
                )}
            </div>
        </div>
    );
};
