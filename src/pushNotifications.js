import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { arrayRemove, arrayUnion, deleteField, doc, setDoc } from 'firebase/firestore';
import NativeOneSignal from 'onesignal-cordova-plugin';
import { db } from './firebase';

const CANAL_PADRAO_ID = 'territorios-alertas';
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';
const APP_INSTANCE = import.meta.env.MODE || 'local';
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME || 'Territórios';
const ONESIGNAL_WEB_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const ONESIGNAL_WEB_WORKER_PATH = 'push/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_WEB_WORKER_SCOPE = '/push/onesignal/';
const ONESIGNAL_PROMPT_TEXT = {
    actionMessage: `Receber comunicados e avisos do ${APP_SHORT_NAME}?`,
    acceptButton: 'Permitir',
    cancelButton: 'Agora nao'
};
const ONESIGNAL_WELCOME_NOTIFICATION = {
    title: APP_SHORT_NAME,
    message: 'Notificações ativadas. Voce receberá comunicados e avisos por aqui.',
    url: '/'
};
let listenersRegistrados = false;
let oneSignalNativoInicializado = false;
let oneSignalWebInicializado = false;
let oneSignalWebSdkPromise = null;
let emailUsuarioAtual = null;
let ultimoTokenRegistrado = null;

const isLikelyContentBlockerError = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    return [
        'err_blocked_by_client',
        'blocked by client',
        'adblock',
        'ublock',
        'brave',
        'privacy',
        'networkerror',
        'failed to fetch',
        'onesignal'
    ].some((snippet) => message.includes(snippet));
};

export const describePushActivationError = (error) => {
    if (isLikelyContentBlockerError(error)) {
        return 'Um bloqueador de anuncios/privacidade pode ter impedido o carregamento do push. Libere este site e tente novamente.';
    }

    return String(error?.message || 'Não foi possível ativar notificações neste navegador.');
};

const ehAndroidNativo = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const ehWebComPush = () =>
    !Capacitor.isNativePlatform()
    && typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'Notification' in window;
const oneSignalNativoDisponivel = () => ehAndroidNativo() && Boolean(ONESIGNAL_APP_ID);
const oneSignalWebDisponivel = () => ehWebComPush() && Boolean(ONESIGNAL_APP_ID);
const normalizarRotaPush = (rota) => {
    const rotaLimpa = String(rota || '/app').trim();
    if (!rotaLimpa) return '#/app';
    if (rotaLimpa.startsWith('#')) return rotaLimpa;
    return `#${rotaLimpa.startsWith('/') ? rotaLimpa : `/${rotaLimpa}`}`;
};

const abrirDestinoDoPush = (notification) => {
    const data = notification?.notification?.data || notification?.data || {};
    const rota = normalizarRotaPush(data?.targetRoute || '/app');

    if (typeof window !== 'undefined' && window.location.hash !== rota) {
        window.location.hash = rota;
    }
};

const getDadosNotificacao = (notification) =>
    notification?.notification?.additionalData
    || notification?.notification?.data
    || notification?.notification?.payload?.additionalData
    || notification?.additionalData
    || notification?.data
    || {};

const getOneSignalTags = (email, plataforma) => ({
    email,
    plataforma,
    instancia: APP_INSTANCE,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    app: APP_SHORT_NAME
});

const getRefUsuario = (email) => doc(db, 'usuarios', email.toLowerCase());

const persistirTokenUsuario = async (email, token) => {
    if (!email || !token) return;

    ultimoTokenRegistrado = token;

    await setDoc(getRefUsuario(email), {
        fcmTokens: arrayUnion(token),
        ultimoFcmToken: token,
        ultimoFcmTokenAtualizadoEm: new Date(),
        plataformaPush: 'android'
    }, { merge: true });
};

const removerTokenUsuario = async (email, token) => {
    if (!email || !token) return;

    await setDoc(getRefUsuario(email), {
        fcmTokens: arrayRemove(token),
        ultimoFcmToken: deleteField(),
        ultimoFcmTokenAtualizadoEm: deleteField(),
        plataformaPush: deleteField()
    }, { merge: true });
};

const registrarFcmNativo = async (user) => {
    if (!ehAndroidNativo()) return;

    emailUsuarioAtual = user.email.toLowerCase();

    await garantirListenersPush();

    let permissao = await PushNotifications.checkPermissions();
    if (permissao.receive === 'prompt') {
        permissao = await PushNotifications.requestPermissions();
    }

    if (permissao.receive !== 'granted') {
        throw new Error('Permissão de notificações não concedida no Android.');
    }

    await PushNotifications.createChannel({
        id: CANAL_PADRAO_ID,
        name: 'Alertas do Territórios',
        description: 'Comunicados e avisos do sistema',
        importance: 4,
        visibility: 1,
        sound: 'default'
    });

    await PushNotifications.register();
};

const registrarFcmFallbackNativo = async (user) => {
    try {
        await registrarFcmNativo(user);
    } catch (error) {
        console.warn('Nao foi possivel registrar o fallback FCM no Android:', error);
    }
};

const desregistrarFcmNativo = async (email) => {
    if (!ehAndroidNativo()) return;

    const emailNormalizado = email?.toLowerCase() || emailUsuarioAtual;
    const tokenParaRemover = ultimoTokenRegistrado;

    try {
        await PushNotifications.unregister();
    } catch (error) {
        console.warn('Nao foi possivel desregistrar o FCM do aparelho:', error);
    }

    try {
        await removerTokenUsuario(emailNormalizado, tokenParaRemover);
    } catch (error) {
        console.warn('Nao foi possivel remover o token FCM do Firestore:', error);
    }

    ultimoTokenRegistrado = null;
};

const garantirListenersPush = async () => {
    if (listenersRegistrados || !ehAndroidNativo()) return;

    await PushNotifications.addListener('registration', async (token) => {
        console.info('FCM token registrado:', token.value);

        try {
            await persistirTokenUsuario(emailUsuarioAtual, token.value);
        } catch (error) {
            console.error('Erro ao salvar token FCM no Firestore:', error);
        }
    });

    await PushNotifications.addListener('registrationError', (error) => {
        console.error('Erro ao registrar Push Notifications:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.info('Push recebido:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.info('Push aberto pelo usuario:', notification);
        abrirDestinoDoPush(notification);
    });

    listenersRegistrados = true;
};

const garantirOneSignal = async () => {
    if (oneSignalNativoInicializado || !oneSignalNativoDisponivel()) return;

    NativeOneSignal.initialize(ONESIGNAL_APP_ID);
    console.info('OneSignal Android inicializado:', ONESIGNAL_APP_ID);

    if (NativeOneSignal.User?.pushSubscription?.addEventListener) {
        NativeOneSignal.User.pushSubscription.addEventListener('change', (event) => {
            console.info('OneSignal Android subscription alterada:', event);
        });
    }

    if (NativeOneSignal.Notifications?.addEventListener) {
        NativeOneSignal.Notifications.addEventListener('click', (event) => {
            console.info('Push OneSignal aberto:', event);
            abrirDestinoDoPush({ data: getDadosNotificacao(event) });
        });

        NativeOneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
            console.info('Push OneSignal recebido em primeiro plano:', event);
        });
    }

    oneSignalNativoInicializado = true;
};

const carregarOneSignalWebSdk = () => {
    if (oneSignalWebSdkPromise) return oneSignalWebSdkPromise;

    oneSignalWebSdkPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('OneSignal Web SDK indisponível fora do navegador.'));
            return;
        }

        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push((OneSignal) => resolve(OneSignal));

        if (document.getElementById('onesignal-web-sdk')) return;

        const script = document.createElement('script');
        script.id = 'onesignal-web-sdk';
        script.src = ONESIGNAL_WEB_SDK_URL;
        script.defer = true;
        script.onerror = () => reject(new Error('Não foi possível carregar o SDK Web da OneSignal. O navegador ou alguma extensão pode ter bloqueado esse arquivo.'));
        document.head.appendChild(script);
    });

    return oneSignalWebSdkPromise;
};

const garantirOneSignalWeb = async () => {
    if (oneSignalWebInicializado || !oneSignalWebDisponivel()) return null;

    const OneSignal = await carregarOneSignalWebSdk();
    await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerPath: ONESIGNAL_WEB_WORKER_PATH,
        serviceWorkerParam: {
            scope: ONESIGNAL_WEB_WORKER_SCOPE
        },
        promptOptions: {
            slidedown: {
                prompts: [{
                    type: 'push',
                    autoPrompt: false,
                    text: ONESIGNAL_PROMPT_TEXT
                }]
            }
        },
        welcomeNotification: ONESIGNAL_WELCOME_NOTIFICATION
    });

    oneSignalWebInicializado = true;
    return OneSignal;
};

const solicitarPermissaoOneSignalWeb = async (OneSignal) => {
    if (OneSignal.Notifications?.permission === true) return;

    if (OneSignal.Slidedown?.promptPush) {
        await OneSignal.Slidedown.promptPush();

        if (OneSignal.Notifications?.permission !== true) {
            throw new Error('Permissão de notificações não concedida no navegador.');
        }

        return;
    }

    if (OneSignal.Notifications?.requestPermission) {
        const aceitou = await OneSignal.Notifications.requestPermission();
        if (!aceitou) {
            throw new Error('Permissão de notificações não concedida no navegador.');
        }
    }
};

const ativarOneSignalNativo = async (user) => {
    emailUsuarioAtual = user.email.toLowerCase();

    await garantirOneSignal();

    if (NativeOneSignal.login) {
        await NativeOneSignal.login(emailUsuarioAtual);
        console.info('OneSignal Android external_id definido:', emailUsuarioAtual);
    }

    if (NativeOneSignal.User?.addTags) {
        await NativeOneSignal.User.addTags(getOneSignalTags(emailUsuarioAtual, 'android'));
    }

    if (NativeOneSignal.Notifications?.requestPermission) {
        const aceitou = await NativeOneSignal.Notifications.requestPermission(false);
        console.info('Permissão OneSignal Android:', aceitou);
        if (!aceitou) {
            throw new Error('Permissão de notificações não concedida no Android.');
        }
    }

    if (NativeOneSignal.User?.pushSubscription?.optIn) {
        NativeOneSignal.User.pushSubscription.optIn();
    }

    try {
        const [oneSignalId, externalId, subscriptionId, token, optedIn] = await Promise.all([
            NativeOneSignal.User?.getOnesignalId?.(),
            NativeOneSignal.User?.getExternalId?.(),
            NativeOneSignal.User?.pushSubscription?.getIdAsync?.(),
            NativeOneSignal.User?.pushSubscription?.getTokenAsync?.(),
            NativeOneSignal.User?.pushSubscription?.getOptedInAsync?.()
        ]);

        console.info('Status OneSignal Android:', {
            oneSignalId,
            externalId,
            subscriptionId,
            tokenRegistrado: Boolean(token),
            optedIn
        });
    } catch (error) {
        console.warn('Nao foi possível ler o status OneSignal Android:', error);
    }
};

const ativarOneSignalWeb = async (user) => {
    emailUsuarioAtual = user.email.toLowerCase();

    const OneSignal = await garantirOneSignalWeb();
    if (!OneSignal) return;

    if (OneSignal.login) {
        await OneSignal.login(emailUsuarioAtual);
    }

    if (OneSignal.User?.addTags) {
        await OneSignal.User.addTags(getOneSignalTags(emailUsuarioAtual, 'web'));
    }

    await solicitarPermissaoOneSignalWeb(OneSignal);
};

export const ativarPushNotifications = async (user) => {
    if (!user?.email) return;

    if (oneSignalNativoDisponivel()) {
        await ativarOneSignalNativo(user);
        await registrarFcmFallbackNativo(user);
        return;
    }

    if (oneSignalWebDisponivel()) {
        await ativarOneSignalWeb(user);
        return;
    }

    if (!ehAndroidNativo()) return;

    await registrarFcmNativo(user);
};

export const desativarPushNotifications = async (email) => {
    if (oneSignalNativoDisponivel()) {
        try {
            if (NativeOneSignal.logout) {
                NativeOneSignal.logout();
            }
        } catch (error) {
            console.warn('Não foi possível encerrar a sessão OneSignal:', error);
        }

        await desregistrarFcmNativo(email);
        emailUsuarioAtual = null;
        return;
    }

    if (oneSignalWebDisponivel()) {
        try {
            const OneSignal = await carregarOneSignalWebSdk();
            if (OneSignal.logout) {
                await OneSignal.logout();
            }
        } catch (error) {
            console.warn('Não foi possível encerrar a sessão OneSignal Web:', error);
        }

        emailUsuarioAtual = null;
        return;
    }

    if (!ehAndroidNativo()) return;

    await desregistrarFcmNativo(email);
    emailUsuarioAtual = null;
};
