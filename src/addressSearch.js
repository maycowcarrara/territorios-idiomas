const NOMINATIM_ENDPOINT = import.meta.env.VITE_ADDRESS_SEARCH_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const ADDRESS_SEARCH_PROVIDER = String(import.meta.env.VITE_ADDRESS_SEARCH_PROVIDER || 'nominatim').trim().toLowerCase();
const ADDRESS_SEARCH_CACHE_PREFIX = 'territorios-idiomas.addressSearch.v2.';
const ADDRESS_SEARCH_THROTTLE_MS = 1000;
const ADDRESS_SEARCH_LIMIT = 5;
const getEnvNumber = (key, fallback) => {
    const value = Number.parseFloat(import.meta.env[key]);
    return Number.isFinite(value) ? value : fallback;
};
const SAO_BENTO_DO_SUL_VIEWBOX = {
    left: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_LEFT', -49.55),
    top: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_TOP', -26.10),
    right: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_RIGHT', -49.20),
    bottom: getEnvNumber('VITE_ADDRESS_SEARCH_VIEWBOX_BOTTOM', -26.40)
};

let lastNominatimRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

const reinforceSaoBentoQuery = (query) => {
    const normalized = normalizeAddressSearchText(query);
    const parts = [String(query || '').trim()];

    if (!normalized.includes('sao bento do sul')) {
        parts.push('São Bento do Sul');
    }

    if (!/\bsc\b/.test(normalized) && !normalized.includes('santa catarina')) {
        parts.push('SC');
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

const waitForNominatimThrottle = async () => {
    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < ADDRESS_SEARCH_THROTTLE_MS) {
        await sleep(ADDRESS_SEARCH_THROTTLE_MS - elapsed);
    }
    lastNominatimRequestAt = Date.now();
};

const searchWithNominatim = async (query, { signal } = {}) => {
    const cacheKey = [
        ADDRESS_SEARCH_PROVIDER,
        normalizeAddressSearchText(query),
        SAO_BENTO_DO_SUL_VIEWBOX.left,
        SAO_BENTO_DO_SUL_VIEWBOX.top,
        SAO_BENTO_DO_SUL_VIEWBOX.right,
        SAO_BENTO_DO_SUL_VIEWBOX.bottom
    ].join('|');
    const cached = readCache(cacheKey);
    if (cached) return cached;

    await waitForNominatimThrottle();

    const params = new URLSearchParams({
        format: 'jsonv2',
        q: reinforceSaoBentoQuery(query),
        addressdetails: '1',
        limit: String(ADDRESS_SEARCH_LIMIT),
        countrycodes: 'br',
        bounded: '1',
        viewbox: [
            SAO_BENTO_DO_SUL_VIEWBOX.left,
            SAO_BENTO_DO_SUL_VIEWBOX.top,
            SAO_BENTO_DO_SUL_VIEWBOX.right,
            SAO_BENTO_DO_SUL_VIEWBOX.bottom
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

const providers = {
    nominatim: searchWithNominatim
};

export const searchAddresses = async (query, options = {}) => {
    const normalized = normalizeAddressSearchText(query);
    if (!normalized) return [];

    const provider = providers[ADDRESS_SEARCH_PROVIDER] || providers.nominatim;
    return provider(query, options);
};
