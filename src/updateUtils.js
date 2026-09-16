import appInfo from './version.json';
import { checkNativeLiveUpdate, isNativeLiveUpdateAvailable } from './nativeLiveUpdate';

function isPwaServiceWorker(registration) {
    const workerUrl = registration.active?.scriptURL
        || registration.waiting?.scriptURL
        || registration.installing?.scriptURL
        || '';

    return /\/(?:dev-)?sw\.js(?:\?|$)/.test(workerUrl);
}

export async function checkForUpdateStatus(manual = false) {
    try {
        if (isNativeLiveUpdateAvailable()) {
            const result = await checkNativeLiveUpdate(manual);
            const status = {
                native: true,
                updateAvailable: Boolean(result?.updateAvailable || result?.installed),
                installed: Boolean(result?.installed),
                version: result?.version || '',
                currentVersion: result?.currentVersion || appInfo.version,
                installedVersion: result?.installedVersion || ''
            };

            if (manual && status.installed && typeof window !== 'undefined') {
                window.setTimeout(() => window.location.reload(), 900);
            }

            return status;
        }

        const baseUrl = import.meta.env.BASE_URL;
        const response = await fetch(`${baseUrl}version.json?t=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!response.ok) return { native: false, updateAvailable: false, installed: false };

        const data = await response.json();
        if (data.version === appInfo.version) {
            return {
                native: false,
                updateAvailable: false,
                installed: false,
                version: data.version,
                currentVersion: appInfo.version
            };
        }

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

        return {
            native: false,
            updateAvailable: true,
            installed: false,
            version: data.version,
            currentVersion: appInfo.version
        };
    } catch (error) {
        console.error("Erro ao verificar versão:", error);
        return { native: false, updateAvailable: false, installed: false, error };
    }
}

export async function checkForUpdate(manual = false) {
    const status = await checkForUpdateStatus(manual);
    return Boolean(status?.updateAvailable || status?.installed);
}
