import {
    DEFAULT_ADDRESS_SEARCH_CONFIG,
    DEFAULT_ADDRESS_SEARCH_VIEWBOX,
    normalizeAddressSearchConfig
} from './addressSearchConfig';
import { waitForNominatimThrottle } from './nominatimThrottle';

const NOMINATIM_ENDPOINT = import.meta.env.VITE_ADDRESS_SEARCH_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const ADDRESS_SEARCH_PROVIDER = String(import.meta.env.VITE_ADDRESS_SEARCH_PROVIDER || 'nominatim').trim().toLowerCase();
const ADDRESS_SEARCH_CACHE_PREFIX = 'territorios-idiomas.addressSearch.v2.';
const ADDRESS_SEARCH_LIMIT = 7;
const getEnvNumber = (key, fallback) => {
    const value = Number.parseFloat(import.meta.env[key]);
    return Number.isFinite(value) ? value : fallback;
};
const ADDRESS_SEARCH_VIEWBOX = {
    left: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_LEFT', DEFAULT_ADDRESS_SEARCH_VIEWBOX.left),
    top: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_TOP', DEFAULT_ADDRESS_SEARCH_VIEWBOX.top),
    right: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_RIGHT', DEFAULT_ADDRESS_SEARCH_VIEWBOX.right),
    bottom: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_BOTTOM', DEFAULT_ADDRESS_SEARCH_VIEWBOX.bottom)
};
const ADDRESS_SEARCH_DEFAULT_CONFIG = normalizeAddressSearchConfig({
    ...DEFAULT_ADDRESS_SEARCH_CONFIG,
    viewbox: ADDRESS_SEARCH_VIEWBOX
});

const isValidLatLng = ({ lat, lng }) => (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
);

const resolveRuntimeSearchConfig = (searchConfig) => (
    normalizeAddressSearchConfig(searchConfig || ADDRESS_SEARCH_DEFAULT_CONFIG)
);

const isInsideSearchViewbox = ({ lat, lng }, searchConfig = ADDRESS_SEARCH_DEFAULT_CONFIG) => (
    (searchConfig.areas?.length ? searchConfig.areas : [{ viewbox: searchConfig.viewbox }]).some((area) => (
        lat <= area.viewbox.top &&
        lat >= area.viewbox.bottom &&
        lng >= area.viewbox.left &&
        lng <= area.viewbox.right
    ))
);

const normalizeCoordinateNumber = (value) => Number.parseFloat(String(value || '').replace(',', '.'));

const COORDINATE_DECIMAL_COMMA_PAIR_PATTERN = /(-?\d{1,3},\d+)\s*(?:[,;/|]|\s)\s*(-?\d{1,3},\d+)/;
const COORDINATE_DECIMAL_POINT_PAIR_PATTERN = /(-?\d{1,3}(?:\.\d+)?)\s*(?:[,;/|]|\s)\s*(-?\d{1,3}(?:\.\d+)?)/;

const buildCoordinateResult = (lat, lng) => ({
    id: `coord-${lat.toFixed(7)}-${lng.toFixed(7)}`,
    label: `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    endereco: '',
    bairro: '',
    lat,
    lng,
    origem: 'coordenadas'
});

const resolveCoordinatePair = (first, second, searchConfig) => {
    const direct = {
        lat: normalizeCoordinateNumber(first),
        lng: normalizeCoordinateNumber(second)
    };
    const swapped = {
        lat: normalizeCoordinateNumber(second),
        lng: normalizeCoordinateNumber(first)
    };

    if (isValidLatLng(direct) && isInsideSearchViewbox(direct, searchConfig)) return direct;
    if (isValidLatLng(swapped) && isInsideSearchViewbox(swapped, searchConfig)) return swapped;
    if (isValidLatLng(direct)) return direct;
    if (isValidLatLng(swapped)) return swapped;
    return null;
};

export const parseAddressCoordinates = (value, runtimeSearchConfig) => {
    const searchConfig = resolveRuntimeSearchConfig(runtimeSearchConfig);
    const raw = String(value || '').trim();
    if (!raw) return null;

    const decimalCommaMatch = raw.match(COORDINATE_DECIMAL_COMMA_PAIR_PATTERN);
    if (decimalCommaMatch) {
        const pair = resolveCoordinatePair(decimalCommaMatch[1], decimalCommaMatch[2], searchConfig);
        return pair ? buildCoordinateResult(pair.lat, pair.lng) : null;
    }

    const decimalPointMatch = raw.match(COORDINATE_DECIMAL_POINT_PAIR_PATTERN);
    if (decimalPointMatch) {
        const pair = resolveCoordinatePair(decimalPointMatch[1], decimalPointMatch[2], searchConfig);
        return pair ? buildCoordinateResult(pair.lat, pair.lng) : null;
    }

    return null;
};

export const normalizeAddressSearchText = (value) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
);

const readCache = (key) => {
    try {
        const raw = window.sessionStorage?.getItem(`${ADDRESS_SEARCH_CACHE_PREFIX}${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.results) ? parsed.results : null;
    } catch {
        return null;
    }
};

const writeCache = (key, results) => {
    if (!results.length) return;

    try {
        window.sessionStorage?.setItem(`${ADDRESS_SEARCH_CACHE_PREFIX}${key}`, JSON.stringify({
            savedAt: Date.now(),
            results
        }));
    } catch {
        // Cache is best effort only.
    }
};

const reinforceRegionalQuery = (query, searchConfig, area) => {
    const normalized = normalizeAddressSearchText(query);
    const parts = [String(query || '').trim()];
    const cidadesNormalizadas = searchConfig.cidades.map(normalizeAddressSearchText);
    const hasSupportedCity = cidadesNormalizadas.some((cityName) => normalized.includes(cityName));

    if (!hasSupportedCity) {
        parts.push(area?.cidade || searchConfig.cidades[0]);
    }

    const uf = String(searchConfig.uf || DEFAULT_ADDRESS_SEARCH_CONFIG.uf).toUpperCase();
    if (!new RegExp(`\\b${uf.toLowerCase()}\\b`).test(normalized) && !normalized.includes('santa catarina')) {
        parts.push(uf);
    }

    if (!normalized.includes('brasil') && !normalized.includes('brazil')) {
        parts.push('Brasil');
    }

    return parts.filter(Boolean).join(', ');
};

const formatEnderecoCadastro = (address = {}, fallback = '') => {
    const via = address.road || address.pedestrian || address.footway || address.path || address.residential || address.neighbourhood || address.suburb;
    const numero = address.house_number;
    const endereco = [via, numero].filter(Boolean).join(', ');
    return endereco || fallback;
};

const resolveBairro = (address = {}) => (
    address.neighbourhood ||
    address.suburb ||
    address.city_district ||
    address.quarter ||
    address.residential ||
    ''
);

const normalizeNominatimResult = (item) => {
    const lat = Number.parseFloat(item?.lat);
    const lng = Number.parseFloat(item?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        id: String(item.place_id || `${item.osm_type || 'osm'}-${item.osm_id || `${lat},${lng}`}`),
        label: String(item.display_name || '').trim(),
        endereco: formatEnderecoCadastro(item.address, item.display_name),
        bairro: resolveBairro(item.address),
        lat,
        lng
    };
};

const resolveSearchAreas = (query, searchConfig) => {
    const areas = searchConfig.areas?.length ? searchConfig.areas : [];
    const normalized = normalizeAddressSearchText(query);
    const matching = areas.filter((area) => {
        const cidade = normalizeAddressSearchText(area.cidade);
        return cidade && normalized.includes(cidade);
    });

    return matching.length ? matching : areas;
};

const getResultKey = (result) => (
    result.id || `${result.lat.toFixed(7)},${result.lng.toFixed(7)}`
);

const searchNominatimArea = async (query, searchConfig, area, signal) => {
    const cacheKey = [
        ADDRESS_SEARCH_PROVIDER,
        normalizeAddressSearchText(query),
        area.uf || searchConfig.uf,
        area.cidade || '',
        area.viewbox.left,
        area.viewbox.top,
        area.viewbox.right,
        area.viewbox.bottom
    ].join('|');
    const cached = readCache(cacheKey);
    if (cached) return cached;

    await waitForNominatimThrottle();

    const params = new URLSearchParams({
        format: 'jsonv2',
        q: reinforceRegionalQuery(query, searchConfig, area),
        addressdetails: '1',
        limit: String(ADDRESS_SEARCH_LIMIT),
        countrycodes: 'br',
        bounded: '1',
        viewbox: [
            area.viewbox.left,
            area.viewbox.top,
            area.viewbox.right,
            area.viewbox.bottom
        ].join(','),
        'accept-language': 'pt-BR'
    });

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, { signal });
    if (!response.ok) {
        throw new Error('Não foi possível consultar o OpenStreetMap agora.');
    }

    const payload = await response.json();
    const results = Array.isArray(payload)
        ? payload.map(normalizeNominatimResult).filter(Boolean).slice(0, ADDRESS_SEARCH_LIMIT)
        : [];

    writeCache(cacheKey, results);
    return results;
};

const searchWithNominatim = async (query, { signal, searchConfig: rawSearchConfig } = {}) => {
    const searchConfig = resolveRuntimeSearchConfig(rawSearchConfig);
    const areas = resolveSearchAreas(query, searchConfig);
    const seen = new Set();
    const combined = [];
    const resultsByArea = [];

    if (!areas.length) {
        throw new Error('Configure ao menos um município na área de busca do mapa.');
    }

    for (const area of areas) {
        const results = await searchNominatimArea(query, searchConfig, area, signal);
        resultsByArea.push(results);
    }

    for (let index = 0; index < ADDRESS_SEARCH_LIMIT && combined.length < ADDRESS_SEARCH_LIMIT; index += 1) {
        resultsByArea.forEach((results) => {
            const result = results[index];
            if (!result || combined.length >= ADDRESS_SEARCH_LIMIT) return;
            const key = getResultKey(result);
            if (seen.has(key)) return;
            seen.add(key);
            combined.push(result);
        });
    }

    return combined.slice(0, ADDRESS_SEARCH_LIMIT);
};

const providers = {
    nominatim: searchWithNominatim
};

export const searchAddresses = async (query, options = {}) => {
    const normalized = normalizeAddressSearchText(query);
    if (!normalized) return [];

    const coordinates = parseAddressCoordinates(query, options.searchConfig);
    if (coordinates) return [coordinates];

    const provider = providers[ADDRESS_SEARCH_PROVIDER] || providers.nominatim;
    return provider(query, options);
};
