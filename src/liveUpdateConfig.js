export const LIVE_UPDATE_MANIFEST_URL =
    import.meta.env.VITE_LIVE_UPDATE_MANIFEST_URL || '';

export const LIVE_UPDATE_ENABLED = LIVE_UPDATE_MANIFEST_URL.trim().length > 0;
