import {
    arrayUnion,
    collection,
    doc,
    runTransaction,
    setDoc
} from 'firebase/firestore';

export const ENDERECOS_COLLECTION = 'enderecos';
export const GRUPOS_ENDERECOS_COLLECTION = 'grupos_enderecos';
export const CONTADORES_COLLECTION = 'contadores';
export const CODIGOS_COUNTER_DOC = 'codigos';

export const ENDERECO_STATUS = Object.freeze({
    ATIVO: 'ativo',
    ARQUIVADO: 'arquivado'
});

export const ENDERECO_ORIGEM = Object.freeze({
    MANUAL: 'manual',
    JSON: 'json',
    IMPORTACAO: 'importacao'
});

export const GRUPO_ENDERECO_STATUS = Object.freeze({
    ATIVO: 'ativo',
    ARQUIVADO: 'arquivado',
    FINALIZADO: 'finalizado'
});

const ENDERECO_CODE_WIDTH = 4;
const GRUPO_ENDERECO_CODE_WIDTH = 3;

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}

export function formatEnderecoCodigo(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `E-${String(safeSequence).padStart(ENDERECO_CODE_WIDTH, '0')}`;
}

export function getEnderecoDocIdFromSequence(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `e_${String(safeSequence).padStart(ENDERECO_CODE_WIDTH, '0')}`;
}

export function formatGrupoEnderecoCodigo(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `T-${String(safeSequence).padStart(GRUPO_ENDERECO_CODE_WIDTH, '0')}`;
}

export function getGrupoEnderecoDocIdFromSequence(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `g_${String(safeSequence).padStart(GRUPO_ENDERECO_CODE_WIDTH, '0')}`;
}

export function getEnderecosCollectionRef(db) {
    return collection(db, ENDERECOS_COLLECTION);
}

export function getGruposEnderecoCollectionRef(db) {
    return collection(db, GRUPOS_ENDERECOS_COLLECTION);
}

export function getEnderecoRef(db, enderecoId) {
    return doc(db, ENDERECOS_COLLECTION, enderecoId);
}

export function getGrupoEnderecoRef(db, grupoId) {
    return doc(db, GRUPOS_ENDERECOS_COLLECTION, grupoId);
}

export function getCodigosCounterRef(db) {
    return doc(db, CONTADORES_COLLECTION, CODIGOS_COUNTER_DOC);
}

export function normalizeEnderecoFields(input = {}) {
    return {
        lat: toFiniteNumber(input.lat),
        lng: toFiniteNumber(input.lng),
        endereco: normalizeText(input.endereco, 220),
        quantidadeEstrangeiros: Math.max(0, Math.min(99, Math.trunc(toFiniteNumber(input.quantidadeEstrangeiros)))),
        observacao: normalizeText(input.observacao, 2000)
    };
}

function buildActorEmail(user) {
    return String(user?.email || '').toLowerCase();
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeGrupoNome(value, fallback) {
    return normalizeText(value, 120) || fallback;
}

function ensureArray(value) {
    return Array.isArray(value) ? [...value] : [];
}

function createDesignacaoId() {
    return crypto.randomUUID();
}

function buildHistoricoGrupoEndereco({ grupo, responsavelNome, agora }) {
    const ciclo = grupo.cicloAtual || {
        dataInicio: grupo.dataDesignacao || agora,
        responsaveis: [responsavelNome],
        designacaoId: grupo.designacaoId || null
    };

    return {
        ...ciclo,
        designacaoId: ciclo.designacaoId || grupo.designacaoId || null,
        dataTermino: agora,
        responsaveis: [...new Set([...(ciclo.responsaveis || []), responsavelNome])]
    };
}

export function getGrupoEnderecoProgresso(grupo) {
    const totalSeguro = Math.max(Number(grupo?.totalEnderecos) || 0, 0);
    const visitadosReais = ensureArray(grupo?.enderecos_visitados).length;
    const visitadosExibicao = Math.min(visitadosReais, totalSeguro || visitadosReais);
    const percentualExibicao = totalSeguro > 0
        ? Math.round((visitadosExibicao / totalSeguro) * 100)
        : 0;

    return {
        statusSalvo: grupo?.status || GRUPO_ENDERECO_STATUS.ATIVO,
        totalEnderecos: totalSeguro,
        visitadosReais,
        visitadosExibicao,
        faltantes: Math.max(totalSeguro - visitadosExibicao, 0),
        percentualExibicao,
        completo: totalSeguro > 0 && visitadosReais >= totalSeguro,
        isFinalizado: grupo?.status === GRUPO_ENDERECO_STATUS.FINALIZADO,
        isArquivado: grupo?.status === GRUPO_ENDERECO_STATUS.ARQUIVADO
    };
}

export function calculateGrupoEnderecoStats(enderecos = []) {
    const enderecosValidos = enderecos.filter((endereco) => (
        endereco &&
        Number.isFinite(Number(endereco.lat)) &&
        Number.isFinite(Number(endereco.lng)) &&
        endereco.status !== ENDERECO_STATUS.ARQUIVADO
    ));

    if (!enderecosValidos.length) {
        return {
            totalEnderecos: 0,
            totalEstrangeiros: 0,
            centro: null,
            bounds: null
        };
    }

    let minLat = 90;
    let minLng = 180;
    let maxLat = -90;
    let maxLng = -180;
    let somaLat = 0;
    let somaLng = 0;
    let totalEstrangeiros = 0;

    enderecosValidos.forEach((endereco) => {
        const lat = Number(endereco.lat);
        const lng = Number(endereco.lng);
        minLat = Math.min(minLat, lat);
        minLng = Math.min(minLng, lng);
        maxLat = Math.max(maxLat, lat);
        maxLng = Math.max(maxLng, lng);
        somaLat += lat;
        somaLng += lng;
        totalEstrangeiros += Math.max(0, Math.trunc(Number(endereco.quantidadeEstrangeiros) || 0));
    });

    return {
        totalEnderecos: enderecosValidos.length,
        totalEstrangeiros,
        centro: {
            lat: somaLat / enderecosValidos.length,
            lng: somaLng / enderecosValidos.length
        },
        bounds: {
            minLat,
            minLng,
            maxLat,
            maxLng
        }
    };
}

export async function createEnderecoManual(db, { user, ...input }) {
    const fields = normalizeEnderecoFields(input);
    const actorEmail = buildActorEmail(user);
    const agora = new Date();
    const counterRef = getCodigosCounterRef(db);

    return runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterRef);
        const currentCounter = counterSnapshot.exists()
            ? Number.parseInt(counterSnapshot.data().proximoEndereco, 10)
            : 1;
        const sequence = Number.isFinite(currentCounter) && currentCounter > 0 ? currentCounter : 1;
        const codigo = formatEnderecoCodigo(sequence);
        const enderecoId = getEnderecoDocIdFromSequence(sequence);
        const enderecoRef = getEnderecoRef(db, enderecoId);

        transaction.set(counterRef, {
            proximoEndereco: sequence + 1,
            atualizadoEm: agora
        }, { merge: true });

        transaction.set(enderecoRef, {
            codigo,
            status: ENDERECO_STATUS.ATIVO,
            grupoId: null,
            grupoCodigo: null,
            ...fields,
            geohash: null,
            origem: ENDERECO_ORIGEM.MANUAL,
            importacaoId: null,
            criadoEm: agora,
            criadoPor: actorEmail,
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: null,
            arquivadoPor: null
        });

        return {
            id: enderecoId,
            codigo
        };
    });
}

export async function updateEnderecoBasico(db, enderecoId, input, user) {
    const fields = normalizeEnderecoFields(input);
    const agora = new Date();
    const actorEmail = buildActorEmail(user);

    await runTransaction(db, async (transaction) => {
        const enderecoRef = getEnderecoRef(db, enderecoId);
        const enderecoSnapshot = await transaction.get(enderecoRef);

        if (!enderecoSnapshot.exists()) {
            throw new Error('Endereço não encontrado.');
        }

        const enderecoAtual = {
            id: enderecoSnapshot.id,
            ...enderecoSnapshot.data()
        };
        const enderecoAtualizado = {
            ...enderecoAtual,
            ...fields
        };

        if (enderecoAtual.grupoId) {
            const grupoRef = getGrupoEnderecoRef(db, enderecoAtual.grupoId);
            const grupoSnapshot = await transaction.get(grupoRef);

            if (grupoSnapshot.exists()) {
                const grupo = grupoSnapshot.data();
                const enderecoIds = grupo.enderecoIds || [];
                const grupoEnderecoSnapshots = await Promise.all(enderecoIds.map((id) => (
                    id === enderecoId ? Promise.resolve(null) : transaction.get(getEnderecoRef(db, id))
                )));
                const enderecosGrupo = grupoEnderecoSnapshots
                    .map((snapshot) => snapshot && snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
                    .filter(Boolean);
                enderecosGrupo.push(enderecoAtualizado);

                transaction.set(grupoRef, {
                    ...calculateGrupoEnderecoStats(enderecosGrupo),
                    ultimaAlteracao: agora,
                    atualizadoEm: agora,
                    atualizadoPor: actorEmail
                }, { merge: true });
            }
        }

        transaction.set(enderecoRef, {
            endereco: fields.endereco,
            quantidadeEstrangeiros: fields.quantidadeEstrangeiros,
            observacao: fields.observacao,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });
    });
}

export async function setEnderecoArquivado(db, enderecoId, arquivar, user) {
    const agora = new Date();
    const actorEmail = buildActorEmail(user);

    await runTransaction(db, async (transaction) => {
        const enderecoRef = getEnderecoRef(db, enderecoId);
        const enderecoSnapshot = await transaction.get(enderecoRef);

        if (!enderecoSnapshot.exists()) {
            throw new Error('Endereço não encontrado.');
        }

        const enderecoAtual = {
            id: enderecoSnapshot.id,
            ...enderecoSnapshot.data()
        };
        const enderecoAtualizado = {
            ...enderecoAtual,
            status: arquivar ? ENDERECO_STATUS.ARQUIVADO : ENDERECO_STATUS.ATIVO
        };

        if (enderecoAtual.grupoId) {
            const grupoRef = getGrupoEnderecoRef(db, enderecoAtual.grupoId);
            const grupoSnapshot = await transaction.get(grupoRef);

            if (grupoSnapshot.exists()) {
                const grupo = grupoSnapshot.data();
                const enderecoIds = grupo.enderecoIds || [];
                const grupoEnderecoSnapshots = await Promise.all(enderecoIds.map((id) => (
                    id === enderecoId ? Promise.resolve(null) : transaction.get(getEnderecoRef(db, id))
                )));
                const enderecosGrupo = grupoEnderecoSnapshots
                    .map((snapshot) => snapshot && snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
                    .filter(Boolean);
                enderecosGrupo.push(enderecoAtualizado);

                const grupoUpdates = {
                    ...calculateGrupoEnderecoStats(enderecosGrupo),
                    ultimaAlteracao: agora,
                    atualizadoEm: agora,
                    atualizadoPor: actorEmail
                };

                if (arquivar) {
                    grupoUpdates.enderecos_visitados = ensureArray(grupo.enderecos_visitados).filter((id) => id !== enderecoId);
                }

                transaction.set(grupoRef, grupoUpdates, { merge: true });
            }
        }

        transaction.set(enderecoRef, {
            status: arquivar ? ENDERECO_STATUS.ARQUIVADO : ENDERECO_STATUS.ATIVO,
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: arquivar ? agora : null,
            arquivadoPor: arquivar ? actorEmail : null
        }, { merge: true });
    });
}

export async function createGrupoEnderecoManual(db, { enderecos, nome, user }) {
    const enderecoIds = [...new Set((enderecos || []).map((endereco) => endereco.id).filter(Boolean))];
    const actorEmail = buildActorEmail(user);
    const agora = new Date();
    const counterRef = getCodigosCounterRef(db);

    if (!enderecoIds.length) {
        throw new Error('Selecione pelo menos um endereço para criar o grupo.');
    }

    return runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterRef);
        const currentCounter = counterSnapshot.exists()
            ? Number.parseInt(counterSnapshot.data().proximoGrupoEndereco, 10)
            : 1;
        const sequence = Number.isFinite(currentCounter) && currentCounter > 0 ? currentCounter : 1;
        const codigo = formatGrupoEnderecoCodigo(sequence);
        const grupoId = getGrupoEnderecoDocIdFromSequence(sequence);
        const grupoRef = getGrupoEnderecoRef(db, grupoId);

        const enderecoSnapshots = await Promise.all(enderecoIds.map((enderecoId) => transaction.get(getEnderecoRef(db, enderecoId))));
        const enderecosAtuais = enderecoSnapshots.map((snapshot) => {
            if (!snapshot.exists()) {
                throw new Error('Um dos endereços selecionados não existe mais.');
            }

            return {
                id: snapshot.id,
                ...snapshot.data()
            };
        });

        enderecosAtuais.forEach((endereco) => {
            if (endereco.status !== ENDERECO_STATUS.ATIVO) {
                throw new Error(`${endereco.codigo || 'Endereço'} não está ativo.`);
            }

            if (endereco.grupoId) {
                throw new Error(`${endereco.codigo || 'Endereço'} já pertence a um grupo.`);
            }
        });

        const stats = calculateGrupoEnderecoStats(enderecosAtuais);
        const nomeGrupo = normalizeGrupoNome(nome, `${codigo} - Endereços de idioma`);

        transaction.set(counterRef, {
            proximoGrupoEndereco: sequence + 1,
            atualizadoEm: agora
        }, { merge: true });

        transaction.set(grupoRef, {
            codigo,
            nome: nomeGrupo,
            status: GRUPO_ENDERECO_STATUS.ATIVO,
            enderecoIds,
            ...stats,
            designadoPara: null,
            designadoNome: null,
            dataDesignacao: null,
            designacaoId: null,
            cicloAtual: null,
            enderecos_visitados: [],
            historico: [],
            ultimaConclusao: null,
            ultimaAlteracao: agora,
            criadoEm: agora,
            criadoPor: actorEmail,
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: null,
            arquivadoPor: null
        });

        enderecoIds.forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoId,
                grupoCodigo: codigo,
                atualizadoEm: agora,
                atualizadoPor: actorEmail
            }, { merge: true });
        });

        return {
            id: grupoId,
            codigo,
            nome: nomeGrupo
        };
    });
}

export async function setGrupoEnderecoArquivado(db, grupoId, arquivar, user) {
    const agora = new Date();

    await setDoc(getGrupoEnderecoRef(db, grupoId), {
        status: arquivar ? GRUPO_ENDERECO_STATUS.ARQUIVADO : GRUPO_ENDERECO_STATUS.ATIVO,
        atualizadoEm: agora,
        atualizadoPor: buildActorEmail(user),
        arquivadoEm: arquivar ? agora : null,
        arquivadoPor: arquivar ? buildActorEmail(user) : null
    }, { merge: true });
}

export async function designarGrupoEndereco(db, { grupoId, usuario, user }) {
    const agora = new Date();
    const designacaoId = createDesignacaoId();
    const usuarioEmail = normalizeEmail(usuario?.email);
    const novoNome = usuario?.nome || usuario?.email || 'Dirigente';

    await setDoc(getGrupoEnderecoRef(db, grupoId), {
        designadoPara: usuarioEmail,
        designadoNome: novoNome,
        dataDesignacao: agora,
        designacaoId,
        cicloAtual: {
            dataInicio: agora,
            responsaveis: [novoNome],
            designacaoId
        },
        status: GRUPO_ENDERECO_STATUS.ATIVO,
        ultimaAlteracao: agora,
        atualizadoEm: agora,
        atualizadoPor: buildActorEmail(user)
    }, { merge: true });

    return {
        designacaoId,
        designadoNome: novoNome
    };
}

export async function devolverGrupoEndereco(db, { grupoId, user }) {
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Grupo não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        if (!grupo.designadoPara) {
            return;
        }

        const responsavelNome = grupo.designadoNome || grupo.designadoPara || 'Dirigente';

        transaction.set(grupoRef, {
            designadoPara: null,
            designadoNome: null,
            dataDesignacao: null,
            designacaoId: null,
            cicloAtual: null,
            historico: arrayUnion(buildHistoricoGrupoEndereco({
                grupo,
                responsavelNome,
                agora
            })),
            status: GRUPO_ENDERECO_STATUS.ATIVO,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });
    });
}

export async function toggleEnderecoVisitadoGrupo(db, { grupoId, enderecoId, user }) {
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Grupo não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        if (grupo.status !== GRUPO_ENDERECO_STATUS.ATIVO) {
            throw new Error('Este grupo não está ativo para execução.');
        }

        if (grupo.designadoPara !== actorEmail) {
            throw new Error('Este grupo não está designado para você.');
        }

        if (!ensureArray(grupo.enderecoIds).includes(enderecoId)) {
            throw new Error('Este endereço não pertence mais ao grupo.');
        }

        const visitados = new Set(ensureArray(grupo.enderecos_visitados));
        if (visitados.has(enderecoId)) {
            visitados.delete(enderecoId);
        } else {
            visitados.add(enderecoId);
        }

        transaction.set(grupoRef, {
            enderecos_visitados: [...visitados],
            status: GRUPO_ENDERECO_STATUS.ATIVO,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });
    });
}

export async function finalizarGrupoEnderecoDesignado(db, { grupoId, user }) {
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Grupo não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        if (grupo.designadoPara !== actorEmail) {
            throw new Error('Este grupo não está designado para você.');
        }

        const progresso = getGrupoEnderecoProgresso(grupo);
        if (!progresso.completo) {
            throw new Error('Marque todos os endereços ativos antes de finalizar.');
        }

        const responsavelNome = grupo.designadoNome || user?.displayName || actorEmail;

        transaction.set(grupoRef, {
            designadoPara: null,
            designadoNome: null,
            dataDesignacao: null,
            designacaoId: null,
            cicloAtual: null,
            historico: arrayUnion(buildHistoricoGrupoEndereco({
                grupo,
                responsavelNome,
                agora
            })),
            ultimaConclusao: agora,
            enderecos_visitados: [],
            status: GRUPO_ENDERECO_STATUS.FINALIZADO,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });
    });
}

export async function removerEnderecoDoGrupo(db, { enderecoId, grupoId, user }) {
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const enderecoRef = getEnderecoRef(db, enderecoId);
        const grupoSnapshot = await transaction.get(grupoRef);
        const enderecoSnapshot = await transaction.get(enderecoRef);

        if (!grupoSnapshot.exists() || !enderecoSnapshot.exists()) {
            throw new Error('Grupo ou endereço não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        const endereco = enderecoSnapshot.data();
        if (endereco.grupoId !== grupoId) {
            throw new Error('O endereço não pertence mais a este grupo.');
        }

        const proximosEnderecoIds = (grupo.enderecoIds || []).filter((id) => id !== enderecoId);
        const proximosVisitados = (grupo.enderecos_visitados || []).filter((id) => id !== enderecoId);
        const remainingSnapshots = await Promise.all(proximosEnderecoIds.map((id) => transaction.get(getEnderecoRef(db, id))));
        const enderecosRestantes = remainingSnapshots
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => ({
                id: snapshot.id,
                ...snapshot.data()
            }));
        const stats = calculateGrupoEnderecoStats(enderecosRestantes);

        transaction.set(enderecoRef, {
            grupoId: null,
            grupoCodigo: null,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });

        transaction.set(grupoRef, {
            enderecoIds: proximosEnderecoIds,
            enderecos_visitados: proximosVisitados,
            ...stats,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });
    });
}
