import React from 'react';
import { buttonClass } from '../../uiClasses';

export const ModalConfirmacaoFinalizacao = ({ isOpen, onConfirmar, onRecusar, loading, contextoSufixo }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm animate-fade-in" style={{ zIndex: 9999 }} onClick={onRecusar}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/25 border border-slate-200/90" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-900 px-5 py-4 text-white flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h3 className="text-base font-bold">Confirmar finalização</h3>
                </div>
                <div className="p-5 text-sm text-slate-600 leading-relaxed">
                    <p>Você finalizou o território{contextoSufixo}?</p>
                </div>
                <div className="flex gap-2.5 px-5 pb-5">
                    <button
                        type="button"
                        onClick={onConfirmar}
                        disabled={loading}
                        className={buttonClass('success', 'flex-1')}
                    >
                        {loading ? 'Finalizando...' : 'Sim, finalizar'}
                    </button>
                    <button
                        type="button"
                        onClick={onRecusar}
                        disabled={loading}
                        className={buttonClass('secondary', 'flex-1')}
                    >
                        Não
                    </button>
                </div>
            </div>
        </div>
    );
};
