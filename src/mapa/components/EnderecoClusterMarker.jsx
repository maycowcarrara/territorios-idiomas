import React, { useMemo } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
    formatEnderecoCodigoExibicao
} from '../../enderecoModel';
import { stopMapDomEvent } from '../utils/mapDomEvents';

const stopLeafletEvent = (event) => {
    if (event?.originalEvent) {
        L.DomEvent.stopPropagation(event.originalEvent);
    }
};

export const EnderecoClusterMarker = ({
    cluster,
    focusMode = false,
    visitadosGrupoFocado = null,
    canMarkVisited = false,
    isAdmin = false,
    isOnline = false,
    onNavigate,
    onEdit,
    onToggleVisited,
    onShare
}) => {
    const map = useMap();
    const currentZoom = map.getZoom();

    const totalVisited = useMemo(() => {
        if (!focusMode || !visitadosGrupoFocado) return 0;
        return cluster.enderecos.filter((e) => visitadosGrupoFocado.has(e.id)).length;
    }, [cluster.enderecos, focusMode, visitadosGrupoFocado]);

    const isAllVisited = focusMode && totalVisited === cluster.count;
    const isPartialVisited = focusMode && totalVisited > 0 && !isAllVisited;

    const icon = useMemo(() => {
        const sizeClass = cluster.count >= 10 ? 'large' : '';
        const statusClass = isAllVisited
            ? 'all-visited'
            : isPartialVisited
                ? 'partial-visited'
                : '';
        const coincidentClass = cluster.isCoincident ? 'coincident' : '';

        const badgeHtml = isAllVisited
            ? '<span class="map-cluster-badge">✓</span>'
            : isPartialVisited
                ? `<span class="map-cluster-sub">${totalVisited}/${cluster.count}</span>`
                : '';

        return L.divIcon({
            className: 'bg-transparent',
            html: `
                <div class="map-cluster-marker ${sizeClass} ${statusClass} ${coincidentClass}">
                    <span class="map-cluster-count">${cluster.count}</span>
                    ${badgeHtml}
                </div>
            `,
            iconSize: cluster.count >= 10 ? [44, 44] : [38, 38],
            iconAnchor: cluster.count >= 10 ? [22, 22] : [19, 19]
        });
    }, [cluster.count, cluster.isCoincident, isAllVisited, isPartialVisited, totalVisited]);

    const handleClick = (event) => {
        if (event?.originalEvent) {
            L.DomEvent.stopPropagation(event.originalEvent);
        }

        const liveZoom = map.getZoom();
        if (cluster.isCoincident || liveZoom >= 18) return;

        map.stop();

        const bounds = L.latLngBounds(cluster.bounds);
        if (!bounds.isValid()) return;

        map.fitBounds(bounds.pad(0.35), {
            maxZoom: 19,
            animate: true
        });
    };

    const tooltipText = cluster.isCoincident
        ? `${cluster.count} endereços no mesmo prédio/local (clique para ver lista)`
        : `${cluster.count} endereços (clique para aproximar)`;

    const shouldShowPopup = cluster.isCoincident || currentZoom >= 18;

    return (
        <Marker
            position={[cluster.lat, cluster.lng]}
            icon={icon}
            zIndexOffset={focusMode ? 850 : 200}
            title={tooltipText}
            keyboard={true}
            eventHandlers={{
                click: handleClick,
                mousedown: stopLeafletEvent,
                touchstart: stopLeafletEvent,
                touchend: stopLeafletEvent
            }}
        >
            <Tooltip direction="top" offset={[0, -18]} className="font-bold text-xs">
                {tooltipText}
            </Tooltip>

            {shouldShowPopup && (
                <Popup className="cluster-enderecos-popup">
                    <div
                        className="flex min-w-[260px] max-w-[300px] flex-col gap-2 p-1"
                        onClick={stopMapDomEvent}
                        onMouseDown={stopMapDomEvent}
                        onTouchStart={stopMapDomEvent}
                        onTouchEnd={stopMapDomEvent}
                    >
                        <div className="border-b border-slate-200 pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                                        {cluster.count}
                                    </span>
                                    <h4 className="text-sm font-black text-slate-800">
                                        {cluster.isCoincident ? 'Endereços no mesmo local' : 'Endereços agrupados'}
                                    </h4>
                                </div>
                            </div>
                            {cluster.enderecos[0]?.bairro && (
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Bairro: {cluster.enderecos[0].bairro}
                                </p>
                            )}
                        </div>

                        <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                            {cluster.enderecos.map((endereco) => {
                                const isVisited = Boolean(visitadosGrupoFocado?.has(endereco.id));
                                const codigoExibicao = formatEnderecoCodigoExibicao(endereco.codigo || endereco.id);

                                return (
                                    <div
                                        key={endereco.id}
                                        className={`rounded-lg border p-2 text-xs transition ${
                                            isVisited
                                                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                                                : 'border-slate-200 bg-slate-50 text-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-extrabold text-slate-900">
                                                        {codigoExibicao}
                                                    </span>
                                                    {focusMode && (
                                                        <span
                                                            className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                                                isVisited
                                                                    ? 'bg-emerald-200 text-emerald-800'
                                                                    : 'bg-teal-100 text-teal-800'
                                                            }`}
                                                        >
                                                            {isVisited ? 'Pregado' : 'Pendente'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 font-medium leading-tight text-slate-600">
                                                    {endereco.endereco || 'Sem endereço informado'}
                                                </p>
                                                {endereco.quantidadeEstrangeiros > 0 && (
                                                    <span className="mt-1 inline-block text-[11px] font-semibold text-slate-500">
                                                        {endereco.quantidadeEstrangeiros} pessoa(s)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-1.5">
                                            {focusMode && canMarkVisited && (
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleVisited?.(endereco)}
                                                    className={`rounded px-2 py-1 text-[11px] font-extrabold transition ${
                                                        isVisited
                                                            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                    }`}
                                                >
                                                    {isVisited ? 'Desmarcar' : 'Marcar pregado'}
                                                </button>
                                            )}
                                            {onNavigate && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigate(endereco)}
                                                    className="rounded border border-blue-200 bg-white px-2 py-1 text-[11px] font-extrabold text-blue-700 hover:bg-blue-50"
                                                >
                                                    Navegar
                                                </button>
                                            )}
                                            {isAdmin && onEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(endereco)}
                                                    disabled={!isOnline}
                                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                                >
                                                    Editar
                                                </button>
                                            )}
                                            {onShare && (
                                                <button
                                                    type="button"
                                                    onClick={() => onShare(endereco)}
                                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                                                >
                                                    Compartilhar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Popup>
            )}
        </Marker>
    );
};
