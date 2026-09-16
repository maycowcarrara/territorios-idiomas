import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as nativeModule from '../../src/nativeLiveUpdate.js';
import { checkForUpdateStatus, checkForUpdate } from '../../src/updateUtils.js';
import currentAppInfo from '../../src/version.json';

describe('updateUtils', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.spyOn(nativeModule, 'isNativeLiveUpdateAvailable').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('checkForUpdateStatus em ambiente Web / PWA', () => {
        it('deve indicar updateAvailable: false quando a versão remota for idêntica à local', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ version: currentAppInfo.version })
            });
            vi.stubGlobal('fetch', mockFetch);

            const status = await checkForUpdateStatus(false);
            expect(status.native).toBe(false);
            expect(status.updateAvailable).toBe(false);
            expect(status.version).toBe(currentAppInfo.version);
            expect(status.currentVersion).toBe(currentAppInfo.version);
        });

        it('deve indicar updateAvailable: true quando houver nova versão na verificação automática', async () => {
            const novaVersao = '3.5.999';
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ version: novaVersao })
            });
            vi.stubGlobal('fetch', mockFetch);

            const status = await checkForUpdateStatus(false);
            expect(status.native).toBe(false);
            expect(status.updateAvailable).toBe(true);
            expect(status.version).toBe(novaVersao);
            expect(status.currentVersion).toBe(currentAppInfo.version);
        });

        it('deve retornar falha tratada sem lançar exceção em caso de erro HTTP ou rede', async () => {
            const mockFetch404 = vi.fn().mockResolvedValue({
                ok: false,
                status: 404
            });
            vi.stubGlobal('fetch', mockFetch404);

            const status = await checkForUpdateStatus(false);
            expect(status.native).toBe(false);
            expect(status.updateAvailable).toBe(false);

            // Erro de rede (rejeição da promise)
            const mockFetchError = vi.fn().mockRejectedValue(new Error('Network error'));
            vi.stubGlobal('fetch', mockFetchError);

            const statusErro = await checkForUpdateStatus(false);
            expect(statusErro.updateAvailable).toBe(false);
            expect(statusErro.error).toBeDefined();
        });

        it('em verificação manual com nova versão, deve atualizar Service Worker e redirecionar preservando hash', async () => {
            const novaVersao = '3.5.999';
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ version: novaVersao })
            });
            vi.stubGlobal('fetch', mockFetch);

            const mockUpdate = vi.fn().mockResolvedValue();
            const mockRegistrations = [
                { active: { scriptURL: 'https://example.com/sw.js' }, update: mockUpdate },
                { active: { scriptURL: 'https://example.com/other-worker.js' }, update: vi.fn() }
            ];

            vi.stubGlobal('navigator', {
                serviceWorker: {
                    getRegistrations: vi.fn().mockResolvedValue(mockRegistrations)
                }
            });

            const mockLocation = {
                origin: 'https://example.com',
                pathname: '/',
                hash: '#/mapa?filtro=ativo',
                href: ''
            };
            vi.stubGlobal('window', {
                location: mockLocation
            });

            const status = await checkForUpdateStatus(true);
            expect(status.updateAvailable).toBe(true);

            // Apenas o sw.js deve ser atualizado
            expect(mockUpdate).toHaveBeenCalledTimes(1);

            // O redirecionamento deve preservar o hash e adicionar parâmetro v
            expect(mockLocation.href).toContain('v=3.5.999');
            expect(mockLocation.href).toContain('#/mapa?filtro=ativo');
        });
    });

    describe('checkForUpdateStatus em ambiente Nativo (Capacitor/Android)', () => {
        it('deve delegar para checkNativeLiveUpdate quando o live update estiver disponível', async () => {
            vi.spyOn(nativeModule, 'isNativeLiveUpdateAvailable').mockReturnValue(true);
            vi.spyOn(nativeModule, 'checkNativeLiveUpdate').mockResolvedValue({
                updateAvailable: true,
                installed: false,
                version: '3.5.999',
                currentVersion: currentAppInfo.version
            });

            const status = await checkForUpdateStatus(false);
            expect(status.native).toBe(true);
            expect(status.updateAvailable).toBe(true);
            expect(status.installed).toBe(false);
            expect(status.version).toBe('3.5.999');
        });

        it('deve agendar reload ao detectar pacote instalado em verificação manual', async () => {
            vi.useFakeTimers();
            vi.spyOn(nativeModule, 'isNativeLiveUpdateAvailable').mockReturnValue(true);
            vi.spyOn(nativeModule, 'checkNativeLiveUpdate').mockResolvedValue({
                updateAvailable: true,
                installed: true,
                version: '3.5.999',
                installedVersion: '3.5.999'
            });

            const reloadMock = vi.fn();
            vi.stubGlobal('window', {
                setTimeout: globalThis.setTimeout,
                location: { reload: reloadMock }
            });

            const status = await checkForUpdateStatus(true);
            expect(status.native).toBe(true);
            expect(status.installed).toBe(true);

            expect(reloadMock).not.toHaveBeenCalled();
            vi.advanceTimersByTime(900);
            expect(reloadMock).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });
    });

    describe('checkForUpdate wrapper booleano', () => {
        it('deve retornar true se houver updateAvailable ou installed', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ version: '3.5.999' })
            });
            vi.stubGlobal('fetch', mockFetch);

            const result = await checkForUpdate(false);
            expect(result).toBe(true);
        });

        it('deve retornar false quando a versão for a mesma', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ version: currentAppInfo.version })
            });
            vi.stubGlobal('fetch', mockFetch);

            const result = await checkForUpdate(false);
            expect(result).toBe(false);
        });
    });
});
