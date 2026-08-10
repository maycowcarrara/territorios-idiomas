const NOMINATIM_THROTTLE_MS = 1000;

let lastNominatimRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const waitForNominatimThrottle = async () => {
    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < NOMINATIM_THROTTLE_MS) {
        await sleep(NOMINATIM_THROTTLE_MS - elapsed);
    }
    lastNominatimRequestAt = Date.now();
};
