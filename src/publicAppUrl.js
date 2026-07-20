const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const inferPublicUrlFromManifest = () => {
    const manifestUrl = trimTrailingSlash(import.meta.env.VITE_LIVE_UPDATE_MANIFEST_URL);
    if (!manifestUrl) return '';

    return manifestUrl.replace(/\/live-update\/manifest\.json$/i, '');
};

const getWindowBaseUrl = () => {
    if (typeof window === 'undefined') return '';

    return trimTrailingSlash(window.location.href.split('?')[0].split('#')[0]);
};

export const getPublicAppBaseUrl = () =>
    trimTrailingSlash(import.meta.env.VITE_PUBLIC_APP_URL)
    || inferPublicUrlFromManifest()
    || getWindowBaseUrl();

export const buildPublicAppRouteUrl = (route = '/app', params = {}) => {
    const baseUrl = getPublicAppBaseUrl();
    const routePath = String(route || '/app').replace(/^#/, '');
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        searchParams.set(key, String(value));
    });

    const query = searchParams.toString();
    return `${baseUrl}#${routePath}${query ? `?${query}` : ''}`;
};
