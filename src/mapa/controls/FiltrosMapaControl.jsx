import React, { useEffect, useRef } from 'react';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';

export function FiltrosMapaControl({ open, onOpenChange, active = false, children }) {
    const root = useRef(null);
    const trigger = useRef(null);
    const isolate = useLeafletDomEventIsolation();
    useEffect(() => {
        if (!open) return;
        const outside = event => { if (!root.current?.contains(event.target)) onOpenChange(false); };
        const escape = event => {
            if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false); trigger.current?.focus(); }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open, onOpenChange]);
    return <div ref={node => { root.current = node; isolate(node); }} className="map-popup-aware-control absolute right-4 top-4 z-[450] flex flex-col items-end gap-2" onClick={stopMapDomEvent}>
        <button ref={trigger} type="button" aria-label="Filtros do mapa" title="Filtros do mapa" aria-expanded={open} onClick={() => onOpenChange(!open)} className={`relative flex h-10 w-10 items-center justify-center rounded-full border bg-white text-slate-700 shadow-md transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></svg>
            {active && <span aria-hidden="true" className="absolute right-0 top-0 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white"/>}
        </button>
        {open && <section aria-label="Filtros do mapa" className="flex max-h-[calc(100dvh-180px)] w-[min(340px,calc(100vw-32px))] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Filtros do mapa</h3><button type="button" aria-label="Fechar filtros" onClick={() => { onOpenChange(false); trigger.current?.focus(); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
            {children}
        </section>}
    </div>;
}
