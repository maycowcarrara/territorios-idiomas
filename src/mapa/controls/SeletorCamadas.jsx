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
        <div ref={controlsRef} className="map-popup-aware-control absolute bottom-6 left-4 z-[400] flex flex-col gap-3" onClick={stopMapDomEvent}>
            {isAdmin && (
                <div className="relative">
                    <div className="flex w-12 flex-col overflow-hidden rounded-lg border-2 border-white bg-white shadow-lg">
                        <button
                            type="button"
                            onClick={() => onChangeModoVisualizacao(MAPA_VISUALIZACAO.TERRITORIOS)}
                            className={`flex h-8 items-center justify-center text-xs font-black transition ${modoVisualizacao === MAPA_VISUALIZACAO.TERRITORIOS ? 'bg-indigo-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                            title="Ver territórios"
                            aria-label="Ver territórios"
                        >
                            T
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeModoVisualizacao(MAPA_VISUALIZACAO.ENDERECOS)}
                            className={`flex h-8 items-center justify-center border-t border-slate-100 text-xs font-black transition ${modoVisualizacao === MAPA_VISUALIZACAO.ENDERECOS ? 'bg-teal-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                            title="Ver endereços"
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
                    <button onClick={() => setShowRefs(!showRefs)} className={`w-12 h-12 rounded-lg bg-white shadow-lg flex items-center justify-center border-2 transition-all ${showRefs ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'}`} title="Mostrar/Ocultar Pontos de Referência">📍</button>
                    {mostrarDicas && <span className="control-hint left-side">Pontos de referência</span>}
                </div>
            )}
            {hasCondominios && (
                <div className="relative">
                    <button onClick={() => setShowCondos(!showCondos)} className={`w-12 h-12 rounded-lg bg-white shadow-lg flex items-center justify-center border-2 transition-all ${showCondos ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`} title="Mostrar/Ocultar Condomínios">🏢</button>
                    {mostrarDicas && <span className="control-hint left-side">Condomínios</span>}
                </div>
            )}
            {hasBairros && (
                <div className="relative">
                    <button onClick={() => setShowBairros(!showBairros)} className={`w-12 h-12 rounded-lg bg-white shadow-lg flex items-center justify-center border-2 text-lg font-black transition-all ${showBairros ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-400'}`} title="Mostrar/Ocultar bairros urbanos">▦</button>
                    {mostrarDicas && <span className="control-hint left-side">Bairros urbanos</span>}
                </div>
            )}
            <div className="relative">
                <button onClick={alternarCamada} className={`map-layer-btn ${classeBotao}`} title={tituloBotao} />
                {mostrarDicas && <span className="control-hint left-side">Mudar mapa</span>}
            </div>
        </div>
    );
};
