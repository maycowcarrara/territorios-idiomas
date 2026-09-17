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
      <span className="flex max-w-full flex-col rounded-2xl border border-violet-400/30 bg-violet-950/60 px-2.5 py-1.5 text-violet-50 shadow-sm backdrop-blur-sm">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-tight">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-violet-300" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
          </svg>
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold ${compact ? 'text-[10px]' : 'text-xs'} bg-violet-950/60 text-violet-50 border-violet-400/30 shadow-sm backdrop-blur-sm`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-violet-300" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
      </svg>
      <span className="truncate max-w-[180px]">{contextoSistema.contextoAtivoTitulo}</span>
      {coberturaBadge}
    </span>
  );
};
