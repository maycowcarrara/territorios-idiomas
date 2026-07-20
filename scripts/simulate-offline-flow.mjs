import assert from 'node:assert/strict';
import {
    describeOutboxConflict,
    isOutboxActionRetryable,
    reduceNotasComOutbox,
    reduceTerritorioComOutbox,
    TERRITORIO_ACTION_TYPE
} from '../src/territorioOfflineModel.js';

const OUTBOX_STATUS = {
    PENDING: 'pending',
    SYNCING: 'syncing',
    CONFLICT: 'conflict'
};

const TERRITORIO_STATUS = {
    ABERTO: 'aberto',
    AGUARDANDO_FINALIZACAO: 'aguardando_finalizacao'
};

const territoryState = reduceTerritorioComOutbox({
    quadras_feitas: ['1'],
    status: TERRITORIO_STATUS.ABERTO
}, [
    {
        id: 'a1',
        status: OUTBOX_STATUS.PENDING,
        type: TERRITORIO_ACTION_TYPE.TOGGLE_QUADRA,
        createdAt: '2026-05-18T12:00:00.000Z',
        updatedAt: '2026-05-18T12:00:00.000Z',
        payload: { quadraId: '2', marcar: true, timestamp: '2026-05-18T12:00:00.000Z' }
    },
    {
        id: 'a2',
        status: OUTBOX_STATUS.PENDING,
        type: TERRITORIO_ACTION_TYPE.FINALIZATION_REQUEST,
        createdAt: '2026-05-18T12:01:00.000Z',
        updatedAt: '2026-05-18T12:01:00.000Z',
        payload: { timestamp: '2026-05-18T12:01:00.000Z' }
    }
]);

assert.deepEqual(territoryState.quadras_feitas.sort(), ['1', '2']);
assert.equal(territoryState.status, TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO);

const notesState = reduceNotasComOutbox({
    Q1: [
        {
            id: 'note-1',
            quadraId: 'Q1',
            texto: 'Portao azul',
            autorEmail: 'irmao@teste.com',
            autorNome: 'Irmão',
            data: '2026-05-18T12:00:00.000Z',
            source: 'doc'
        }
    ]
}, [
    {
        id: 'b1',
        status: OUTBOX_STATUS.SYNCING,
        type: TERRITORIO_ACTION_TYPE.ADD_NOTE,
        territorioId: 12,
        territorioNome: 'T-12',
        designacaoId: 'd-1',
        createdAt: '2026-05-18T12:00:01.000Z',
        updatedAt: '2026-05-18T12:00:02.000Z',
        payload: {
            quadraId: 'Q1',
            noteId: 'note-1',
            texto: 'Portao azul',
            autorNome: 'Irmão',
            data: '2026-05-18T12:00:00.000Z'
        }
    }
], 'irmao@teste.com');

assert.equal(notesState.Q1.length, 1);
assert.equal(notesState.Q1[0].id, 'note-1');

assert.equal(isOutboxActionRetryable({ status: OUTBOX_STATUS.SYNCING }), true);
assert.equal(isOutboxActionRetryable({ status: OUTBOX_STATUS.CONFLICT }), false);

const conflictText = describeOutboxConflict({
    type: TERRITORIO_ACTION_TYPE.TOGGLE_QUADRA,
    territorioId: 12,
    territorioNome: 'T-12',
    payload: { quadraId: 'Q7' }
});

assert.match(conflictText, /Q7/);
assert.match(conflictText, /designação mudou/i);

console.log('Offline simulation passed.');
