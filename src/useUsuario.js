import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { enviarEventoNotificacao } from './notificationRelay';

const ESTADO_BASE = {
    email: null,
    isAdmin: false,
    autorizado: false,
    loading: false,
    role: null
};

export function useUsuario(user) {
    const emailFormatado = user?.email?.toLowerCase() || null;
    const [estado, setEstado] = useState(ESTADO_BASE);

    useEffect(() => {
        if (!emailFormatado) {
            return;
        }

        const docRef = doc(db, "usuarios", emailFormatado);

        const unsub = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                const dados = docSnap.data();
                const podeEntrar = dados.role === 'admin' || dados.role === 'comum';

                setEstado({
                    email: emailFormatado,
                    autorizado: podeEntrar,
                    isAdmin: dados.role === 'admin',
                    loading: false,
                    role: dados.role
                });
            } else {
                try {
                    await setDoc(docRef, {
                        role: 'aguardando',
                        nome: user.displayName || 'Sem nome',
                        emailOriginal: user.email,
                        whatsapp: '',
                        criadoEm: new Date()
                    });

                    const texto = `Novo cadastro pendente: ${user.displayName || user.email}`;
                    await enviarEventoNotificacao({
                        para: 'ADMINS',
                        texto,
                        tipo: 'cadastro',
                        origem: 'sistema',
                        tituloPush: 'Novo cadastro pendente'
                    });

                } catch (err) {
                    console.error("Erro ao criar solicitação:", err);
                }

                setEstado({
                    email: emailFormatado,
                    autorizado: false,
                    isAdmin: false,
                    loading: false,
                    role: 'aguardando'
                });
            }
        });

        return () => unsub();
    }, [emailFormatado, user]);

    if (!emailFormatado) {
        return ESTADO_BASE;
    }

    if (estado.email !== emailFormatado) {
        return {
            email: emailFormatado,
            isAdmin: false,
            autorizado: false,
            loading: true,
            role: null
        };
    }

    return estado;
}
