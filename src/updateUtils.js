import appInfo from './version.json';
import { checkNativeLiveUpdate, isNativeLiveUpdateAvailable } from './nativeLiveUpdate';

function isPwaServiceWorker(registration) {
    const workerUrl = registration.active?.scriptURL
        || registration.waiting?.scriptURL
        || registration.installing?.scriptURL
        || '';

    return /\/(?:dev-)?sw\.js(?:\?|$)/.test(workerUrl);
}

export async function checkForUpdate(manual = false) {
    try {
        if (isNativeLiveUpdateAvailable()) {
            return await checkNativeLiveUpdate(manual);
        }

        const baseUrl = import.meta.env.BASE_URL;
        const response = await fetch(`${baseUrl}version.json?t=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!response.ok) return false;

        const data = await response.json();
        if (data.version === appInfo.version) return false;

        if (manual) {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(
                    regs
                        .filter(isPwaServiceWorker)
                        .map((registration) => registration.update())
                );
            }

            const baseUrl = import.meta.env.BASE_URL || '/';
            const basePath = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            const updateUrl = new URL(basePath, window.location.origin);
            updateUrl.searchParams.set('v', data.version);
            updateUrl.hash = window.location.hash;
            window.location.href = updateUrl.toString();
        }

        return true;
    } catch (error) {
        console.error("Erro ao verificar versão:", error);
        return false;
    }
}
