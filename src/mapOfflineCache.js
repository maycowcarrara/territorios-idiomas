const DISABLED_MAP_DATA_URL_VALUES = new Set(['', 'none', 'null', 'false', 'off', 'disabled']);

export function createEmptyMapData() {
    return {
        type: 'FeatureCollection',
        features: []
    };
}

export function resolveMapDataUrl(
    value = import.meta.env.VITE_MAPA_URL,
    mode = import.meta.env.MODE
) {
    const rawValue = String(value ?? '').trim();
    if (DISABLED_MAP_DATA_URL_VALUES.has(rawValue.toLowerCase())) {
        return null;
    }

    if (rawValue) {
        return rawValue;
    }

    return mode === 'general' ? './mapa.general.json' : null;
}

const DEFAULT_MAP_DATA_URL = resolveMapDataUrl();
export const MAP_DATA_CACHE_NAME = 'offline-map-data-v1';
export const MAP_TILE_CACHE_NAME = 'offline-map-tiles-v1';
const OFFLINE_MAP_DOWNLOAD_STATE_KEY = 'offline-map-download-state-v1';
const OFFLINE_MAP_VIEWPORT_BOUNDS_KEY = 'offline-map-viewport-bounds-v1';
const OFFLINE_MAP_ESTIMATE_CALIBRATION_KEY = 'offline-map-estimate-calibration-v1';
export const OFFLINE_MAP_MAX_AGE_DAYS = 365;
const TILE_LAYER_TYPES = ['padrao', 'google', 'satelite'];
export const OFFLINE_MAP_DOWNLOAD_ZOOMS = [12, 13, 14, 15, 16, 17, 18, 19];
export const OFFLINE_MAP_DOWNLOAD_PROFILES = Object.freeze({
    leve: {
        id: 'leve',
        label: 'Leve',
        zooms: [13, 14, 15, 16],
        description: 'Mais rápido e econômico'
    },
    medio: {
        id: 'medio',
        label: 'Médio',
        zooms: [13, 14, 15, 16, 17, 18],
        description: 'Bom equilíbrio para o campo'
    },
    completo: {
        id: 'completo',
        label: 'Completo',
        zooms: OFFLINE_MAP_DOWNLOAD_ZOOMS,
        description: 'Inclui zoom alto até 19'
    }
});
const OSM_SUBDOMAINS = ['a', 'b', 'c'];
const HIGH_ZOOM_PRECISE_TILE_FROM = 16;
const MAP_TILE_CACHE_MAX_ENTRIES = 30000;
const MAP_TILE_CACHE_TRIM_TO = 27000;
const TILE_TEMPLATES = {
    padrao: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    google: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    satelite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
};

const warmedTileJobs = new Set();
let tileCachePrunePromise = null;

function getConnectionInfo() {
    if (typeof navigator === 'undefined') return null;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function supportsCacheStorage() {
    return typeof window !== 'undefined' && 'caches' in window;
}

function resolveAbsoluteUrl(url) {
    if (typeof window === 'undefined') return url;
    return new URL(url, window.location.origin).toString();
}

function supportsLocalStorage() {
    return typeof window !== 'undefined' && !!window.localStorage;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function readOfflineMapEstimateCalibration() {
    if (!supportsLocalStorage()) {
        return { factor: 1, samples: 0 };
    }

    try {
        const raw = window.localStorage.getItem(OFFLINE_MAP_ESTIMATE_CALIBRATION_KEY);
        if (!raw) return { factor: 1, samples: 0 };

        const parsed = JSON.parse(raw);
        const factor = Number(parsed?.factor);
        const samples = Number(parsed?.samples);

        return {
            factor: Number.isFinite(factor) ? clampNumber(factor, 0.25, 3) : 1,
            samples: Number.isFinite(samples) ? clampNumber(Math.round(samples), 0, 12) : 0
        };
    } catch (error) {
        console.warn('Nao foi possivel ler calibracao de tamanho offline:', error);
        return { factor: 1, samples: 0 };
    }
}

function writeOfflineMapEstimateCalibration(nextFactor) {
    if (!supportsLocalStorage() || !Number.isFinite(nextFactor) || nextFactor <= 0) return;

    try {
        const current = readOfflineMapEstimateCalibration();
        const currentSamples = clampNumber(current.samples || 0, 0, 12);
        const boundedFactor = clampNumber(nextFactor, 0.25, 3);
        const samples = Math.min(currentSamples + 1, 12);
        const factor = currentSamples > 0
            ? ((current.factor * currentSamples) + boundedFactor) / (currentSamples + 1)
            : boundedFactor;

        window.localStorage.setItem(OFFLINE_MAP_ESTIMATE_CALIBRATION_KEY, JSON.stringify({
            factor,
            samples,
            updatedAt: new Date().toISOString()
        }));
    } catch (error) {
        console.warn('Nao foi possivel salvar calibracao de tamanho offline:', error);
    }
}

function estimateLayerMegabytes(tileCount, layerType) {
    const perTileKb = layerType === 'satelite'
        ? 60
        : layerType === 'google'
            ? 35
            : 25;

    return (tileCount * perTileKb) / 1024;
}

async function readCachedJson(cacheName, url) {
    if (!supportsCacheStorage()) return null;

    const cache = await window.caches.open(cacheName);
    const response = await cache.match(resolveAbsoluteUrl(url));
    if (!response) return null;

    return response.json();
}

async function writeResponseToCache(cacheName, url, response) {
    if (!supportsCacheStorage()) return;

    const cache = await window.caches.open(cacheName);
    await cache.put(resolveAbsoluteUrl(url), response.clone());
}

function lngToTileX(lng, zoom) {
    const worldTiles = 2 ** zoom;
    const normalized = ((lng + 180) / 360) * worldTiles;
    return Math.min(worldTiles - 1, Math.max(0, Math.floor(normalized)));
}

function latToTileY(lat, zoom) {
    const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const radians = latitude * Math.PI / 180;
    const worldTiles = 2 ** zoom;
    const normalized = (1 - Math.log(Math.tan(radians) + (1 / Math.cos(radians))) / Math.PI) / 2 * worldTiles;
    return Math.min(worldTiles - 1, Math.max(0, Math.floor(normalized)));
}

function normalizeBounds(bounds) {
    if (!bounds) return null;

    if (typeof bounds.getSouth === 'function') {
        return {
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast()
        };
    }

    if (
        Number.isFinite(bounds.south)
        && Number.isFinite(bounds.west)
        && Number.isFinite(bounds.north)
        && Number.isFinite(bounds.east)
    ) {
        return bounds;
    }

    return null;
}

function getTileCoordinatesForBounds(bounds, zoom) {
    const normalized = normalizeBounds(bounds);
    if (!normalized) return [];

    const minX = lngToTileX(normalized.west, zoom);
    const maxX = lngToTileX(normalized.east, zoom);
    const minY = latToTileY(normalized.north, zoom);
    const maxY = latToTileY(normalized.south, zoom);

    const tiles = [];
    for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
            tiles.push({ x, y, z: zoom });
        }
    }

    return tiles;
}

function trimTileList(tiles, maxTilesPerZoom) {
    if (tiles.length <= maxTilesPerZoom) return tiles;

    const step = Math.ceil(tiles.length / maxTilesPerZoom);
    return tiles.filter((_, index) => index % step === 0).slice(0, maxTilesPerZoom);
}

function buildTileKey({ x, y, z }) {
    return `${z}:${x}:${y}`;
}

function tileXToLng(x, zoom) {
    return (x / (2 ** zoom)) * 360 - 180;
}

function tileYToLat(y, zoom) {
    const mercator = Math.PI - (2 * Math.PI * y) / (2 ** zoom);
    return 180 / Math.PI * Math.atan(Math.sinh(mercator));
}

function getTileBounds(tile) {
    return {
        west: tileXToLng(tile.x, tile.z),
        east: tileXToLng(tile.x + 1, tile.z),
        north: tileYToLat(tile.y, tile.z),
        south: tileYToLat(tile.y + 1, tile.z)
    };
}

function pointInBounds(point, bounds) {
    return point.lng >= bounds.west
        && point.lng <= bounds.east
        && point.lat >= bounds.south
        && point.lat <= bounds.north;
}

function pointInRing(point, ring) {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersects = ((yi > point.lat) !== (yj > point.lat))
            && (point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
}

function orientation(a, b, c) {
    const value = (b.lat - a.lat) * (c.lng - b.lng) - (b.lng - a.lng) * (c.lat - b.lat);
    if (Math.abs(value) < 1e-10) return 0;
    return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
    return b.lng <= Math.max(a.lng, c.lng)
        && b.lng >= Math.min(a.lng, c.lng)
        && b.lat <= Math.max(a.lat, c.lat)
        && b.lat >= Math.min(a.lat, c.lat);
}

function segmentsIntersect(a1, a2, b1, b2) {
    const o1 = orientation(a1, a2, b1);
    const o2 = orientation(a1, a2, b2);
    const o3 = orientation(b1, b2, a1);
    const o4 = orientation(b1, b2, a2);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a1, b1, a2)) return true;
    if (o2 === 0 && onSegment(a1, b2, a2)) return true;
    if (o3 === 0 && onSegment(b1, a1, b2)) return true;
    if (o4 === 0 && onSegment(b1, a2, b2)) return true;
    return false;
}

function ringIntersectsTile(ring, tileBounds) {
    const tileCorners = [
        { lng: tileBounds.west, lat: tileBounds.north },
        { lng: tileBounds.east, lat: tileBounds.north },
        { lng: tileBounds.east, lat: tileBounds.south },
        { lng: tileBounds.west, lat: tileBounds.south }
    ];

    const tileCenter = {
        lng: (tileBounds.west + tileBounds.east) / 2,
        lat: (tileBounds.north + tileBounds.south) / 2
    };

    if (pointInRing(tileCenter, ring)) {
        return true;
    }

    if (tileCorners.some((corner) => pointInRing(corner, ring))) {
        return true;
    }

    const ringPoints = ring.map(([lng, lat]) => ({ lng, lat }));
    if (ringPoints.some((point) => pointInBounds(point, tileBounds))) {
        return true;
    }

    const tileEdges = [
        [tileCorners[0], tileCorners[1]],
        [tileCorners[1], tileCorners[2]],
        [tileCorners[2], tileCorners[3]],
        [tileCorners[3], tileCorners[0]]
    ];

    for (let i = 0; i < ringPoints.length; i += 1) {
        const current = ringPoints[i];
        const next = ringPoints[(i + 1) % ringPoints.length];
        for (const [edgeStart, edgeEnd] of tileEdges) {
            if (segmentsIntersect(current, next, edgeStart, edgeEnd)) {
                return true;
            }
        }
    }

    return false;
}

function getFeatureOuterRings(feature) {
    if (!feature?.geometry) return [];

    if (feature.geometry.type === 'Polygon') {
        return feature.geometry.coordinates?.[0] ? [feature.geometry.coordinates[0]] : [];
    }

    if (feature.geometry.type === 'MultiPolygon') {
        return (feature.geometry.coordinates || [])
            .map((polygon) => polygon?.[0])
            .filter(Boolean);
    }

    return [];
}

function getFeatureBounds(feature) {
    let south = Infinity;
    let west = Infinity;
    let north = -Infinity;
    let east = -Infinity;

    getFeatureOuterRings(feature).forEach((ring) => {
        ring.forEach(([lng, lat]) => {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            south = Math.min(south, lat);
            west = Math.min(west, lng);
            north = Math.max(north, lat);
            east = Math.max(east, lng);
        });
    });

    if (![south, west, north, east].every(Number.isFinite)) {
        return null;
    }

    return { south, west, north, east };
}

function collectFeatureTiles(feature, zoom) {
    const featureBounds = getFeatureBounds(feature);
    if (!featureBounds) return [];

    const candidateTiles = getTileCoordinatesForBounds(featureBounds, zoom);
    if (zoom < HIGH_ZOOM_PRECISE_TILE_FROM) {
        return candidateTiles;
    }

    const outerRings = getFeatureOuterRings(feature);
    if (outerRings.length === 0) {
        return candidateTiles;
    }

    return candidateTiles.filter((tile) => {
        const tileBounds = getTileBounds(tile);
        return outerRings.some((ring) => ringIntersectsTile(ring, tileBounds));
    });
}

function buildTileUrl(layerType, { x, y, z }) {
    const template = TILE_TEMPLATES[layerType];
    if (!template) return null;

    return template
        .replace('{s}', OSM_SUBDOMAINS[Math.abs(x + y) % OSM_SUBDOMAINS.length])
        .replace('{x}', String(x))
        .replace('{y}', String(y))
        .replace('{z}', String(z));
}

async function warmSingleTile(url) {
    if (!supportsCacheStorage()) return false;

    const request = new Request(url, {
        mode: 'no-cors',
        credentials: 'omit'
    });

    const cache = await window.caches.open(MAP_TILE_CACHE_NAME);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return true;

    const response = await fetch(request);
    if (!response || (!response.ok && response.type !== 'opaque')) {
        throw new Error(`Falha ao aquecer tile: ${url}`);
    }

    await cache.put(request, response.clone());
    return true;
}

async function pruneTileCacheIfNeeded() {
    if (!supportsCacheStorage()) return { removed: 0 };
    if (tileCachePrunePromise) return tileCachePrunePromise;

    tileCachePrunePromise = (async () => {
        const cache = await window.caches.open(MAP_TILE_CACHE_NAME);
        const requests = await cache.keys();
        if (requests.length <= MAP_TILE_CACHE_MAX_ENTRIES) {
            return { removed: 0 };
        }

        const removeCount = Math.max(0, requests.length - MAP_TILE_CACHE_TRIM_TO);
        const requestsToDelete = requests.slice(0, removeCount);
        await Promise.all(requestsToDelete.map((request) => cache.delete(request)));
        return { removed: requestsToDelete.length };
    })().finally(() => {
        tileCachePrunePromise = null;
    });

    return tileCachePrunePromise;
}

function buildJobKey({ bounds, zooms, layerTypes }) {
    const normalized = normalizeBounds(bounds);
    if (!normalized) return null;

    return [
        normalized.south.toFixed(3),
        normalized.west.toFixed(3),
        normalized.north.toFixed(3),
        normalized.east.toFixed(3),
        zooms.join(','),
        layerTypes.join(',')
    ].join('|');
}

export async function loadMapDataWithOfflineCache(url = DEFAULT_MAP_DATA_URL) {
    if (!url) {
        return createEmptyMapData();
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Falha ao carregar mapa: ${url}`);
        }

        await writeResponseToCache(MAP_DATA_CACHE_NAME, url, response);
        return response.json();
    } catch (error) {
        const cached = await readCachedJson(MAP_DATA_CACHE_NAME, url);
        if (cached) {
            return cached;
        }

        throw error;
    }
}

export function getGeoJsonBounds(geoJsonData) {
    let south = Infinity;
    let west = Infinity;
    let north = -Infinity;
    let east = -Infinity;

    (geoJsonData?.features || []).forEach((feature) => {
        const polygons = feature?.geometry?.type === 'MultiPolygon'
            ? feature.geometry.coordinates.flat(1)
            : feature?.geometry?.coordinates;

        (polygons || []).forEach((polygon) => {
            (polygon || []).forEach(([lng, lat]) => {
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                south = Math.min(south, lat);
                west = Math.min(west, lng);
                north = Math.max(north, lat);
                east = Math.max(east, lng);
            });
        });
    });

    if (![south, west, north, east].every(Number.isFinite)) {
        return null;
    }

    return { south, west, north, east };
}

function buildTilePlanForBounds(bounds, zooms) {
    const uniqueTilesByZoom = new Map();

    zooms.forEach((zoom) => {
        const tileSet = new Set();
        getTileCoordinatesForBounds(bounds, zoom).forEach((tile) => {
            tileSet.add(buildTileKey(tile));
        });
        uniqueTilesByZoom.set(zoom, tileSet);
    });

    return uniqueTilesByZoom;
}

function buildTilePlanForFeatures(features, zooms) {
    const uniqueTilesByZoom = new Map();

    for (const zoom of zooms) {
        const tileSet = new Set();
        features.forEach((feature) => {
            collectFeatureTiles(feature, zoom).forEach((tile) => {
                tileSet.add(buildTileKey(tile));
            });
        });
        uniqueTilesByZoom.set(zoom, tileSet);
    }

    return uniqueTilesByZoom;
}

export async function warmMapTilesForBounds({
    bounds,
    zooms = [],
    layerTypes = TILE_LAYER_TYPES,
    maxTilesPerZoom = 48
}) {
    if (!supportsCacheStorage() || typeof navigator === 'undefined' || navigator.onLine === false) {
        return { warmedCount: 0 };
    }

    const normalized = normalizeBounds(bounds);
    if (!normalized) return { warmedCount: 0 };

    const safeZooms = [...new Set(zooms.filter(Number.isFinite).map((zoom) => Math.max(0, Math.min(19, Math.round(zoom)))))];
    if (safeZooms.length === 0) return { warmedCount: 0 };

    const jobKey = buildJobKey({
        bounds: normalized,
        zooms: safeZooms,
        layerTypes
    });

    if (jobKey && warmedTileJobs.has(jobKey)) {
        return { warmedCount: 0 };
    }

    let warmedCount = 0;

    for (const layerType of layerTypes) {
        for (const zoom of safeZooms) {
            const tiles = trimTileList(getTileCoordinatesForBounds(normalized, zoom), maxTilesPerZoom);
            for (const tile of tiles) {
                const url = buildTileUrl(layerType, tile);
                if (!url) continue;

                try {
                    await warmSingleTile(url);
                    warmedCount += 1;
                } catch (error) {
                    console.warn('Nao foi possivel aquecer tile offline:', error);
                }
            }
        }
    }

    if (jobKey) {
        warmedTileJobs.add(jobKey);
    }

    await pruneTileCacheIfNeeded();

    return { warmedCount };
}

async function getCacheSummary(cacheName) {
    if (!supportsCacheStorage()) {
        return {
            entries: 0,
            bytes: 0
        };
    }

    const cache = await window.caches.open(cacheName);
    const requests = await cache.keys();

    return {
        entries: requests.length
    };
}

export async function getOfflineMapCacheSummary() {
    const [mapData, tiles] = await Promise.all([
        getCacheSummary(MAP_DATA_CACHE_NAME),
        getCacheSummary(MAP_TILE_CACHE_NAME)
    ]);

    let storageEstimate = null;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
            storageEstimate = await navigator.storage.estimate();
        } catch (error) {
            console.warn('Nao foi possivel obter estimate de storage:', error);
        }
    }

    return {
        mapDataEntries: mapData.entries,
        tileEntries: tiles.entries,
        totalEntries: mapData.entries + tiles.entries,
        quotaBytes: storageEstimate?.quota || null,
        storageUsedBytes: storageEstimate?.usage || null
    };
}

export async function clearOfflineMapCaches() {
    if (!supportsCacheStorage()) return false;

    await Promise.all([
        window.caches.delete(MAP_DATA_CACHE_NAME),
        window.caches.delete(MAP_TILE_CACHE_NAME)
    ]);

    warmedTileJobs.clear();
    return true;
}

export function buildOfflineAreaDownloadPlan(geoJsonData, {
    zooms = OFFLINE_MAP_DOWNLOAD_ZOOMS,
    layerTypes = TILE_LAYER_TYPES,
    areaMode = 'territorios',
    bounds = null
} = {}) {
    const calibration = readOfflineMapEstimateCalibration();
    const features = geoJsonData?.features || [];
    const resolvedBounds = normalizeBounds(bounds);
    const hasViewportArea = areaMode === 'viewport' && resolvedBounds;

    if (!hasViewportArea && features.length === 0) {
        return {
            bounds: null,
            zooms: [],
            layerTypes,
            totalTiles: 0,
            tilesByLayer: {},
            estimatedTotalMb: 0,
            estimatedByLayerMb: {},
            rawEstimatedTotalMb: 0,
            rawEstimatedByLayerMb: {},
            estimateCalibrationFactor: calibration.factor
        };
    }

    const uniqueTilesByZoom = hasViewportArea
        ? buildTilePlanForBounds(resolvedBounds, zooms)
        : buildTilePlanForFeatures(features, zooms);
    const tilesByLayer = {};
    const estimatedByLayerMb = {};
    const rawEstimatedByLayerMb = {};
    let totalTiles = 0;
    for (const layerType of layerTypes) {
        tilesByLayer[layerType] = {};
        let layerTotal = 0;
        for (const zoom of zooms) {
            const count = uniqueTilesByZoom.get(zoom)?.size || 0;
            tilesByLayer[layerType][zoom] = count;
            totalTiles += count;
            layerTotal += count;
        }
        rawEstimatedByLayerMb[layerType] = estimateLayerMegabytes(layerTotal, layerType);
        estimatedByLayerMb[layerType] = rawEstimatedByLayerMb[layerType] * calibration.factor;
    }

    const rawEstimatedTotalMb = Object.values(rawEstimatedByLayerMb).reduce((sum, value) => sum + value, 0);

    return {
        bounds: hasViewportArea ? resolvedBounds : getGeoJsonBounds(geoJsonData),
        zooms,
        layerTypes,
        totalTiles,
        tilesByLayer,
        uniqueTilesByZoom,
        estimatedByLayerMb,
        estimatedTotalMb: Object.values(estimatedByLayerMb).reduce((sum, value) => sum + value, 0),
        rawEstimatedByLayerMb,
        rawEstimatedTotalMb,
        estimateCalibrationFactor: calibration.factor
    };
}

async function cacheTileWithProgress(url) {
    if (!supportsCacheStorage()) {
        return { cached: false, skipped: true };
    }

    const request = new Request(url, {
        mode: 'no-cors',
        credentials: 'omit'
    });

    const cache = await window.caches.open(MAP_TILE_CACHE_NAME);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) {
        return { cached: true, skipped: true };
    }

    const response = await fetch(request);
    if (!response || (!response.ok && response.type !== 'opaque')) {
        throw new Error(`Falha ao baixar tile offline: ${url}`);
    }

    await cache.put(request, response.clone());
    return { cached: true, skipped: false };
}

export async function downloadOfflineMapArea({
    geoJsonData,
    zooms = OFFLINE_MAP_DOWNLOAD_ZOOMS,
    layerTypes = TILE_LAYER_TYPES,
    areaMode = 'territorios',
    bounds = null,
    concurrency = 4,
    onProgress
}) {
    const plan = buildOfflineAreaDownloadPlan(geoJsonData, { zooms, layerTypes, areaMode, bounds });
    if (!plan.bounds) {
        throw new Error('Nao foi possivel calcular a area do mapa para download offline.');
    }

    let storageUsageBefore = null;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
            storageUsageBefore = (await navigator.storage.estimate())?.usage ?? null;
        } catch (error) {
            console.warn('Nao foi possivel ler uso de storage antes do download offline:', error);
        }
    }

    const tasks = [];
    for (const layerType of layerTypes) {
        for (const zoom of zooms) {
            const uniqueTiles = plan.uniqueTilesByZoom?.get(zoom) || new Set();
            for (const tileKey of uniqueTiles) {
                const [z, x, y] = tileKey.split(':').map(Number);
                const url = buildTileUrl(layerType, { x, y, z });
                if (url) {
                    tasks.push(url);
                }
            }
        }
    }

    let completed = 0;
    let downloaded = 0;
    let skipped = 0;
    const total = tasks.length + 1;

    const emitProgress = (extra = {}) => {
        onProgress?.({
            total,
            completed,
            downloaded,
            skipped,
            ...extra
        });
    };

    emitProgress({ phase: 'Preparando mapa base...' });
    await loadMapDataWithOfflineCache();
    completed += 1;
    downloaded += 1;
    emitProgress({ phase: 'Baixando partes do mapa...' });

    let cursor = 0;
    const workerCount = Math.max(1, Math.min(concurrency, 6));

    const worker = async () => {
        while (cursor < tasks.length) {
            const currentIndex = cursor;
            cursor += 1;
            const url = tasks[currentIndex];

            const result = await cacheTileWithProgress(url);
            if (result.skipped) {
                skipped += 1;
            } else {
                downloaded += 1;
            }
            completed += 1;
            emitProgress({ phase: 'Baixando partes do mapa...' });
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    await pruneTileCacheIfNeeded();

    if (storageUsageBefore !== null && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
            const storageUsageAfter = (await navigator.storage.estimate())?.usage ?? null;
            const observedUsageBytes = storageUsageAfter !== null
                ? Math.max(0, storageUsageAfter - storageUsageBefore)
                : null;
            const rawEstimatedBytes = Math.round((plan.rawEstimatedTotalMb || 0) * 1024 * 1024);

            if (observedUsageBytes && rawEstimatedBytes > 0) {
                writeOfflineMapEstimateCalibration(observedUsageBytes / rawEstimatedBytes);
            }
        } catch (error) {
            console.warn('Nao foi possivel calibrar tamanho do download offline:', error);
        }
    }

    emitProgress({ phase: 'Concluido' });

    return {
        total,
        completed,
        downloaded,
        skipped
    };
}

export function getMapWarmProfile() {
    const connection = getConnectionInfo();
    const saveData = Boolean(connection?.saveData);
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const isSlowConnection = saveData || effectiveType.includes('2g') || effectiveType.includes('3g');

    return {
        saveData,
        isSlowConnection,
        allowSecondaryLayers: !isSlowConnection,
        overviewZooms: isSlowConnection ? [12] : [12, 13],
        viewportZoomOffset: isSlowConnection ? 0 : 1,
        primaryMaxTilesPerZoom: isSlowConnection ? 16 : 24,
        secondaryMaxTilesPerZoom: isSlowConnection ? 0 : 10
    };
}

export function readOfflineMapDownloadState() {
    if (!supportsLocalStorage()) {
        return { status: 'idle', updatedAt: null };
    }

    try {
        const raw = window.localStorage.getItem(OFFLINE_MAP_DOWNLOAD_STATE_KEY);
        if (!raw) return { status: 'idle', updatedAt: null };
        const parsed = JSON.parse(raw);
        return {
            status: parsed?.status || 'idle',
            updatedAt: parsed?.updatedAt || null,
            lastCompletedAt: parsed?.lastCompletedAt || null
        };
    } catch (error) {
        console.warn('Nao foi possivel ler estado do download offline:', error);
        return { status: 'idle', updatedAt: null, lastCompletedAt: null };
    }
}

export function writeOfflineMapDownloadState(status) {
    if (!supportsLocalStorage()) return;

    try {
        const currentState = readOfflineMapDownloadState();
        const nowIso = new Date().toISOString();
        window.localStorage.setItem(OFFLINE_MAP_DOWNLOAD_STATE_KEY, JSON.stringify({
            status,
            updatedAt: nowIso,
            lastCompletedAt: status === 'completed'
                ? nowIso
                : currentState.lastCompletedAt || null
        }));
    } catch (error) {
        console.warn('Nao foi possivel salvar estado do download offline:', error);
    }
}

export function getOfflineMapFreshnessInfo(now = new Date()) {
    const state = readOfflineMapDownloadState();
    const lastCompletedAt = state.lastCompletedAt || null;

    if (!lastCompletedAt) {
        return {
            hasOfflineDownload: false,
            isExpired: false,
            ageDays: null,
            expiresInDays: null,
            lastCompletedAt: null
        };
    }

    const downloadedAt = new Date(lastCompletedAt);
    if (Number.isNaN(downloadedAt.getTime())) {
        return {
            hasOfflineDownload: false,
            isExpired: false,
            ageDays: null,
            expiresInDays: null,
            lastCompletedAt: null
        };
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const ageDays = Math.max(0, Math.floor((now.getTime() - downloadedAt.getTime()) / msPerDay));
    const expiresInDays = OFFLINE_MAP_MAX_AGE_DAYS - ageDays;

    return {
        hasOfflineDownload: true,
        isExpired: expiresInDays <= 0,
        ageDays,
        expiresInDays,
        lastCompletedAt
    };
}

export function readOfflineMapViewportBounds() {
    if (!supportsLocalStorage()) return null;

    try {
        const raw = window.localStorage.getItem(OFFLINE_MAP_VIEWPORT_BOUNDS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizeBounds(parsed);
    } catch (error) {
        console.warn('Nao foi possivel ler viewport offline do mapa:', error);
        return null;
    }
}

export function writeOfflineMapViewportBounds(bounds) {
    const normalized = normalizeBounds(bounds);
    if (!supportsLocalStorage() || !normalized) return;

    try {
        window.localStorage.setItem(OFFLINE_MAP_VIEWPORT_BOUNDS_KEY, JSON.stringify(normalized));
    } catch (error) {
        console.warn('Nao foi possivel salvar viewport offline do mapa:', error);
    }
}

export function scheduleTileWarm(taskFactory, {
    delayMs = 1500,
    timeoutMs = 4000
} = {}) {
    if (typeof window === 'undefined') {
        return () => {};
    }

    let timerId = null;
    let idleId = null;
    let cancelled = false;

    const execute = () => {
        if (cancelled) return;
        Promise.resolve()
            .then(() => taskFactory())
            .catch((error) => {
                console.warn('Nao foi possivel executar aquecimento offline do mapa:', error);
            });
    };

    timerId = window.setTimeout(() => {
        if (cancelled) return;

        if ('requestIdleCallback' in window) {
            idleId = window.requestIdleCallback(execute, { timeout: timeoutMs });
            return;
        }

        execute();
    }, delayMs);

    return () => {
        cancelled = true;
        if (timerId) {
            window.clearTimeout(timerId);
        }
        if (idleId && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(idleId);
        }
    };
}
