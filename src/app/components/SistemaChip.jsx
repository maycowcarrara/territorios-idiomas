import React from 'react';

export const SistemaChip = ({ contextoSistema, compact = false, coberturaCampanha = null, carregandoCobertura = false, stacked = false, coverageOnly = false }) => {
  if (!contextoSistema?.campanhaAtiva) return null;

  const coberturaBadge = carregandoCobertura ? (
    <span className="rounded-full bg-violet-950/35 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-100">
      ...
    </span>
  ) : coberturaCampanha ? (
    <span className="rounded-full bg-violet-950/35 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-100 whitespace-nowrap">
      {coberturaCampanha.percentualCoberto}% coberto
    </span>
  ) : null;

  if (coverageOnly) {
    if (carregandoCobertura) {
      return (
        <span className="inline-flex items-center rounded-full bg-violet-950/35 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-100">
          ...
        </span>
      );
    }

    if (coberturaCampanha) {
      return (
        <span className="inline-flex items-center rounded-full bg-violet-950/35 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-100">
          {coberturaCampanha.percentualCoberto}%
        </span>
      );
    }

    return null;
  }

  if (stacked) {
    return (
      <span className="flex max-w-full flex-col rounded-2xl border border-violet-200/35 bg-violet-900/45 px-2.5 py-1.5 text-violet-50 shadow-sm">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold leading-tight">
          <span className="shrink-0">📢</span>
          <span className="truncate">{contextoSistema.contextoAtivoTitulo}</span>
        </span>
        {coberturaBadge ? (
          <span className="mt-1 pl-5">
            {coberturaBadge}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 font-bold ${compact ? 'text-[10px]' : 'text-xs'} bg-violet-900/45 text-violet-50 border-violet-200/35`}>
      <span>📢</span>
      <span className="truncate max-w-[180px]">{contextoSistema.contextoAtivoTitulo}</span>
      {coberturaBadge}
    </span>
  );
};
