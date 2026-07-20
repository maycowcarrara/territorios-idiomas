import { collection } from 'firebase/firestore';

export function getTerritorioNotasCollectionRef(baseRef) {
    return collection(baseRef, 'notas');
}

export function buildLegacyNoteId(quadraId, index) {
    return `legacy:${encodeURIComponent(String(quadraId))}:${index}`;
}

export function isLegacyNoteId(noteId) {
    return String(noteId || '').startsWith('legacy:');
}

export function normalizeLegacyNotasMap(legacyNotas = {}) {
    return Object.entries(legacyNotas || {}).reduce((acc, [quadraId, value]) => {
        if (typeof value === 'string' && value.trim()) {
            acc[quadraId] = [{
                id: buildLegacyNoteId(quadraId, 0),
                quadraId,
                texto: value,
                autorNome: 'Sistema (Antigo)',
                autorEmail: 'sistema',
                data: null,
                source: 'legacy'
            }];
            return acc;
        }

        if (Array.isArray(value) && value.length > 0) {
            acc[quadraId] = value.map((nota, index) => ({
                ...nota,
                id: nota.id || buildLegacyNoteId(quadraId, index),
                quadraId,
                source: 'legacy'
            }));
        }

        return acc;
    }, {});
}

export function groupNoteDocsByQuadra(snapshotDocs = []) {
    const grouped = {};

    snapshotDocs.forEach((noteDoc) => {
        const data = noteDoc.data();
        const quadraId = data.quadraId;
        if (!quadraId) return;

        if (!grouped[quadraId]) {
            grouped[quadraId] = [];
        }

        grouped[quadraId].push({
            id: noteDoc.id,
            ...data,
            source: 'doc'
        });
    });

    Object.values(grouped).forEach((notes) => {
        notes.sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
    });

    return grouped;
}

export function mergeTerritorioNotas({ legacyNotas = {}, noteDocs = {} }) {
    const merged = { ...normalizeLegacyNotasMap(legacyNotas) };

    Object.entries(noteDocs).forEach(([quadraId, notes]) => {
        merged[quadraId] = [...(merged[quadraId] || []), ...notes];
    });

    return merged;
}
