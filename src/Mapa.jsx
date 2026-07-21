import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Popup, CircleMarker, Tooltip, useMapEvents, useMap, Marker, Polyline } from 'react-leaflet';
import { onSnapshot, setDoc, deleteDoc, doc, arrayUnion, collection, getDocs } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { db } from './firebase';
import { clearMapaDataCache, loadMapaData } from './mapData';
import { getFeatureId } from './mapaUtils';
import {
    buildBaseTerritorioDefaults,
    buildTerritorioStateMergeSeed,
    buildTerritorioStateSeed,
    getTerritorioProgresso,
    getTerritorioBaseRef,
    getTerritorioStateRef,
    mergeTerritorioData,
    TERRITORIO_STATUS
} from './territorioContext';
import { isNormalContext } from './sistema';
import {
    buildHistoricoTerritorio,
    buildNovoCicloTerritorio,
    createDesignacaoId,
    enqueueTerritorioAction,
    finalizarTerritorioDesignado
} from './territorioActions';
import { groupNoteDocsByQuadra, getTerritorioNotasCollectionRef, isLegacyNoteId, mergeTerritorioNotas } from './territorioNotes';
import { reduceNotasComOutbox, reduceTerritorioComOutbox, TERRITORIO_ACTION_TYPE } from './territorioOfflineModel';
import { getGeoJsonBounds, getMapWarmProfile, scheduleTileWarm, warmMapTilesForBounds, writeOfflineMapViewportBounds } from './mapOfflineCache';
import { buildPublicAppRouteUrl } from './publicAppUrl';
import { buildAppLocationUrl, buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl, buildLocationShareText, buildWhatsAppShareUrl } from './shareLinks';
import {
    calculateGrupoEnderecoStats,
    createGrupoEnderecoManual,
    createEnderecoManual,
    devolverGrupoEndereco,
    designarGrupoEndereco,
    ENDERECO_STATUS,
    finalizarGrupoEnderecoDesignado,
    formatEnderecoCodigoExibicao,
    formatGrupoEnderecoCodigoExibicao,
    formatGrupoEnderecoNomeExibicao,
    getGrupoEnderecoProgresso,
    GRUPO_ENDERECO_STATUS,
    getEnderecosCollectionRef,
    getGruposEnderecoCollectionRef,
    getGrupoEnderecoDocIdFromSequence,
    removerEnderecoDoGrupo,
    setEnderecoArquivado,
    setGrupoEnderecoArquivado,
    toggleEnderecoVisitadoGrupo,
    updateEnderecoBasico
} from './enderecoModel';
import { extractTerritorioCodigo, normalizeTerritorioNome } from './territorioNome';
import L from 'leaflet';
import { useUiFeedback } from './uiFeedback';
import { enviarEventoNotificacao } from './notificationRelay';
import { MAP_COLORS, getTerritorioDisponivelColors } from './mapLegend';

const normalizeEmailValue = (value) => String(value || '').trim().toLowerCase();

const stopMapDomEvent = (event) => {
    event?.stopPropagation?.();
    if (event?.nativeEvent) {
        L.DomEvent.stopPropagation(event.nativeEvent);
    }
};

const useLeafletDomEventIsolation = () => {
    return useCallback((element) => {
        if (!element) return;
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
    }, []);
};

const getGrupoEnderecoCanonicalKey = (value) => {
    const codigo = formatGrupoEnderecoCodigoExibicao(value);
    return String(codigo || value || '').trim().toLowerCase();
};

const getGrupoEnderecoDocIdCandidate = (value) => {
    const codigo = formatGrupoEnderecoCodigoExibicao(value);
    const match = String(codigo || '').match(/^T-(\d+)$/i);
    return match ? getGrupoEnderecoDocIdFromSequence(match[1]) : String(value || '').trim();
};

const isSameGrupoEndereco = (grupo, grupoId) => {
    if (!grupo || !grupoId) return false;
    const alvo = getGrupoEnderecoCanonicalKey(grupoId);
    return [grupo.id, grupo.codigo]
        .filter(Boolean)
        .some((value) => getGrupoEnderecoCanonicalKey(value) === alvo);
};

const addEnderecoUnico = (destino, vistos, endereco) => {
    if (!endereco?.id || vistos.has(endereco.id)) return;
    vistos.add(endereco.id);
    destino.push(endereco);
};

const resolveEnderecosGrupoFromMaps = (grupo, exactMap, canonicalMap, enderecosById) => {
    if (!grupo) return [];

    const resultado = [];
    const vistos = new Set();

    (grupo.enderecoIds || []).forEach((enderecoId) => {
        const endereco = enderecosById?.get(enderecoId);
        if (endereco) addEnderecoUnico(resultado, vistos, endereco);
    });

    const aliases = [
        grupo.id,
        grupo.codigo,
        formatGrupoEnderecoCodigoExibicao(grupo.id),
        formatGrupoEnderecoCodigoExibicao(grupo.codigo)
    ].filter(Boolean);

    aliases.forEach((alias) => {
        (exactMap.get(alias) || []).forEach((endereco) => addEnderecoUnico(resultado, vistos, endereco));
        (canonicalMap.get(getGrupoEnderecoCanonicalKey(alias)) || []).forEach((endereco) => addEnderecoUnico(resultado, vistos, endereco));
    });

    return resultado;
};

const buildSyntheticGrupoEndereco = (grupoId, enderecosGrupo) => {
    const primeiroEndereco = enderecosGrupo[0] || {};
    const codigo = primeiroEndereco.grupoCodigo || primeiroEndereco.grupoId || grupoId;
    const codigoExibicao = formatGrupoEnderecoCodigoExibicao(codigo || grupoId);
    const id = primeiroEndereco.grupoId || getGrupoEnderecoDocIdCandidate(codigo || grupoId) || grupoId;
    const stats = calculateGrupoEnderecoStats(enderecosGrupo);

    return {
        id,
        codigo,
        nome: `${codigoExibicao || 'Território'} - Endereços de idioma`,
        status: GRUPO_ENDERECO_STATUS.ATIVO,
        enderecoIds: enderecosGrupo.map((endereco) => endereco.id).filter(Boolean),
        ...stats,
        designadoPara: null,
        designadoNome: null,
        dataDesignacao: null,
        designacaoId: null,
        cicloAtual: null,
        enderecos_visitados: [],
        historico: [],
        ultimaConclusao: null,
        sintetico: true
    };
};

const mergeGrupoEnderecoRuntimeStats = (grupo, enderecosGrupo = []) => {
    const stats = enderecosGrupo.length ? calculateGrupoEnderecoStats(enderecosGrupo) : null;
    const enderecoIds = Array.isArray(grupo.enderecoIds) && grupo.enderecoIds.length
        ? grupo.enderecoIds
        : enderecosGrupo.map((endereco) => endereco.id).filter(Boolean);

    return {
        ...grupo,
        status: grupo.status || GRUPO_ENDERECO_STATUS.ATIVO,
        enderecoIds,
        totalEnderecos: Math.max(
            Math.trunc(Number(grupo.totalEnderecos) || 0),
            Math.trunc(Number(stats?.totalEnderecos) || 0)
        ),
        totalEstrangeiros: Math.max(
            Math.trunc(Number(grupo.totalEstrangeiros) || 0),
            Math.trunc(Number(stats?.totalEstrangeiros) || 0)
        ),
        centro: grupo.centro || stats?.centro || null,
        bounds: grupo.bounds || stats?.bounds || null
    };
};

// --- CSS ---
const cssTooltip = `
  @keyframes gps-pulse {
    0% { transform: scale(0.72); opacity: 0.75; }
    70% { transform: scale(1.15); opacity: 0; }
    100% { transform: scale(1.2); opacity: 0; }
  }

  .label-territorio { background: transparent; border: none; box-shadow: none; font-family: 'Bahnschrift', sans-serif-condensed, sans-serif; text-align: center; line-height: 1.1; pointer-events: none; }
  .label-nome { font-weight: 700; font-size: 14px; color: #1e3a8a; text-shadow: 2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff, 1px 1px #fff, -1px -1px #fff; display: block; font-stretch: condensed; letter-spacing: -0.5px; margin-bottom: 2px; white-space: normal; max-width: 140px; margin-left: auto; margin-right: auto; }
  .label-status { font-size: 11px; font-weight: 700; color: #444; text-shadow: 1px 1px 0px rgba(255,255,255,0.9); background-color: rgba(255,255,255,0.7); padding: 1px 6px; border-radius: 8px; display: inline-block; }
  .label-tempo { display: block; font-size: 10px; font-weight: 800; color: #7f1d1d; margin-top: 2px; text-shadow: 1px 1px 0px rgba(255,255,255,0.8); text-transform: uppercase; }
  .label-tempo-compacto { display: inline-block; font-size: 9px; font-weight: 800; color: #7c2d12; margin-top: 1px; padding: 1px 5px; border-radius: 999px; background: rgba(255,255,255,0.72); border: 1px solid rgba(194, 65, 12, 0.18); text-shadow: 1px 1px 0px rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.2px; }
  .sem-fundo { background: transparent; border: none; box-shadow: none; }
  .map-poi-marker { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.94); border: 2px solid rgba(255,255,255,0.98); box-shadow: 0 3px 10px rgba(15,23,42,0.32), 0 0 0 1px rgba(15,23,42,0.08); font-size: 18px; line-height: 1; cursor: help; }
  .map-poi-marker.ref { border-color: ${MAP_COLORS.apoio.referencia}; }
  .map-poi-marker.condo { border-color: ${MAP_COLORS.apoio.condominio}; }
  .map-address-marker { min-width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: ${MAP_COLORS.endereco.ativo}; color: white; border: 3px solid white; box-shadow: 0 4px 12px rgba(15,23,42,0.35); font-size: 12px; line-height: 1; font-weight: 900; padding: 0 6px; white-space: nowrap; }
  .map-address-marker.grouped { background: ${MAP_COLORS.endereco.agrupado}; }
  .map-address-marker.selected { background: ${MAP_COLORS.endereco.selecionado}; color: #111827; }
  .map-address-marker.archived { background: ${MAP_COLORS.endereco.arquivado}; opacity: 0.82; }
  .map-address-marker.focus-pending { background: ${MAP_COLORS.endereco.ativo}; transform: scale(1.08); }
  .map-address-marker.focus-done { background: ${MAP_COLORS.endereco.visitado}; transform: scale(1.08); }
  .map-group-marker { min-width: 44px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: ${MAP_COLORS.grupoEndereco.ativo.marker}; color: white; border: 3px solid white; box-shadow: 0 4px 14px rgba(15,23,42,0.38); font-size: 12px; line-height: 1; font-weight: 900; padding: 0 7px; white-space: nowrap; }
  .map-group-marker.archived { background: ${MAP_COLORS.grupoEndereco.arquivado.marker}; opacity: 0.86; }
  .map-group-marker.assigned { background: ${MAP_COLORS.grupoEndereco.designado.marker}; }
  .map-group-marker.finished { background: ${MAP_COLORS.grupoEndereco.finalizado.marker}; }
  .map-click-marker { width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: ${MAP_COLORS.apoio.clique}; color: white; border: 3px solid white; box-shadow: 0 4px 12px rgba(37,99,235,0.35); font-size: 16px; line-height: 1; font-weight: 900; }
  .control-hint { position: absolute; z-index: 20; top: 50%; transform: translateY(-50%); white-space: nowrap; border-radius: 999px; background: rgba(15,23,42,0.72); color: white; font-size: 11px; font-weight: 700; line-height: 1; padding: 7px 10px; box-shadow: 0 6px 16px rgba(15,23,42,0.18); pointer-events: none; animation: control-hint-fade 4s ease-in-out forwards; }
  .control-hint.left-side { left: 58px; }
  .control-hint.right-side { right: 58px; }
  @keyframes control-hint-fade {
    0% { opacity: 0; transform: translateY(-50%) translateY(4px); }
    15% { opacity: 1; transform: translateY(-50%) translateY(0); }
    78% { opacity: 1; transform: translateY(-50%) translateY(0); }
    100% { opacity: 0; transform: translateY(-50%) translateY(-4px); }
  }
  
  .map-layer-btn { width: 48px; height: 48px; border-radius: 8px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.1s, border-color 0.2s; overflow: hidden; position: relative; background-size: cover; }
  .map-layer-btn:active { transform: scale(0.95); }
  .map-layer-btn.active { border-color: ${MAP_COLORS.apoio.clique}; transform: scale(1.05); z-index: 10; }
  
  .thumb-rua { background: #e5e7eb; } 
  .thumb-rua::after { content: '🗺️'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; }

  .thumb-google { background: #fce7b2; } 
  .thumb-google::after { content: '📍'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; }
  
  .thumb-satelite {
    background-color: #172554;
    background-image: 
      radial-gradient(circle at 15% 25%, white 1px, transparent 1.5px),
      radial-gradient(circle at 75% 15%, rgba(255,255,255,0.8) 1px, transparent 1.5px),
      radial-gradient(circle at 60% 85%, rgba(255,255,255,0.9) 1px, transparent 1.5px),
      radial-gradient(circle at 25% 80%, rgba(255,255,255,0.6) 1px, transparent 1.5px),
      radial-gradient(circle at 85% 65%, rgba(255,255,255,0.7) 1px, transparent 1.5px);
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .thumb-satelite::after { 
    content: '🛰️'; 
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
    font-size: 24px; 
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.5)); 
  }

  .leaflet-tooltip.sem-fundo {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .popup-btn-action { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 12px; transition: background-color 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.1); cursor: pointer; }
  .popup-btn-action:disabled { opacity: 0.7; cursor: not-allowed; }
`;

// Função Centroide
const calcularCentroide = (coords) => {
    let lat = 0, lng = 0, n = coords.length;
    coords.forEach(p => { lat += p[1]; lng += p[0]; });
    return { lat: lat / n, lng: lng / n };
};

const toRad = (value) => (value * Math.PI) / 180;

const calcularDistanciaMetros = (origem, destino) => {
    if (!origem || !destino) return 0;

    const raioTerra = 6371000;
    const deltaLat = toRad(destino.lat - origem.lat);
    const deltaLng = toRad(destino.lng - origem.lng);
    const lat1 = toRad(origem.lat);
    const lat2 = toRad(destino.lat);

    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

    return 2 * raioTerra * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcularRumo = (origem, destino) => {
    if (!origem || !destino) return null;

    const lat1 = toRad(origem.lat);
    const lat2 = toRad(destino.lat);
    const deltaLng = toRad(destino.lng - origem.lng);

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
        - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const DISTANCIA_MINIMA_ATUALIZACAO_METROS = 0.8;
const DISTANCIA_MINIMA_TRILHA_METROS = 3;
const DISTANCIA_MINIMA_DIRECAO_METROS = 2;
const PRECISAO_MAXIMA_INICIAL_NATIVE_METROS = 120;
const PRECISAO_MAXIMA_RASTREAMENTO_NATIVE_METROS = 80;
const PRECISAO_MAXIMA_INICIAL_WEB_METROS = 300;
const PRECISAO_MAXIMA_RASTREAMENTO_WEB_METROS = 150;
const GEOLOCATION_TIMEOUT_NATIVE_MS = 10000;
const GEOLOCATION_TIMEOUT_WEB_MS = 20000;
const GEOLOCATION_MAXIMUM_AGE_NATIVE_MS = 1500;
const GEOLOCATION_MAXIMUM_AGE_WEB_MS = 5000;
const getEnvNumber = (key, fallback) => {
    const value = Number.parseFloat(import.meta.env[key]);
    return Number.isFinite(value) ? value : fallback;
};
const MAP_INITIAL_CENTER = [
    getEnvNumber('VITE_MAP_CENTER_LAT', -26.485),
    getEnvNumber('VITE_MAP_CENTER_LNG', -51.995)
];
const MAP_INITIAL_ZOOM = getEnvNumber('VITE_MAP_INITIAL_ZOOM', 14);
const ADMIN_OFFLINE_MESSAGE = 'Você está offline. Ações administrativas precisam de conexão para evitar conflito de designações. Conecte-se para continuar.';

// --- DEEP LINK HANDLER ---
const DeepLinkHandler = () => {
    const map = useMap();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const boundsParam = params.get('bounds');
        if (boundsParam) {
            const parts = boundsParam.split(',').map(parseFloat);
            if (parts.length === 4) {
                const [minLat, minLng, maxLat, maxLng] = parts;
                const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
                setTimeout(() => {
                    map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
                }, 500);
                return;
            }
        }
        const lat = params.get('lat');
        const lng = params.get('lng');
        const z = params.get('z');
        if (lat && lng) {
            setTimeout(() => {
                map.flyTo([parseFloat(lat), parseFloat(lng)], parseFloat(z) || 17, { animate: true, duration: 1.5 });
            }, 500);
        }
    }, [location, map]);
    return null;
};

// --- COMPONENTES DE UI ---

const SeletorCamadas = ({
    tipoMapa,
    setTipoMapa,
    showRefs,
    setShowRefs,
    showCondos,
    setShowCondos,
    mostrarDicas,
    hasReferencias,
    hasCondominios
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
        <div ref={controlsRef} className="absolute bottom-6 left-4 z-[400] flex flex-col gap-3" onClick={stopMapDomEvent}>
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
            <div className="relative">
                <button onClick={alternarCamada} className={`map-layer-btn ${classeBotao}`} title={tituloBotao} />
                {mostrarDicas && <span className="control-hint left-side">Mudar mapa</span>}
            </div>
        </div>
    );
};

const CacheMapaOffline = ({ geoJsonData, isOnline, tipoMapa }) => {
    const map = useMap();

    useEffect(() => {
        if (!geoJsonData || !isOnline) return;

        const bounds = getGeoJsonBounds(geoJsonData);
        if (!bounds) return;

        const profile = getMapWarmProfile();
        return scheduleTileWarm(() => warmMapTilesForBounds({
            bounds,
            zooms: profile.overviewZooms,
            layerTypes: [tipoMapa],
            maxTilesPerZoom: Math.max(10, profile.primaryMaxTilesPerZoom - 4)
        }), {
            delayMs: 6000,
            timeoutMs: 5000
        });
    }, [geoJsonData, isOnline, tipoMapa]);

    useEffect(() => {
        if (!isOnline) return undefined;

        let timeoutId = null;
        let cancelWarm = null;
        let cancelSecondaryWarm = null;
        const aquecerViewport = () => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                const profile = getMapWarmProfile();
                const zoomAtual = Math.round(map.getZoom());
                const bounds = map.getBounds();
                const zooms = [...new Set([
                    Math.max(12, zoomAtual - profile.viewportZoomOffset),
                    Math.max(12, zoomAtual),
                ])];

                if (cancelWarm) {
                    cancelWarm();
                }

                if (cancelSecondaryWarm) {
                    cancelSecondaryWarm();
                }

                cancelWarm = scheduleTileWarm(() => warmMapTilesForBounds({
                    bounds,
                    zooms,
                    layerTypes: [tipoMapa],
                    maxTilesPerZoom: profile.primaryMaxTilesPerZoom
                }), {
                    delayMs: 1200,
                    timeoutMs: 3500
                });

                if (profile.allowSecondaryLayers && profile.secondaryMaxTilesPerZoom > 0) {
                    const outrosTipos = ['padrao', 'google', 'satelite'].filter((layerType) => layerType !== tipoMapa);
                    cancelSecondaryWarm = scheduleTileWarm(() => warmMapTilesForBounds({
                        bounds,
                        zooms: [zoomAtual],
                        layerTypes: outrosTipos,
                        maxTilesPerZoom: profile.secondaryMaxTilesPerZoom
                    }), {
                        delayMs: 9000,
                        timeoutMs: 5000
                    });
                }
            }, 500);
        };

        aquecerViewport();
        map.on('moveend zoomend', aquecerViewport);

        return () => {
            window.clearTimeout(timeoutId);
            if (cancelWarm) {
                cancelWarm();
            }
            if (cancelSecondaryWarm) {
                cancelSecondaryWarm();
            }
            map.off('moveend zoomend', aquecerViewport);
        };
    }, [isOnline, map, tipoMapa]);

    return null;
};

const ControlesNavegacao = ({
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
    const [buscando, setBuscando] = useState(false);
    const isNativePlatform = Capacitor.isNativePlatform();
    const watchIdRef = useRef(null);
    const primeiraCentralizacaoRef = useRef(false);
    const ultimaPosicaoBrutaRef = useRef(null);
    const ultimaPosicaoAceitaRef = useRef(null);
    const limparDirecaoTimeoutRef = useRef(null);

    useEffect(() => {
        const limparRastreamentoVisual = () => {
            setPosicaoUsuario(null);
            setTrilhaUsuario([]);
            setDirecaoUsuario(null);
            ultimaPosicaoBrutaRef.current = null;
            ultimaPosicaoAceitaRef.current = null;
            primeiraCentralizacaoRef.current = false;
            setBuscando(false);
            if (limparDirecaoTimeoutRef.current) {
                window.clearTimeout(limparDirecaoTimeoutRef.current);
                limparDirecaoTimeoutRef.current = null;
            }
        };

        const pararWatch = () => {
            if (watchIdRef.current === null) return;

            if (isNativePlatform) {
                void Geolocation.clearWatch({ id: watchIdRef.current });
            } else if (navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }

            watchIdRef.current = null;
        };

        if (!rastreandoLocalizacao) {
            pararWatch();
            limparRastreamentoVisual();
            return undefined;
        }

        if (!isNativePlatform && !navigator.geolocation) {
            notify({
                title: 'Localização indisponível',
                message: 'Seu navegador não suporta localização.',
                variant: 'warning'
            });
            setRastreandoLocalizacao(false);
            return undefined;
        }

        const processarPosicao = (position) => {
            const novaPosicao = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            const precisao = position.coords.accuracy ?? null;
            const ultimaPosicaoAceita = ultimaPosicaoAceitaRef.current;
            const precisaoMaximaInicial = isNativePlatform
                ? PRECISAO_MAXIMA_INICIAL_NATIVE_METROS
                : PRECISAO_MAXIMA_INICIAL_WEB_METROS;
            const precisaoMaximaRastreamento = isNativePlatform
                ? PRECISAO_MAXIMA_RASTREAMENTO_NATIVE_METROS
                : PRECISAO_MAXIMA_RASTREAMENTO_WEB_METROS;

            if (!ultimaPosicaoAceita && precisao && precisao > precisaoMaximaInicial) {
                return;
            }

            if (ultimaPosicaoAceita && precisao && precisao > precisaoMaximaRastreamento) {
                setBuscando(false);
                return;
            }

            if (ultimaPosicaoAceita) {
                const deslocamentoCurto = calcularDistanciaMetros(ultimaPosicaoAceita, novaPosicao);
                if (deslocamentoCurto < DISTANCIA_MINIMA_ATUALIZACAO_METROS) {
                    setBuscando(false);
                    return;
                }
            }

            ultimaPosicaoAceitaRef.current = novaPosicao;

            setPosicaoUsuario(novaPosicao);

            setTrilhaUsuario((caminhoAtual) => {
                if (!caminhoAtual.length) return [novaPosicao];

                const ultimaPosicaoTrilha = caminhoAtual[caminhoAtual.length - 1];
                if (calcularDistanciaMetros(ultimaPosicaoTrilha, novaPosicao) < DISTANCIA_MINIMA_TRILHA_METROS) {
                    return caminhoAtual;
                }

                return [...caminhoAtual, novaPosicao];
            });

            if (!primeiraCentralizacaoRef.current) {
                primeiraCentralizacaoRef.current = true;
                map.flyTo(novaPosicao, Math.max(map.getZoom(), 17), { animate: true, duration: 1.2 });
            }

            if (ultimaPosicaoBrutaRef.current) {
                const distanciaPercorrida = calcularDistanciaMetros(ultimaPosicaoBrutaRef.current, novaPosicao);
                if (distanciaPercorrida >= DISTANCIA_MINIMA_DIRECAO_METROS) {
                    setDirecaoUsuario(calcularRumo(ultimaPosicaoBrutaRef.current, novaPosicao));
                    ultimaPosicaoBrutaRef.current = novaPosicao;

                    if (limparDirecaoTimeoutRef.current) {
                        window.clearTimeout(limparDirecaoTimeoutRef.current);
                    }

                    limparDirecaoTimeoutRef.current = window.setTimeout(() => {
                        setDirecaoUsuario(null);
                    }, 2000);
                }
            } else {
                ultimaPosicaoBrutaRef.current = novaPosicao;
            }

            setBuscando(false);
        };

        const tratarErro = (error) => {
            console.error("Erro ao obter localização:", error);
            setBuscando(false);

            if (error?.code === 1 || error?.code === 'NOT_AUTHORIZED') {
                pararWatch();
                setRastreandoLocalizacao(false);
                notify({
                    title: 'Permissão de localização',
                    message: isNativePlatform
                        ? 'Permita o acesso à localização do app para usar o GPS do celular.'
                        : 'Permita o acesso à localização no navegador ou no PWA para usar sua posição no mapa.',
                    variant: 'warning'
                });
                return;
            }

            if (!ultimaPosicaoBrutaRef.current) {
                pararWatch();
                setRastreandoLocalizacao(false);
                notify({
                    title: isNativePlatform ? 'GPS necessário' : 'Localização indisponível',
                    message: isNativePlatform
                        ? 'Ative o GPS do celular para usar a sua localização no mapa.'
                        : 'Não foi possível obter sua localização no navegador. Verifique a permissão do site/PWA e a localização do sistema.',
                    variant: 'warning'
                });
            }
        };

        const iniciarRastreamento = async () => {
            setBuscando(true);

            if (isNativePlatform) {
                try {
                    let permissaoLocalizacao = await Geolocation.checkPermissions();
                    if (permissaoLocalizacao.location !== 'granted' && permissaoLocalizacao.coarseLocation !== 'granted') {
                        permissaoLocalizacao = await Geolocation.requestPermissions();
                    }

                    if (permissaoLocalizacao.location === 'denied' && permissaoLocalizacao.coarseLocation === 'denied') {
                        throw { code: 'NOT_AUTHORIZED' };
                    }

                    watchIdRef.current = await Geolocation.watchPosition(
                        {
                            enableHighAccuracy: true,
                            maximumAge: GEOLOCATION_MAXIMUM_AGE_NATIVE_MS,
                            timeout: GEOLOCATION_TIMEOUT_NATIVE_MS
                        },
                        (position, error) => {
                            if (error) {
                                tratarErro(error);
                                return;
                            }

                            if (position) {
                                processarPosicao(position);
                            }
                        }
                    );
                    return;
                } catch (error) {
                    tratarErro(error);
                    return;
                }
            }

            watchIdRef.current = navigator.geolocation.watchPosition(
                processarPosicao,
                tratarErro,
                {
                    enableHighAccuracy: true,
                    maximumAge: GEOLOCATION_MAXIMUM_AGE_WEB_MS,
                    timeout: GEOLOCATION_TIMEOUT_WEB_MS
                }
            );
        };

        void iniciarRastreamento();

        return () => {
            pararWatch();
            if (limparDirecaoTimeoutRef.current) {
                window.clearTimeout(limparDirecaoTimeoutRef.current);
                limparDirecaoTimeoutRef.current = null;
            }
        };
    }, [isNativePlatform, map, notify, rastreandoLocalizacao, setDirecaoUsuario, setPosicaoUsuario, setRastreandoLocalizacao, setTrilhaUsuario]);

    const alternarLocalizacao = () => {
        setRastreandoLocalizacao((estadoAtual) => !estadoAtual);
    };

    return (
        <div ref={controlsRef} className="absolute bottom-6 right-4 z-[400] flex flex-col gap-3" onClick={stopMapDomEvent}>
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
                    <button onClick={() => map.zoomIn()} className="w-12 h-12 flex items-center justify-center text-slate-600 border-b border-slate-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
                    {mostrarDicas && <span className="control-hint right-side">Aumentar zoom</span>}
                </div>
                <div className="relative">
                    <button onClick={() => map.zoomOut()} className="w-12 h-12 flex items-center justify-center text-slate-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19.5 12h-15" /></svg></button>
                    {mostrarDicas && <span className="control-hint right-side">Diminuir zoom</span>}
                </div>
            </div>
        </div>
    );
};

const MarcadorUsuario = ({ posicao, direcao }) => {
    const [posicaoAnimada, setPosicaoAnimada] = useState(posicao);
    const frameAnimacaoRef = useRef(null);
    const posicaoAnimadaRef = useRef(posicao);

    useEffect(() => {
        if (!posicao) {
            if (frameAnimacaoRef.current) {
                window.cancelAnimationFrame(frameAnimacaoRef.current);
                frameAnimacaoRef.current = null;
            }
            posicaoAnimadaRef.current = null;
            setPosicaoAnimada(null);
            return undefined;
        }

        if (!posicaoAnimadaRef.current) {
            posicaoAnimadaRef.current = posicao;
            setPosicaoAnimada(posicao);
            return undefined;
        }

        const origem = posicaoAnimadaRef.current;
        const distancia = calcularDistanciaMetros(origem, posicao);

        if (distancia < 0.4) {
            posicaoAnimadaRef.current = posicao;
            setPosicaoAnimada(posicao);
            return undefined;
        }

        if (frameAnimacaoRef.current) {
            window.cancelAnimationFrame(frameAnimacaoRef.current);
        }

        const inicio = performance.now();
        const duracao = 850;

        const animar = (agora) => {
            const progresso = Math.min((agora - inicio) / duracao, 1);
            const easing = 1 - ((1 - progresso) ** 3);
            const proximaPosicao = {
                lat: origem.lat + ((posicao.lat - origem.lat) * easing),
                lng: origem.lng + ((posicao.lng - origem.lng) * easing)
            };

            posicaoAnimadaRef.current = proximaPosicao;
            setPosicaoAnimada(proximaPosicao);

            if (progresso < 1) {
                frameAnimacaoRef.current = window.requestAnimationFrame(animar);
                return;
            }

            frameAnimacaoRef.current = null;
        };

        frameAnimacaoRef.current = window.requestAnimationFrame(animar);

        return () => {
            if (frameAnimacaoRef.current) {
                window.cancelAnimationFrame(frameAnimacaoRef.current);
                frameAnimacaoRef.current = null;
            }
        };
    }, [posicao]);

    const posicaoExibida = posicaoAnimada ?? posicao;

    const iconeGPS = useMemo(() => L.divIcon({
        className: 'bg-transparent',
        html: `
            <div style="position: relative; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background: rgba(59, 130, 246, 0.18); animation: gps-pulse 1.8s ease-out infinite;"></div>
                ${typeof direcao === 'number' ? `
                    <div style="position: absolute; top: 5px; left: 50%; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 16px solid #1d4ed8; transform: translateX(-50%) rotate(${direcao}deg); transform-origin: 50% 21px; filter: drop-shadow(0 2px 3px rgba(30, 64, 175, 0.3));"></div>
                ` : ''}
                <div style="position: relative; width: 18px; height: 18px; border-radius: 9999px; background: ${MAP_COLORS.apoio.clique}; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45); z-index: 2;"></div>
            </div>
        `,
        iconSize: [54, 54],
        iconAnchor: [27, 27]
    }), [direcao]);

    if (!posicaoExibida) return null;

    const compartilharLocalizacao = () => {
        const appUrl = buildAppLocationUrl(posicaoExibida.lat, posicaoExibida.lng, 17);
        const mapsUrl = buildGoogleMapsUrl(posicaoExibida.lat, posicaoExibida.lng);
        const text = buildLocationShareText({
            title: 'Minha localização no território',
            appUrl,
            mapsUrl
        });

        window.open(buildWhatsAppShareUrl(text), '_blank');
    };

    return (
        <Marker position={posicaoExibida} icon={iconeGPS}>
            <Popup>
                <div className="text-center p-1">
                    <p className="font-bold text-sm mb-2 text-gray-700">Você está aqui</p>
                    <button onClick={compartilharLocalizacao} className="popup-btn-action bg-blue-600 text-white hover:bg-blue-700 text-xs py-1 px-3 shadow-md">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
                        Compartilhar Local
                    </button>
                </div>
            </Popup>
        </Marker>
    );
};

// --- MODAL DE NOTAS ---
const ModalNota = ({ isOpen, onClose, onAdicionar, onEditar, onExcluir, dados, user, isAdmin, canWrite }) => {
    const [texto, setTexto] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const scrollRef = useRef(null);

    const notas = useMemo(() => {
        if (!dados?.notas) return [];
        if (typeof dados.notas === 'string') {
            return [{ id: 'legacy', texto: dados.notas, autorNome: 'Sistema (Antigo)', data: null, autorEmail: 'sistema' }];
        }
        return dados.notas;
    }, [dados]);

    useEffect(() => {
        if (!isOpen) return;
        const timeoutId = window.setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);

        return () => window.clearTimeout(timeoutId);
    }, [isOpen, dados]);

    const handleSubmit = () => {
        if (!canWrite) return;
        if (!texto.trim()) return;
        if (editandoId) {
            onEditar(dados.quadraId, editandoId, texto);
        } else {
            onAdicionar(dados.quadraId, texto);
        }
        setTexto('');
        setEditandoId(null);
    };

    const iniciarEdicao = (nota) => {
        setTexto(nota.texto);
        setEditandoId(nota.id);
    };

    const cancelarEdicao = () => {
        setTexto('');
        setEditandoId(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[500px]">
                <div className="bg-blue-600 p-4 flex justify-between items-center shrink-0">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        💬 Notas: {dados?.quadraId}
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white text-xl font-bold">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3" ref={scrollRef}>
                    {notas.length === 0 && (
                        <p className="text-center text-gray-400 text-sm italic mt-10">Nenhuma observação ainda.</p>
                    )}
                    {notas.map((nota) => {
                        const isMe = user?.email === nota.autorEmail;
                        const podeExcluir = isAdmin || isMe;
                        const podeEditar = isMe || isAdmin;
                        return (
                            <div key={nota.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 shadow-sm relative group ${isMe ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}`}>
                                    <div className="flex justify-between items-center gap-4 mb-1 border-b border-black/5 pb-1">
                                        <span className="text-[10px] font-bold uppercase opacity-70">{nota.autorNome || 'Anônimo'}</span>
                                        <span className="text-[9px] opacity-50">
                                            {nota.data ? new Date(nota.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{nota.texto}</p>
                                    <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
                                        {podeEditar && (
                                            <button onClick={() => iniciarEdicao(nota)} className="bg-white text-blue-600 border border-blue-200 p-1 rounded-full shadow hover:bg-blue-50" title="Editar">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        )}
                                        {podeExcluir && (
                                            <button onClick={() => onExcluir(dados.quadraId, nota.id)} className="bg-white text-red-600 border border-red-200 p-1 rounded-full shadow hover:bg-red-50" title="Excluir">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-3 bg-white border-t border-gray-200">
                    {!canWrite && (
                        <div className="mb-2 rounded bg-gray-100 px-3 py-2 text-xs text-gray-600">
                            Modo consulta. Conecte-se e abra o território correto para adicionar ou corrigir observações.
                        </div>
                    )}
                    {editandoId && (
                        <div className="flex justify-between items-center text-xs text-blue-600 mb-2 bg-blue-50 p-1 px-2 rounded">
                            <span>✏️ Editando mensagem...</span>
                            <button onClick={cancelarEdicao} className="underline hover:text-blue-800">Cancelar</button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <textarea
                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
                            placeholder="Escreva uma observação..."
                            rows="2"
                            value={texto}
                            disabled={!canWrite}
                            onChange={(e) => setTexto(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                        />
                        <button onClick={handleSubmit} disabled={!canWrite || !texto.trim()} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ModalConfirmacaoFinalizacao = ({ isOpen, onConfirmar, onRecusar, loading, contextoSufixo }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-blue-600 px-4 py-3">
                    <h3 className="text-lg font-bold text-white">Confirmar finalização</h3>
                </div>
                <div className="p-4 text-sm text-gray-700">
                    <p>Você finalizou o território{contextoSufixo}?</p>
                </div>
                <div className="flex gap-3 px-4 pb-4">
                    <button
                        onClick={onConfirmar}
                        disabled={loading}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Sim
                    </button>
                    <button
                        onClick={onRecusar}
                        disabled={loading}
                        className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Não
                    </button>
                </div>
            </div>
        </div>
    );
};

const getEnderecoInitialForm = (endereco, ponto) => ({
    endereco: endereco?.endereco || '',
    quantidadeEstrangeiros: String(endereco?.quantidadeEstrangeiros ?? 1),
    observacao: endereco?.observacao || '',
    lat: endereco?.lat ?? ponto?.lat ?? '',
    lng: endereco?.lng ?? ponto?.lng ?? ''
});

const EnderecoFormModal = ({ isOpen, mode, endereco, ponto, loading, onClose, onSubmit }) => {
    const [form, setForm] = useState(getEnderecoInitialForm(endereco, ponto));

    useEffect(() => {
        if (!isOpen) return;
        setForm(getEnderecoInitialForm(endereco, ponto));
    }, [endereco, isOpen, ponto]);

    if (!isOpen) return null;

    const isEdit = mode === 'edit';
    const titulo = isEdit ? `Editar ${endereco?.codigo || 'endereço'}` : 'Cadastrar endereço';

    const handleChange = (field) => (event) => {
        setForm((current) => ({
            ...current,
            [field]: event.target.value
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit({
            ...form,
            lat: Number(form.lat),
            lng: Number(form.lng),
            quantidadeEstrangeiros: Number(form.quantidadeEstrangeiros)
        });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <form onSubmit={handleSubmit} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-teal-700 px-4 py-3">
                    <h3 className="text-lg font-bold text-white">{titulo}</h3>
                </div>
                <div className="space-y-3 p-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                        Lat {Number(form.lat).toFixed(6)} · Lng {Number(form.lng).toFixed(6)}
                    </div>
                    <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Endereço</span>
                        <input
                            value={form.endereco}
                            onChange={handleChange('endereco')}
                            maxLength={220}
                            required
                            disabled={loading}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                            placeholder="Rua, número, referência"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estrangeiros</span>
                        <input
                            type="number"
                            min="0"
                            max="99"
                            value={form.quantidadeEstrangeiros}
                            onChange={handleChange('quantidadeEstrangeiros')}
                            disabled={loading}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Observação</span>
                        <textarea
                            value={form.observacao}
                            onChange={handleChange('observacao')}
                            maxLength={2000}
                            rows="4"
                            disabled={loading}
                            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                            placeholder="Idioma, melhor horário, detalhes úteis"
                        />
                    </label>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-70"
                    >
                        {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const GrupoEnderecoFormModal = ({ isOpen, selectedEnderecos, loading, onClose, onSubmit }) => {
    const [nome, setNome] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setNome('');
    }, [isOpen]);

    if (!isOpen) return null;

    const totalEstrangeiros = selectedEnderecos.reduce((total, endereco) => total + (Number(endereco.quantidadeEstrangeiros) || 0), 0);

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit({ nome });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <form onSubmit={handleSubmit} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-indigo-700 px-4 py-3">
                    <h3 className="text-lg font-bold text-white">Criar território</h3>
                </div>
                <div className="space-y-3 p-4">
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">
                        {selectedEnderecos.length} endereço(s) · {totalEstrangeiros} estrangeiro(s)
                    </div>
                    <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome do território</span>
                        <input
                            value={nome}
                            onChange={(event) => setNome(event.target.value)}
                            maxLength={120}
                            disabled={loading}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                            placeholder="Ex.: Jardim São João"
                        />
                    </label>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {selectedEnderecos.map((endereco) => (
                            <div key={endereco.id} className="border-b border-slate-200 py-1 text-xs last:border-0">
                                <span className="font-bold text-slate-700">{formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}</span>
                                <span className="text-slate-500"> · {endereco.endereco || 'Sem endereço'}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || selectedEnderecos.length === 0}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-70"
                    >
                        {loading ? 'Criando...' : 'Criar território'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const GrupoEnderecosModal = ({
    isOpen,
    grupoCodigo,
    grupoNome,
    enderecos,
    visitados,
    podeExecutar,
    loading,
    onClose,
    onToggleVisitado
}) => {
    const modalRef = useLeafletDomEventIsolation();

    if (!isOpen) return null;

    return (
        <div
            ref={modalRef}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            style={{ zIndex: 9999 }}
            onClick={(event) => {
                stopMapDomEvent(event);
                onClose();
            }}
            onMouseDown={stopMapDomEvent}
        >
            <div
                className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                onClick={stopMapDomEvent}
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                        <h3 className="text-base font-extrabold leading-tight text-slate-800">Endereços do {grupoCodigo}</h3>
                        <p className="mt-0.5 text-xs font-semibold leading-tight text-slate-500">{grupoNome}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                        aria-label="Fechar endereços"
                    >
                        ×
                    </button>
                </div>
                <div className="max-h-[62vh] overflow-y-auto p-3">
                    <div className="space-y-2">
                        {enderecos.map((endereco) => {
                            const feito = visitados.has(endereco.id);
                            return (
                                <button
                                    key={endereco.id}
                                    type="button"
                                    onClick={() => onToggleVisitado(endereco)}
                                    disabled={!podeExecutar || loading}
                                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${feito ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50'}`}
                                >
                                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black ${feito ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                                    <span className="min-w-0">
                                        <span className="block font-extrabold leading-tight text-slate-800">{formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}</span>
                                        <span className="mt-0.5 block leading-snug">{endereco.endereco || 'Sem endereço'}</span>
                                        <span className="mt-1 block text-xs font-semibold text-slate-500">{endereco.quantidadeEstrangeiros || 0} estrangeiro(s)</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {!podeExecutar && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs font-semibold text-slate-500">
                        Visualização somente leitura.
                    </div>
                )}
            </div>
        </div>
    );
};

const PontoMapaClicado = ({ ponto, canCreate, onCreate, onShare, onClose }) => {
    const markerRef = useRef(null);
    const icon = useMemo(() => L.divIcon({
        className: 'bg-transparent',
        html: '<div class="map-click-marker">+</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    }), []);

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
                    <h3 className="text-sm font-bold text-slate-800">Local selecionado</h3>
                    <button onClick={onShare} className="popup-btn-action bg-blue-600 text-white hover:bg-blue-700">
                        Compartilhar localização
                    </button>
                    {canCreate && (
                        <button onClick={onCreate} className="popup-btn-action bg-teal-700 text-white hover:bg-teal-800">
                            Cadastrar endereço
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

const EnderecoMarker = ({
    endereco,
    isAdmin,
    isOnline,
    isSelected,
    canSelect,
    focusMode = false,
    isVisited = false,
    canMarkVisited = false,
    onShare,
    onNavigate,
    onEdit,
    onToggleArchive,
    onToggleSelect,
    onRemoveFromGroup,
    onToggleVisited
}) => {
    const arquivado = endereco.status === ENDERECO_STATUS.ARQUIVADO;
    const agrupado = Boolean(endereco.grupoId || endereco.grupoCodigo);
    const codigoExibicao = formatEnderecoCodigoExibicao(endereco.codigo || endereco.id);
    const [menuAberto, setMenuAberto] = useState(false);
    const icon = useMemo(() => L.divIcon({
        className: 'bg-transparent',
        html: `<div class="map-address-marker ${focusMode ? isVisited ? 'focus-done' : 'focus-pending' : ''} ${!focusMode && agrupado ? 'grouped' : ''} ${isSelected ? 'selected' : ''} ${arquivado ? 'archived' : ''}">${codigoExibicao || 'E'}</div>`,
        iconSize: [44, 30],
        iconAnchor: [22, 15]
    }), [agrupado, arquivado, codigoExibicao, focusMode, isSelected, isVisited]);

    return (
        <Marker
            position={[endereco.lat, endereco.lng]}
            icon={icon}
            zIndexOffset={focusMode ? 900 : 0}
            eventHandlers={{ click: (event) => event.originalEvent && L.DomEvent.stopPropagation(event.originalEvent) }}
        >
            <Tooltip direction="top" offset={[0, -16]} className="font-bold text-xs">
                {codigoExibicao}
            </Tooltip>
            <Popup>
                <div className="flex min-w-[230px] flex-col gap-1.5 p-1">
                    <div className="relative border-b border-slate-200 pb-1.5 text-center">
                        {isAdmin && (
                            <div className="absolute right-0 top-0">
                                <button
                                    type="button"
                                    onClick={() => setMenuAberto((aberto) => !aberto)}
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-black leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                    title="Mais opções"
                                    aria-label="Mais opções do endereço"
                                >
                                    ...
                                </button>
                                {menuAberto && (
                                    <div className="absolute right-0 top-7 z-[10000] w-44 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-xl">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMenuAberto(false);
                                                onEdit(endereco);
                                            }}
                                            disabled={!isOnline}
                                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-teal-700 transition hover:bg-teal-50 disabled:opacity-50"
                                        >
                                            Editar dados
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMenuAberto(false);
                                                onToggleArchive(endereco);
                                            }}
                                            disabled={!isOnline}
                                            className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-bold transition disabled:opacity-50 ${arquivado ? 'text-emerald-700 hover:bg-emerald-50' : 'text-amber-700 hover:bg-amber-50'}`}
                                        >
                                            {arquivado ? 'Reativar endereço' : 'Arquivar endereço'}
                                        </button>
                                        {!arquivado && canSelect && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMenuAberto(false);
                                                    onToggleSelect(endereco);
                                                }}
                                                disabled={!isOnline}
                                                className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-bold transition disabled:opacity-50 ${isSelected ? 'text-amber-700 hover:bg-amber-50' : 'text-indigo-700 hover:bg-indigo-50'}`}
                                            >
                                                {isSelected ? 'Remover da seleção' : 'Selecionar para território'}
                                            </button>
                                        )}
                                        {!arquivado && endereco.grupoId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMenuAberto(false);
                                                    onRemoveFromGroup(endereco);
                                                }}
                                                disabled={!isOnline}
                                                className="w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Remover do território
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-center gap-1.5">
                            <span className="text-base font-extrabold leading-none text-slate-800">{codigoExibicao}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase leading-none ${arquivado ? 'bg-slate-100 text-slate-500' : focusMode && isVisited ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'}`}>
                                {arquivado ? 'Arquivado' : focusMode ? isVisited ? 'Pregado' : 'Pendente' : 'Ativo'}
                            </span>
                        </div>
                        {endereco.grupoCodigo && (
                            <div className="mt-1 text-[11px] font-bold leading-tight text-indigo-700">Território {formatGrupoEnderecoCodigoExibicao(endereco.grupoCodigo)}</div>
                        )}
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <div className="font-semibold leading-snug">{endereco.endereco || 'Sem endereço informado'}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{endereco.quantidadeEstrangeiros || 0} estrangeiro(s)</div>
                        {endereco.observacao && (
                            <div className="mt-1.5 whitespace-pre-line rounded-md bg-white px-2 py-1.5 text-xs leading-snug text-slate-600">{endereco.observacao}</div>
                        )}
                    </div>
                    {focusMode ? (
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                onClick={() => onNavigate(endereco)}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-blue-700"
                            >
                                Navegar
                            </button>
                            <button
                                onClick={() => onToggleVisited(endereco)}
                                disabled={!canMarkVisited}
                                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition disabled:opacity-50 ${isVisited ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                            >
                                {isVisited ? 'Desmarcar' : 'Marcar pregado'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => onNavigate(endereco)}
                            className="popup-btn-action bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Navegar
                        </button>
                    )}
                    <button
                        onClick={() => onShare(endereco)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                    >
                        Compartilhar localização
                    </button>
                </div>
            </Popup>
        </Marker>
    );
};

const buildGrupoBoundsPositions = (bounds) => {
    if (!bounds) return null;
    const { minLat, minLng, maxLat, maxLng } = bounds;
    if (![minLat, minLng, maxLat, maxLng].every((value) => Number.isFinite(Number(value)))) return null;
    return [
        [minLat, minLng],
        [minLat, maxLng],
        [maxLat, maxLng],
        [maxLat, minLng]
    ];
};

const buildGrupoBoundsParam = (bounds) => {
    if (!bounds) return '';
    const { minLat, minLng, maxLat, maxLng } = bounds;
    const values = [minLat, minLng, maxLat, maxLng].map(Number);
    return values.every(Number.isFinite) ? values.join(',') : '';
};

const buildGrupoEnderecoAppLink = ({ grupo, centro }) => {
    const boundsParam = buildGrupoBoundsParam(grupo?.bounds);
    if (boundsParam) {
        return buildPublicAppRouteUrl('/app', { bounds: boundsParam });
    }

    if (Number.isFinite(Number(centro?.lat)) && Number.isFinite(Number(centro?.lng))) {
        return buildPublicAppRouteUrl('/app', { lat: centro.lat, lng: centro.lng, z: 17 });
    }

    return buildPublicAppRouteUrl('/app');
};

const buildGrupoEnderecoTituloMensagem = (grupo) => {
    const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo?.codigo || grupo?.id);
    const nomeExibicao = formatGrupoEnderecoNomeExibicao(grupo?.nome, grupo?.codigo || grupo?.id);
    const nomeNormalizado = String(nomeExibicao || '').trim();

    if (!codigoExibicao) {
        return nomeNormalizado || 'Território';
    }

    const nomeLower = nomeNormalizado.toLowerCase();
    const codigoLower = codigoExibicao.toLowerCase();

    if (!nomeNormalizado || nomeLower === codigoLower || nomeLower === `território ${codigoLower}`) {
        return codigoExibicao;
    }

    if (nomeLower.startsWith(`${codigoLower} - `) || nomeLower.startsWith(`${codigoLower} `)) {
        return nomeNormalizado;
    }

    return `${codigoExibicao} - ${nomeNormalizado}`;
};

const buildMensagemDesignacaoGrupoEndereco = ({ grupo, usuario, centro, contextoSistema }) => {
    const tituloTerritorio = buildGrupoEnderecoTituloMensagem(grupo);
    const nome = usuario?.nome || grupo?.designadoNome || grupo?.designadoPara || 'Publicador';
    const link = buildGrupoEnderecoAppLink({ grupo, centro });
    const contextoLinha = contextoSistema?.campanhaAtiva ? `\n *Modo:* ${contextoSistema.contextoAtivoTitulo}` : '';

    return {
        texto: `Olá *${nome}*! \nO território *${tituloTerritorio}* foi designado para você.${contextoLinha}\n\n *Acesse:* ${link}\n\nBom trabalho!`,
        whatsapp: usuario?.whatsapp,
        nome
    };
};

const resolveGrupoEnderecoCentro = (grupo, enderecosGrupo = []) => {
    const latGrupo = Number(grupo?.centro?.lat);
    const lngGrupo = Number(grupo?.centro?.lng);
    if (Number.isFinite(latGrupo) && Number.isFinite(lngGrupo)) {
        return { lat: latGrupo, lng: lngGrupo };
    }

    const enderecoCentro = enderecosGrupo.find((endereco) => (
        Number.isFinite(Number(endereco.lat)) && Number.isFinite(Number(endereco.lng))
    ));

    if (enderecoCentro) {
        return {
            lat: Number(enderecoCentro.lat),
            lng: Number(enderecoCentro.lng)
        };
    }

    const minLat = Number(grupo?.bounds?.minLat);
    const minLng = Number(grupo?.bounds?.minLng);
    const maxLat = Number(grupo?.bounds?.maxLat);
    const maxLng = Number(grupo?.bounds?.maxLng);
    if ([minLat, minLng, maxLat, maxLng].every(Number.isFinite)) {
        return {
            lat: (minLat + maxLat) / 2,
            lng: (minLng + maxLng) / 2
        };
    }

    return null;
};

const FocoGrupoEnderecoMapController = ({ grupoId, enderecos }) => {
    const map = useMap();

    useEffect(() => {
        if (!grupoId || !enderecos.length) return;

        const pontos = enderecos
            .map((endereco) => [Number(endereco.lat), Number(endereco.lng)])
            .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

        if (!pontos.length) return;

        if (pontos.length === 1) {
            map.setView(pontos[0], Math.max(map.getZoom(), 18), { animate: true });
            return;
        }

        map.fitBounds(L.latLngBounds(pontos).pad(0.25), {
            animate: true,
            maxZoom: 18
        });
    }, [enderecos, grupoId, map]);

    return null;
};

const GrupoEnderecoLayer = ({
    grupo,
    user,
    isAdmin,
    isOnline,
    contextoSistema,
    listaUsuarios,
    enderecosGrupo,
    onShare,
    onToggleArchive,
    onDesignar,
    onDevolver,
    onToggleVisitado,
    onFinalizar,
    onFocusMap,
    isMapFocused = false
}) => {
    const map = useMap();
    const arquivado = grupo.status === GRUPO_ENDERECO_STATUS.ARQUIVADO;
    const finalizado = grupo.status === GRUPO_ENDERECO_STATUS.FINALIZADO;
    const designado = Boolean(grupo.designadoPara);
    const progresso = getGrupoEnderecoProgresso(grupo);
    const visitados = new Set(grupo.enderecos_visitados || []);
    const userEmail = normalizeEmailValue(user?.email);
    const isMeu = normalizeEmailValue(grupo.designadoPara) === userEmail;
    const podeExecutar = (isAdmin || isMeu) && isOnline && !arquivado && !progresso.isFinalizado;
    const [usuarioSelecionado, setUsuarioSelecionado] = useState('');
    const [loadingAction, setLoadingAction] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);
    const [enderecosModalAberto, setEnderecosModalAberto] = useState(false);
    const [mensagemDesignacaoPronta, setMensagemDesignacaoPronta] = useState(null);
    const codigoPreferencial = formatGrupoEnderecoCodigoExibicao(grupo.codigo);
    const codigoExibicao = /^T-\d+$/i.test(codigoPreferencial)
        ? codigoPreferencial
        : formatGrupoEnderecoCodigoExibicao(grupo.id) || codigoPreferencial || 'T';
    const nomeExibicao = formatGrupoEnderecoNomeExibicao(grupo.nome, grupo.codigo || grupo.id);
    const totalEnderecosResumo = enderecosGrupo.length || Math.max(0, Math.trunc(Number(grupo.totalEnderecos) || 0));
    const totalEstrangeirosEnderecos = enderecosGrupo.reduce((total, endereco) => (
        total + Math.max(0, Math.trunc(Number(endereco.quantidadeEstrangeiros) || 0))
    ), 0);
    const totalEstrangeirosResumo = enderecosGrupo.length
        ? totalEstrangeirosEnderecos
        : Math.max(0, Math.trunc(Number(grupo.totalEstrangeiros) || 0));
    const centroGrupo = resolveGrupoEnderecoCentro(grupo, enderecosGrupo);
    const boundsPositions = buildGrupoBoundsPositions(grupo.bounds);
    const hasArea = boundsPositions && (
        Math.abs(Number(grupo.bounds.maxLat) - Number(grupo.bounds.minLat)) > 0.00001 ||
        Math.abs(Number(grupo.bounds.maxLng) - Number(grupo.bounds.minLng)) > 0.00001
    );
    const icon = useMemo(() => L.divIcon({
        className: 'bg-transparent',
        html: `<div class="map-group-marker ${arquivado ? 'archived' : ''} ${designado && !finalizado ? 'assigned' : ''} ${finalizado ? 'finished' : ''}">${codigoExibicao}</div>`,
        iconSize: [56, 30],
        iconAnchor: [28, 15]
    }), [arquivado, codigoExibicao, designado, finalizado]);

    useEffect(() => {
        setUsuarioSelecionado('');
    }, [grupo.designadoPara]);

    useEffect(() => {
        setUsuarioSelecionado('');
        setMenuAberto(false);
        setEnderecosModalAberto(false);
        setMensagemDesignacaoPronta(null);
    }, [grupo.id, grupo.status]);

    if (!centroGrupo) return null;

    const executarAcaoGrupo = async (acao) => {
        setLoadingAction(true);
        try {
            await acao();
        } finally {
            setLoadingAction(false);
        }
    };

    const alternarArquivoPeloMenu = async () => {
        setMenuAberto(false);
        await executarAcaoGrupo(() => onToggleArchive(grupo));
    };

    const ativarFocoMapa = () => {
        setMenuAberto(false);
        setEnderecosModalAberto(false);
        map.closePopup();
        onFocusMap(grupo);
    };

    const designarTerritorio = async () => {
        const mensagem = await onDesignar(grupo, usuarioSelecionado, { centro: centroGrupo });
        if (mensagem) {
            setMensagemDesignacaoPronta(mensagem);
        }
    };

    const buildMensagemResponsavelAtual = () => {
        const usuarioResponsavel = listaUsuarios.find((usuario) => (
            normalizeEmailValue(usuario.email) === normalizeEmailValue(grupo.designadoPara)
        ));
        return buildMensagemDesignacaoGrupoEndereco({
            grupo,
            usuario: usuarioResponsavel || {
                nome: grupo.designadoNome || grupo.designadoPara,
                whatsapp: null
            },
            centro: centroGrupo,
            contextoSistema
        });
    };

    const abrirWhatsappDesignacao = () => {
        if (!mensagemDesignacaoPronta) return;
        window.open(
            buildWhatsAppShareUrl(mensagemDesignacaoPronta.texto, mensagemDesignacaoPronta.whatsapp),
            '_blank'
        );
        setMensagemDesignacaoPronta(null);
    };

    const enviarWhatsappResponsavelAtual = () => {
        const mensagem = buildMensagemResponsavelAtual();
        window.open(buildWhatsAppShareUrl(mensagem.texto, mensagem.whatsapp), '_blank');
    };

    return (
        <>
            {hasArea && (
                <Polygon
                    positions={boundsPositions}
                    pathOptions={{
                        color: arquivado
                            ? MAP_COLORS.grupoEndereco.arquivado.border
                            : designado && !finalizado
                                ? MAP_COLORS.grupoEndereco.designado.border
                                : finalizado
                                    ? MAP_COLORS.grupoEndereco.finalizado.border
                                    : MAP_COLORS.grupoEndereco.ativo.border,
                        fillColor: arquivado
                            ? MAP_COLORS.grupoEndereco.arquivado.fill
                            : designado && !finalizado
                                ? MAP_COLORS.grupoEndereco.designado.fill
                                : finalizado
                                    ? MAP_COLORS.grupoEndereco.finalizado.fill
                                    : MAP_COLORS.grupoEndereco.ativo.fill,
                        weight: 2,
                        opacity: 0.85,
                        fillOpacity: designado && !finalizado ? 0.16 : 0.12,
                        dashArray: '5 6'
                    }}
                    eventHandlers={{ click: (event) => event.originalEvent && L.DomEvent.stopPropagation(event.originalEvent) }}
                />
            )}
            {!isMapFocused && (
                <Marker
                    position={[centroGrupo.lat, centroGrupo.lng]}
                    icon={icon}
                    zIndexOffset={1200}
                    eventHandlers={{ click: (event) => event.originalEvent && L.DomEvent.stopPropagation(event.originalEvent) }}
                >
                    <Tooltip direction="top" offset={[0, -18]} className="font-bold text-xs">
                        {codigoExibicao}
                    </Tooltip>
                    <Popup>
                        <div className="flex min-w-[230px] flex-col gap-1.5 p-1">
                            <div className="relative border-b border-slate-200 pb-1.5">
                                {isAdmin && (
                                    <div className="absolute right-0 top-0">
                                        <button
                                            type="button"
                                            onClick={() => setMenuAberto((aberto) => !aberto)}
                                            disabled={loadingAction}
                                            className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-black leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                                            title="Mais opções"
                                            aria-label="Mais opções do território"
                                        >
                                            ...
                                        </button>
                                        {menuAberto && (
                                            <div className="absolute right-0 top-7 z-[10000] w-36 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-xl">
                                                <button
                                                    type="button"
                                                    onClick={alternarArquivoPeloMenu}
                                                    disabled={!isOnline || loadingAction}
                                                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-bold transition disabled:opacity-50 ${arquivado ? 'text-emerald-700 hover:bg-emerald-50' : 'text-amber-700 hover:bg-amber-50'}`}
                                                >
                                                    {arquivado ? 'Reativar território' : 'Arquivar território'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-base font-extrabold leading-none text-slate-800">{codigoExibicao}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase leading-none ${arquivado ? 'bg-slate-100 text-slate-500' : finalizado ? 'bg-emerald-50 text-emerald-700' : designado ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {arquivado ? 'Arquivado' : finalizado ? 'Finalizado' : designado ? 'Designado' : 'Ativo'}
                                    </span>
                                </div>
                                <div className="mt-1.5 text-center text-xs font-semibold leading-tight text-slate-600">{nomeExibicao}</div>
                                <div className="mt-1 grid grid-cols-2 gap-1">
                                    <div className="rounded-md bg-slate-50 px-2 py-0.5 text-center">
                                        <span className="block text-[10px] font-bold uppercase leading-tight text-slate-400">Endereços</span>
                                        <span className="text-sm font-extrabold leading-tight text-slate-700">{totalEnderecosResumo}</span>
                                    </div>
                                    <div className="rounded-md bg-slate-50 px-2 py-0.5 text-center">
                                        <span className="block text-[10px] font-bold uppercase leading-tight text-slate-400">Estrangeiros</span>
                                        <span className="text-sm font-extrabold leading-tight text-slate-700">{totalEstrangeirosResumo}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
                                    <span>{progresso.visitadosExibicao} de {progresso.totalEnderecos} visitados</span>
                                    <span>{progresso.percentualExibicao}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${progresso.isFinalizado ? 'bg-green-500' : 'bg-indigo-600'}`}
                                        style={{ width: `${progresso.percentualExibicao}%` }}
                                    ></div>
                                </div>
                            </div>
                            {isAdmin && (
                                <>
                                    {!arquivado && (
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            {mensagemDesignacaoPronta ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="rounded-md bg-green-100 p-2 text-center text-xs font-bold text-green-700">
                                                        Designado para {mensagemDesignacaoPronta.nome}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={abrirWhatsappDesignacao}
                                                        className="popup-btn-action bg-green-600 text-white hover:bg-green-700"
                                                    >
                                                        {mensagemDesignacaoPronta.whatsapp ? 'Enviar no WhatsApp' : 'Compartilhar link'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMensagemDesignacaoPronta(null)}
                                                        className="text-center text-xs font-semibold text-slate-400 underline"
                                                    >
                                                        Voltar
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {designado ? (
                                                        <div className="mb-2 rounded-md border border-blue-100 bg-blue-50 p-2 text-center">
                                                            <div className="text-[10px] font-black uppercase text-blue-500">Território com</div>
                                                            <div className="mt-0.5 text-xs font-extrabold text-blue-800">{grupo.designadoNome || grupo.designadoPara}</div>
                                                            <button
                                                                type="button"
                                                                onClick={enviarWhatsappResponsavelAtual}
                                                                className="popup-btn-action mt-2 bg-green-600 text-white hover:bg-green-700"
                                                            >
                                                                {buildMensagemResponsavelAtual().whatsapp ? 'Enviar no WhatsApp' : 'Compartilhar link'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="mb-2 text-center text-[11px] font-bold uppercase text-slate-500">
                                                            Sem responsável
                                                        </div>
                                                    )}
                                                    <select
                                                        className="mb-2 w-full rounded-md border border-slate-300 bg-white p-2 text-xs outline-none disabled:bg-slate-100"
                                                        value={usuarioSelecionado}
                                                        onChange={(event) => {
                                                            setUsuarioSelecionado(event.target.value);
                                                            setMensagemDesignacaoPronta(null);
                                                        }}
                                                        disabled={loadingAction || !isOnline}
                                                    >
                                                        <option value="">-- escolher publicador --</option>
                                                        {listaUsuarios.map((usuario) => (
                                                            <option key={usuario.email} value={usuario.email}>{usuario.nome}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => executarAcaoGrupo(designarTerritorio)}
                                                        disabled={!usuarioSelecionado || loadingAction || !isOnline}
                                                        className="popup-btn-action bg-indigo-700 text-white hover:bg-indigo-800 disabled:opacity-50"
                                                    >
                                                        {loadingAction ? 'Salvando...' : 'Designar território'}
                                                    </button>
                                                    {grupo.designadoPara && (
                                                        <button
                                                            onClick={() => executarAcaoGrupo(() => onDevolver(grupo))}
                                                            disabled={loadingAction || !isOnline}
                                                            className="popup-btn-action mt-2 border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            Devolver território
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                            {(isMeu || isAdmin) && enderecosGrupo.length > 0 && (
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setEnderecosModalAberto(true)}
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                                    >
                                        <span>Lista</span>
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <span>{enderecosGrupo.length}</span>
                                            <span aria-hidden="true">›</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={ativarFocoMapa}
                                        className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-extrabold text-teal-700 transition hover:bg-teal-100"
                                    >
                                        Ver no mapa
                                    </button>
                                </div>
                            )}
                            {podeExecutar && progresso.completo && (
                                <button
                                    onClick={() => executarAcaoGrupo(() => onFinalizar(grupo))}
                                    disabled={loadingAction}
                                    className="popup-btn-action bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {loadingAction ? 'Finalizando...' : 'Finalizar território'}
                                </button>
                            )}
                            <button
                                onClick={() => onShare({ ...grupo, centro: centroGrupo })}
                                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                            >
                                Compartilhar localização
                            </button>
                        </div>
                    </Popup>
                </Marker>
            )}
            <GrupoEnderecosModal
                isOpen={enderecosModalAberto}
                grupoCodigo={codigoExibicao}
                grupoNome={nomeExibicao}
                enderecos={enderecosGrupo}
                visitados={visitados}
                podeExecutar={podeExecutar}
                loading={loadingAction}
                onClose={() => {
                    if (!loadingAction) setEnderecosModalAberto(false);
                }}
                onToggleVisitado={(endereco) => executarAcaoGrupo(() => onToggleVisitado(grupo, endereco, { sugerirFinalizacao: true }))}
            />
        </>
    );
};

// --- QUADRA MARKER ---
const QuadraMarker = ({ quadra, isFeita, podeMarcar, podeAnotar, nota, onAbrirNota, onAlternarQuadra }) => {
    const toqueLongoRef = useRef(null);
    const ignorarProximoClickRef = useRef(false);

    const limparToqueLongo = () => {
        if (toqueLongoRef.current) {
            window.clearTimeout(toqueLongoRef.current);
            toqueLongoRef.current = null;
        }
    };

    const alternarQuadra = async (event) => {
        if (event?.originalEvent) {
            L.DomEvent.stopPropagation(event.originalEvent);
        }
        if (ignorarProximoClickRef.current) {
            ignorarProximoClickRef.current = false;
            return;
        }
        if (!podeMarcar) return;
        await onAlternarQuadra(quadra.id, isFeita);
    };

    const handleContextMenu = (e) => {
        if (e.originalEvent) { e.originalEvent.preventDefault(); e.originalEvent.stopPropagation(); }
        if (podeAnotar) { onAbrirNota(quadra.id, nota); }
    };

    const iniciarToqueLongo = () => {
        if (!podeAnotar) return;
        limparToqueLongo();
        toqueLongoRef.current = window.setTimeout(() => {
            toqueLongoRef.current = null;
            ignorarProximoClickRef.current = true;
            onAbrirNota(quadra.id, nota);
        }, 650);
    };

    useEffect(() => () => {
        if (toqueLongoRef.current) {
            window.clearTimeout(toqueLongoRef.current);
        }
    }, []);

    const temNota = () => {
        if (!nota) return false;
        if (typeof nota === 'string') return nota.trim() !== "";
        if (Array.isArray(nota)) return nota.length > 0;
        return false;
    };

    return (
        <CircleMarker
            center={[quadra.lat, quadra.lng]}
            pathOptions={{
                color: isFeita ? MAP_COLORS.territorio.finalizado.border : '#b91c1c',
                fillColor: isFeita ? MAP_COLORS.territorio.finalizado.fill : MAP_COLORS.endereco.pendente,
                fillOpacity: 1, weight: 2
            }}
            radius={16}
            eventHandlers={{
                click: alternarQuadra,
                contextmenu: handleContextMenu,
                touchstart: iniciarToqueLongo,
                touchend: limparToqueLongo,
                touchcancel: limparToqueLongo
            }}
        >
            <Tooltip direction="center" permanent className="sem-fundo" opacity={1}>
                <div className="relative flex items-center justify-center w-8 h-8 pointer-events-none">
                    <span className="font-bold text-white text-[15px] drop-shadow-md select-none">{quadra.id}</span>
                    {temNota() && (
                        <span className="absolute -top-1 -right-2 w-3 h-3 bg-yellow-400 border-2 border-white rounded-full shadow-sm z-50" title="Tem observações"></span>
                    )}
                </div>
            </Tooltip>
        </CircleMarker>
    );
};

// --- TERRITÓRIO DETALHADO ATUALIZADO ---
const TerritorioDetalhado = ({ dados, idTerritorio, zoomLevel, user, isAdmin, isOnline, outboxActions, listaUsuarios, showRefs, showCondos, contextoSistema }) => {
    const nome = normalizeTerritorioNome(dados.properties.nome, `T-${idTerritorio}`);
    const contextoId = contextoSistema?.contextoAtivoId || 'normal';
    const contextoNormal = isNormalContext(contextoId);
    const dadosBaseIniciais = useMemo(() => buildBaseTerritorioDefaults(nome), [nome]);
    const dadosContextoIniciais = useMemo(() => buildTerritorioStateSeed({ contextoId, idTerritorio, nome, contextoSistema }), [contextoId, contextoSistema, idTerritorio, nome]);

    const [dadosBase, setDadosBase] = useState(dadosBaseIniciais);
    const [dadosContexto, setDadosContexto] = useState(dadosContextoIniciais);
    const [notasDocsMap, setNotasDocsMap] = useState({});
    const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
    const [msgPronta, setMsgPronta] = useState(null);
    const [posicaoClique, setPosicaoClique] = useState(null);
    const [modalConfig, setModalConfig] = useState({ open: false, dados: null });
    const [confirmacaoFinalizacaoAberta, setConfirmacaoFinalizacaoAberta] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const { notify, confirm } = useUiFeedback();

    const pontosFiltrados = useMemo(() => {
        const todos = dados.properties.pontos || [];
        return {
            trabalho: todos.filter(p => !p.tipo || p.tipo === 'quadra' || p.tipo === 'endereco'),
            referencias: todos.filter(p => p.tipo === 'referencia'),
            condominios: todos.filter(p => p.tipo === 'condominio')
        };
    }, [dados]);

    const listaQuadras = pontosFiltrados.trabalho.map((p, index) => ({
        id: p.nome || (index + 1),
        lat: p.lat,
        lng: p.lng
    }));

    const codigoTerritorio = extractTerritorioCodigo(nome, `T-${idTerritorio}`);
    const coords = dados.geometry.coordinates[0];
    const posicoes = coords.map(coord => [coord[1], coord[0]]);
    const centro = calcularCentroide(coords);
    const labelPosition = dados.properties.labelPosition;
    const posicaoLabel = labelPosition?.lat && labelPosition?.lng
        ? [labelPosition.lat, labelPosition.lng]
        : null;
    const baseRef = useMemo(() => getTerritorioBaseRef(db, idTerritorio), [idTerritorio]);
    const stateRef = useMemo(() => getTerritorioStateRef(db, idTerritorio, contextoId), [contextoId, idTerritorio]);
    const territorioOutboxActions = useMemo(() => outboxActions.filter((action) => action.territorioId === idTerritorio && action.contextoId === contextoId), [contextoId, idTerritorio, outboxActions]);
    const dadosBancoServidor = useMemo(() => mergeTerritorioData({
        contextoId,
        nomeFallback: nome,
        baseData: dadosBase,
        stateData: contextoNormal ? dadosBase : dadosContexto
    }), [contextoId, contextoNormal, dadosBase, dadosContexto, nome]);
    const dadosBanco = useMemo(() => reduceTerritorioComOutbox(dadosBancoServidor, territorioOutboxActions), [dadosBancoServidor, territorioOutboxActions]);
    const notasCombinadas = useMemo(() => mergeTerritorioNotas({
        legacyNotas: dadosBase.notas_quadras,
        noteDocs: notasDocsMap
    }), [dadosBase.notas_quadras, notasDocsMap]);
    const notasVisiveis = useMemo(() => reduceNotasComOutbox(notasCombinadas, territorioOutboxActions, user?.email), [notasCombinadas, territorioOutboxActions, user?.email]);

    useEffect(() => {
        const unsubBase = onSnapshot(baseRef, (docSnapshot) => {
            setDadosBase(docSnapshot.exists() ? docSnapshot.data() : buildBaseTerritorioDefaults(nome));
        });
        const unsubNotas = onSnapshot(getTerritorioNotasCollectionRef(baseRef), (snapshot) => {
            setNotasDocsMap(groupNoteDocsByQuadra(snapshot.docs));
        });

        if (contextoNormal) {
            return () => {
                unsubBase();
                unsubNotas();
            };
        }

        const unsubContexto = onSnapshot(stateRef, (docSnapshot) => {
            setDadosContexto(docSnapshot.exists() ? docSnapshot.data() : buildTerritorioStateSeed({ contextoId, idTerritorio, nome, contextoSistema }));
        });

        return () => {
            unsubBase();
            unsubNotas();
            unsubContexto();
        };
    }, [baseRef, contextoId, contextoNormal, contextoSistema, idTerritorio, nome, stateRef]);

    useEffect(() => {
        setUsuarioSelecionado("");
        setMsgPronta(null);
    }, [contextoId, idTerritorio]);

    const contextoSufixo = contextoSistema?.campanhaAtiva ? ` na campanha "${contextoSistema.contextoAtivoTitulo}"` : '';
    const stateDocMergeSeed = useMemo(() => buildTerritorioStateMergeSeed({
        contextoId,
        idTerritorio,
        nome,
        contextoSistema
    }), [contextoId, contextoSistema, idTerritorio, nome]);

    const salvarEstadoTerritorio = async (updates) => {
        await setDoc(stateRef, {
            ...stateDocMergeSeed,
            ...updates
        }, { merge: true });
    };

    const enfileirarAcaoExecucao = async (type, payload) => enqueueTerritorioAction({
        type,
        territorioId: idTerritorio,
        territorioNome: nome,
        contextoSistema,
        userEmail: user.email,
        designacaoId: dadosBanco.designacaoId,
        payload: {
            ...payload,
            timestamp: new Date().toISOString()
        }
    });

    const finalizarTerritorio = async () => {
        if (!dadosBanco.designadoPara) return;
        try {
            setLoadingAction(true);
            if (!isOnline) {
                await enfileirarAcaoExecucao(TERRITORIO_ACTION_TYPE.FINALIZATION_CONFIRM, {
                    responsavelNome: dadosBanco.designadoNome || user.displayName || user.email.split('@')[0]
                });
                notify({
                    title: 'Finalização preparada',
                    message: 'Você está offline. A finalização ficou salva e será concluída automaticamente quando a conexão voltar.',
                    variant: 'info',
                    durationMs: 7000
                });
                return;
            }
            const resultado = await finalizarTerritorioDesignado({
                salvarEstadoTerritorio,
                dadosBanco,
                nome,
                db,
                contextoSistema
            });

            if (resultado.ok) {
                notify({
                    title: 'Território finalizado',
                    message: `Parabéns! Você finalizou o território${resultado.contextoSufixo}. Solicite um novo ao Servo de Territórios com antecedência. Os administradores foram notificados.`,
                    variant: 'success',
                    durationMs: 7000
                });
            }
        } catch (error) { console.error(error); }
        finally {
            setLoadingAction(false);
        }
    };

    const confirmarFinalizacao = async () => {
        setConfirmacaoFinalizacaoAberta(false);
        await finalizarTerritorio();
    };

    const recusarFinalizacao = async () => {
        try {
            setLoadingAction(true);
            await enfileirarAcaoExecucao(TERRITORIO_ACTION_TYPE.FINALIZATION_REQUEST, {});
            setConfirmacaoFinalizacaoAberta(false);
            notify({
                title: isOnline ? 'Solicitação de finalização preparada' : 'Solicitação salva offline',
                message: isOnline
                    ? 'Tudo certo. O território continua com você e ficará como 100% concluído, aguardando sua confirmação final.'
                    : 'Tudo certo. O território ficará marcado como aguardando finalização quando a conexão voltar.',
                variant: 'info'
            });
        } finally {
            setLoadingAction(false);
        }
    };

    const alternarQuadra = async (quadraId, jaFeita) => {
        if (isAdmin && isOnline && !isMeu) {
            const quadrasFeitas = Array.isArray(dadosBanco.quadras_feitas) ? dadosBanco.quadras_feitas : [];
            const proximasQuadras = !jaFeita
                ? [...new Set([...quadrasFeitas, quadraId])]
                : quadrasFeitas.filter((item) => item !== quadraId);

            await salvarEstadoTerritorio({
                quadras_feitas: proximasQuadras,
                status: TERRITORIO_STATUS.ABERTO,
                ultimaAlteracao: new Date()
            });
            return;
        }

        await enfileirarAcaoExecucao(TERRITORIO_ACTION_TYPE.TOGGLE_QUADRA, {
            quadraId,
            marcar: !jaFeita
        });

        if (!jaFeita && feitas + 1 === total) {
            setConfirmacaoFinalizacaoAberta(true);
        }
    };

    const adicionarNota = async (quadraId, texto) => {
        if (adminModerandoOutroTerritorio) {
            const noteRef = doc(getTerritorioNotasCollectionRef(baseRef));
            await setDoc(noteRef, {
                quadraId,
                texto,
                autorEmail: user.email,
                autorNome: user.displayName || user.email.split('@')[0],
                data: new Date().toISOString(),
                designacaoId: dadosBanco.designacaoId || null,
                territorioId: idTerritorio,
                contextoId
            });
            await setDoc(baseRef, {
                nome,
                ultimaAlteracao: new Date()
            }, { merge: true });
            return;
        }

        await enfileirarAcaoExecucao(TERRITORIO_ACTION_TYPE.ADD_NOTE, {
            quadraId,
            noteId: crypto.randomUUID(),
            texto,
            autorNome: user.displayName || user.email.split('@')[0],
            data: new Date().toISOString()
        });
    };

    const editarNota = async (quadraId, noteId, novoTexto) => {
        if (isLegacyNoteId(noteId)) {
            notify({
                title: 'Observação antiga',
                message: 'Essa observação ainda está no formato antigo e fica somente para consulta. Crie uma nova nota para continuar no formato seguro.',
                variant: 'warning'
            });
            return;
        }

        if (adminModerandoOutroTerritorio) {
            const noteRef = doc(getTerritorioNotasCollectionRef(baseRef), noteId);
            await setDoc(noteRef, {
                texto: novoTexto,
                editadoEm: new Date().toISOString()
            }, { merge: true });
            await setDoc(baseRef, {
                nome,
                ultimaAlteracao: new Date()
            }, { merge: true });
            return;
        }

        await enfileirarAcaoExecucao(TERRITORIO_ACTION_TYPE.EDIT_NOTE, {
            quadraId,
            noteId,
            texto: novoTexto,
            editadoEm: new Date().toISOString()
        });
    };

    const removerNota = async (quadraId, noteId) => {
        if (!(await confirm({
            title: 'Excluir mensagem',
            message: 'Excluir esta mensagem?',
            tone: 'danger',
            confirmLabel: 'Excluir'
        }))) return;

        if (isLegacyNoteId(noteId)) {
            notify({
                title: 'Observação antiga',
                message: 'Essa observação ainda está no formato antigo e fica somente para consulta. Mantenha-a como histórico e use novas notas no formato seguro.',
                variant: 'warning'
            });
            return;
        }

        if (adminModerandoOutroTerritorio) {
            await deleteDoc(doc(getTerritorioNotasCollectionRef(baseRef), noteId));
            await setDoc(baseRef, {
                nome,
                ultimaAlteracao: new Date()
            }, { merge: true });
            return;
        }

        await enfileirarAcaoExecucao(TERRITORIO_ACTION_TYPE.DELETE_NOTE, {
            quadraId,
            noteId
        });
    };

    const abrirModalNota = (quadraId, notasAtuais) => {
        setModalConfig({ open: true, dados: { quadraId, notas: notasAtuais } });
    };

    const fecharModal = () => {
        setModalConfig({ ...modalConfig, open: false });
    };

    const usuarioAtual = user?.email;
    const donoDoTerritorio = dadosBanco.designadoPara;
    const isMeu = donoDoTerritorio === usuarioAtual;
    const isOcupado = donoDoTerritorio && !isMeu;
    const adminExecutandoOutroTerritorio = isAdmin && isOnline && !isMeu;
    const podeMarcarQuadra = isMeu || adminExecutandoOutroTerritorio;
    const podeAnotar = isMeu || (isAdmin && isOnline);
    const adminModerandoOutroTerritorio = adminExecutandoOutroTerritorio;
    const total = listaQuadras.length;
    const progressoTerritorio = getTerritorioProgresso(dadosBanco, total);
    const isFinalizado = progressoTerritorio.isFinalizado;
    const isAguardandoFinalizacao = progressoTerritorio.isAguardandoFinalizacao;
    const feitas = progressoTerritorio.quadrasFeitasExibicao;

    // --- CÁLCULO DA PORCENTAGEM (PARA O TOOLTIP) ---
    const porcentagem = total > 0 ? (feitas / total) * 100 : 0;
    const pctInteira = Math.round(porcentagem);

    // --- NOME CURTO PARA O TOOLTIP ---
    const nomeResponsavelCurto = dadosBanco.designadoNome ? dadosBanco.designadoNome.split(' ')[0] : "Ocupado";

    // VISIBILIDADE
    const deveMostrarQuadras = zoomLevel >= 17 && (isAdmin || isMeu);
    const podeVerDetalhes = isAdmin || isMeu;

    let diasSemTrabalhar = 0;
    let textoTempo = "Nunca";
    let textoTempoCompacto = "Nunca";
    if (dadosBanco.ultimaConclusao) {
        const dataUltima = dadosBanco.ultimaConclusao.toDate ? dadosBanco.ultimaConclusao.toDate() : new Date(dadosBanco.ultimaConclusao);
        diasSemTrabalhar = Math.ceil(Math.abs(new Date() - dataUltima) / (1000 * 60 * 60 * 24));
        textoTempo = diasSemTrabalhar > 60 ? `${Math.floor(diasSemTrabalhar / 30)} meses` : `${diasSemTrabalhar} dias`;
        textoTempoCompacto = diasSemTrabalhar > 60 ? `${Math.floor(diasSemTrabalhar / 30)}m` : `${diasSemTrabalhar}d`;
    }

    const coresDisponivel = getTerritorioDisponivelColors(diasSemTrabalhar, Boolean(dadosBanco.ultimaConclusao));

    let corPreenchimento = coresDisponivel.fill;
    let corBorda = coresDisponivel.border;
    let pesoBorda = 1;
    let opacidade = 0.5;
    let opacidadeBorda = 1;

    if (isFinalizado) {
        corPreenchimento = MAP_COLORS.territorio.finalizado.fill; corBorda = MAP_COLORS.territorio.finalizado.border; opacidade = 0.6; if (isMeu) pesoBorda = 3;
    }
    else if (isAguardandoFinalizacao) {
        corPreenchimento = MAP_COLORS.territorio.aguardandoFinalizacao.fill; corBorda = MAP_COLORS.territorio.aguardandoFinalizacao.border; opacidade = 0.65; if (isMeu) pesoBorda = 3;
    }
    else if (isMeu) {
        corPreenchimento = MAP_COLORS.territorio.meu.fill; corBorda = MAP_COLORS.territorio.meu.border; pesoBorda = 3; if (isAdmin) { corPreenchimento = MAP_COLORS.territorio.meuAdmin.fill; corBorda = MAP_COLORS.territorio.meuAdmin.border; }
    }
    else if (isOcupado) {
        corPreenchimento = MAP_COLORS.territorio.ocupado.fill; corBorda = MAP_COLORS.territorio.ocupado.border; opacidade = 0.4;
    }

    if (!isAdmin && !isMeu) { opacidade = 0.2; opacidadeBorda = 0.4; }

    const renderLabelTerritorio = () => (
        <>
            <span className="label-nome">{zoomLevel < 16 ? codigoTerritorio : nome}</span>
            {zoomLevel < 16 && !isOcupado && !isFinalizado && !isAguardandoFinalizacao && (
                <span className="label-tempo-compacto" title={dadosBanco.ultimaConclusao ? `Última conclusão: ${textoTempo} atrás` : 'Território ainda não trabalhado'}>
                    {textoTempoCompacto}
                </span>
            )}
            {zoomLevel >= 16 && podeVerDetalhes && (
                <>
                    {!isOcupado && !isFinalizado && !isAguardandoFinalizacao && (<><span className="label-status">{dadosBanco.ultimaConclusao ? "Trabalhado" : "Nunca"}</span><span className="label-tempo">{textoTempo}</span></>)}
                    {isOcupado && (
                        <span
                            className="label-status"
                            style={{
                                color: '#fff',
                                background: `linear-gradient(to right, ${MAP_COLORS.territorio.finalizado.border} ${pctInteira}%, ${MAP_COLORS.apoio.barraProgressoBase} ${pctInteira}%)`,
                                fontSize: '12px',
                                textShadow: 'none',
                                border: '1px solid white'
                            }}
                            title={`${feitas} de ${total} quadras (${pctInteira}%)`}
                        >
                            {nomeResponsavelCurto}
                        </span>
                    )}
                    {isAguardandoFinalizacao && <span className="label-status" style={{ color: '#854d0e', background: '#fef3c7' }}>Aguardando finalização</span>}
                    {isFinalizado && <span className="label-status" style={{ color: '#166534', background: '#dcfce7' }}>Feito!</span>}
                </>
            )}
        </>
    );

    const gerarLinkMsg = (uNome, uWhats) => {
        const linkInterno = buildPublicAppRouteUrl('/app', { lat: centro.lat, lng: centro.lng, z: 16 });
        const tituloContexto = contextoSistema?.campanhaAtiva ? `\n*Modo:* ${contextoSistema.contextoAtivoTitulo}` : '';
        const textoMsg = `Olá *${uNome}*! \nO território *${nome}* foi designado para você.${tituloContexto}\n\n *Acesse pelo App:* ${linkInterno}\n\nBom trabalho!`;
        return { texto: textoMsg, whatsapp: uWhats, nome: uNome };
    };

    const salvarDesignacao = async () => {
        if (!isOnline) {
            notify({
                title: 'Administração bloqueada offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setLoadingAction(true);

        try {
            if (!usuarioSelecionado) {
                if (!dadosBanco.designadoPara || !(await confirm({
                    title: 'Devolver território',
                    message: 'Confirmar devolução do território?',
                    tone: 'warning',
                    confirmLabel: 'Devolver'
                }))) {
                    setLoadingAction(false);
                    return;
                }
                const historico = buildHistoricoTerritorio({
                    dadosBanco,
                    responsavelNome: dadosBanco.designadoNome,
                    agora: new Date()
                });
                const updateData = {
                    designadoPara: null,
                    designadoNome: null,
                    dataDesignacao: null,
                    designacaoId: null,
                    cicloAtual: null,
                    historico: arrayUnion(historico),
                    status: TERRITORIO_STATUS.ABERTO,
                    ultimaAlteracao: new Date()
                };

                if (dadosBanco.status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO) {
                    updateData.quadras_feitas = [];
                }

                await salvarEstadoTerritorio(updateData);
                try {
                    const texto = `Território ${nome} devolvido${contextoSufixo}.`;
                    await enviarEventoNotificacao({
                        para: 'ADMINS',
                        texto,
                        tipo: 'devolucao',
                        origem: 'sistema',
                        tituloPush: 'Território devolvido'
                    });
                } catch (error) {
                    console.error("Erro ao enviar notificação de devolução:", error);
                }

                setMsgPronta(null);
                notify({
                    title: 'Território devolvido',
                    message: 'Território devolvido com sucesso. Sincronizado com o servidor.',
                    variant: 'success'
                });
            } else {
                const usuarioObj = listaUsuarios.find(u => u.email === usuarioSelecionado);
                const novoNome = usuarioObj ? usuarioObj.nome : "Dirigente";
                const agora = new Date();
                const designacaoId = createDesignacaoId();
                const novoCiclo = buildNovoCicloTerritorio({
                    dadosBanco,
                    novoNome,
                    agora,
                    designacaoId
                });

                await salvarEstadoTerritorio({
                    designadoPara: usuarioSelecionado,
                    designadoNome: novoNome,
                    dataDesignacao: agora,
                    designacaoId,
                    cicloAtual: novoCiclo,
                    status: TERRITORIO_STATUS.ABERTO,
                    ultimaAlteracao: agora
                });

                const link = buildPublicAppRouteUrl('/app', { lat: centro.lat, lng: centro.lng, z: 16 });
                const contextoLinha = contextoSistema?.campanhaAtiva ? `\n *Modo:* ${contextoSistema.contextoAtivoTitulo}` : '';
                setMsgPronta({ texto: `Olá *${novoNome}*! \nO território *${nome}* foi designado para você.${contextoLinha}\n\n *Acesse:* ${link}\n\nBom trabalho!`, whatsapp: usuarioObj?.whatsapp, nome: novoNome });

                notify({
                    title: 'Designação salva',
                    message: `Designação salva com sucesso para ${novoNome}.`,
                    variant: 'success'
                });
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            notify({
                title: 'Erro ao salvar',
                message: 'Verifique sua conexão com a internet e tente novamente. A alteração não foi salva.',
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setLoadingAction(false);
        }
    };

    const disponibilizarNovamente = async () => {
        if (!isOnline) {
            notify({
                title: 'Administração bloqueada offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        if (!(await confirm({
            title: 'Disponibilizar novamente',
            message: 'Remover o status de finalizado e deixar este território disponível novamente?',
            tone: 'warning',
            confirmLabel: 'Disponibilizar'
        }))) return;

        setLoadingAction(true);
        try {
            await salvarEstadoTerritorio({
                status: TERRITORIO_STATUS.ABERTO,
                ultimaAlteracao: new Date()
            });
            notify({
                title: 'Território liberado',
                message: 'Território liberado novamente para trabalho.',
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao reabrir território:", error);
            notify({
                title: 'Reabertura indisponível',
                message: 'Não foi possível liberar o território novamente.',
                variant: 'error'
            });
        } finally {
            setLoadingAction(false);
        }
    };

    const compartilharDiretamente = () => {
        const usuarioObj = listaUsuarios.find(u => u.email === dadosBanco.designadoPara);
        const msg = gerarLinkMsg(dadosBanco.designadoNome, usuarioObj?.whatsapp);
        window.open(buildWhatsAppShareUrl(msg.texto, msg.whatsapp), '_blank');
    };

    const abrirWhatsapp = () => {
        if (!msgPronta) return;
        window.open(buildWhatsAppShareUrl(msgPronta.texto, msgPronta.whatsapp), '_blank');
        setMsgPronta(null);
    };

    const compartilharPontoEncontro = () => {
        const p = posicaoClique || centro;
        const appUrl = buildAppLocationUrl(p.lat, p.lng, 17);
        const mapsUrl = buildGoogleMapsUrl(p.lat, p.lng);
        const text = buildLocationShareText({
            title: 'Ponto de Encontro',
            territoryName: nome,
            appUrl,
            mapsUrl
        });

        window.open(buildWhatsAppShareUrl(text), '_blank');
    };

    if (!isAdmin && !isMeu) return null;

    return (
        <>
            <Polygon positions={posicoes} pathOptions={{ color: corBorda, weight: pesoBorda, fillColor: corPreenchimento, fillOpacity: opacidade, opacity: opacidadeBorda }} eventHandlers={{ click: (e) => { if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); setPosicaoClique(e.latlng); } }}>
                <Popup>
                    <div className="min-w-[260px] p-1 font-sans">
                        <div className="border-b border-gray-200 pb-2 mb-2 text-center relative">
                            {/* ÍCONE DE PROCESSANDO NO CABEÇALHO (POPUP) */}
                            {loadingAction && (
                                <div className="absolute top-0 right-0 animate-spin text-blue-600" title="Salvando alterações...">
                                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                            <strong className="text-lg font-bold text-gray-800 block break-words leading-tight">{nome}</strong>
                            {dadosBanco.ultimaConclusao && <span className="text-[10px] text-gray-500 uppercase">Última vez: {textoTempo} atrás</span>}
                        </div>
                        <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1 font-medium"><span>{feitas} de {total} quadras</span><span>{Math.round(porcentagem)}%</span></div>
                            <div className="w-full bg-gray-200 rounded-full h-2 border border-gray-300 overflow-hidden"><div className={`h-full transition-all duration-500 ${isFinalizado ? 'bg-green-500' : isAguardandoFinalizacao ? 'bg-yellow-400' : 'bg-blue-600'}`} style={{ width: `${porcentagem}%` }}></div></div>
                        </div>
                        {(isFinalizado || isAguardandoFinalizacao) && (
                            <div className={`mb-3 rounded-lg border px-3 py-2 text-xs font-bold text-center ${isFinalizado ? 'border-green-200 bg-green-50 text-green-700' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                                {isFinalizado
                                    ? 'Território finalizado e aguardando nova liberação.'
                                    : 'Território 100% concluído, aguardando confirmação final.'}
                            </div>
                        )}
                        {isMeu && isAguardandoFinalizacao && (
                            <button
                                onClick={finalizarTerritorio}
                                disabled={loadingAction}
                                className={`popup-btn-action mb-3 text-white ${loadingAction ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            >
                                {loadingAction ? 'Processando...' : isOnline ? 'Confirmar Finalização' : 'Preparar Finalização'}
                            </button>
                        )}
                        {isAdmin ? (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {msgPronta ? (
                                    <div className="animate-fade-in flex flex-col gap-2">
                                        <div className="text-xs text-center text-green-700 font-bold bg-green-100 p-2 rounded">Designado para {msgPronta.nome}</div>
                                        <button onClick={abrirWhatsapp} className="popup-btn-action bg-green-600 text-white hover:bg-green-700">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" /></svg>
                                            {msgPronta.whatsapp ? "Enviar no WhatsApp" : "Compartilhar Link"}
                                        </button>
                                        <button onClick={() => setMsgPronta(null)} className="text-xs text-gray-400 underline text-center mt-1">Voltar</button>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        <div className="mb-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm text-center flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Responsável ATUAL</span>
                                            {dadosBanco.designadoPara ? (
                                                <span className="text-lg font-extrabold text-blue-800 uppercase leading-tight break-words">
                                                    {dadosBanco.designadoNome}
                                                </span>
                                            ) : (
                                                <span className="text-lg font-bold text-green-600">
                                                    Livre
                                                </span>
                                            )}
                                        </div>
                                        {!isOnline && (
                                            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                                {ADMIN_OFFLINE_MESSAGE}
                                            </div>
                                        )}
                                        <select
                                            className="w-full p-2 mb-2 text-sm bg-white border border-gray-300 rounded outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                            value={usuarioSelecionado}
                                            onChange={(e) => setUsuarioSelecionado(e.target.value)}
                                            disabled={loadingAction || !isOnline}
                                        >
                                            <option value="">-- Devolver / Livre --</option>
                                            {listaUsuarios.map(u => <option key={u.email} value={u.email} className={u.email === user.email ? "font-bold text-blue-600" : ""}>{u.nome}</option>)}
                                        </select>
                                        <button
                                            onClick={salvarDesignacao}
                                            disabled={(!dadosBanco.designadoPara && !usuarioSelecionado) || loadingAction || !isOnline}
                                            className={`popup-btn-action text-white mb-2 ${loadingAction ? 'bg-slate-400 cursor-wait' :
                                                (!dadosBanco.designadoPara && !usuarioSelecionado ? 'bg-gray-300' : !usuarioSelecionado ? 'bg-red-500' : 'bg-blue-600')
                                                }`}
                                        >
                                            {loadingAction ? (
                                                <span className="flex items-center gap-2">
                                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Processando...
                                                </span>
                                            ) : (
                                                !dadosBanco.designadoPara && !usuarioSelecionado ? "Já está Livre" : !usuarioSelecionado ? "Devolver" : "Salvar"
                                            )}
                                        </button>
                                        {isFinalizado && !dadosBanco.designadoPara && (
                                            <button onClick={disponibilizarNovamente} disabled={loadingAction || !isOnline} className="popup-btn-action bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 mt-2 disabled:opacity-50">
                                                Disponibilizar Novamente
                                            </button>
                                        )}
                                        {donoDoTerritorio && <button onClick={compartilharDiretamente} disabled={loadingAction} className="popup-btn-action bg-white border border-green-600 text-green-700 hover:bg-green-50 text-xs py-1 mt-2">Compartilhar Novamente</button>}
                                        {isMeu && <button onClick={compartilharPontoEncontro} className="popup-btn-action bg-green-600 text-white mt-2">Ponto de Encontro</button>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center mt-2">
                                {isMeu ? <button onClick={compartilharPontoEncontro} className="popup-btn-action bg-green-600 text-white w-full">Ponto de Encontro</button> : <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">{isOcupado ? `Ocupado por ${dadosBanco.designadoNome}` : "Disponível"}</div>}
                            </div>
                        )}
                    </div>
                </Popup>
                {/* TOOLTIP INTELIGENTE */}
                {zoomLevel >= 14 && !posicaoLabel && (
                    <Tooltip permanent direction="center" className="label-territorio">
                        {renderLabelTerritorio()}
                    </Tooltip>
                )}
            </Polygon>

            {zoomLevel >= 14 && posicaoLabel && (
                <CircleMarker
                    center={posicaoLabel}
                    radius={0}
                    pathOptions={{ opacity: 0, fillOpacity: 0 }}
                    interactive={false}
                >
                    <Tooltip permanent direction="center" className="label-territorio">
                        {renderLabelTerritorio()}
                    </Tooltip>
                </CircleMarker>
            )}

            {/* ITENS INTERNOS COM KEYS ÚNICAS COMPOSTAS (FIXED) */}
            {deveMostrarQuadras && listaQuadras.map((q, idx) => (
                <QuadraMarker
                    key={`t-${idTerritorio}-q-${idx}`} // FIX: Usando apenas ID do território + index para garantir unicidade absoluta
                    quadra={q}
                    isFeita={dadosBanco.quadras_feitas?.includes(q.id)}
                    podeMarcar={podeMarcarQuadra}
                    podeAnotar={podeAnotar}
                    nota={notasVisiveis?.[q.id]}
                    onAbrirNota={abrirModalNota}
                    onAlternarQuadra={alternarQuadra}
                />
            ))}
            {deveMostrarQuadras && showRefs && pontosFiltrados.referencias.map((ref, idx) => (
                <Marker key={`t-${idTerritorio}-ref-${idx}`} position={[ref.lat, ref.lng]} icon={L.divIcon({ className: 'bg-transparent', html: `<div class="map-poi-marker ref">📍</div>`, iconAnchor: [13, 13] })} eventHandlers={{ click: (e) => { if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); } }}>
                    <Tooltip direction="top" offset={[0, -14]} className="font-bold text-xs">{ref.nome}</Tooltip>
                    <Popup>
                        <div className="flex flex-col items-center gap-2 p-1 min-w-[150px]">
                            <h3 className="font-bold text-gray-800 text-sm">{ref.nome}</h3>
                            <button
                                onClick={() => {
                                    const mapsUrl = buildGoogleMapsUrl(ref.lat, ref.lng);
                                    const text = buildLocationShareText({
                                        title: 'Ponto de Referência',
                                        territoryName: nome,
                                        mapsUrl,
                                        extraLine: `Referência: *${ref.nome}*`
                                    });

                                    window.open(buildWhatsAppShareUrl(text), '_blank');
                                }}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium w-full shadow-sm"
                            >
                                Compartilhar
                            </button>
                            <button
                                onClick={() => window.open(buildGoogleMapsUrl(ref.lat, ref.lng), '_blank')}
                                className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium w-full shadow-sm"
                            >
                                Abrir no mapa
                            </button>
                        </div>
                    </Popup>
                </Marker>
            ))}
            {deveMostrarQuadras && showCondos && pontosFiltrados.condominios.map((c, idx) => (
                <Marker key={`t-${idTerritorio}-cdo-${idx}`} position={[c.lat, c.lng]} icon={L.divIcon({ className: 'bg-transparent', html: `<div class="relative group map-poi-marker condo">🏢${(notasVisiveis?.[c.nome]?.length || (typeof notasVisiveis?.[c.nome] === 'string' && notasVisiveis?.[c.nome])) ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 border-2 border-white rounded-full shadow-sm z-50"></span>' : ''}</div>`, iconAnchor: [13, 13] })} eventHandlers={{ click: (e) => { if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); abrirModalNota(c.nome, notasVisiveis?.[c.nome]); } }}>
                    <Tooltip direction="top" offset={[0, -14]} className="font-bold text-xs text-blue-800">{c.nome}</Tooltip>
                </Marker>
            ))}
            <ModalNota
                key={`${modalConfig.open ? 'open' : 'closed'}-${modalConfig.dados?.quadraId || 'sem-quadra'}`}
                isOpen={modalConfig.open}
                dados={modalConfig.dados ? {
                    ...modalConfig.dados,
                    notas: notasVisiveis?.[modalConfig.dados.quadraId]
                } : null}
                user={user}
                isAdmin={isAdmin && isOnline}
                canWrite={podeAnotar}
                onClose={fecharModal}
                onAdicionar={adicionarNota}
                onEditar={editarNota}
                onExcluir={removerNota}
            />
            <ModalConfirmacaoFinalizacao
                isOpen={confirmacaoFinalizacaoAberta}
                onConfirmar={confirmarFinalizacao}
                onRecusar={recusarFinalizacao}
                loading={loadingAction}
                contextoSufixo={contextoSufixo}
            />
        </>
    );
};

// --- MAPA PRINCIPAL ---
const Mapa = ({ user, isAdmin, contextoSistema, isOnline, outboxActions }) => {
    const adminControlsRef = useLeafletDomEventIsolation();
    const focusSummaryRef = useLeafletDomEventIsolation();
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [mapaErro, setMapaErro] = useState('');
    const [zoomLevel, setZoomLevel] = useState(MAP_INITIAL_ZOOM);
    const [listaUsuarios, setListaUsuarios] = useState([]);
    const [enderecos, setEnderecos] = useState([]);
    const [gruposEndereco, setGruposEndereco] = useState([]);
    const [mostrarEnderecosArquivados, setMostrarEnderecosArquivados] = useState(false);
    const [mostrarGruposArquivados, setMostrarGruposArquivados] = useState(false);
    const [enderecosSelecionadosGrupo, setEnderecosSelecionadosGrupo] = useState([]);
    const [grupoEnderecoModalAberto, setGrupoEnderecoModalAberto] = useState(false);
    const [grupoEnderecoFocadoId, setGrupoEnderecoFocadoId] = useState(null);
    const [pontoMapaSelecionado, setPontoMapaSelecionado] = useState(null);
    const [enderecoModal, setEnderecoModal] = useState({ open: false, mode: 'create', endereco: null, ponto: null });
    const [salvandoEndereco, setSalvandoEndereco] = useState(false);
    const [salvandoGrupoEndereco, setSalvandoGrupoEndereco] = useState(false);
    const [posicaoUsuario, setPosicaoUsuario] = useState(null);
    const [trilhaUsuario, setTrilhaUsuario] = useState([]);
    const [direcaoUsuario, setDirecaoUsuario] = useState(null);
    const [rastreandoLocalizacao, setRastreandoLocalizacao] = useState(false);
    const [tipoMapa, setTipoMapa] = useState('google');
    const [showRefs, setShowRefs] = useState(false);
    const [showCondos, setShowCondos] = useState(true);
    const [mostrarDicasControles, setMostrarDicasControles] = useState(true);
    const [tentativaMapa, setTentativaMapa] = useState(0);
    const { notify, confirm } = useUiFeedback();

    const tiposPontosDisponiveis = useMemo(() => {
        const todosPontos = geoJsonData?.features?.flatMap((feature) => feature.properties?.pontos || []) || [];
        return {
            hasReferencias: todosPontos.some((ponto) => ponto.tipo === 'referencia'),
            hasCondominios: todosPontos.some((ponto) => ponto.tipo === 'condominio')
        };
    }, [geoJsonData]);

    useEffect(() => {
        if (!geoJsonData) return;
        if (!tiposPontosDisponiveis.hasReferencias) setShowRefs(false);
        if (!tiposPontosDisponiveis.hasCondominios) setShowCondos(false);
    }, [geoJsonData, tiposPontosDisponiveis.hasCondominios, tiposPontosDisponiveis.hasReferencias]);

    useEffect(() => {
        const unsubscribe = onSnapshot(getEnderecosCollectionRef(db), (snapshot) => {
            const lista = snapshot.docs
                .map((docSnapshot) => ({
                    id: docSnapshot.id,
                    ...docSnapshot.data()
                }))
                .filter((endereco) => Number.isFinite(Number(endereco.lat)) && Number.isFinite(Number(endereco.lng)))
                .sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id)));

            setEnderecos(lista);
        }, (error) => {
            console.error('Erro ao carregar endereços:', error);
            notify({
                title: 'Endereços indisponíveis',
                message: 'Não foi possível carregar os endereços cadastrados agora.',
                variant: 'warning'
            });
        });

        return unsubscribe;
    }, [notify]);

    useEffect(() => {
        const unsubscribe = onSnapshot(getGruposEnderecoCollectionRef(db), (snapshot) => {
            const lista = snapshot.docs
                .map((docSnapshot) => ({
                    id: docSnapshot.id,
                    ...docSnapshot.data()
                }))
                .sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id)));

            setGruposEndereco(lista);
        }, (error) => {
            console.error('Erro ao carregar grupos de endereços:', error);
            notify({
                title: 'Territórios indisponíveis',
                message: 'Não foi possível carregar os territórios de endereços agora.',
                variant: 'warning'
            });
        });

        return unsubscribe;
    }, [notify]);

    useEffect(() => {
        let ativo = true;

        setMapaErro('');
        setGeoJsonData(null);

        loadMapaData()
            .then((data) => {
                if (!ativo) return;
                setGeoJsonData(data);
            })
            .catch((error) => {
                console.error("Erro ao carregar mapa:", error);
                clearMapaDataCache();

                if (!ativo) return;

                setMapaErro('Não foi possível carregar o mapa agora. Tente novamente.');
            });

        const carregarUsuarios = async () => {
            if (!isAdmin) return;
            try {
                const q = await getDocs(collection(db, "usuarios"));
                const lista = q.docs.map(doc => ({ email: doc.id, nome: doc.data().nome || "Sem Nome", role: doc.data().role, whatsapp: doc.data().whatsapp }));
                lista.sort((a, b) => a.nome.localeCompare(b.nome));
                setListaUsuarios(lista);
            } catch (e) { console.error(e); }
        };
        carregarUsuarios();

        return () => {
            ativo = false;
        };
    }, [isAdmin, tentativaMapa]);

    useEffect(() => {
        const timer = window.setTimeout(() => setMostrarDicasControles(false), 4000);
        return () => window.clearTimeout(timer);
    }, []);

    const MapEvents = () => {
        const map = useMapEvents({
            click: (event) => {
                setPontoMapaSelecionado({
                    lat: event.latlng.lat,
                    lng: event.latlng.lng
                });
            },
            zoomstart: () => {
                setPontoMapaSelecionado(null);
            },
            dragstart: () => {
                setPontoMapaSelecionado(null);
            },
            zoomend: () => {
                setZoomLevel(map.getZoom());
                writeOfflineMapViewportBounds(map.getBounds());
            },
            moveend: () => {
                writeOfflineMapViewportBounds(map.getBounds());
            }
        });

        useEffect(() => {
            writeOfflineMapViewportBounds(map.getBounds());
        }, [map]);

        return null;
    };

    const enderecosPorGrupo = useMemo(() => {
        const map = new Map();
        enderecos.forEach((endereco) => {
            if (!endereco.grupoId) return;
            if (!map.has(endereco.grupoId)) {
                map.set(endereco.grupoId, []);
            }
            map.get(endereco.grupoId).push(endereco);
        });

        map.forEach((lista) => lista.sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id))));
        return map;
    }, [enderecos]);

    const enderecosPorId = useMemo(() => (
        new Map(enderecos.map((endereco) => [endereco.id, endereco]))
    ), [enderecos]);

    const enderecosPorGrupoCanonico = useMemo(() => {
        const map = new Map();
        enderecos.forEach((endereco) => {
            const grupoKey = getGrupoEnderecoCanonicalKey(endereco.grupoId || endereco.grupoCodigo);
            if (!grupoKey) return;
            if (!map.has(grupoKey)) {
                map.set(grupoKey, []);
            }
            map.get(grupoKey).push(endereco);
        });

        map.forEach((lista) => lista.sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id))));
        return map;
    }, [enderecos]);

    const gruposEnderecoCompletos = useMemo(() => {
        const grupos = gruposEndereco.map((grupo) => (
            mergeGrupoEnderecoRuntimeStats(
                grupo,
                resolveEnderecosGrupoFromMaps(grupo, enderecosPorGrupo, enderecosPorGrupoCanonico, enderecosPorId)
            )
        ));
        const chavesReais = new Set();

        grupos.forEach((grupo) => {
            [grupo.id, grupo.codigo].filter(Boolean).forEach((value) => {
                chavesReais.add(getGrupoEnderecoCanonicalKey(value));
            });
        });

        enderecosPorGrupoCanonico.forEach((listaEnderecos, grupoKey) => {
            if (chavesReais.has(grupoKey)) return;
            grupos.push(buildSyntheticGrupoEndereco(grupoKey, listaEnderecos));
        });

        return grupos.sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id)));
    }, [enderecosPorGrupo, enderecosPorGrupoCanonico, enderecosPorId, gruposEndereco]);

    const grupoEnderecoFocado = useMemo(() => (
        gruposEnderecoCompletos.find((grupo) => isSameGrupoEndereco(grupo, grupoEnderecoFocadoId)) || null
    ), [grupoEnderecoFocadoId, gruposEnderecoCompletos]);

    const enderecosGrupoFocado = useMemo(() => (
        grupoEnderecoFocado
            ? resolveEnderecosGrupoFromMaps(grupoEnderecoFocado, enderecosPorGrupo, enderecosPorGrupoCanonico, enderecosPorId)
            : []
    ), [enderecosPorGrupo, enderecosPorGrupoCanonico, enderecosPorId, grupoEnderecoFocado]);

    const visitadosGrupoFocado = useMemo(() => new Set(grupoEnderecoFocado?.enderecos_visitados || []), [grupoEnderecoFocado]);

    const podeExecutarGrupoFocado = useMemo(() => {
        if (!grupoEnderecoFocado || !isOnline) return false;
        if (grupoEnderecoFocado.status === GRUPO_ENDERECO_STATUS.ARQUIVADO) return false;
        if (getGrupoEnderecoProgresso(grupoEnderecoFocado).isFinalizado) return false;

        return isAdmin || normalizeEmailValue(grupoEnderecoFocado.designadoPara) === normalizeEmailValue(user?.email);
    }, [grupoEnderecoFocado, isAdmin, isOnline, user?.email]);

    const enderecosVisiveis = useMemo(() => enderecos.filter((endereco) => {
        if (grupoEnderecoFocadoId) {
            const chavesFoco = new Set(
                (grupoEnderecoFocado ? [grupoEnderecoFocado.id, grupoEnderecoFocado.codigo] : [grupoEnderecoFocadoId])
                    .filter(Boolean)
                    .map(getGrupoEnderecoCanonicalKey)
            );
            const chaveEndereco = getGrupoEnderecoCanonicalKey(endereco.grupoId || endereco.grupoCodigo);
            return endereco.status === ENDERECO_STATUS.ATIVO && chavesFoco.has(chaveEndereco);
        }

        if (isAdmin) {
            if (endereco.status === ENDERECO_STATUS.ARQUIVADO) {
                return mostrarEnderecosArquivados;
            }

            return endereco.status === ENDERECO_STATUS.ATIVO && !endereco.grupoId && !endereco.grupoCodigo;
        }

        return false;
    }), [enderecos, grupoEnderecoFocado, grupoEnderecoFocadoId, isAdmin, mostrarEnderecosArquivados]);

    const totalEnderecosArquivados = useMemo(() => enderecos.filter((endereco) => endereco.status === ENDERECO_STATUS.ARQUIVADO).length, [enderecos]);
    const gruposEnderecoVisiveis = useMemo(() => gruposEnderecoCompletos.filter((grupo) => {
        const statusGrupo = grupo.status || GRUPO_ENDERECO_STATUS.ATIVO;

        if (grupoEnderecoFocadoId) {
            return isSameGrupoEndereco(grupo, grupoEnderecoFocadoId);
        }

        if (isAdmin) {
            return statusGrupo === GRUPO_ENDERECO_STATUS.ATIVO ||
                statusGrupo === GRUPO_ENDERECO_STATUS.FINALIZADO ||
                (mostrarGruposArquivados && statusGrupo === GRUPO_ENDERECO_STATUS.ARQUIVADO);
        }

        return statusGrupo === GRUPO_ENDERECO_STATUS.ATIVO && normalizeEmailValue(grupo.designadoPara) === normalizeEmailValue(user?.email);
    }), [grupoEnderecoFocadoId, gruposEnderecoCompletos, isAdmin, mostrarGruposArquivados, user?.email]);
    const totalGruposArquivados = useMemo(() => gruposEndereco.filter((grupo) => (grupo.status || GRUPO_ENDERECO_STATUS.ATIVO) === GRUPO_ENDERECO_STATUS.ARQUIVADO).length, [gruposEndereco]);
    const enderecosSelecionadosDados = useMemo(() => {
        const porId = new Map(enderecos.map((endereco) => [endereco.id, endereco]));
        return enderecosSelecionadosGrupo
            .map((enderecoId) => porId.get(enderecoId))
            .filter((endereco) => endereco && endereco.status === ENDERECO_STATUS.ATIVO && !endereco.grupoId && !endereco.grupoCodigo);
    }, [enderecos, enderecosSelecionadosGrupo]);

    useEffect(() => {
        setEnderecosSelecionadosGrupo((selecionadosAtuais) => {
            const selecionaveis = new Set(enderecos
                .filter((endereco) => endereco.status === ENDERECO_STATUS.ATIVO && !endereco.grupoId && !endereco.grupoCodigo)
                .map((endereco) => endereco.id));
            return selecionadosAtuais.filter((enderecoId) => selecionaveis.has(enderecoId));
        });
    }, [enderecos]);

    useEffect(() => {
        if (grupoEnderecoFocadoId && !grupoEnderecoFocado) {
            setGrupoEnderecoFocadoId(null);
        }
    }, [grupoEnderecoFocado, grupoEnderecoFocadoId]);

    const resumoFocoGrupoEndereco = useMemo(() => {
        if (!grupoEnderecoFocado) return null;

        const total = enderecosGrupoFocado.length;
        const pregados = enderecosGrupoFocado.filter((endereco) => visitadosGrupoFocado.has(endereco.id)).length;

        return {
            codigo: formatGrupoEnderecoCodigoExibicao(grupoEnderecoFocado.codigo || grupoEnderecoFocado.id),
            nome: formatGrupoEnderecoNomeExibicao(grupoEnderecoFocado.nome, grupoEnderecoFocado.codigo || grupoEnderecoFocado.id),
            total,
            pregados
        };
    }, [enderecosGrupoFocado, grupoEnderecoFocado, visitadosGrupoFocado]);

    const ativarFocoGrupoEndereco = (grupo) => {
        if (!grupo?.id) return;
        setGrupoEnderecoFocadoId(grupo.id);
        setPontoMapaSelecionado(null);
        setEnderecosSelecionadosGrupo([]);
    };

    const compartilharPontoMapa = (ponto) => {
        if (!ponto) return;
        const appUrl = buildAppLocationUrl(ponto.lat, ponto.lng, 18);
        const mapsUrl = buildGoogleMapsUrl(ponto.lat, ponto.lng);
        const text = buildLocationShareText({
            title: 'Localização selecionada',
            appUrl,
            mapsUrl
        });

        window.open(buildWhatsAppShareUrl(text), '_blank');
    };

    const compartilharEndereco = (endereco) => {
        const appUrl = buildAppLocationUrl(endereco.lat, endereco.lng, 18);
        const mapsUrl = buildGoogleMapsUrl(endereco.lat, endereco.lng);
        const detalhes = [
            `Código: *${formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}*`,
            endereco.endereco ? `Endereço: ${endereco.endereco}` : '',
            `Estrangeiros: ${endereco.quantidadeEstrangeiros || 0}`
        ].filter(Boolean).join('\n');
        const text = buildLocationShareText({
            title: 'Endereço de idioma',
            appUrl,
            mapsUrl,
            extraLine: detalhes
        });

        window.open(buildWhatsAppShareUrl(text), '_blank');
    };

    const navegarEndereco = (endereco) => {
        const directionsUrl = buildGoogleMapsDirectionsUrl(endereco.lat, endereco.lng);
        if (!directionsUrl) return;

        window.open(directionsUrl, '_blank');
    };

    const compartilharGrupoEndereco = (grupo) => {
        if (!grupo?.centro) return;
        const appUrl = buildAppLocationUrl(grupo.centro.lat, grupo.centro.lng, 17);
        const mapsUrl = buildGoogleMapsUrl(grupo.centro.lat, grupo.centro.lng);
        const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
        const nomeExibicao = formatGrupoEnderecoNomeExibicao(grupo.nome, grupo.codigo || grupo.id);
        const text = buildLocationShareText({
            title: 'Território',
            appUrl,
            mapsUrl,
            extraLine: [
                `Território: *${codigoExibicao}*`,
                nomeExibicao ? `Nome: ${nomeExibicao}` : '',
                `Endereços: ${grupo.totalEnderecos || 0}`,
                `Estrangeiros: ${grupo.totalEstrangeiros || 0}`
            ].filter(Boolean).join('\n')
        });

        window.open(buildWhatsAppShareUrl(text), '_blank');
    };

    const abrirCadastroEndereco = () => {
        if (!isOnline) {
            notify({
                title: 'Cadastro bloqueado offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setEnderecoModal({
            open: true,
            mode: 'create',
            endereco: null,
            ponto: pontoMapaSelecionado
        });
    };

    const abrirEdicaoEndereco = (endereco) => {
        if (!isOnline) {
            notify({
                title: 'Edição bloqueada offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setEnderecoModal({
            open: true,
            mode: 'edit',
            endereco,
            ponto: null
        });
    };

    const fecharEnderecoModal = () => {
        if (salvandoEndereco) return;
        setEnderecoModal({ open: false, mode: 'create', endereco: null, ponto: null });
    };

    const salvarEndereco = async (form) => {
        if (!isOnline) {
            notify({
                title: 'Cadastro bloqueado offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setSalvandoEndereco(true);
        try {
            if (enderecoModal.mode === 'edit' && enderecoModal.endereco?.id) {
                await updateEnderecoBasico(db, enderecoModal.endereco.id, form, user);
                notify({
                    title: 'Endereço atualizado',
                    message: 'Os dados básicos do endereço foram salvos.',
                    variant: 'success'
                });
            } else {
                const resultado = await createEnderecoManual(db, {
                    ...form,
                    user
                });
                setPontoMapaSelecionado(null);
                notify({
                    title: 'Endereço cadastrado',
                    message: `Código gerado: ${formatEnderecoCodigoExibicao(resultado.codigo)}.`,
                    variant: 'success'
                });
            }

            setEnderecoModal({ open: false, mode: 'create', endereco: null, ponto: null });
        } catch (error) {
            console.error('Erro ao salvar endereço:', error);
            notify({
                title: 'Erro ao salvar endereço',
                message: 'Verifique sua conexão e permissões antes de tentar novamente.',
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setSalvandoEndereco(false);
        }
    };

    const alternarArquivoEndereco = async (endereco) => {
        const arquivado = endereco.status === ENDERECO_STATUS.ARQUIVADO;
        const codigoExibicao = formatEnderecoCodigoExibicao(endereco.codigo || endereco.id);
        const confirmar = await confirm({
            title: arquivado ? 'Reativar endereço' : 'Arquivar endereço',
            message: arquivado
                ? `Reativar ${codigoExibicao || 'este endereço'} e voltar a mostrá-lo no mapa padrão?`
                : `Arquivar ${codigoExibicao || 'este endereço'} sem excluir o cadastro?`,
            tone: arquivado ? 'info' : 'warning',
            confirmLabel: arquivado ? 'Reativar' : 'Arquivar'
        });

        if (!confirmar) return;

        try {
            await setEnderecoArquivado(db, endereco.id, !arquivado, user);
            notify({
                title: arquivado ? 'Endereço reativado' : 'Endereço arquivado',
                message: arquivado ? 'O endereço voltou para o mapa padrão.' : 'O endereço foi ocultado do mapa padrão, sem exclusão física.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao alterar status do endereço:', error);
            notify({
                title: 'Status não alterado',
                message: 'Não foi possível alterar o status do endereço agora.',
                variant: 'error'
            });
        }
    };

    const alternarSelecaoEnderecoGrupo = (endereco) => {
        if (!endereco || endereco.grupoId || endereco.grupoCodigo || endereco.status !== ENDERECO_STATUS.ATIVO) return;
        setEnderecosSelecionadosGrupo((selecionadosAtuais) => (
            selecionadosAtuais.includes(endereco.id)
                ? selecionadosAtuais.filter((enderecoId) => enderecoId !== endereco.id)
                : [...selecionadosAtuais, endereco.id]
        ));
    };

    const abrirCriacaoGrupoEndereco = () => {
        if (!isOnline) {
            notify({
                title: 'Agrupamento bloqueado offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        if (!enderecosSelecionadosDados.length) {
            notify({
                title: 'Selecione endereços',
                message: 'Escolha pelo menos um endereço ativo e sem território para criar o território.',
                variant: 'warning'
            });
            return;
        }

        setGrupoEnderecoModalAberto(true);
    };

    const criarGrupoEndereco = async ({ nome }) => {
        if (!isOnline) {
            notify({
                title: 'Agrupamento bloqueado offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        setSalvandoGrupoEndereco(true);
        try {
            const resultado = await createGrupoEnderecoManual(db, {
                enderecos: enderecosSelecionadosDados,
                nome,
                user
            });
            setEnderecosSelecionadosGrupo([]);
            setGrupoEnderecoModalAberto(false);
            const codigoExibicao = formatGrupoEnderecoCodigoExibicao(resultado.codigo);
            notify({
                title: 'Território criado',
                message: `Código gerado: ${codigoExibicao}.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao criar grupo de endereços:', error);
            notify({
                title: 'Território não criado',
                message: String(error?.message || 'Não foi possível criar o território agora.'),
                variant: 'error',
                durationMs: 7000
            });
        } finally {
            setSalvandoGrupoEndereco(false);
        }
    };

    const alternarArquivoGrupoEndereco = async (grupo) => {
        const arquivado = grupo.status === GRUPO_ENDERECO_STATUS.ARQUIVADO;
        const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
        const confirmar = await confirm({
            title: arquivado ? 'Reativar território' : 'Arquivar território',
            message: arquivado
                ? `Reativar ${codigoExibicao || 'este território'} e voltar a mostrá-lo no mapa padrão?`
                : `Arquivar ${codigoExibicao || 'este território'} sem alterar os endereços vinculados?`,
            tone: arquivado ? 'info' : 'warning',
            confirmLabel: arquivado ? 'Reativar' : 'Arquivar'
        });

        if (!confirmar) return;

        try {
            await setGrupoEnderecoArquivado(db, grupo.id, !arquivado, user);
            notify({
                title: arquivado ? 'Território reativado' : 'Território arquivado',
                message: arquivado ? 'O território voltou para o mapa padrão.' : 'O território foi ocultado do mapa padrão.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao alterar status do grupo:', error);
            notify({
                title: 'Status não alterado',
                message: 'Não foi possível alterar o status do território agora.',
                variant: 'error'
            });
        }
    };

    const salvarDesignacaoGrupoEndereco = async (grupo, usuarioEmail, opcoes = {}) => {
        if (!isOnline) {
            notify({
                title: 'Designação bloqueada offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        const usuario = listaUsuarios.find((item) => item.email === usuarioEmail);
        if (!usuario) {
            notify({
                title: 'Usuário não encontrado',
                message: 'Escolha um usuário aprovado para designar o território.',
                variant: 'warning'
            });
            return;
        }

        const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);

        try {
            await designarGrupoEndereco(db, {
                grupoId: grupo.id,
                usuario,
                user
            });

            const mensagemDesignacao = buildMensagemDesignacaoGrupoEndereco({
                grupo,
                usuario,
                centro: opcoes?.centro || grupo.centro || null,
                contextoSistema
            });

            notify({
                title: 'Território designado',
                message: `${codigoExibicao} designado para ${usuario.nome}.`,
                variant: 'success'
            });

            return {
                texto: mensagemDesignacao.texto,
                whatsapp: mensagemDesignacao.whatsapp,
                nome: mensagemDesignacao.nome
            };
        } catch (error) {
            console.error('Erro ao designar grupo:', error);
            notify({
                title: 'Designação não salva',
                message: String(error?.message || 'Não foi possível designar o território agora.'),
                variant: 'error',
                durationMs: 7000
            });
        }
    };

    const devolverDesignacaoGrupoEndereco = async (grupo) => {
        if (!isOnline) {
            notify({
                title: 'Devolução bloqueada offline',
                message: ADMIN_OFFLINE_MESSAGE,
                variant: 'warning',
                durationMs: 7000
            });
            return;
        }

        const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
        const confirmar = await confirm({
            title: 'Devolver território',
            message: `Confirmar devolução do território ${codigoExibicao}?`,
            tone: 'warning',
            confirmLabel: 'Devolver'
        });

        if (!confirmar) return;

        try {
            await devolverGrupoEndereco(db, {
                grupoId: grupo.id,
                user
            });
            notify({
                title: 'Território devolvido',
                message: `${codigoExibicao} ficou livre para nova designação.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao devolver grupo:', error);
            notify({
                title: 'Devolução não salva',
                message: String(error?.message || 'Não foi possível devolver o território agora.'),
                variant: 'error',
                durationMs: 7000
            });
        }
    };

    const alternarEnderecoVisitadoGrupo = async (grupo, endereco, { sugerirFinalizacao = false } = {}) => {
        const visitadosAntes = new Set(grupo?.enderecos_visitados || []);
        const estavaVisitado = visitadosAntes.has(endereco.id);
        const enderecoIdsGrupo = Array.isArray(grupo?.enderecoIds) ? grupo.enderecoIds : [];
        const totalEnderecosGrupo = enderecoIdsGrupo.length || Number(grupo?.totalEnderecos) || 0;
        const totalAposToggle = estavaVisitado
            ? Math.max(0, visitadosAntes.size - 1)
            : visitadosAntes.size + 1;
        const completouAgora = sugerirFinalizacao && !estavaVisitado && totalEnderecosGrupo > 0 && totalAposToggle >= totalEnderecosGrupo;

        try {
            await toggleEnderecoVisitadoGrupo(db, {
                grupoId: grupo.id,
                enderecoId: endereco.id,
                user: { ...user, isAdmin }
            });

            if (completouAgora) {
                const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
                const deveFinalizar = await confirm({
                    title: 'Finalizar território?',
                    message: `Todos os endereços do território ${codigoExibicao} foram marcados como pregados. Deseja finalizar o território agora?`,
                    tone: 'info',
                    confirmLabel: 'Finalizar agora',
                    cancelLabel: 'Depois'
                });

                if (deveFinalizar) {
                    try {
                        await finalizarGrupoEnderecoDesignado(db, {
                            grupoId: grupo.id,
                            user: { ...user, isAdmin }
                        });
                        notify({
                            title: 'Território finalizado',
                            message: `${codigoExibicao} foi finalizado com sucesso.`,
                            variant: 'success'
                        });
                    } catch (error) {
                        console.error('Erro ao finalizar grupo:', error);
                        notify({
                            title: 'Finalização indisponível',
                            message: String(error?.message || 'Não foi possível finalizar o território agora.'),
                            variant: 'error',
                            durationMs: 7000
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao marcar endereço do grupo:', error);
            notify({
                title: 'Progresso não salvo',
                message: String(error?.message || 'Não foi possível salvar o progresso do território agora.'),
                variant: 'error',
                durationMs: 7000
            });
        }
    };

    const finalizarGrupoEndereco = async (grupo) => {
        const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
        const confirmar = await confirm({
            title: 'Finalizar território',
            message: `Confirmar finalização do território ${codigoExibicao}?`,
            tone: 'warning',
            confirmLabel: 'Finalizar'
        });

        if (!confirmar) return;

        try {
            await finalizarGrupoEnderecoDesignado(db, {
                grupoId: grupo.id,
                user: { ...user, isAdmin }
            });
            notify({
                title: 'Território finalizado',
                message: `${codigoExibicao} foi finalizado com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao finalizar grupo:', error);
            notify({
                title: 'Finalização indisponível',
                message: String(error?.message || 'Não foi possível finalizar o território agora.'),
                variant: 'error',
                durationMs: 7000
            });
        }
    };

    const removerEnderecoSelecionadoDoGrupo = async (endereco) => {
        if (!endereco?.grupoId) return;
        const codigoExibicao = formatGrupoEnderecoCodigoExibicao(endereco.grupoCodigo || '');
        const enderecoCodigoExibicao = formatEnderecoCodigoExibicao(endereco.codigo || endereco.id);
        const confirmar = await confirm({
            title: 'Remover do território',
            message: `Remover ${enderecoCodigoExibicao || 'este endereço'} do território ${codigoExibicao || ''}?`,
            tone: 'warning',
            confirmLabel: 'Remover'
        });

        if (!confirmar) return;

        try {
            await removerEnderecoDoGrupo(db, {
                enderecoId: endereco.id,
                grupoId: endereco.grupoId,
                user
            });
            notify({
                title: 'Endereço removido',
                message: 'O vínculo com o território foi removido e os totais foram recalculados.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Erro ao remover endereço do grupo:', error);
            notify({
                title: 'Vínculo não alterado',
                message: String(error?.message || 'Não foi possível remover o endereço do território agora.'),
                variant: 'error',
                durationMs: 7000
            });
        }
    };

    return (
        <div className="h-full w-full relative">
            <style>{cssTooltip}</style>
            {mapaErro ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-gray-100 px-6 text-center">
                    <p className="max-w-sm text-sm font-semibold text-slate-700">{mapaErro}</p>
                    <button
                        type="button"
                        onClick={() => setTentativaMapa((atual) => atual + 1)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                        Tentar novamente
                    </button>
                </div>
            ) : !geoJsonData ? (
                <div className="flex h-full items-center justify-center bg-gray-100"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
            ) : (
                <MapContainer center={MAP_INITIAL_CENTER} zoom={MAP_INITIAL_ZOOM} maxZoom={22} zoomControl={false} className="h-full w-full z-0">
                    <MapEvents />
                    <FocoGrupoEnderecoMapController grupoId={grupoEnderecoFocadoId} enderecos={enderecosGrupoFocado} />
                    <DeepLinkHandler />
                    <CacheMapaOffline geoJsonData={geoJsonData} isOnline={isOnline} tipoMapa={tipoMapa} />
                    {tipoMapa === 'padrao' && <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={22} />}
                    {tipoMapa === 'google' && <TileLayer attribution='© Google Maps' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" maxNativeZoom={20} maxZoom={22} />}
                    {tipoMapa === 'satelite' && <TileLayer attribution='© Google Maps' url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" maxNativeZoom={20} maxZoom={22} />}

                    <SeletorCamadas
                        tipoMapa={tipoMapa}
                        setTipoMapa={setTipoMapa}
                        showRefs={showRefs}
                        setShowRefs={setShowRefs}
                        showCondos={showCondos}
                        setShowCondos={setShowCondos}
                        mostrarDicas={mostrarDicasControles}
                        hasReferencias={tiposPontosDisponiveis.hasReferencias}
                        hasCondominios={tiposPontosDisponiveis.hasCondominios}
                    />
                    {isAdmin && (
                        <div ref={adminControlsRef} className="absolute top-20 right-4 z-[400] flex max-w-[150px] flex-col gap-2" onClick={stopMapDomEvent}>
                            {enderecosSelecionadosDados.length > 0 && (
                                <div className="rounded-lg border border-indigo-200 bg-white p-2 shadow-xl">
                                    <div className="mb-2 text-center text-xs font-extrabold text-indigo-700">
                                        {enderecosSelecionadosDados.length} selecionado(s)
                                    </div>
                                    <button
                                        type="button"
                                        onClick={abrirCriacaoGrupoEndereco}
                                        disabled={!isOnline}
                                        className="w-full rounded-md bg-indigo-700 px-2 py-2 text-xs font-extrabold text-white transition hover:bg-indigo-800 disabled:opacity-50"
                                    >
                                        Criar território
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEnderecosSelecionadosGrupo([])}
                                        className="mt-1 w-full rounded-md px-2 py-1 text-xs font-bold text-slate-400 underline"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            )}
                            {totalEnderecosArquivados > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setMostrarEnderecosArquivados((current) => !current)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-extrabold shadow-xl transition active:scale-95 ${mostrarEnderecosArquivados ? 'border-slate-500 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                                    title={mostrarEnderecosArquivados ? 'Ocultar endereços arquivados' : 'Mostrar endereços arquivados'}
                                >
                                    End. arquivados
                                </button>
                            )}
                            {totalGruposArquivados > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setMostrarGruposArquivados((current) => !current)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-extrabold shadow-xl transition active:scale-95 ${mostrarGruposArquivados ? 'border-slate-500 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                                    title={mostrarGruposArquivados ? 'Ocultar territórios arquivados' : 'Mostrar territórios arquivados'}
                                >
                                    Terr. arq.
                                </button>
                            )}
                        </div>
                    )}
                    <ControlesNavegacao
                        rastreandoLocalizacao={rastreandoLocalizacao}
                        setRastreandoLocalizacao={setRastreandoLocalizacao}
                        setPosicaoUsuario={setPosicaoUsuario}
                        setTrilhaUsuario={setTrilhaUsuario}
                        setDirecaoUsuario={setDirecaoUsuario}
                        mostrarDicas={mostrarDicasControles}
                    />
                    {trilhaUsuario.length > 1 && (
                        <Polyline positions={trilhaUsuario} pathOptions={{ color: MAP_COLORS.apoio.trilha, weight: 4, opacity: 0.38, lineCap: 'round', lineJoin: 'round' }} />
                    )}
                    <MarcadorUsuario posicao={posicaoUsuario} direcao={direcaoUsuario} />
                    <PontoMapaClicado
                        ponto={pontoMapaSelecionado}
                        canCreate={isAdmin && isOnline}
                        onCreate={abrirCadastroEndereco}
                        onShare={() => compartilharPontoMapa(pontoMapaSelecionado)}
                        onClose={() => setPontoMapaSelecionado(null)}
                    />

                    {gruposEnderecoVisiveis.map((grupo) => (
                        <GrupoEnderecoLayer
                            key={grupo.id}
                            grupo={grupo}
                            user={user}
                            isAdmin={isAdmin}
                            isOnline={isOnline}
                            contextoSistema={contextoSistema}
                            listaUsuarios={listaUsuarios}
                            enderecosGrupo={resolveEnderecosGrupoFromMaps(grupo, enderecosPorGrupo, enderecosPorGrupoCanonico, enderecosPorId)}
                            onShare={compartilharGrupoEndereco}
                            onToggleArchive={alternarArquivoGrupoEndereco}
                            onDesignar={salvarDesignacaoGrupoEndereco}
                            onDevolver={devolverDesignacaoGrupoEndereco}
                            onToggleVisitado={alternarEnderecoVisitadoGrupo}
                            onFinalizar={finalizarGrupoEndereco}
                            onFocusMap={ativarFocoGrupoEndereco}
                            isMapFocused={isSameGrupoEndereco(grupo, grupoEnderecoFocadoId)}
                        />
                    ))}

                    {enderecosVisiveis.map((endereco) => (
                        <EnderecoMarker
                            key={endereco.id}
                            endereco={endereco}
                            isAdmin={isAdmin}
                            isOnline={isOnline}
                            isSelected={enderecosSelecionadosGrupo.includes(endereco.id)}
                            canSelect={isAdmin && isOnline && endereco.status === ENDERECO_STATUS.ATIVO && !endereco.grupoId && !endereco.grupoCodigo}
                            focusMode={Boolean(grupoEnderecoFocadoId)}
                            isVisited={visitadosGrupoFocado.has(endereco.id)}
                            canMarkVisited={Boolean(grupoEnderecoFocadoId) && podeExecutarGrupoFocado}
                            onShare={compartilharEndereco}
                            onNavigate={navegarEndereco}
                            onEdit={abrirEdicaoEndereco}
                            onToggleArchive={alternarArquivoEndereco}
                            onToggleSelect={alternarSelecaoEnderecoGrupo}
                            onRemoveFromGroup={removerEnderecoSelecionadoDoGrupo}
                            onToggleVisited={(enderecoSelecionado) => {
                                if (!grupoEnderecoFocado) return;
                                return alternarEnderecoVisitadoGrupo(grupoEnderecoFocado, enderecoSelecionado, { sugerirFinalizacao: true });
                            }}
                        />
                    ))}

                    {geoJsonData.features.map((feature, index) => {
                        const uniqueId = getFeatureId(feature, index);
                        const uniqueKey = feature.properties.id ? `terr-${feature.properties.id}` : `terr-idx-${index}`;
                        return (
                            <TerritorioDetalhado
                                key={`${uniqueKey}-${contextoSistema?.contextoAtivoId || 'normal'}`}
                                dados={feature}
                                idTerritorio={uniqueId}
                                zoomLevel={zoomLevel}
                                user={user}
                                isAdmin={isAdmin}
                                isOnline={isOnline}
                                outboxActions={outboxActions}
                                listaUsuarios={listaUsuarios}
                                showRefs={showRefs}
                                showCondos={showCondos}
                                contextoSistema={contextoSistema}
                            />
                        );
                    })}
                    <EnderecoFormModal
                        isOpen={enderecoModal.open}
                        mode={enderecoModal.mode}
                        endereco={enderecoModal.endereco}
                        ponto={enderecoModal.ponto}
                        loading={salvandoEndereco}
                        onClose={fecharEnderecoModal}
                        onSubmit={salvarEndereco}
                    />
                    <GrupoEnderecoFormModal
                        isOpen={grupoEnderecoModalAberto}
                        selectedEnderecos={enderecosSelecionadosDados}
                        loading={salvandoGrupoEndereco}
                        onClose={() => {
                            if (!salvandoGrupoEndereco) setGrupoEnderecoModalAberto(false);
                        }}
                        onSubmit={criarGrupoEndereco}
                    />
                    {resumoFocoGrupoEndereco && (
                        <div className="pointer-events-none absolute left-3 right-3 top-4 z-[500] flex justify-center sm:left-auto sm:right-4 sm:w-full sm:max-w-[360px] sm:justify-end">
                            <div ref={focusSummaryRef} className="pointer-events-auto flex w-full flex-col gap-2 rounded-xl border border-teal-200 bg-white px-2.5 py-2 shadow-2xl" onClick={stopMapDomEvent}>
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex min-w-12 shrink-0 items-center justify-center rounded-lg bg-teal-50 px-2 py-2 text-base font-black text-teal-800">
                                        {resumoFocoGrupoEndereco.codigo}
                                    </div>
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight text-slate-700">{resumoFocoGrupoEndereco.nome}</p>
                                    <button
                                        type="button"
                                        onClick={() => setGrupoEnderecoFocadoId(null)}
                                        className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Sair
                                    </button>
                                </div>
                                <div className="flex w-full items-center gap-2">
                                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-teal-50">
                                        <div
                                            className="h-full rounded-full bg-teal-600"
                                            style={{
                                                width: `${Math.min(100, Math.max(0, resumoFocoGrupoEndereco.total ? (resumoFocoGrupoEndereco.pregados / resumoFocoGrupoEndereco.total) * 100 : 0))}%`
                                            }}
                                        />
                                    </div>
                                    <span className="shrink-0 text-[10px] font-black leading-none text-teal-700">
                                        {resumoFocoGrupoEndereco.pregados}/{resumoFocoGrupoEndereco.total} pregados
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </MapContainer>
            )}
        </div>
    );
};

export default Mapa;

