import { useEffect, useState } from 'react';
import { getOutboxSummary, listOutboxActions, pruneSyncedOutboxActions, subscribeOutbox } from './offlineOutbox';
import { processTerritorioOutbox } from './territorioActions';
import { useOnlineStatus } from './useOnlineStatus';

export function useTerritorioOutbox(userEmail) {
    const [actions, setActions] = useState([]);
    const [summary, setSummary] = useState({
        pendingCount: 0,
        syncingCount: 0,
        conflictCount: 0,
        failedCount: 0
    });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const [nextActions, nextSummary] = await Promise.all([
                    listOutboxActions({ userEmail, includeSynced: false }),
                    getOutboxSummary(userEmail)
                ]);

                if (cancelled) return;
                setActions(nextActions);
                setSummary(nextSummary);
            } catch (error) {
                console.error('Erro ao carregar estado da outbox local:', error);
                if (cancelled) return;
                setActions([]);
                setSummary({
                    pendingCount: 0,
                    syncingCount: 0,
                    conflictCount: 0,
                    failedCount: 0
                });
            }
        };

        void load();
        const unsubscribe = subscribeOutbox(load);

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [userEmail]);

    return { actions, summary };
}

export function useTerritorioSync({ db, userEmail, enabled = true }) {
    const isOnline = useOnlineStatus();

    useEffect(() => {
        if (!enabled || !userEmail || !isOnline) return undefined;

        void pruneSyncedOutboxActions().catch((error) => {
            console.error('Erro ao limpar acoes sincronizadas da outbox:', error);
        });
        void processTerritorioOutbox({ db, userEmail }).catch((error) => {
            console.error('Erro ao sincronizar a outbox de territorio:', error);
        });

        const handleOnline = () => {
            void processTerritorioOutbox({ db, userEmail }).catch((error) => {
                console.error('Erro ao sincronizar a outbox de territorio:', error);
            });
        };

        const unsubscribe = subscribeOutbox(() => {
            if (navigator.onLine) {
                return processTerritorioOutbox({ db, userEmail }).catch((error) => {
                    console.error('Erro ao sincronizar a outbox de territorio:', error);
                });
            }
            return Promise.resolve();
        });

        window.addEventListener('online', handleOnline);

        return () => {
            unsubscribe();
            window.removeEventListener('online', handleOnline);
        };
    }, [db, enabled, isOnline, userEmail]);

    return isOnline;
}
