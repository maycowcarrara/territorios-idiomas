import {
    arrayUnion,
    doc,
    getDocFromServer,
    runTransaction,
} from 'firebase/firestore';
import {
    buildTerritorioStateMergeSeed,
    buildTerritorioStateSeed,
    getTerritorioBaseRef,
    getTerritorioStateRef,
    TERRITORIO_STATUS
} from './territorioContext';
import {
    buildOutboxAction,
    listOutboxActions,
    OUTBOX_STATUS,
    putOutboxAction,
    updateOutboxAction
} from './offlineOutbox';
import { getTerritorioNotasCollectionRef } from './territorioNotes';
import { enviarEventoNotificacao } from './notificationRelay';
import { isOutboxActionRetryable, TERRITORIO_ACTION_TYPE } from './territorioOfflineModel';
import { normalizeTerritorioNome } from './territorioNome';

let syncInFlight = null;

class SyncConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SyncConflictError';
    }
}

function buildContextoMeta(contextoSistema, contextoIdFallback) {
    return {
        contextoId: contextoSistema?.contextoAtivoId || contextoIdFallback || 'normal',
        contextoTipo: contextoSistema?.contextoAtivoTipo || 'normal',
        contextoTitulo: contextoSistema?.contextoAtivoTitulo || 'Pregação normal'
    };
}

function getActionContextSeed(action) {
    return {
        contextoAtivoId: action.contextoId,
        contextoAtivoTipo: action.contextoTipo,
        contextoAtivoTitulo: action.contextoTitulo
    };
}

function getTerritorioSeedFromAction(action) {
    return buildTerritorioStateSeed({
        contextoId: action.contextoId,
        idTerritorio: action.territorioId,
        nome: action.territorioNome,
        contextoSistema: getActionContextSeed(action)
    });
}

function getTerritorioMergeSeedFromAction(action) {
    return buildTerritorioStateMergeSeed({
        contextoId: action.contextoId,
        idTerritorio: action.territorioId,
        nome: action.territorioNome,
        contextoSistema: getActionContextSeed(action)
    });
}

function getTerritorioSnapshotData(snapshot, action) {
    return snapshot.exists()
        ? snapshot.data()
        : getTerritorioSeedFromAction(action);
}

function ensureSameDesignacao(currentState, action) {
    if (currentState.designadoPara !== action.userEmail || currentState.designacaoId !== action.designacaoId) {
        throw new SyncConflictError('O território mudou de responsável ou de designação antes da sincronização.');
    }
}

function ensureArray(value) {
    return Array.isArray(value) ? [...value] : [];
}

function upsertQuadra(quadrasFeitas, quadraId, marcar) {
    const set = new Set(ensureArray(quadrasFeitas));
    if (marcar) {
        set.add(quadraId);
    } else {
        set.delete(quadraId);
    }
    return [...set];
}

function getActionTimestamp(action) {
    return new Date(action.payload?.timestamp || action.updatedAt || action.createdAt || Date.now());
}

function isLikelyConnectivityError(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code.includes('unavailable')
        || code.includes('failed-precondition')
        || code.includes('network')
        || message.includes('offline')
        || message.includes('network');
}

function buildContextoSufixo(contextoSistema) {
    if (contextoSistema?.campanhaAtiva && contextoSistema?.contextoAtivoTitulo) {
        return ` na campanha "${contextoSistema.contextoAtivoTitulo}"`;
    }

    if (contextoSistema?.contextoAtivoTipo === 'campanha' && contextoSistema?.contextoAtivoTitulo) {
        return ` na campanha "${contextoSistema.contextoAtivoTitulo}"`;
    }

    return '';
}

function buildFinalizacaoPayload({ dadosBanco, responsavelNome, agora }) {
    const historico = buildHistoricoTerritorio({
        dadosBanco,
        responsavelNome,
        agora
    });

    return {
        designadoPara: null,
        designadoNome: null,
        dataDesignacao: null,
        designacaoId: null,
        cicloAtual: null,
        historico: arrayUnion(historico),
        ultimaConclusao: agora,
        quadras_feitas: [],
        status: TERRITORIO_STATUS.FINALIZADO,
        ultimaAlteracao: agora
    };
}

async function enviarNotificacaoFinalizacao({ nome, responsavelNome, contextoSistema }) {
    const texto = `🏁 O Território ${nome} foi finalizado por ${responsavelNome}${buildContextoSufixo(contextoSistema)}.`;

    await enviarEventoNotificacao({
        para: 'ADMINS',
        texto,
        tipo: 'conclusao',
        origem: 'sistema',
        tituloPush: 'Território finalizado'
    });
}

export function createDesignacaoId() {
    return crypto.randomUUID();
}

export function buildNovoCicloTerritorio({ dadosBanco, novoNome, agora, designacaoId }) {
    if (dadosBanco.designadoPara) {
        return {
            dataInicio: dadosBanco.cicloAtual?.dataInicio || agora,
            responsaveis: [...new Set([...(dadosBanco.cicloAtual?.responsaveis || [dadosBanco.designadoNome]), novoNome])],
            designacaoId
        };
    }

    return {
        dataInicio: agora,
        responsaveis: [novoNome],
        designacaoId
    };
}

export function buildHistoricoTerritorio({ dadosBanco, responsavelNome, agora }) {
    const ciclo = dadosBanco.cicloAtual || {
        dataInicio: dadosBanco.dataDesignacao || agora,
        responsaveis: [responsavelNome],
        designacaoId: dadosBanco.designacaoId || null
    };

    return {
        ...ciclo,
        designacaoId: ciclo.designacaoId || dadosBanco.designacaoId || null,
        dataTermino: agora,
        responsaveis: [...new Set([...(ciclo.responsaveis || []), responsavelNome])]
    };
}

export async function enqueueTerritorioAction({
    type,
    territorioId,
    territorioNome,
    contextoSistema,
    userEmail,
    designacaoId,
    payload = {}
}) {
    const nomeNormalizado = normalizeTerritorioNome(territorioNome, `Território ${territorioId}`);
    const contextoMeta = buildContextoMeta(contextoSistema, payload.contextoId);

    return putOutboxAction(buildOutboxAction({
        type,
        territorioId,
        territorioNome: nomeNormalizado,
        userEmail,
        designacaoId,
        payload,
        ...contextoMeta
    }));
}

async function ensureServerStateBeforeSync(action, stateRef) {
    const serverSnapshot = await getDocFromServer(stateRef);
    const currentState = getTerritorioSnapshotData(serverSnapshot, action);
    ensureSameDesignacao(currentState, action);
}

async function syncToggleQuadraAction({ db, action }) {
    const stateRef = getTerritorioStateRef(db, action.territorioId, action.contextoId);
    await ensureServerStateBeforeSync(action, stateRef);

    await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(stateRef);
        const currentState = getTerritorioSnapshotData(currentSnapshot, action);
        ensureSameDesignacao(currentState, action);

        transaction.set(stateRef, {
            ...getTerritorioMergeSeedFromAction(action),
            nome: currentState.nome || action.territorioNome,
            quadras_feitas: upsertQuadra(
                currentState.quadras_feitas,
                action.payload.quadraId,
                Boolean(action.payload.marcar)
            ),
            status: TERRITORIO_STATUS.ABERTO,
            ultimaAlteracao: getActionTimestamp(action)
        }, { merge: true });
    });
}

async function syncFinalizationRequestAction({ db, action }) {
    const stateRef = getTerritorioStateRef(db, action.territorioId, action.contextoId);
    await ensureServerStateBeforeSync(action, stateRef);

    await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(stateRef);
        const currentState = getTerritorioSnapshotData(currentSnapshot, action);
        ensureSameDesignacao(currentState, action);

        transaction.set(stateRef, {
            ...getTerritorioMergeSeedFromAction(action),
            nome: currentState.nome || action.territorioNome,
            status: TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO,
            ultimaAlteracao: getActionTimestamp(action)
        }, { merge: true });
    });
}

async function syncFinalizationConfirmAction({ db, action }) {
    const stateRef = getTerritorioStateRef(db, action.territorioId, action.contextoId);
    await ensureServerStateBeforeSync(action, stateRef);

    const finalizacaoMeta = await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(stateRef);
        const currentState = getTerritorioSnapshotData(currentSnapshot, action);
        ensureSameDesignacao(currentState, action);

        const responsavelNome = currentState.designadoNome || action.payload?.responsavelNome || 'Dirigente';
        const agora = getActionTimestamp(action);

        transaction.set(stateRef, {
            ...getTerritorioMergeSeedFromAction(action),
            nome: currentState.nome || action.territorioNome,
            ...buildFinalizacaoPayload({
                dadosBanco: currentState,
                responsavelNome,
                agora
            })
        }, { merge: true });

        return {
            responsavelNome
        };
    });

    await enviarNotificacaoFinalizacao({
        nome: action.territorioNome,
        responsavelNome: finalizacaoMeta.responsavelNome,
        contextoSistema: getActionContextSeed(action)
    });
}

async function syncAddNoteAction({ db, action }) {
    const stateRef = getTerritorioStateRef(db, action.territorioId, action.contextoId);
    const baseRef = getTerritorioBaseRef(db, action.territorioId);
    const noteRef = doc(getTerritorioNotasCollectionRef(baseRef), action.payload.noteId);

    await ensureServerStateBeforeSync(action, stateRef);

    await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(stateRef);
        const currentState = getTerritorioSnapshotData(currentSnapshot, action);
        ensureSameDesignacao(currentState, action);

        transaction.set(noteRef, {
            quadraId: action.payload.quadraId,
            texto: action.payload.texto,
            autorEmail: action.userEmail,
            autorNome: action.payload.autorNome,
            data: action.payload.data,
            designacaoId: action.designacaoId,
            territorioId: action.territorioId,
            contextoId: action.contextoId
        }, { merge: false });

        transaction.set(baseRef, {
            nome: action.territorioNome,
            ultimaAlteracao: getActionTimestamp(action)
        }, { merge: true });
    });
}

async function syncEditNoteAction({ db, action }) {
    const stateRef = getTerritorioStateRef(db, action.territorioId, action.contextoId);
    const baseRef = getTerritorioBaseRef(db, action.territorioId);
    const noteRef = doc(getTerritorioNotasCollectionRef(baseRef), action.payload.noteId);

    await ensureServerStateBeforeSync(action, stateRef);

    await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(stateRef);
        const currentState = getTerritorioSnapshotData(currentSnapshot, action);
        ensureSameDesignacao(currentState, action);

        const noteSnapshot = await transaction.get(noteRef);
        if (!noteSnapshot.exists()) {
            throw new SyncConflictError('A observação original não existe mais no servidor.');
        }

        transaction.update(noteRef, {
            texto: action.payload.texto,
            editadoEm: action.payload.editadoEm
        });

        transaction.set(baseRef, {
            nome: action.territorioNome,
            ultimaAlteracao: getActionTimestamp(action)
        }, { merge: true });
    });
}

async function syncDeleteNoteAction({ db, action }) {
    const stateRef = getTerritorioStateRef(db, action.territorioId, action.contextoId);
    const baseRef = getTerritorioBaseRef(db, action.territorioId);
    const noteRef = doc(getTerritorioNotasCollectionRef(baseRef), action.payload.noteId);

    await ensureServerStateBeforeSync(action, stateRef);

    await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(stateRef);
        const currentState = getTerritorioSnapshotData(currentSnapshot, action);
        ensureSameDesignacao(currentState, action);

        const noteSnapshot = await transaction.get(noteRef);
        if (noteSnapshot.exists()) {
            transaction.delete(noteRef);
        }

        transaction.set(baseRef, {
            nome: action.territorioNome,
            ultimaAlteracao: getActionTimestamp(action)
        }, { merge: true });
    });
}

async function syncSingleTerritorioAction({ db, action }) {
    switch (action.type) {
    case TERRITORIO_ACTION_TYPE.TOGGLE_QUADRA:
        await syncToggleQuadraAction({ db, action });
        return;
    case TERRITORIO_ACTION_TYPE.FINALIZATION_REQUEST:
        await syncFinalizationRequestAction({ db, action });
        return;
    case TERRITORIO_ACTION_TYPE.FINALIZATION_CONFIRM:
        await syncFinalizationConfirmAction({ db, action });
        return;
    case TERRITORIO_ACTION_TYPE.ADD_NOTE:
        await syncAddNoteAction({ db, action });
        return;
    case TERRITORIO_ACTION_TYPE.EDIT_NOTE:
        await syncEditNoteAction({ db, action });
        return;
    case TERRITORIO_ACTION_TYPE.DELETE_NOTE:
        await syncDeleteNoteAction({ db, action });
        return;
    default:
        throw new Error(`Tipo de ação offline desconhecido: ${action.type}`);
    }
}

async function processTerritorioOutboxInternal({ db, userEmail }) {
    const actions = (await listOutboxActions({ userEmail, includeSynced: false }))
        .filter(isOutboxActionRetryable);

    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    for (const action of actions) {
        await updateOutboxAction(action.id, {
            status: OUTBOX_STATUS.SYNCING,
            errorMessage: null,
            conflictMessage: null
        });

        try {
            await syncSingleTerritorioAction({ db, action });
            await updateOutboxAction(action.id, {
                status: OUTBOX_STATUS.SYNCED
            });
            syncedCount += 1;
        } catch (error) {
            if (error instanceof SyncConflictError) {
                await updateOutboxAction(action.id, {
                    status: OUTBOX_STATUS.CONFLICT,
                    conflictMessage: error.message
                });
                conflictCount += 1;
                continue;
            }

            await updateOutboxAction(action.id, {
                status: OUTBOX_STATUS.FAILED,
                errorMessage: String(error?.message || 'Falha ao sincronizar ação offline.')
            });
            failedCount += 1;

            if (isLikelyConnectivityError(error)) {
                break;
            }
        }
    }

    return {
        syncedCount,
        conflictCount,
        failedCount
    };
}

export function processTerritorioOutbox({ db, userEmail }) {
    if (syncInFlight) {
        return syncInFlight;
    }

    syncInFlight = processTerritorioOutboxInternal({ db, userEmail })
        .finally(() => {
            syncInFlight = null;
        });

    return syncInFlight;
}

export async function finalizarTerritorioDesignado({ salvarEstadoTerritorio, dadosBanco, nome, contextoSistema }) {
    if (!dadosBanco?.designadoPara) {
        return { ok: false, motivo: 'sem_designacao' };
    }

    const nomeNormalizado = normalizeTerritorioNome(nome);
    const responsavelNome = dadosBanco.designadoNome || 'Dirigente';
    const agora = new Date();
    const contextoSufixo = buildContextoSufixo(contextoSistema);

    await salvarEstadoTerritorio(buildFinalizacaoPayload({
        dadosBanco,
        responsavelNome,
        agora
    }));

    await enviarNotificacaoFinalizacao({
        nome: nomeNormalizado,
        responsavelNome,
        contextoSistema
    });

    return {
        ok: true,
        responsavelNome,
        contextoSufixo
    };
}
