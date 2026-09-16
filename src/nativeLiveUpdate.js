import { Capacitor, registerPlugin } from '@capacitor/core';
import appInfo from './version.json';
import { LIVE_UPDATE_ENABLED, LIVE_UPDATE_MANIFEST_URL } from './liveUpdateConfig';

const NativeLiveUpdate = registerPlugin('NativeLiveUpdate');

export function isNativeLiveUpdateAvailable() {
    return LIVE_UPDATE_ENABLED && Capacitor.getPlatform() === 'android';
}

function withCacheBuster(url) {
    try {
        const parsedUrl = new URL(url);
        parsedUrl.searchParams.set('t', String(Date.now()));
        return parsedUrl.toString();
    } catch {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${Date.now()}`;
    }
}

export async function checkNativeLiveUpdate(manual = false) {
    if (!isNativeLiveUpdateAvailable()) return false;

    const options = {
        manifestUrl: manual ? withCacheBuster(LIVE_UPDATE_MANIFEST_URL) : LIVE_UPDATE_MANIFEST_URL,
        currentVersion: appInfo.version
    };

    const result = manual
        ? await NativeLiveUpdate.downloadAndInstall(options)
        : await NativeLiveUpdate.check(options);

    return result || { updateAvailable: false, installed: false };
}
