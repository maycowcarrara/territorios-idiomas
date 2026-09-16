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
        <div ref={controlsRef} className="map-popup-aware-control absolute bottom-6 right-4 z-[400] flex flex-col gap-3" onClick={stopMapDomEvent}>
            <button
                onClick={alternarLocalizacao}
                aria-pressed={rastreandoLocalizacao}
                title={rastreandoLocalizacao ? "Desativar rastreamento da minha localização" : "Ativar rastreamento da minha localização"}
                className={`relative w-12 h-12 flex items-center justify-center shadow-xl border active:scale-95 transition-all duration-200 rounded-full mb-2 ${rastreandoLocalizacao ? 'bg-blue-600 text-white border-blue-700 shadow-blue-500/30' : 'bg-white text-blue-600 border-slate-200 hover:bg-slate-50'}`}
            >
                {buscando ? (
                    <div className={`animate-spin rounded-full h-5 w-5 border-2 ${rastreandoLocalizacao ? 'border-blue-100 border-t-white' : 'border-slate-300 border-t-blue-600'}`}></div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                    </svg>
                )}
                <span className={`absolute left-1/2 -translate-x-1/2 -top-3 flex items-center gap-1 rounded-full px-1.5 py-0.5 border shadow-sm text-[9px] font-bold tracking-wide ${rastreandoLocalizacao ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                    <span className={`block w-1.5 h-1.5 rounded-full ${rastreandoLocalizacao ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    {rastreandoLocalizacao ? 'ON' : 'OFF'}
                </span>
                {mostrarDicas && <span className="control-hint right-side">Ligar GPS</span>}
            </button>
            <div className="flex flex-col shadow-xl rounded-xl border border-slate-200 bg-white">
                <div className="relative">
                    <button onClick={() => map.zoomIn()} className="w-12 h-12 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition text-2xl font-bold border-b border-slate-100 rounded-t-xl" title="Aumentar zoom">+</button>
                    {mostrarDicas && <span className="control-hint right-side">Aumentar zoom</span>}
                </div>
                <div className="relative">
                    <button onClick={() => map.zoomOut()} className="w-12 h-12 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition text-2xl font-bold rounded-b-xl" title="Diminuir zoom">-</button>
                    {mostrarDicas && <span className="control-hint right-side">Diminuir zoom</span>}
                </div>
            </div>
        </div>
    );
};
