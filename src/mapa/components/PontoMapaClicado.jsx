import React, { useRef, useEffect, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export const PontoMapaClicado = ({ ponto, canCreate, onCreate, onShare, onClose }) => {
    const markerRef = useRef(null);
    const isSearchPoint = ponto?.origem === 'busca-endereco';
    const icon = useMemo(() => L.divIcon({
        className: 'bg-transparent',
        html: `<div class="map-click-marker ${isSearchPoint ? 'search' : ''}">${isSearchPoint ? 'S' : '+'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    }), [isSearchPoint]);

    useEffect(() => {
        if (!ponto) return;
        const timeoutId = window.setTimeout(() => {
            markerRef.current?.openPopup();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [ponto]);

    if (!ponto) return null;

    return (
        <Marker ref={markerRef} position={[ponto.lat, ponto.lng]} icon={icon} eventHandlers={{ click: (event) => event.originalEvent && L.DomEvent.stopPropagation(event.originalEvent) }}>
            <Popup>
                <div className="flex min-w-[190px] flex-col gap-2 p-1 text-center">
                    <h3 className="text-sm font-bold text-slate-800">{isSearchPoint ? 'Resultado da busca' : 'Local selecionado'}</h3>
                    {isSearchPoint && ponto.endereco && (
                        <p className="max-w-[220px] text-xs font-semibold leading-snug text-slate-500">{ponto.endereco}</p>
                    )}
                    <button onClick={onShare} className="popup-btn-action bg-blue-600 text-white hover:bg-blue-700">
                        Compartilhar localização
                    </button>
                    {canCreate && (
                        <button onClick={() => onCreate(ponto)} className="popup-btn-action bg-teal-700 text-white hover:bg-teal-800">
                            {isSearchPoint ? 'Cadastrar neste ponto' : 'Cadastrar endereço'}
                        </button>
                    )}
                    <button onClick={onClose} className="text-xs font-semibold text-slate-400 underline">
                        Fechar
                    </button>
                </div>
            </Popup>
        </Marker>
    );
};
