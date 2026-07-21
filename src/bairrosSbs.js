const BAIRROS_SBS_ASSET_URL = './bairros-sbs.geojson';

const BAIRROS_SBS_URBANOS = [
    '25 de Julho',
    'Alpino',
    'Bairro Novo',
    'Bela Aliança',
    'Boehmerwald',
    'Brasília',
    'Centenário',
    'Centro',
    'Colonial',
    'Cruzeiro',
    'Dona Francisca',
    'Industrial Sudoeste',
    'Lençol',
    'Mato Preto',
    'Oxford',
    'Progresso',
    'Rio Negro',
    'Rio Vermelho Estação',
    'Rio Vermelho Povoado',
    'Schramm',
    'Serra Alta'
];

const BAIRROS_BY_NORMALIZED_NAME = new Map(
    BAIRROS_SBS_URBANOS.map((nome) => [normalizeBairroNome(nome), nome])
);

let bairrosPromise = null;

export function normalizeBairroNome(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

export function buildBairroId(value) {
    return normalizeBairroNome(value)
        .toLowerCase()
        .replace(/\s+/g, '-');
}

function normalizeBairroFeature(feature) {
    const rawNome = feature?.properties?.bairro || feature?.properties?.nome || '';
    const normalizedName = normalizeBairroNome(rawNome);
    const bairroNome = BAIRROS_BY_NORMALIZED_NAME.get(normalizedName);

    if (!bairroNome) return null;

    return {
        ...feature,
        properties: {
            ...feature.properties,
            bairroId: buildBairroId(bairroNome),
            bairroNome,
            bairroNomeNormalizado: normalizedName
        }
    };
}

export function normalizeBairrosSbsGeoJson(geoJson) {
    const features = (geoJson?.features || [])
        .map(normalizeBairroFeature)
        .filter(Boolean)
        .sort((a, b) => a.properties.bairroNome.localeCompare(b.properties.bairroNome));

    return {
        type: 'FeatureCollection',
        features
    };
}

export function loadBairrosSbsData() {
    if (!bairrosPromise) {
        bairrosPromise = fetch(BAIRROS_SBS_ASSET_URL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Falha ao carregar bairros (${response.status}).`);
                }

                return response.json();
            })
            .then(normalizeBairrosSbsGeoJson)
            .catch((error) => {
                bairrosPromise = null;
                throw error;
            });
    }

    return bairrosPromise;
}

function isPointInRing(point, ring = []) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || ring.length < 3) {
        return false;
    }

    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [lngI, latI] = ring[i];
        const [lngJ, latJ] = ring[j];
        const intersects = ((latI > lat) !== (latJ > lat))
            && (lng < ((lngJ - lngI) * (lat - latI)) / ((latJ - latI) || Number.EPSILON) + lngI);

        if (intersects) inside = !inside;
    }

    return inside;
}

export function isPointInsidePolygon(point, polygonCoordinates = []) {
    if (!polygonCoordinates.length || !isPointInRing(point, polygonCoordinates[0])) {
        return false;
    }

    return !polygonCoordinates.slice(1).some((hole) => isPointInRing(point, hole));
}

export function isPointInsideGeoJsonGeometry(point, geometry) {
    if (!geometry) return false;

    if (geometry.type === 'Polygon') {
        return isPointInsidePolygon(point, geometry.coordinates || []);
    }

    if (geometry.type === 'MultiPolygon') {
        return (geometry.coordinates || []).some((polygon) => isPointInsidePolygon(point, polygon));
    }

    return false;
}

export function findBairroFeatureForPoint(features = [], point) {
    if (!point) return null;

    return features.find((feature) => isPointInsideGeoJsonGeometry(point, feature.geometry)) || null;
}

export function getBairroLeafletPositions(feature) {
    const geometry = feature?.geometry;

    if (geometry?.type === 'Polygon') {
        return (geometry.coordinates || []).map((ring) => (
            ring.map(([lng, lat]) => [lat, lng])
        ));
    }

    if (geometry?.type === 'MultiPolygon') {
        return (geometry.coordinates || []).map((polygon) => (
            polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng]))
        ));
    }

    return [];
}
