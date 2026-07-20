import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
    isSignInWithEmailLink,
    sendSignInLinkToEmail,
    signInWithEmailLink
} from 'firebase/auth';
import { auth } from './firebase';
import { getPublicAppBaseUrl } from './publicAppUrl';

const MAGIC_LINK_EMAIL_STORAGE_KEY = 'territorios.magicLink.email';
const MAGIC_LINK_URL_STORAGE_KEY = 'territorios.magicLink.url';
export const MAGIC_LINK_STATE_EVENT = 'territorios:magic-link-state-change';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const canUseBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const notifyMagicLinkStateChange = () => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(MAGIC_LINK_STATE_EVENT));
};

const readStorage = (key) => {
    if (!canUseBrowserStorage()) return '';

    try {
        return String(window.localStorage.getItem(key) || '');
    } catch {
        return '';
    }
};

const writeStorage = (key, value) => {
    if (!canUseBrowserStorage()) return;

    try {
        window.localStorage.setItem(key, value);
        notifyMagicLinkStateChange();
    } catch {
        // Ignora storage indisponível.
    }
};

const removeStorage = (key) => {
    if (!canUseBrowserStorage()) return;

    try {
        window.localStorage.removeItem(key);
        notifyMagicLinkStateChange();
    } catch {
        // Ignora storage indisponível.
    }
};

export const normalizeAuthEmail = (value) => String(value || '').trim().toLowerCase();

export const isValidAuthEmail = (value) => emailRegex.test(normalizeAuthEmail(value));

export const getRememberedMagicLinkEmail = () => readStorage(MAGIC_LINK_EMAIL_STORAGE_KEY);

export const rememberPendingMagicLinkUrl = (url) => {
    const normalized = String(url || '').trim();
    if (!isMagicLinkSignInUrl(normalized)) return;
    writeStorage(MAGIC_LINK_URL_STORAGE_KEY, normalized);
};

export const consumePendingMagicLinkUrl = () => {
    return readStorage(MAGIC_LINK_URL_STORAGE_KEY);
};

export const clearPendingMagicLinkUrl = () => {
    removeStorage(MAGIC_LINK_URL_STORAGE_KEY);
};

export const isMagicLinkSignInUrl = (value) => {
    const url = String(value || '').trim();
    if (!url) return false;

    try {
        return isSignInWithEmailLink(auth, url);
    } catch {
        return false;
    }
};

export const getMagicLinkFromCurrentUrl = () => {
    if (typeof window === 'undefined') return '';

    const currentUrl = String(window.location.href || '').trim();
    return isMagicLinkSignInUrl(currentUrl) ? currentUrl : '';
};

const buildActionCodeSettings = async () => {
    const publicUrl = getPublicAppBaseUrl();

    if (!publicUrl) {
        throw new Error('Configuração ausente: defina VITE_PUBLIC_APP_URL para enviar o link mágico.');
    }

    const settings = {
        url: publicUrl,
        handleCodeInApp: true
    };

    if (Capacitor.isNativePlatform()) {
        const appInfo = await CapacitorApp.getInfo();
        if (appInfo?.id) {
            settings.android = {
                packageName: appInfo.id,
                installApp: false
            };
        }
    }

    return settings;
};

export const sendMagicLink = async (email) => {
    const normalized = normalizeAuthEmail(email);
    const settings = await buildActionCodeSettings();

    auth.languageCode = 'pt-BR';
    await sendSignInLinkToEmail(auth, normalized, settings);

    writeStorage(MAGIC_LINK_EMAIL_STORAGE_KEY, normalized);

    return normalized;
};

export const clearMagicLinkBrowserUrl = () => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;

    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
};

export const completeMagicLinkSignIn = async ({ email, emailLink }) => {
    const normalized = normalizeAuthEmail(email);
    const link = String(emailLink || '').trim();

    await signInWithEmailLink(auth, normalized, link);
    removeStorage(MAGIC_LINK_EMAIL_STORAGE_KEY);
    clearPendingMagicLinkUrl();
    clearMagicLinkBrowserUrl();
};
