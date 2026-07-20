const OUTBOX_DB_NAME = 'territorios-offline-outbox';
const OUTBOX_DB_VERSION = 1;
const OUTBOX_STORE = 'actions';
const OUTBOX_EVENT = 'territorios-offline-outbox-changed';

export const OUTBOX_STATUS = Object.freeze({
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    CONFLICT: 'conflict',
    FAILED: 'failed'
});

function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined';
}

function openOutboxDb() {
    if (!canUseIndexedDb()) {
        return Promise.reject(new Error('IndexedDB indisponivel neste ambiente.'));
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OUTBOX_DB_NAME, OUTBOX_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
                const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('userEmail', 'userEmail', { unique: false });
                store.createIndex('territoryKey', 'territoryKey', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB.'));
    });
}

function withStore(mode, callback) {
    return openOutboxDb().then((db) => new Promise((resolve, reject) => {
        const transaction = db.transaction(OUTBOX_STORE, mode);
        const store = transaction.objectStore(OUTBOX_STORE);

        let settled = false;

        const finishResolve = (value) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };

        const finishReject = (error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        };

        transaction.oncomplete = () => finishResolve();
        transaction.onerror = () => finishReject(transaction.error || new Error('Falha na transacao do IndexedDB.'));
        transaction.onabort = () => finishReject(transaction.error || new Error('Transacao abortada no IndexedDB.'));

        callback(store, finishResolve, finishReject);
    }));
}

function emitOutboxChanged() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

function sortByCreation(actions) {
    return [...actions].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export function buildOutboxAction(partial) {
    const nowIso = new Date().toISOString();
    return {
        id: partial.id || crypto.randomUUID(),
        status: partial.status || OUTBOX_STATUS.PENDING,
        createdAt: partial.createdAt || nowIso,
        updatedAt: partial.updatedAt || nowIso,
        territoryKey: `${partial.contextoId || 'normal'}::${partial.territorioId}`,
        ...partial
    };
}

export async function putOutboxAction(action) {
    const nextAction = buildOutboxAction(action);

    await withStore('readwrite', (store, resolve, reject) => {
        const request = store.put(nextAction);
        request.onsuccess = () => resolve(nextAction);
        request.onerror = () => reject(request.error || new Error('Falha ao salvar acao offline.'));
    });

    emitOutboxChanged();
    return nextAction;
}

export async function updateOutboxAction(actionId, patch) {
    const existing = await getOutboxAction(actionId);
    if (!existing) return null;

    const updated = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString()
    };

    await putOutboxAction(updated);
    return updated;
}

export async function getOutboxAction(actionId) {
    return withStore('readonly', (store, resolve, reject) => {
        const request = store.get(actionId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Falha ao carregar acao offline.'));
    });
}

export async function listOutboxActions({ userEmail, includeSynced = false } = {}) {
    const allActions = await withStore('readonly', (store, resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Falha ao listar acoes offline.'));
    });

    return sortByCreation(
        allActions.filter((action) => {
            if (userEmail && action.userEmail !== userEmail) return false;
            if (!includeSynced && action.status === OUTBOX_STATUS.SYNCED) return false;
            return true;
        })
    );
}

export async function getOutboxSummary(userEmail) {
    const actions = await listOutboxActions({ userEmail, includeSynced: false });
    const pendingCount = actions.filter((action) => action.status === OUTBOX_STATUS.PENDING).length;
    const syncingCount = actions.filter((action) => action.status === OUTBOX_STATUS.SYNCING).length;
    const conflictCount = actions.filter((action) => action.status === OUTBOX_STATUS.CONFLICT).length;
    const failedCount = actions.filter((action) => action.status === OUTBOX_STATUS.FAILED).length;

    return {
        pendingCount,
        syncingCount,
        conflictCount,
        failedCount
    };
}

export async function pruneSyncedOutboxActions({ olderThanMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
    const cutoff = Date.now() - olderThanMs;
    const actions = await listOutboxActions({ includeSynced: true });
    const staleIds = actions
        .filter((action) => action.status === OUTBOX_STATUS.SYNCED)
        .filter((action) => {
            const updated = Date.parse(action.updatedAt || action.createdAt || 0);
            return Number.isFinite(updated) && updated < cutoff;
        })
        .map((action) => action.id);

    if (!staleIds.length) return 0;

    await withStore('readwrite', (store, resolve, reject) => {
        let processed = 0;
        staleIds.forEach((id) => {
            const request = store.delete(id);
            request.onerror = () => reject(request.error || new Error('Falha ao limpar acoes sincronizadas.'));
            request.onsuccess = () => {
                processed += 1;
                if (processed === staleIds.length) {
                    resolve(processed);
                }
            };
        });
    });

    emitOutboxChanged();
    return staleIds.length;
}

export function subscribeOutbox(listener) {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const wrapped = () => {
        void listener();
    };

    window.addEventListener(OUTBOX_EVENT, wrapped);
    return () => window.removeEventListener(OUTBOX_EVENT, wrapped);
}
