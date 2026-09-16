import React from 'react';

export const ModalConfirmacaoFinalizacao = ({ isOpen, onConfirmar, onRecusar, loading, contextoSufixo }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-blue-600 px-4 py-3">
                    <h3 className="text-lg font-bold text-white">Confirmar finalização</h3>
                </div>
                <div className="p-4 text-sm text-gray-700">
                    <p>Você finalizou o território{contextoSufixo}?</p>
                </div>
                <div className="flex gap-3 px-4 pb-4">
                    <button
                        onClick={onConfirmar}
                        disabled={loading}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Sim
                    </button>
                    <button
                        onClick={onRecusar}
                        disabled={loading}
                        className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Não
                    </button>
                </div>
            </div>
        </div>
    );
};
