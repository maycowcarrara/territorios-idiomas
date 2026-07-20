import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import emailjs from '@emailjs/browser';
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
const relayUrl = String(import.meta.env.VITE_NOTIFICATIONS_RELAY_URL || '').trim();
const emailJsPublicKey = String(import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '').trim();
const emailJsServiceId = String(import.meta.env.VITE_EMAILJS_SERVICE_ID || '').trim();
const emailJsTemplateId = String(import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '').trim();
const emailJsTemplateName = String(import.meta.env.VITE_EMAILJS_TEMPLATE_NAME || 'Territórios').trim();
const EMAILJS_RATE_LIMIT_MS = 10 * 1000;

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

const getRelayBaseUrl = () => relayUrl.replace(/\/$/, '');

const buildMagicLinkRelayUrl = () => {
    const baseUrl = getRelayBaseUrl();
    return baseUrl ? `${baseUrl}/auth/magic-link` : '';
};

const createRelayFallbackError = () => {
    const error = new Error('magic-link-relay-unavailable');
    error.magicLinkRelayFallback = true;
    return error;
};

const createEmailJsFallbackError = () => {
    const error = new Error('magic-link-emailjs-unavailable');
    error.magicLinkEmailJsFallback = true;
    return error;
};

const shouldFallbackToFirebase = (error) => {
    if (error?.magicLinkRelayFallback || error?.magicLinkEmailJsFallback) return true;

    const message = String(error?.message || error || '');
    return (
        !relayUrl
        || !emailJsPublicKey
        || !emailJsServiceId
        || !emailJsTemplateId
        || message.includes('magic-link-relay-unavailable')
        || message.includes('magic-link-emailjs-unavailable')
        || message.includes('Failed to fetch')
        || message.includes('NetworkError')
        || message.includes('Sessão ausente para enviar notificação.')
        || message.includes('Ação de relay inválida.')
        || message.includes('Rota do relay inválida.')
    );
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

const sendMagicLinkViaFirebase = async (normalized, settings) => {
    auth.languageCode = 'pt-BR';
    await sendSignInLinkToEmail(auth, normalized, settings);
};

const createMagicLinkViaRelay = async (normalized, settings) => {
    const endpoint = buildMagicLinkRelayUrl();
    if (!endpoint) {
        throw createRelayFallbackError();
    }

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: normalized,
                settings
            })
        });
    } catch {
        throw createRelayFallbackError();
    }

    const payload = await response.json().catch(() => ({}));
    if (response.status === 404 || response.status === 405) {
        throw createRelayFallbackError();
    }

    if (!response.ok) {
        const error = new Error(payload?.error || 'Falha ao enviar link mágico pelo relay.');
        if (response.status === 401 && String(payload?.error || '').includes('Sessão ausente para enviar notificação.')) {
            error.magicLinkRelayFallback = true;
        }
        throw error;
    }

    return payload;
};

const sendMagicLinkViaEmailJs = async ({ normalized, magicLinkPayload }) => {
    if (!emailJsPublicKey || !emailJsServiceId || !emailJsTemplateId) {
        throw createEmailJsFallbackError();
    }

    const emailTemplate = magicLinkPayload?.emailTemplate || {};
    const magicLink = String(magicLinkPayload?.magicLink || emailTemplate.magicLink || '').trim();
    if (!magicLink) {
        throw new Error('O relay não retornou um link mágico válido.');
    }

    const templateParams = {
        to_email: normalized,
        to_name: normalized,
        app_name: emailTemplate.appName || emailJsTemplateName,
        app_subtitle: emailTemplate.appSubtitle || '',
        app_icon_url: emailTemplate.appIconUrl || '',
        app_url: emailTemplate.publicUrl || getPublicAppBaseUrl(),
        subject: emailTemplate.subject || `Seu link de acesso ao ${emailJsTemplateName}`,
        intro_text: emailTemplate.introText || `Recebemos um pedido de acesso ao ${emailJsTemplateName}.`,
        button_label: emailTemplate.buttonLabel || 'Entrar com link mágico',
        hint_text: emailTemplate.hintText || 'Use o botão abaixo para concluir o login com segurança.',
        footer_text: emailTemplate.footerText || 'O acesso continua sujeito à aprovação do administrador para o e-mail informado.',
        magic_link: magicLink
    };

    return emailjs.send(
        emailJsServiceId,
        emailJsTemplateId,
        templateParams,
        {
            publicKey: emailJsPublicKey,
            blockHeadless: true,
            limitRate: {
                id: 'magic-link',
                throttle: EMAILJS_RATE_LIMIT_MS
            }
        }
    );
};

export const sendMagicLink = async (email) => {
    const normalized = normalizeAuthEmail(email);
    const settings = await buildActionCodeSettings();

    try {
        const magicLinkPayload = await createMagicLinkViaRelay(normalized, settings);
        await sendMagicLinkViaEmailJs({
            normalized,
            magicLinkPayload
        });
    } catch (error) {
        if (!shouldFallbackToFirebase(error)) {
            throw error;
        }

        await sendMagicLinkViaFirebase(normalized, settings);
    }

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
