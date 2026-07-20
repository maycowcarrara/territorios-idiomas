export const TERRITORIO_ACTION_TYPE = Object.freeze({
    TOGGLE_QUADRA: 'toggle_quadra',
    FINALIZATION_REQUEST: 'finalization_request',
    FINALIZATION_CONFIRM: 'finalization_confirm',
    ADD_NOTE: 'add_note',
    EDIT_NOTE: 'edit_note',
    DELETE_NOTE: 'delete_note'
});

const ACTIVE_SYNC_STATUSES = new Set([
    'pending',
    'syncing',
    'failed'
]);

export function isOutboxActionActive(action) {
    return ACTIVE_SYNC_STATUSES.has(action.status);
}

export function isOutboxActionRetryable(action) {
    return action.status === 'pending'
        || action.status === 'failed'
        || action.status === 'syncing';
}

function sortActions(actions) {
    return [...actions].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
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

function upsertNotaById(notas, novaNota) {
    const lista = Array.isArray(notas) ? [...notas] : [];
    const index = lista.findIndex((nota) => nota.id === novaNota.id);

    if (index === -1) {
        lista.push(novaNota);
        return lista;
    }

    lista[index] = {
        ...lista[index],
        ...novaNota
    };

    return lista;
}

export function reduceTerritorioComOutbox(dadosBanco, actions) {
    return sortActions(actions)
        .filter(isOutboxActionActive)
        .reduce((current, action) => {
            switch (action.type) {
            case TERRITORIO_ACTION_TYPE.TOGGLE_QUADRA:
                return {
                    ...current,
                    quadras_feitas: upsertQuadra(
                        current.quadras_feitas,
                        action.payload.quadraId,
                        Boolean(action.payload.marcar)
                    ),
                    status: 'aberto',
                    ultimaAlteracao: action.payload.timestamp || action.updatedAt
                };
            case TERRITORIO_ACTION_TYPE.FINALIZATION_REQUEST:
                return {
                    ...current,
                    status: 'aguardando_finalizacao',
                    ultimaAlteracao: action.payload.timestamp || action.updatedAt
                };
            case TERRITORIO_ACTION_TYPE.FINALIZATION_CONFIRM:
                return {
                    ...current,
                    status: 'finalizado',
                    ultimaAlteracao: action.payload.timestamp || action.updatedAt
                };
            default:
                return current;
            }
        }, {
            ...dadosBanco,
            quadras_feitas: ensureArray(dadosBanco?.quadras_feitas)
        });
}

export function reduceNotasComOutbox(notasPorQuadra, actions, userEmail) {
    const nextState = Object.entries(notasPorQuadra || {}).reduce((acc, [quadraId, notas]) => {
        acc[quadraId] = Array.isArray(notas) ? [...notas] : [];
        return acc;
    }, {});

    sortActions(actions)
        .filter(isOutboxActionActive)
        .forEach((action) => {
            const quadraId = action.payload?.quadraId;
            if (!quadraId) return;

            if (!nextState[quadraId]) {
                nextState[quadraId] = [];
            }

            if (action.type === TERRITORIO_ACTION_TYPE.ADD_NOTE) {
                nextState[quadraId] = upsertNotaById(nextState[quadraId], {
                    id: action.payload.noteId,
                    quadraId,
                    texto: action.payload.texto,
                    autorEmail: userEmail,
                    autorNome: action.payload.autorNome,
                    data: action.payload.data,
                    designacaoId: action.designacaoId,
                    source: 'outbox'
                });
            }

            if (action.type === TERRITORIO_ACTION_TYPE.EDIT_NOTE) {
                nextState[quadraId] = nextState[quadraId].map((nota) => (
                    nota.id === action.payload.noteId
                        ? {
                            ...nota,
                            texto: action.payload.texto,
                            editadoEm: action.payload.editadoEm,
                            source: nota.source || 'outbox'
                        }
                        : nota
                ));
            }

            if (action.type === TERRITORIO_ACTION_TYPE.DELETE_NOTE) {
                nextState[quadraId] = nextState[quadraId].filter((nota) => nota.id !== action.payload.noteId);
            }
        });

    return nextState;
}

export function describeOutboxConflict(action) {
    const territorio = action.territorioNome || `Território ${action.territorioId}`;

    switch (action.type) {
    case TERRITORIO_ACTION_TYPE.TOGGLE_QUADRA:
        return `${territorio}: a quadra ${action.payload?.quadraId} não foi sincronizada porque a designação mudou.`;
    case TERRITORIO_ACTION_TYPE.FINALIZATION_REQUEST:
        return `${territorio}: a solicitação de finalização não foi enviada porque a designação mudou.`;
    case TERRITORIO_ACTION_TYPE.FINALIZATION_CONFIRM:
        return `${territorio}: a finalização não foi concluída porque a designação mudou.`;
    case TERRITORIO_ACTION_TYPE.ADD_NOTE:
    case TERRITORIO_ACTION_TYPE.EDIT_NOTE:
    case TERRITORIO_ACTION_TYPE.DELETE_NOTE:
        return `${territorio}: uma observação não foi sincronizada porque a designação mudou.`;
    default:
        return `${territorio}: uma alteração não foi sincronizada porque a designação mudou.`;
    }
}
