import { Capacitor, registerPlugin } from '@capacitor/core';
import appInfo from './version.json';
import { LIVE_UPDATE_ENABLED, LIVE_UPDATE_MANIFEST_URL } from './liveUpdateConfig';

const NativeLiveUpdate = registerPlugin('NativeLiveUpdate');

export function isNativeLiveUpdateAvailable() {
    return LIVE_UPDATE_ENABLED && Capacitor.getPlatform() === 'android';
}

export async function checkNativeLiveUpdate(manual = false) {
    if (!isNativeLiveUpdateAvailable()) return false;

    const options = {
        manifestUrl: LIVE_UPDATE_MANIFEST_URL,
        currentVersion: appInfo.version
    };

    const result = manual
        ? await NativeLiveUpdate.downloadAndInstall(options)
        : await NativeLiveUpdate.check(options);

    return Boolean(result?.updateAvailable || result?.installed);
}
