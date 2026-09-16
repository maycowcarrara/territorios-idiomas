import React from 'react';

export const ModalConfirmacaoLogout = ({ isOpen, onConfirmar, onCancelar }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-red-600 px-4 py-3">
          <h3 className="text-lg font-bold text-white">Confirmar saída</h3>
        </div>
        <div className="p-4 text-sm text-gray-700">
          <p>Deseja realmente sair da sua conta do Google?</p>
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={onConfirmar}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700"
          >
            Sair
          </button>
          <button
            onClick={onCancelar}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-700 hover:bg-gray-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
