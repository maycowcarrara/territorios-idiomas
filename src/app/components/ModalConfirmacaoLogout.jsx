import React from 'react';
import { buttonClass } from '../../uiClasses';

export const ModalConfirmacaoLogout = ({ isOpen, onConfirmar, onCancelar }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm animate-fade-in" onClick={onCancelar}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/25 border border-slate-200/90" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-base font-bold">Confirmar saída</h3>
        </div>
        <div className="p-5 text-sm text-slate-600 leading-relaxed">
          <p>Deseja realmente sair da sua conta e encerrar a sessão?</p>
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            type="button"
            onClick={onConfirmar}
            className={buttonClass('danger', 'flex-1')}
          >
            Sair
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className={buttonClass('secondary', 'flex-1')}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
