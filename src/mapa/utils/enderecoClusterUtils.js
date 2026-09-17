/**
 * Utilitários para agrupamento inteligente (clustering) de endereços no mapa.
 */

export const UNCLUSTER_ZOOM = 18;
export const DEFAULT_CLUSTER_RADIUS_PX = 42;
export const COINCIDENT_COORD_EPSILON = 0.00003; // ~3 metros

/**
 * Valida se o valor de uma coordenada é utilizável (não nulo, não indefinido, não vazio e numérico finito).
 */
export const isUsableCoordinateValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    const num = Number(value);
    return Number.isFinite(num);
};

/**
 * Valida se a latitude e longitude estão dentro dos limites geográficos padrão globais.
 */
export const isValidLatLng = (lat, lng) =>
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/**
 * Converte latitude e longitude em coordenadas de pixel no Web Mercator (fallback caso map.project não esteja disponível).
 */
export const projectLatLngToPixel = (lat, lng, zoom) => {
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const clampedSinLat = Math.max(-0.9999, Math.min(0.9999, sinLat));
    const scale = 256 * Math.pow(2, zoom);

    const x = scale * ((lng + 180) / 360);
    const y = scale * (0.5 - Math.log((1 + clampedSinLat) / (1 - clampedSinLat)) / (4 * Math.PI));

    return { x, y };
};

/**
 * Verifica se dois endereços possuem coordenadas praticamente idênticas (mesmo prédio / mesmo lote).
 */
export const areCoordsCoincident = (lat1, lng1, lat2, lng2, epsilon = COINCIDENT_COORD_EPSILON) => {
    return Math.abs(Number(lat1) - Number(lat2)) <= epsilon &&
           Math.abs(Number(lng1) - Number(lng2)) <= epsilon;
};

/**
 * Calcula a distância euclidiana entre dois pontos em pixels.
 */
export const getPixelDistance = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Agrupa uma lista de endereços com base no nível de zoom e na proximidade de tela.
 *
 * @param {Array} enderecos Lista de endereços
 * @param {Object} map Instância do mapa Leaflet (opcional)
 * @param {number} zoomLevel Nível de zoom atual
 * @param {Object} options Configurações (clusterRadiusPx, maxClusterZoom)
 * @returns {Array} Lista de itens (únicos ou clusters)
 */
export const clusterEnderecos = (enderecos = [], map = null, zoomLevel = 14, options = {}) => {
    const currentZoom = Number.isFinite(Number(zoomLevel)) ? Number(zoomLevel) : (map?.getZoom?.() ?? 14);
    const radiusPx = options.clusterRadiusPx || DEFAULT_CLUSTER_RADIUS_PX;
    const maxClusterZoom = options.maxClusterZoom || UNCLUSTER_ZOOM;
    const isAtStreetLevel = currentZoom >= maxClusterZoom;

    // Filtra e prepara marcadores válidos com validação estrita de coordenadas
    const validMarkers = enderecos
        .map((endereco) => {
            if (!isUsableCoordinateValue(endereco?.lat) || !isUsableCoordinateValue(endereco?.lng)) {
                return null;
            }

            const lat = Number(endereco.lat);
            const lng = Number(endereco.lng);
            if (!isValidLatLng(lat, lng)) return null;

            let point;
            if (map && typeof map.project === 'function') {
                const projected = map.project([lat, lng], currentZoom);
                point = { x: projected.x, y: projected.y };
            } else {
                point = projectLatLngToPixel(lat, lng, currentZoom);
            }

            return {
                endereco,
                lat,
                lng,
                point
            };
        })
        .filter(Boolean)
        .sort((a, b) =>
            String(a.endereco.codigo || a.endereco.id)
                .localeCompare(String(b.endereco.codigo || b.endereco.id))
        );

    if (validMarkers.length === 0) return [];

    // Se estiver em zoom alto (rua), agrupamos APENAS se forem estritamente coincidentes (mesmo prédio)
    // Usamos group[0] como referência para evitar agrupamento transitivo em cadeia
    if (isAtStreetLevel) {
        const groups = [];

        validMarkers.forEach((marker) => {
            const matchGroup = groups.find((group) =>
                areCoordsCoincident(marker.lat, marker.lng, group[0].lat, group[0].lng)
            );

            if (matchGroup) {
                matchGroup.push(marker);
            } else {
                groups.push([marker]);
            }
        });

        return groups.map((group, index) => {
            if (group.length === 1) {
                return {
                    isCluster: false,
                    endereco: group[0].endereco
                };
            }

            const enderecosGrupo = group.map((m) => m.endereco);
            const lat = group[0].lat;
            const lng = group[0].lng;

            return {
                isCluster: true,
                id: `cluster-coincident-${group[0].endereco.id || index}`,
                enderecos: enderecosGrupo,
                count: enderecosGrupo.length,
                lat,
                lng,
                bounds: [[lat, lng], [lat, lng]],
                isCoincident: true
            };
        });
    }

    // Zoom afastado: agrupamento baseado em raio de pixels na tela
    const clusters = [];

    validMarkers.forEach((marker) => {
        const cluster = clusters.find((items) =>
            items.some((existing) => getPixelDistance(marker.point, existing.point) <= radiusPx)
        );

        if (cluster) {
            cluster.push(marker);
        } else {
            clusters.push([marker]);
        }
    });

    return clusters.map((items, index) => {
        if (items.length === 1) {
            return {
                isCluster: false,
                endereco: items[0].endereco
            };
        }

        const enderecosCluster = items.map((m) => m.endereco);

        let sumLat = 0;
        let sumLng = 0;
        let minLat = Infinity;
        let maxLat = -Infinity;
        let minLng = Infinity;
        let maxLng = -Infinity;

        items.forEach((item) => {
            sumLat += item.lat;
            sumLng += item.lng;
            if (item.lat < minLat) minLat = item.lat;
            if (item.lat > maxLat) maxLat = item.lat;
            if (item.lng < minLng) minLng = item.lng;
            if (item.lng > maxLng) maxLng = item.lng;
        });

        const count = items.length;
        const centerLat = sumLat / count;
        const centerLng = sumLng / count;

        const isCoincident = areCoordsCoincident(minLat, minLng, maxLat, maxLng);

        return {
            isCluster: true,
            id: `cluster-${items[0].endereco.id || index}-${count}`,
            enderecos: enderecosCluster,
            count,
            lat: centerLat,
            lng: centerLng,
            bounds: [[minLat, minLng], [maxLat, maxLng]],
            isCoincident
        };
    });
};
