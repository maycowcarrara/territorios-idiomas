import React from 'react';

export const StatusSincronizacaoChip = ({
  isAdmin,
  isOnline,
  aberto,
  onToggle,
  onClose
}) => {
  if (isOnline) return null;

  const infoOffline = isAdmin
    ? 'Você está offline. Ações administrativas precisam de conexão para evitar conflito de designações.'
    : 'Você está sem conexão. O modo offline foi removido; aguarde a internet voltar antes de marcar progresso.';

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-800 shadow-sm transition-all active:scale-95"
          aria-expanded={aberto}
          aria-haspopup="dialog"
          title="Sem conexão"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current opacity-80"></span>
          <span>Sem conexão</span>
        </button>
        <div className={`fixed left-3 right-3 top-[4.75rem] z-[60] origin-top overflow-hidden rounded-2xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur transition-all duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[24rem] sm:origin-top-right ${aberto ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-[0.98] opacity-0'}`}>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Status do envio</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Conexão necessária</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                aria-label="Fechar status"
              >
                x
              </button>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4 text-sm">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">
              {infoOffline}
            </div>
          </div>
        </div>
      </div>
      {aberto && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[50] cursor-default bg-transparent"
          aria-label="Fechar status"
        />
      )}
    </>
  );
};
