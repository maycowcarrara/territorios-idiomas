function sanitizeTerritorioNome(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitTerritorioNome(value) {
    const nome = sanitizeTerritorioNome(value);
    if (!nome) {
        return { codigo: '', descricao: '' };
    }

    let match = nome.match(/^([A-Za-z]+\d+[A-Za-z]?)\s*-\s*(.+)$/u);
    if (match) {
        return {
            codigo: sanitizeTerritorioNome(match[1]),
            descricao: sanitizeTerritorioNome(match[2])
        };
    }

    match = nome.match(/^([A-Za-z]+\d+[A-Za-z]?)\s+(.+)$/u);
    if (match) {
        return {
            codigo: sanitizeTerritorioNome(match[1]),
            descricao: sanitizeTerritorioNome(match[2])
        };
    }

    return {
        codigo: '',
        descricao: nome
    };
}

export function normalizeTerritorioNome(value, fallback = '') {
    const nome = sanitizeTerritorioNome(value);
    if (!nome) {
        return sanitizeTerritorioNome(fallback);
    }

    const { codigo, descricao } = splitTerritorioNome(nome);
    if (codigo && descricao) {
        return `${codigo} - ${descricao}`;
    }

    return nome;
}

export function extractTerritorioCodigo(value, fallback = '') {
    const nome = sanitizeTerritorioNome(value);
    if (!nome) {
        return sanitizeTerritorioNome(fallback);
    }

    const { codigo } = splitTerritorioNome(nome);
    return codigo || sanitizeTerritorioNome(fallback) || nome;
}
