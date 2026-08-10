import {
    buildAddressSearchArea,
    getKnownAddressSearchCityViewbox,
    normalizeAddressSearchCityKey,
    normalizeAddressSearchMarginKm
} from './addressSearchConfig';
import { waitForNominatimThrottle } from './nominatimThrottle';

const NOMINATIM_ENDPOINT = import.meta.env.VITE_ADDRESS_SEARCH_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const CITY_LOOKUP_CACHE_PREFIX = 'territorios-idiomas.addressSearchCity.v1.';

const BR_UF_NAMES = {
    AC: 'Acre',
    AL: 'Alagoas',
    AP: 'Amapa',
    AM: 'Amazonas',
    BA: 'Bahia',
    CE: 'Ceara',
    DF: 'Distrito Federal',
    ES: 'Espirito Santo',
    GO: 'Goias',
    MA: 'Maranhao',
    MT: 'Mato Grosso',
    MS: 'Mato Grosso do Sul',
    MG: 'Minas Gerais',
    PA: 'Para',
    PB: 'Paraiba',
    PR: 'Parana',
    PE: 'Pernambuco',
    PI: 'Piaui',
    RJ: 'Rio de Janeiro',
    RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul',
    RO: 'Rondonia',
    RR: 'Roraima',
    SC: 'Santa Catarina',
    SP: 'Sao Paulo',
    SE: 'Sergipe',
    TO: 'Tocantins'
};

const getCacheKey = (uf, cidade, margemKm) => [
    String(uf || '').toUpperCase(),
    normalizeAddressSearchCityKey(cidade),
    normalizeAddressSearchMarginKm(margemKm)
].join('|');

const readCache = (key) => {
    try {
        const raw = window.sessionStorage?.getItem(`${CITY_LOOKUP_CACHE_PREFIX}${key}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeCache = (key, area) => {
    try {
        window.sessionStorage?.setItem(`${CITY_LOOKUP_CACHE_PREFIX}${key}`, JSON.stringify(area));
    } catch {
        // Cache is best effort.
    }
};

const viewboxFromBoundingBox = (boundingbox) => {
    if (!Array.isArray(boundingbox) || boundingbox.length < 4) return null;

    const [south, north, west, east] = boundingbox.map((value) => Number.parseFloat(value));
    if (![south, north, west, east].every(Number.isFinite)) return null;

    return {
        left: west,
        top: north,
        right: east,
        bottom: south
    };
};

const getCandidateCityNames = (address = {}) => [
    address.municipality,
    address.city,
    address.town,
    address.village,
    address.county
].filter(Boolean);

const matchesCity = (item, cidade) => {
    const expected = normalizeAddressSearchCityKey(cidade);
    return getCandidateCityNames(item?.address).some((name) => normalizeAddressSearchCityKey(name) === expected);
};

const matchesUf = (item, uf) => {
    const address = item?.address || {};
    const iso = String(address['ISO3166-2-lvl4'] || '').toUpperCase();
    if (iso.endsWith(`-${uf}`)) return true;

    const expectedState = normalizeAddressSearchCityKey(BR_UF_NAMES[uf]);
    return expectedState && normalizeAddressSearchCityKey(address.state) === expectedState;
};

const findMunicipalityMatch = (payload, uf, cidade) => {
    if (!Array.isArray(payload)) return null;

    return payload.find((item) => (
        item?.boundingbox &&
        matchesCity(item, cidade) &&
        matchesUf(item, uf)
    )) || null;
};

export const lookupAddressSearchCityArea = async ({ uf, cidade, margemKm, signal }) => {
    const nome = String(cidade || '').trim();
    const normalizedUf = String(uf || '').trim().toUpperCase();
    if (!nome || !normalizedUf) return null;

    const known = getKnownAddressSearchCityViewbox(normalizedUf, nome);
    if (known) {
        return buildAddressSearchArea({
            uf: normalizedUf,
            cidade: nome,
            baseViewbox: known
        }, margemKm);
    }

    const cacheKey = getCacheKey(normalizedUf, nome, margemKm);
    const cached = readCache(cacheKey);
    if (cached) return cached;

    await waitForNominatimThrottle();

    const params = new URLSearchParams({
        format: 'jsonv2',
        q: `${nome}, ${normalizedUf}, Brasil`,
        addressdetails: '1',
        limit: '3',
        countrycodes: 'br',
        'accept-language': 'pt-BR'
    });

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, { signal });
    if (!response.ok) {
        throw new Error('Não foi possível localizar os limites desse município agora.');
    }

    const payload = await response.json();
    const match = findMunicipalityMatch(payload, normalizedUf, nome);
    const baseViewbox = viewboxFromBoundingBox(match?.boundingbox);

    if (!baseViewbox) return null;

    const area = buildAddressSearchArea({
        uf: normalizedUf,
        cidade: nome,
        baseViewbox
    }, margemKm);
    writeCache(cacheKey, area);
    return area;
};
