import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { getDefaultSistemaConfig, normalizeSistemaConfig, SISTEMA_CONFIG_PATH } from './sistema';

export function useSistema() {
    const [state, setState] = useState({
        config: getDefaultSistemaConfig(),
        loading: true
    });

    useEffect(() => {
        const sistemaRef = doc(db, ...SISTEMA_CONFIG_PATH);
        const unsubscribe = onSnapshot(
            sistemaRef,
            (snapshot) => {
                setState({
                    config: normalizeSistemaConfig(snapshot.exists() ? snapshot.data() : null),
                    loading: false
                });
            },
            (error) => {
                console.error('Erro ao carregar configuração do sistema:', error);
                setState({
                    config: getDefaultSistemaConfig(),
                    loading: false
                });
            }
        );

        return () => unsubscribe();
    }, []);

    return state;
}
