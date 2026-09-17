import React from 'react';
import { useMap } from 'react-leaflet';
import { useUiFeedback } from '../../uiFeedback';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';
import { useGeolocationTracking } from '../hooks/useGeolocationTracking';

export const ControlesNavegacao = ({
    rastreandoLocalizacao,
    setRastreandoLocalizacao,
    setPosicaoUsuario,
    setTrilhaUsuario,
    setDirecaoUsuario,
    mostrarDicas
}) => {
    const map = useMap();
    const { notify } = useUiFeedback();
    const controlsRef = useLeafletDomEventIsolation();

    const { buscando } = useGeolocationTracking({
        map,
        rastreandoLocalizacao,
        setRastreandoLocalizacao,
        setPosicaoUsuario,
        setTrilhaUsuario,
        setDirecaoUsuario,
        notify
    });

    const alternarLocalizacao = () => {
        setRastreandoLocalizacao((estadoAtual) => !estadoAtual);
    };

    return (
        <div ref={controlsRef} className="map-popup-aware-control absolute bottom-6 right-4 z-[400] flex flex-col gap-2.5" onClick={stopMapDomEvent}>
            <button
                type="button"
                onClick={alternarLocalizacao}
                aria-pressed={rastreandoLocalizacao}
                title={rastreandoLocalizacao ? "Desativar rastreamento da minha localização" : "Ativar rastreamento da minha localização"}
                className={`relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shadow-md shadow-slate-900/10 border backdrop-blur-md active:scale-95 transition-all duration-150 rounded-2xl ${rastreandoLocalizacao ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/30 shadow-blue-600/20' : 'bg-white/95 text-slate-600 border-slate-200/90 hover:text-blue-600 hover:bg-white'}`}
            >
                {buscando ? (
                    <div className={`animate-spin rounded-full h-5 w-5 border-2 ${rastreandoLocalizacao ? 'border-blue-100 border-t-white' : 'border-slate-300 border-t-blue-600'}`}></div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <circle cx="12" cy="12" r="8" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                        <line x1="12" y1="2" x2="12" y2="4" strokeLinecap="round" />
                        <line x1="12" y1="20" x2="12" y2="22" strokeLinecap="round" />
                        <line x1="2" y1="12" x2="4" y2="12" strokeLinecap="round" />
                        <line x1="20" y1="12" x2="22" y2="12" strokeLinecap="round" />
                    </svg>
                )}
                <span className={`absolute left-1/2 -translate-x-1/2 -top-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 border shadow-sm text-[9px] font-bold tracking-wider ${rastreandoLocalizacao ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white/95 text-slate-500 border-slate-200'}`}>
                    <span className={`block w-1.5 h-1.5 rounded-full ${rastreandoLocalizacao ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    {rastreandoLocalizacao ? 'ON' : 'OFF'}
                </span>
                {mostrarDicas && <span className="control-hint right-side">Ligar GPS</span>}
            </button>
            <div className="flex flex-col shadow-md shadow-slate-900/10 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md overflow-hidden">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => map.zoomIn()}
                        className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors text-xl font-bold border-b border-slate-200/70"
                        title="Aumentar zoom"
                        aria-label="Aumentar zoom"
                    >
                        +
                    </button>
                    {mostrarDicas && <span className="control-hint right-side">Aumentar zoom</span>}
                </div>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => map.zoomOut()}
                        className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors text-xl font-bold"
                        title="Diminuir zoom"
                        aria-label="Diminuir zoom"
                    >
                        -
                    </button>
                    {mostrarDicas && <span className="control-hint right-side">Diminuir zoom</span>}
                </div>
            </div>
        </div>
    );
};
