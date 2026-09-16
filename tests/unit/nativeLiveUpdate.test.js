import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockNativeLiveUpdatePlugin } = vi.hoisted(() => ({
    mockNativeLiveUpdatePlugin: {
        check: vi.fn(),
        downloadAndInstall: vi.fn()
    }
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: vi.fn()
    },
    registerPlugin: vi.fn(() => mockNativeLiveUpdatePlugin)
}));

vi.mock('../../src/liveUpdateConfig.js', () => ({
    LIVE_UPDATE_ENABLED: true,
    LIVE_UPDATE_MANIFEST_URL: 'https://example.com/live-update/manifest.json'
}));

import { Capacitor } from '@capacitor/core';
import { isNativeLiveUpdateAvailable, checkNativeLiveUpdate } from '../../src/nativeLiveUpdate.js';
import currentAppInfo from '../../src/version.json';

describe('nativeLiveUpdate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isNativeLiveUpdateAvailable', () => {
        it('deve retornar true apenas quando plataforma for android e live update estiver habilitado', () => {
            vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
            expect(isNativeLiveUpdateAvailable()).toBe(true);

            vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
            expect(isNativeLiveUpdateAvailable()).toBe(false);

            vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
            expect(isNativeLiveUpdateAvailable()).toBe(false);
        });
    });

    describe('checkNativeLiveUpdate', () => {
        it('deve retornar false caso a plataforma não seja android', async () => {
            vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
            const result = await checkNativeLiveUpdate(false);
            expect(result).toBe(false);
            expect(mockNativeLiveUpdatePlugin.check).not.toHaveBeenCalled();
        });

        it('deve chamar NativeLiveUpdate.check no modo automático com manifestUrl original', async () => {
            vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
            mockNativeLiveUpdatePlugin.check.mockResolvedValue({
                updateAvailable: true,
                installed: false,
                version: '3.5.999'
            });

            const result = await checkNativeLiveUpdate(false);
            expect(result.updateAvailable).toBe(true);
            expect(mockNativeLiveUpdatePlugin.check).toHaveBeenCalledWith({
                manifestUrl: 'https://example.com/live-update/manifest.json',
                currentVersion: currentAppInfo.version
            });
        });

        it('deve chamar NativeLiveUpdate.downloadAndInstall no modo manual com cache buster', async () => {
            vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
            mockNativeLiveUpdatePlugin.downloadAndInstall.mockResolvedValue({
                updateAvailable: true,
                installed: true,
                version: '3.5.999'
            });

            const result = await checkNativeLiveUpdate(true);
            expect(result.installed).toBe(true);
            expect(mockNativeLiveUpdatePlugin.downloadAndInstall).toHaveBeenCalledTimes(1);

            const callArg = mockNativeLiveUpdatePlugin.downloadAndInstall.mock.calls[0][0];
            expect(callArg.currentVersion).toBe(currentAppInfo.version);
            expect(callArg.manifestUrl).toMatch(/https:\/\/example\.com\/live-update\/manifest\.json\?t=\d+/);
        });
    });
});
