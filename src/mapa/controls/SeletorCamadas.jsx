import React from 'react';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';
import { MAPA_VISUALIZACAO } from '../constants/mapaConstants';

export const SeletorCamadas = ({
    tipoMapa,
    setTipoMapa,
    isAdmin,
    modoVisualizacao,
    onChangeModoVisualizacao,
    showRefs,
    setShowRefs,
    showCondos,
    setShowCondos,
    showBairros,
    setShowBairros,
    mostrarDicas,
    hasReferencias,
    hasCondominios,
    hasBairros
}) => {
    const controlsRef = useLeafletDomEventIsolation();

    const alternarCamada = () => {
        if (tipoMapa === 'google') setTipoMapa('satelite');
        else if (tipoMapa === 'satelite') setTipoMapa('padrao');
        else setTipoMapa('google');
    };

    let classeBotao = '';
    let tituloBotao = '';

    if (tipoMapa === 'google') {
        classeBotao = 'thumb-satelite';
        tituloBotao = "Mudar para Satélite";
    } else if (tipoMapa === 'satelite') {
        classeBotao = 'thumb-rua';
        tituloBotao = "Mudar para OpenStreetMap";
    } else {
        classeBotao = 'thumb-google';
        tituloBotao = "Mudar para Google Maps";
    }

    return (
        <div ref={controlsRef} className="map-popup-aware-control absolute bottom-6 left-4 z-[400] flex flex-col gap-2.5" onClick={stopMapDomEvent}>
            {isAdmin && (
                <div className="relative">
                    <div className="flex w-11 sm:w-12 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-md shadow-slate-900/10 backdrop-blur-md">
                        <button
                            type="button"
                            onClick={() => onChangeModoVisualizacao(MAPA_VISUALIZACAO.TERRITORIOS)}
                            className={`flex h-8 sm:h-9 items-center justify-center text-xs font-black transition-all ${modoVisualizacao === MAPA_VISUALIZACAO.TERRITORIOS ? 'bg-indigo-700 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                            title="Ver territórios (T)"
                            aria-label="Ver territórios"
                        >
                            T
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeModoVisualizacao(MAPA_VISUALIZACAO.ENDERECOS)}
                            className={`flex h-8 sm:h-9 items-center justify-center border-t border-slate-200/70 text-xs font-black transition-all ${modoVisualizacao === MAPA_VISUALIZACAO.ENDERECOS ? 'bg-teal-700 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                            title="Ver endereços (E)"
                            aria-label="Ver endereços"
                        >
                            E
                        </button>
                    </div>
                    {mostrarDicas && <span className="control-hint left-side">Visão do mapa</span>}
                </div>
            )}
            {hasReferencias && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowRefs(!showRefs)}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border shadow-md shadow-slate-900/10 backdrop-blur-md transition-all active:scale-95 ${showRefs ? 'border-blue-500 bg-blue-50/95 text-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200/90 bg-white/95 text-slate-400 hover:text-slate-600'}`}
                        title="Mostrar/Ocultar Pontos de Referência"
                        aria-pressed={showRefs}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill={showRefs ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={showRefs ? 0 : 2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                    </button>
                    {mostrarDicas && <span className="control-hint left-side">Pontos de referência</span>}
                </div>
            )}
            {hasCondominios && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowCondos(!showCondos)}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border shadow-md shadow-slate-900/10 backdrop-blur-md transition-all active:scale-95 ${showCondos ? 'border-orange-500 bg-orange-50/95 text-orange-600 ring-2 ring-orange-500/20' : 'border-slate-200/90 bg-white/95 text-slate-400 hover:text-slate-600'}`}
                        title="Mostrar/Ocultar Condomínios"
                        aria-pressed={showCondos}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                        </svg>
                    </button>
                    {mostrarDicas && <span className="control-hint left-side">Condomínios</span>}
                </div>
            )}
            {hasBairros && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowBairros(!showBairros)}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border shadow-md shadow-slate-900/10 backdrop-blur-md transition-all active:scale-95 ${showBairros ? 'border-teal-600 bg-teal-50/95 text-teal-700 ring-2 ring-teal-500/20' : 'border-slate-200/90 bg-white/95 text-slate-400 hover:text-slate-600'}`}
                        title="Mostrar/Ocultar bairros urbanos"
                        aria-pressed={showBairros}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                        </svg>
                    </button>
                    {mostrarDicas && <span className="control-hint left-side">Bairros urbanos</span>}
                </div>
            )}
            <div className="relative">
                <button onClick={alternarCamada} className={`map-layer-btn ${classeBotao} shadow-md shadow-slate-900/15 rounded-2xl`} title={tituloBotao} />
                {mostrarDicas && <span className="control-hint left-side">Mudar mapa</span>}
            </div>
        </div>
    );
};
