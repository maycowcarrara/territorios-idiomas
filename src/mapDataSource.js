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

export async function loadMapDataFromNetwork(url) {
    if (!url) {
        return createEmptyMapData();
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Falha ao carregar mapa: ${url}`);
    }

    return response.json();
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
