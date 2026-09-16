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
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            style={{ zIndex: 9999 }}
            onClick={(event) => {
                stopMapDomEvent(event);
                onClose();
            }}
            onMouseDown={stopMapDomEvent}
        >
            <div
                className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                onClick={stopMapDomEvent}
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                        <h3 className="text-base font-extrabold leading-tight text-slate-800">Endereços do {grupoCodigo}</h3>
                        <p className="mt-0.5 text-xs font-semibold leading-tight text-slate-500">{grupoNome}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                        aria-label="Fechar endereços"
                    >
                        ×
                    </button>
                </div>
                <div className="max-h-[62vh] overflow-y-auto p-3">
                    <div className="space-y-2">
                        {enderecos.map((endereco) => {
                            const feito = visitados.has(endereco.id);
                            return (
                                <div
                                    key={endereco.id}
                                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border p-2 text-sm transition ${feito ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onToggleVisitado(endereco)}
                                        disabled={!podeExecutar || loading}
                                        className="flex min-w-0 items-start gap-3 rounded-md px-1 py-0.5 text-left transition hover:bg-white/55 disabled:cursor-not-allowed disabled:opacity-60"
                                        aria-label={`${feito ? 'Desmarcar' : 'Marcar como pregado'} ${formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}`}
                                    >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black ${feito ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                                        <span className="min-w-0">
                                            <span className="block font-extrabold leading-tight text-slate-800">{formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}</span>
                                            <span className="mt-0.5 block leading-snug">{endereco.endereco || 'Sem endereço'}</span>
                                            <span className="mt-1 block text-xs font-semibold text-slate-500">{endereco.quantidadeEstrangeiros || 0} estrangeiro(s)</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(endereco)}
                                        className="self-stretch rounded-md border border-blue-200 bg-white px-3 text-xs font-extrabold text-blue-700 transition hover:bg-blue-50"
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
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs font-semibold text-slate-500">
                        Marcação somente leitura.
                    </div>
                )}
            </div>
        </div>
    );
};
