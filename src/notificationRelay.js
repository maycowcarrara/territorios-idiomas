import { addDoc, collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

const relayUrl = import.meta.env.VITE_NOTIFICATIONS_RELAY_URL || '';
const ADMIN_NOTIFICATION_BATCH_SIZE = 400;

export const relayDisponivel = () => Boolean(relayUrl);

const getRelayBaseUrl = () => relayUrl.replace(/\/$/, '');

const isPermissionDeniedError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code.includes('permission-denied') || message.includes('permission-denied');
};

const listarAdmins = async () => {
    const snapshot = await getDocs(query(collection(db, 'usuarios'), where('role', '==', 'admin')));
    return snapshot.docs.map((docSnapshot) => docSnapshot.id).filter(Boolean);
};

const gravarNotificacoesParaAdmins = async ({ texto, tipo, origem }) => {
    const admins = await listarAdmins();
    if (!admins.length) {
        return 0;
    }

    const agora = new Date();
    for (let index = 0; index < admins.length; index += ADMIN_NOTIFICATION_BATCH_SIZE) {
        const batch = writeBatch(db);
        admins.slice(index, index + ADMIN_NOTIFICATION_BATCH_SIZE).forEach((adminEmail) => {
            batch.set(doc(collection(db, 'notificacoes')), {
                para: adminEmail,
                texto,
                data: agora,
                lida: false,
                tipo,
                origem
            });
        });
        await batch.commit();
    }

    return admins.length;
};

const postRelay = async (payload) => {
    if (!relayUrl) {
        throw new Error('Relay de notificações não configurado.');
    }

    const user = auth.currentUser;
    if (!user) {
        throw new Error('Sessão expirada. Entre novamente para continuar.');
    }

    const idToken = await user.getIdToken();

    const response = await fetch(`${getRelayBaseUrl()}/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            idToken,
            ...payload
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || 'Falha ao enviar notificação pelo relay.');
    }

    return data;
};

export const enviarComunicadoPeloRelay = async ({ destino, mensagem }) =>
    postRelay({
        action: 'broadcast',
        destino,
        mensagem
    });

export const enviarEventoNotificacaoPeloRelay = async ({
    para,
    texto,
    tipo = 'sistema',
    origem = 'sistema',
    tituloPush = 'Territórios'
}) =>
    postRelay({
        action: 'notify',
        notificacao: {
            para,
            texto,
            tipo,
            origem,
            tituloPush
        }
    });

export const enviarEventoNotificacao = async ({
    para,
    texto,
    tipo = 'sistema',
    origem = 'sistema',
    tituloPush = 'Territórios'
}) => {
    if (relayDisponivel()) {
        try {
            return await enviarEventoNotificacaoPeloRelay({
                para,
                texto,
                tipo,
                origem,
                tituloPush
            });
        } catch (error) {
            console.warn('Relay de notificações indisponível. Tentando fallback no Firestore.', error);
        }
    }

    if (para === 'ADMINS') {
        try {
            const destinatarios = await gravarNotificacoesParaAdmins({
                texto,
                tipo,
                origem
            });

            return {
                ok: true,
                action: 'notify',
                channel: 'firestore-fallback',
                destinatarios
            };
        } catch (error) {
            if (!isPermissionDeniedError(error)) {
                throw error;
            }

            console.warn('Sem permissão para listar admins no fallback local. Usando notificação legada ADMINS.', error);
            await addDoc(collection(db, 'notificacoes'), {
                para: 'ADMINS',
                texto,
                data: new Date(),
                lida: false,
                tipo,
                origem
            });

            return {
                ok: true,
                action: 'notify',
                channel: 'firestore-fallback-legacy-admins',
                destinatarios: 1
            };
        }
    }

    await addDoc(collection(db, 'notificacoes'), {
        para,
        texto,
        data: new Date(),
        lida: false,
        tipo,
        origem
    });

    return {
        ok: true,
        action: 'notify',
        channel: 'firestore-fallback'
    };
};
