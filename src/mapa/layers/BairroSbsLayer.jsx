import React from 'react';
import { Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getBairroLeafletPositions } from '../../bairrosSbs';
import { createEmptyBairroResumo, getBairroSbsColor } from './bairroSbsUtils';

export const BairroSbsLayer = ({
    bairrosGeoJson,
    resumoPorBairro,
    mostrarCobertura = false,
    onLongPressStart,
    onLongPressEnd,
    onLongPressCancel,
    onContextMenu,
    shouldIgnoreClick
}) => {
    const features = bairrosGeoJson?.features || [];

    return (
        <>
            {features.map((feature, index) => {
                const bairroId = feature.properties.bairroId;
                const nome = feature.properties.bairroNome;
                const resumo = resumoPorBairro.get(bairroId) || createEmptyBairroResumo();
                const positions = getBairroLeafletPositions(feature);
                const colors = getBairroSbsColor(index);
                const completo = resumo.total > 0 && resumo.faltando === 0;
                const temAndamento = resumo.emAndamento > 0;
                const percentual = resumo.total > 0
                    ? Math.round((resumo.cobertos / resumo.total) * 100)
                    : 0;
                const pathOptions = mostrarCobertura
                    ? {
                        color: colors.border,
                        fillColor: colors.fill,
                        weight: completo ? 2.6 : temAndamento ? 2.2 : 1.6,
                        opacity: resumo.total > 0 ? 0.88 : 0.62,
                        fillOpacity: resumo.total > 0 ? 0.24 : 0.11,
                        dashArray: resumo.total > 0 ? undefined : '7 8'
                    }
                    : {
                        color: colors.border,
                        fillColor: colors.fill,
                        weight: 1.6,
                        opacity: 0.72,
                        fillOpacity: 0.14,
                        dashArray: undefined
                    };

                return (
                    <Polygon
                        key={bairroId}
                        positions={positions}
                        pathOptions={pathOptions}
                        eventHandlers={{
                            mousedown: onLongPressStart,
                            touchstart: onLongPressStart,
                            mouseup: onLongPressEnd,
                            touchend: onLongPressEnd,
                            touchcancel: onLongPressCancel,
                            contextmenu: (event) => {
                                onContextMenu?.(event);
                                if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
                            },
                            click: (event) => {
                                if (shouldIgnoreClick?.()) {
                                    if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
                                    event.target?.closePopup?.();
                                    return;
                                }

                                if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
                            }
                        }}
                    >
                        <Popup className="bairro-sbs-popup">
                            <div className="min-w-[220px] max-w-[235px] bg-white">
                                <div className="h-1" style={{ backgroundColor: colors.border }} />
                                <div className="px-3 pb-3 pt-2.5">
                                    <div className="flex items-start gap-2 pr-6">
                                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors.border }} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-black leading-tight text-slate-800">{nome}</div>
                                            <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Bairro urbano</div>
                                        </div>
                                    </div>

                                    {mostrarCobertura && (
                                        <>
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between gap-3 text-xs font-extrabold">
                                                    <span style={{ color: colors.text }}>{resumo.cobertos}/{resumo.total} cobertos</span>
                                                    <span className="text-slate-500">{percentual}%</span>
                                                </div>
                                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${percentual}%`,
                                                            backgroundColor: colors.border
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-100 text-center">
                                                <div className="bg-white px-2 py-1.5">
                                                    <div className="text-[9px] font-black uppercase leading-none text-slate-400">Total</div>
                                                    <div className="mt-1 text-base font-black leading-none text-slate-800">{resumo.total}</div>
                                                </div>
                                                <div className="border-x border-slate-100 bg-white px-2 py-1.5">
                                                    <div className="text-[9px] font-black uppercase leading-none text-emerald-600">Cobertos</div>
                                                    <div className="mt-1 text-base font-black leading-none text-emerald-700">{resumo.cobertos}</div>
                                                </div>
                                                <div className="bg-white px-2 py-1.5">
                                                    <div className="text-[9px] font-black uppercase leading-none text-amber-600">Faltam</div>
                                                    <div className="mt-1 text-base font-black leading-none text-amber-700">{resumo.faltando}</div>
                                                </div>
                                            </div>

                                            {resumo.emAndamento > 0 && (
                                                <div className="mt-2 rounded-md bg-blue-50 px-2 py-1.5 text-center text-xs font-extrabold text-blue-700">
                                                    {resumo.emAndamento} em andamento
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Polygon>
                );
            })}
        </>
    );
};
