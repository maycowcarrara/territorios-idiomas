import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { auth } from './firebase';

const googleWebClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
    || import.meta.env.VITE_GOOGLE_ANDROID_WEB_CLIENT_ID
    || '';

let googleAuthInicializado = false;

const garantirConfigGoogleNativa = () => {
    if (googleWebClientId) return googleWebClientId;

    throw new Error('Configuração ausente: defina VITE_GOOGLE_WEB_CLIENT_ID para o login nativo Android.');
};

export const signInWithGoogleNative = async () => {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Login nativo só pode ser usado dentro do app Capacitor.');
    }

    const webClientId = garantirConfigGoogleNativa();

    if (!googleAuthInicializado) {
        await SocialLogin.initialize({
            google: {
                webClientId,
                mode: 'online'
            }
        });
        googleAuthInicializado = true;
    }

    const resposta = await SocialLogin.login({
        provider: 'google',
        options: {
            // O plugin já inclui email/profile por padrão no Android.
            // Enviar scopes extras sem adaptar a MainActivity faz o login falhar.
            style: 'standard',
            filterByAuthorizedAccounts: false
        }
    });

    if (resposta.provider !== 'google' || resposta.result.responseType !== 'online' || !resposta.result.idToken) {
        throw new Error('Não foi possível obter o token do Google no login nativo.');
    }

    const credential = GoogleAuthProvider.credential(resposta.result.idToken);
    return signInWithCredential(auth, credential);
};

export const signOutGoogleNative = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            await SocialLogin.logout({ provider: 'google' });
        } catch (error) {
            console.warn('Não foi possível limpar a sessão nativa do Google:', error);
        }
    }

    await signOut(auth);
};
