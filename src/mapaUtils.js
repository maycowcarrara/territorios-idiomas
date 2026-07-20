export function getFeatureId(feature, index = 0) {
    return feature?.properties?.id || index + 1;
}

export function buildFeatureIndex(geoData) {
    const featureMap = new Map();

    (geoData?.features || []).forEach((feature, index) => {
        featureMap.set(getFeatureId(feature, index), feature);
    });

    return featureMap;
}

export function getFeatureBoundsStr(feature) {
    if (!feature?.geometry) return null;

    const rawCoords = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates.flat(2)
        : feature.geometry.coordinates?.[0];

    if (!rawCoords?.length) return null;

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;

    rawCoords.forEach(([lng, lat]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    });

    return `${minLat},${minLng},${maxLat},${maxLng}`;
}

export function getTerritorioQuadrasCount(feature) {
    const pontos = feature?.properties?.pontos || [];
    const totalQuadras = pontos.filter((ponto) => !ponto.tipo || ponto.tipo === 'quadra' || ponto.tipo === 'endereco').length;
    return totalQuadras || 1;
}
