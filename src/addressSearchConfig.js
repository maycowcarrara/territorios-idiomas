export const DEFAULT_ADDRESS_SEARCH_UF = 'SC';

export const DEFAULT_ADDRESS_SEARCH_VIEWBOX = Object.freeze({
    left: -49.85,
    top: -25.95,
    right: -49.05,
    bottom: -26.55
});
export const DEFAULT_ADDRESS_SEARCH_MARGIN_KM = 5;

export const DEFAULT_ADDRESS_SEARCH_CITIES = Object.freeze([
    'Sao Bento do Sul',
    'Campo Alegre',
    'Rio Negrinho'
]);

export const ADDRESS_SEARCH_CITY_BASE_VIEWBOXES = Object.freeze({
    'SC|SAO BENTO DO SUL': Object.freeze({ left: -49.55, top: -26.10, right: -49.20, bottom: -26.40 }),
    'SC|CAMPO ALEGRE': Object.freeze({ left: -49.62, top: -25.90, right: -48.95, bottom: -26.38 }),
    'SC|RIO NEGRINHO': Object.freeze({ left: -49.78, top: -26.10, right: -49.25, bottom: -26.56 })
});

export const DEFAULT_ADDRESS_SEARCH_CONFIG = Object.freeze({
    uf: DEFAULT_ADDRESS_SEARCH_UF,
    cidades: DEFAULT_ADDRESS_SEARCH_CITIES,
    margemKm: DEFAULT_ADDRESS_SEARCH_MARGIN_KM,
    viewbox: DEFAULT_ADDRESS_SEARCH_VIEWBOX
});

export const ADDRESS_SEARCH_REGION_PRESET = Object.freeze({
    id: 'sbs-campo-alegre-rio-negrinho',
    label: 'SBS + Campo Alegre + Rio Negrinho',
    uf: DEFAULT_ADDRESS_SEARCH_UF,
    cidades: DEFAULT_ADDRESS_SEARCH_CITIES,
    margemKm: DEFAULT_ADDRESS_SEARCH_MARGIN_KM,
    viewbox: DEFAULT_ADDRESS_SEARCH_VIEWBOX
});

const normalizeText = (value, fallback = '', maxLength = 120) => {
    const text = String(value ?? '').trim().slice(0, maxLength);
    return text || fallback;
};

const normalizeUf = (value, fallback = DEFAULT_ADDRESS_SEARCH_UF) => {
    const uf = normalizeText(value, fallback, 2).toUpperCase();
    return /^[A-Z]{2}$/.test(uf) ? uf : fallback;
};

const normalizeNumber = (value, fallback) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
};

export const normalizeAddressSearchCityKey = (value) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
);

export const getAddressSearchCityKey = (uf, cidade) => (
    `${normalizeUf(uf)}|${normalizeAddressSearchCityKey(cidade)}`
);

export const normalizeAddressSearchMarginKm = (value) => {
    const number = normalizeNumber(value, DEFAULT_ADDRESS_SEARCH_MARGIN_KM);
    return Math.max(0, Math.min(50, Number(number.toFixed(1))));
};

export const normalizeAddressSearchViewbox = (value = {}, fallback = DEFAULT_ADDRESS_SEARCH_VIEWBOX) => {
    const viewbox = {
        left: normalizeNumber(value.left, fallback.left),
        top: normalizeNumber(value.top, fallback.top),
        right: normalizeNumber(value.right, fallback.right),
        bottom: normalizeNumber(value.bottom, fallback.bottom)
    };

    if (viewbox.left >= viewbox.right || viewbox.bottom >= viewbox.top) {
        return fallback;
    }

    return viewbox;
};

export const expandAddressSearchViewboxByKm = (viewbox, marginKm = DEFAULT_ADDRESS_SEARCH_MARGIN_KM) => {
    const normalized = normalizeAddressSearchViewbox(viewbox);
    const margin = normalizeAddressSearchMarginKm(marginKm);
    if (margin <= 0) return normalized;

    const centerLat = (normalized.top + normalized.bottom) / 2;
    const latDelta = margin / 110.574;
    const lngKm = Math.max(30, 111.320 * Math.cos(centerLat * Math.PI / 180));
    const lngDelta = margin / lngKm;

    return {
        left: Number((normalized.left - lngDelta).toFixed(6)),
        top: Number((normalized.top + latDelta).toFixed(6)),
        right: Number((normalized.right + lngDelta).toFixed(6)),
        bottom: Number((normalized.bottom - latDelta).toFixed(6))
    };
};

export const normalizeAddressSearchCities = (value) => {
    const raw = Array.isArray(value) ? value : DEFAULT_ADDRESS_SEARCH_CITIES;
    const seen = new Set();

    return raw
        .map((cidade) => normalizeText(cidade?.nome || cidade, '', 120))
        .filter(Boolean)
        .filter((cidade) => {
            const key = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

export const getKnownAddressSearchCityViewbox = (uf, cidade) => (
    ADDRESS_SEARCH_CITY_BASE_VIEWBOXES[getAddressSearchCityKey(uf, cidade)] || null
);

export const buildAddressSearchArea = ({ uf, cidade, baseViewbox, viewbox }, marginKm = DEFAULT_ADDRESS_SEARCH_MARGIN_KM) => {
    const normalizedUf = normalizeUf(uf);
    const normalizedCidade = normalizeText(cidade, '', 120);
    const base = normalizeAddressSearchViewbox(
        baseViewbox || viewbox || getKnownAddressSearchCityViewbox(normalizedUf, normalizedCidade) || DEFAULT_ADDRESS_SEARCH_VIEWBOX
    );

    return {
        uf: normalizedUf,
        cidade: normalizedCidade,
        baseViewbox: base,
        viewbox: expandAddressSearchViewboxByKm(base, marginKm)
    };
};

export const normalizeAddressSearchAreas = (value, { uf, cidades, margemKm, fallbackViewbox } = {}) => {
    const raw = Array.isArray(value)
        ? value
        : cidades.map((cidade) => ({
            uf,
            cidade,
            baseViewbox: getKnownAddressSearchCityViewbox(uf, cidade) || fallbackViewbox || DEFAULT_ADDRESS_SEARCH_VIEWBOX
        }));
    const seen = new Set();

    return raw
        .map((area) => buildAddressSearchArea({
            uf: area?.uf || uf,
            cidade: area?.cidade || area?.nome,
            baseViewbox: area?.baseViewbox,
            viewbox: area?.viewbox
        }, margemKm))
        .filter((area) => area.cidade)
        .filter((area) => {
            const key = getAddressSearchCityKey(area.uf, area.cidade);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

export const unionAddressSearchViewboxes = (areas, fallback = DEFAULT_ADDRESS_SEARCH_VIEWBOX) => {
    const boxes = (Array.isArray(areas) ? areas : [])
        .map((area) => area?.viewbox)
        .filter(Boolean);

    if (!boxes.length) return normalizeAddressSearchViewbox(fallback);

    return boxes.reduce((acc, viewbox) => ({
        left: Math.min(acc.left, viewbox.left),
        top: Math.max(acc.top, viewbox.top),
        right: Math.max(acc.right, viewbox.right),
        bottom: Math.min(acc.bottom, viewbox.bottom)
    }), boxes[0]);
};

export const normalizeAddressSearchConfig = (value = {}) => {
    const uf = normalizeUf(value.uf);
    const cidades = normalizeAddressSearchCities(value.cidades);
    const margemKm = normalizeAddressSearchMarginKm(value.margemKm);
    const fallbackViewbox = normalizeAddressSearchViewbox(value.viewbox);
    const areas = normalizeAddressSearchAreas(value.areas, { uf, cidades, margemKm, fallbackViewbox });

    return {
        uf,
        cidades: areas.length ? areas.map((area) => area.cidade) : cidades,
        margemKm,
        areas,
        viewbox: unionAddressSearchViewboxes(areas, fallbackViewbox)
    };
};
