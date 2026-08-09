import {
    arrayUnion,
    collection,
    doc,
    runTransaction
} from 'firebase/firestore';
import { buildUsuarioAprovadoData, USUARIOS_COLLECTION } from './usuariosModel.js';

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

export const IDIOMA_PADRAO_ENDERECOS = Object.freeze({
    id: 'es',
    nome: 'Espanhol',
    codigoPrefixoEndereco: 'ES-SBS-',
    codigoPrefixoTerritorio: 'ES-SBS-T'
});

export const ENDERECO_CODIGO_PADRAO = 'ES-SBS-001';
export const GRUPO_ENDERECO_CODIGO_PADRAO = 'ES-SBS-T01';

export const ENDERECO_CLASSES = Object.freeze({
    CONFIRMADO: 'confirmado',
    VERIFICAR: 'verificar',
    ESTUDO: 'estudo',
    EXCLUIDO: 'excluido'
});

export const ENDERECO_CLASSE_LABELS = Object.freeze({
    [ENDERECO_CLASSES.CONFIRMADO]: 'Confirmado',
    [ENDERECO_CLASSES.VERIFICAR]: 'Verificar',
    [ENDERECO_CLASSES.ESTUDO]: 'Estudo',
    [ENDERECO_CLASSES.EXCLUIDO]: 'Excluido'
});

const CODIGO_MANUAL_REGEX = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
const ENDERECO_CODE_WIDTH = 4;
const GRUPO_ENDERECO_CODE_WIDTH = 3;

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}

export function normalizeCodigoManual(value) {
    return String(value || '').trim().toUpperCase();
}

export function isCodigoManualValido(value) {
    return CODIGO_MANUAL_REGEX.test(normalizeCodigoManual(value));
}

function assertCodigoManualValido(value, label) {
    const codigo = normalizeCodigoManual(value);

    if (!codigo) {
        throw new Error(`Informe o código do ${label}.`);
    }

    if (!CODIGO_MANUAL_REGEX.test(codigo)) {
        throw new Error(`Código do ${label} inválido. Use letras, números e hífen, como ES-SBS-001.`);
    }

    return codigo;
}

function codigoManualToDocSuffix(codigo) {
    return normalizeCodigoManual(codigo)
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

export function getEnderecoDocIdFromCodigo(codigo) {
    return `e_${codigoManualToDocSuffix(codigo)}`;
}

export function getGrupoEnderecoDocIdFromCodigo(codigo) {
    return `g_${codigoManualToDocSuffix(codigo)}`;
}

export function formatEnderecoCodigo(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `E-${String(safeSequence).padStart(ENDERECO_CODE_WIDTH, '0')}`;
}

export function formatEnderecoCodigoExibicao(value) {
    const codigo = String(value || '').trim();
    const match = codigo.match(/^(?:E-|e_)?0*(\d+)$/i);
    if (!match) return codigo;

    return `E-${Number.parseInt(match[1], 10)}`;
}

export function getEnderecoDocIdFromSequence(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `e_${String(safeSequence).padStart(ENDERECO_CODE_WIDTH, '0')}`;
}

export function formatGrupoEnderecoCodigo(sequence) {
    const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
    return `T-${String(safeSequence).padStart(GRUPO_ENDERECO_CODE_WIDTH, '0')}`;
}

export function formatGrupoEnderecoCodigoExibicao(value) {
    const codigo = String(value || '').trim();
    const match = codigo.match(/^(?:T-|g_)?0*(\d+)$/i);
    if (!match) return codigo;

    return `T-${Number.parseInt(match[1], 10)}`;
}

export function formatGrupoEnderecoNomeExibicao(nome, codigo) {
    const codigoBase = String(codigo || '').trim();
    const codigoExibicao = formatGrupoEnderecoCodigoExibicao(codigoBase);
    const texto = String(nome || '').trim();

    if (!texto || texto === codigoBase) {
        return codigoExibicao ? `Território ${codigoExibicao}` : 'Território';
    }

    return texto.replace(/^T-0*(\d+)/i, (_, sequence) => `T-${Number.parseInt(sequence, 10)}`);
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

export function normalizeEnderecoClasse(value) {
    const classe = String(value || '').trim().toLowerCase();
    return Object.values(ENDERECO_CLASSES).includes(classe)
        ? classe
        : ENDERECO_CLASSES.CONFIRMADO;
}

export function resolveEnderecoStatusFromClasse(classe, fallbackStatus = ENDERECO_STATUS.ATIVO) {
    if (normalizeEnderecoClasse(classe) === ENDERECO_CLASSES.EXCLUIDO) {
        return ENDERECO_STATUS.ARQUIVADO;
    }

    return fallbackStatus === ENDERECO_STATUS.ARQUIVADO
        ? ENDERECO_STATUS.ARQUIVADO
        : ENDERECO_STATUS.ATIVO;
}

export function normalizeEnderecoFields(input = {}) {
    const classe = normalizeEnderecoClasse(input.classe);
    const informacao = normalizeText(input.informacao ?? input.observacao, 2000);

    return {
        lat: toFiniteNumber(input.lat),
        lng: toFiniteNumber(input.lng),
        idiomaId: normalizeText(input.idiomaId, 32) || IDIOMA_PADRAO_ENDERECOS.id,
        idiomaNome: normalizeText(input.idiomaNome, 80) || IDIOMA_PADRAO_ENDERECOS.nome,
        bairro: normalizeText(input.bairro, 120),
        endereco: normalizeText(input.endereco, 220),
        informacao,
        quantidadeEstrangeiros: Math.max(0, Math.min(99, Math.trunc(toFiniteNumber(input.quantidadeEstrangeiros)))),
        observacao: normalizeText(input.observacao ?? informacao, 2000),
        classe,
        status: resolveEnderecoStatusFromClasse(classe, input.status)
    };
}

function buildActorEmail(user) {
    return normalizeEmail(user?.email);
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isAdminActor(user) {
    return user?.isAdmin === true || user?.role === 'admin';
}

function normalizeGrupoNome(value, fallback) {
    return normalizeText(value, 120) || fallback;
}

function resolveGrupoMetadataFromEnderecos(enderecos = [], input = {}) {
    const metadata = {
        idiomaId: normalizeText(input.idiomaId, 32),
        idiomaNome: normalizeText(input.idiomaNome, 80),
        bairro: normalizeText(input.bairro, 120)
    };
    const idiomaIds = [...new Set(enderecos.map((endereco) => normalizeText(endereco.idiomaId, 32) || IDIOMA_PADRAO_ENDERECOS.id))];
    const idiomaNomes = [...new Set(enderecos.map((endereco) => normalizeText(endereco.idiomaNome, 80) || IDIOMA_PADRAO_ENDERECOS.nome))];
    const bairros = [...new Set(enderecos.map((endereco) => normalizeText(endereco.bairro, 120)).filter(Boolean))];

    if (idiomaIds.length > 1) {
        throw new Error('Selecione endereços do mesmo idioma para criar ou atualizar o território.');
    }

    return {
        idiomaId: metadata.idiomaId || idiomaIds[0] || IDIOMA_PADRAO_ENDERECOS.id,
        idiomaNome: metadata.idiomaNome || idiomaNomes[0] || IDIOMA_PADRAO_ENDERECOS.nome,
        bairro: metadata.bairro || (bairros.length === 1 ? bairros[0] : '')
    };
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
    const visitadosReais = new Set(ensureArray(grupo?.enderecos_visitados).filter(Boolean)).size;
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
    const codigo = assertCodigoManualValido(input.codigo || ENDERECO_CODIGO_PADRAO, 'endereço');
    const actorEmail = buildActorEmail(user);
    const agora = new Date();
    const enderecoId = getEnderecoDocIdFromCodigo(codigo);
    const enderecoRef = getEnderecoRef(db, enderecoId);

    return runTransaction(db, async (transaction) => {
        const enderecoSnapshot = await transaction.get(enderecoRef);
        if (enderecoSnapshot.exists()) {
            throw new Error(`Já existe um endereço com o código ${codigo}.`);
        }

        transaction.set(enderecoRef, {
            codigo,
            status: fields.status,
            grupoId: null,
            grupoCodigo: null,
            grupoDesignadoPara: null,
            ...fields,
            geohash: null,
            origem: ENDERECO_ORIGEM.MANUAL,
            importacaoId: null,
            criadoEm: agora,
            criadoPor: actorEmail,
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: fields.status === ENDERECO_STATUS.ARQUIVADO ? agora : null,
            arquivadoPor: fields.status === ENDERECO_STATUS.ARQUIVADO ? actorEmail : null
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
            ...fields,
            status: fields.status
        };
        const idiomaAtual = normalizeText(enderecoAtual.idiomaId, 32) || IDIOMA_PADRAO_ENDERECOS.id;
        const proximoIdioma = normalizeText(fields.idiomaId, 32) || IDIOMA_PADRAO_ENDERECOS.id;

        if ((enderecoAtual.grupoId || enderecoAtual.grupoCodigo) && idiomaAtual !== proximoIdioma) {
            throw new Error('Remova o endereço do território antes de trocar o idioma.');
        }

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

                if (enderecoAtualizado.status === ENDERECO_STATUS.ARQUIVADO) {
                    grupoUpdates.enderecos_visitados = ensureArray(grupo.enderecos_visitados).filter((id) => id !== enderecoId);
                }

                transaction.set(grupoRef, grupoUpdates, { merge: true });
            }
        }

        transaction.set(enderecoRef, {
            idiomaId: fields.idiomaId,
            idiomaNome: fields.idiomaNome,
            bairro: fields.bairro,
            endereco: fields.endereco,
            informacao: fields.informacao,
            quantidadeEstrangeiros: fields.quantidadeEstrangeiros,
            observacao: fields.observacao,
            classe: fields.classe,
            status: fields.status,
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: fields.status === ENDERECO_STATUS.ARQUIVADO ? (enderecoAtual.arquivadoEm || agora) : null,
            arquivadoPor: fields.status === ENDERECO_STATUS.ARQUIVADO ? (enderecoAtual.arquivadoPor || actorEmail) : null
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
            classe: !arquivar && enderecoAtual.classe === ENDERECO_CLASSES.EXCLUIDO
                ? ENDERECO_CLASSES.CONFIRMADO
                : (enderecoAtual.classe || ENDERECO_CLASSES.CONFIRMADO),
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: arquivar ? agora : null,
            arquivadoPor: arquivar ? actorEmail : null
        }, { merge: true });
    });
}

export async function createGrupoEnderecoManual(db, { enderecos, nome, codigo: codigoInput, user, ...input }) {
    const enderecoIds = [...new Set((enderecos || []).map((endereco) => endereco.id).filter(Boolean))];
    const codigo = assertCodigoManualValido(codigoInput || GRUPO_ENDERECO_CODIGO_PADRAO, 'território');
    const actorEmail = buildActorEmail(user);
    const agora = new Date();
    const grupoId = getGrupoEnderecoDocIdFromCodigo(codigo);
    const grupoRef = getGrupoEnderecoRef(db, grupoId);

    if (!enderecoIds.length) {
        throw new Error('Selecione pelo menos um endereço para criar o território.');
    }

    return runTransaction(db, async (transaction) => {
        const grupoSnapshot = await transaction.get(grupoRef);
        if (grupoSnapshot.exists()) {
            throw new Error(`Já existe um território com o código ${codigo}.`);
        }

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
                throw new Error(`${formatEnderecoCodigoExibicao(endereco.codigo) || 'Endereço'} não está ativo.`);
            }

            if (endereco.grupoId || endereco.grupoCodigo) {
                throw new Error(`${formatEnderecoCodigoExibicao(endereco.codigo) || 'Endereço'} já pertence a um território.`);
            }
        });

        const stats = calculateGrupoEnderecoStats(enderecosAtuais);
        const metadata = resolveGrupoMetadataFromEnderecos(enderecosAtuais, input);
        const nomeGrupo = normalizeGrupoNome(nome, `${codigo} - Endereços de idioma`);

        transaction.set(grupoRef, {
            codigo,
            ...metadata,
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
                grupoDesignadoPara: null,
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

export async function adicionarEnderecosAoGrupo(db, { enderecoIds, grupoId, user }) {
    const idsSelecionados = [...new Set((enderecoIds || []).filter(Boolean))];
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    if (!grupoId) {
        throw new Error('Escolha um território existente.');
    }

    if (!idsSelecionados.length) {
        throw new Error('Selecione pelo menos um endereço para vincular ao território.');
    }

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Território não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        if ((grupo.status || GRUPO_ENDERECO_STATUS.ATIVO) !== GRUPO_ENDERECO_STATUS.ATIVO) {
            throw new Error('Só é possível vincular endereços a territórios ativos.');
        }

        const enderecoIdsAtuais = ensureArray(grupo.enderecoIds).filter(Boolean);
        const proximosEnderecoIds = [...new Set([...enderecoIdsAtuais, ...idsSelecionados])];

        if (proximosEnderecoIds.length === enderecoIdsAtuais.length) {
            throw new Error('Os endereços selecionados já pertencem a este território.');
        }

        const enderecoSnapshots = await Promise.all(proximosEnderecoIds.map((enderecoId) => (
            transaction.get(getEnderecoRef(db, enderecoId))
        )));
        const enderecosAtualizados = enderecoSnapshots.map((snapshot) => {
            if (!snapshot.exists()) {
                throw new Error('Um dos endereços selecionados não existe mais.');
            }

            return {
                id: snapshot.id,
                ...snapshot.data()
            };
        });

        const idsSelecionadosSet = new Set(idsSelecionados);
        enderecosAtualizados.forEach((endereco) => {
            if (!idsSelecionadosSet.has(endereco.id)) return;

            if (endereco.status !== ENDERECO_STATUS.ATIVO) {
                throw new Error(`${formatEnderecoCodigoExibicao(endereco.codigo) || 'Endereço'} não está ativo.`);
            }

            if (endereco.grupoId || endereco.grupoCodigo) {
                throw new Error(`${formatEnderecoCodigoExibicao(endereco.codigo) || 'Endereço'} já pertence a um território.`);
            }
        });

        const stats = calculateGrupoEnderecoStats(enderecosAtualizados);
        const proximosVisitados = ensureArray(grupo.enderecos_visitados).filter((id) => proximosEnderecoIds.includes(id));
        const idiomaGrupo = normalizeText(grupo.idiomaId, 32);
        const idiomasAtualizados = [...new Set(enderecosAtualizados.map((endereco) => (
            normalizeText(endereco.idiomaId, 32) || IDIOMA_PADRAO_ENDERECOS.id
        )))];

        if (idiomaGrupo && idiomasAtualizados.some((idiomaId) => idiomaId !== idiomaGrupo)) {
            throw new Error('Selecione endereços do mesmo idioma do território.');
        }

        transaction.set(grupoRef, {
            enderecoIds: proximosEnderecoIds,
            enderecos_visitados: proximosVisitados,
            ...resolveGrupoMetadataFromEnderecos(enderecosAtualizados, grupo),
            ...stats,
            status: GRUPO_ENDERECO_STATUS.ATIVO,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });

        idsSelecionados.forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoId,
                grupoCodigo: grupo.codigo,
                grupoDesignadoPara: grupo.designadoPara || null,
                atualizadoEm: agora,
                atualizadoPor: actorEmail
            }, { merge: true });
        });

        return {
            id: grupoId,
            codigo: grupo.codigo,
            totalEnderecos: proximosEnderecoIds.length
        };
    });
}

export async function setGrupoEnderecoArquivado(db, grupoId, arquivar, user) {
    const agora = new Date();
    const actorEmail = buildActorEmail(user);

    await runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Território não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        ensureArray(grupo.enderecoIds).forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoDesignadoPara: arquivar ? null : (grupo.designadoPara || null),
                atualizadoEm: agora,
                atualizadoPor: actorEmail
            }, { merge: true });
        });

        transaction.set(grupoRef, {
            status: arquivar ? GRUPO_ENDERECO_STATUS.ARQUIVADO : GRUPO_ENDERECO_STATUS.ATIVO,
            atualizadoEm: agora,
            atualizadoPor: actorEmail,
            arquivadoEm: arquivar ? agora : null,
            arquivadoPor: arquivar ? actorEmail : null
        }, { merge: true });
    });
}

export async function designarGrupoEndereco(db, { grupoId, usuario, user }) {
    const agora = new Date();
    const designacaoId = createDesignacaoId();
    const usuarioEmail = normalizeEmail(usuario?.email);
    const novoNome = usuario?.nome || usuario?.email || 'Dirigente';
    if (!usuarioEmail) {
        throw new Error('Usuário inválido para designação.');
    }

    await runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Território não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        const statusAtual = grupo.status || GRUPO_ENDERECO_STATUS.ATIVO;
        if (statusAtual === GRUPO_ENDERECO_STATUS.ARQUIVADO) {
            throw new Error('Território arquivado não pode ser designado.');
        }

        if (statusAtual === GRUPO_ENDERECO_STATUS.FINALIZADO) {
            throw new Error('Território finalizado precisa ser disponibilizado antes de uma nova designação.');
        }

        transaction.set(grupoRef, {
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

        ensureArray(grupo.enderecoIds).forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoDesignadoPara: usuarioEmail,
                atualizadoEm: agora,
                atualizadoPor: buildActorEmail(user)
            }, { merge: true });
        });
    });

    return {
        designacaoId,
        designadoNome: novoNome
    };
}

export async function designarGrupoEnderecoComUsuarioAprovado(db, { grupoId, convite, user }) {
    const agora = new Date();
    const dadosUsuarioPreliminares = buildUsuarioAprovadoData({
        email: convite?.email,
        nome: convite?.nome || 'Novo Dirigente',
        whatsapp: convite?.whatsapp,
        criadoPor: buildActorEmail(user) || null,
        origem: 'designacao-grupo-endereco',
        agora
    });
    const usuarioRef = doc(db, USUARIOS_COLLECTION, dadosUsuarioPreliminares.email);
    const grupoRef = getGrupoEnderecoRef(db, grupoId);
    const designacaoId = createDesignacaoId();
    let usuarioRetorno = null;

    await runTransaction(db, async (transaction) => {
        const usuarioSnapshot = await transaction.get(usuarioRef);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Território não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        const statusAtual = grupo.status || GRUPO_ENDERECO_STATUS.ATIVO;
        if (statusAtual === GRUPO_ENDERECO_STATUS.ARQUIVADO) {
            throw new Error('Território arquivado não pode ser designado.');
        }

        if (statusAtual === GRUPO_ENDERECO_STATUS.FINALIZADO) {
            throw new Error('Território finalizado precisa ser disponibilizado antes de uma nova designação.');
        }

        const existente = usuarioSnapshot.exists() ? usuarioSnapshot.data() : null;
        const usuarioAprovado = buildUsuarioAprovadoData({
            email: convite?.email,
            nome: convite?.nome || 'Novo Dirigente',
            whatsapp: convite?.whatsapp,
            criadoPor: buildActorEmail(user) || null,
            origem: 'designacao-grupo-endereco',
            existente,
            agora
        });
        usuarioRetorno = {
            email: usuarioAprovado.email,
            id: usuarioAprovado.id,
            role: usuarioAprovado.dados.role,
            nome: usuarioAprovado.dados.nome,
            whatsapp: usuarioAprovado.dados.whatsapp
        };

        transaction.set(usuarioRef, usuarioAprovado.dados, { merge: true });
        transaction.set(grupoRef, {
            designadoPara: usuarioAprovado.email,
            designadoNome: usuarioAprovado.dados.nome,
            dataDesignacao: agora,
            designacaoId,
            cicloAtual: {
                dataInicio: agora,
                responsaveis: [usuarioAprovado.dados.nome],
                designacaoId
            },
            status: GRUPO_ENDERECO_STATUS.ATIVO,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: buildActorEmail(user)
        }, { merge: true });

        ensureArray(grupo.enderecoIds).forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoDesignadoPara: usuarioAprovado.email,
                atualizadoEm: agora,
                atualizadoPor: buildActorEmail(user)
            }, { merge: true });
        });
    });

    return {
        usuario: usuarioRetorno,
        designacaoId,
        designadoNome: usuarioRetorno?.nome
    };
}

export async function devolverGrupoEndereco(db, { grupoId, user }) {
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Território não encontrado.');
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

        ensureArray(grupo.enderecoIds).forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoDesignadoPara: null,
                atualizadoEm: agora,
                atualizadoPor: actorEmail
            }, { merge: true });
        });
    });
}

export async function toggleEnderecoVisitadoGrupo(db, { grupoId, enderecoId, user }) {
    const actorEmail = buildActorEmail(user);
    const agora = new Date();

    return runTransaction(db, async (transaction) => {
        const grupoRef = getGrupoEnderecoRef(db, grupoId);
        const grupoSnapshot = await transaction.get(grupoRef);

        if (!grupoSnapshot.exists()) {
            throw new Error('Território não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        if ((grupo.status || GRUPO_ENDERECO_STATUS.ATIVO) !== GRUPO_ENDERECO_STATUS.ATIVO) {
            throw new Error('Este território não está ativo para execução.');
        }

        if (!isAdminActor(user) && normalizeEmail(grupo.designadoPara) !== actorEmail) {
            throw new Error('Este território não está designado para você.');
        }

        if (!ensureArray(grupo.enderecoIds).includes(enderecoId)) {
            throw new Error('Este endereço não pertence mais ao território.');
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
            throw new Error('Território não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        if (!isAdminActor(user) && normalizeEmail(grupo.designadoPara) !== actorEmail) {
            throw new Error('Este território não está designado para você.');
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

        ensureArray(grupo.enderecoIds).forEach((enderecoId) => {
            transaction.set(getEnderecoRef(db, enderecoId), {
                grupoDesignadoPara: null,
                atualizadoEm: agora,
                atualizadoPor: actorEmail
            }, { merge: true });
        });
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
            throw new Error('Território ou endereço não encontrado.');
        }

        const grupo = grupoSnapshot.data();
        const endereco = enderecoSnapshot.data();
        if (endereco.grupoId !== grupoId) {
            throw new Error('O endereço não pertence mais a este território.');
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
        const statsPersistidos = stats.totalEnderecos > 0
            ? stats
            : {
                ...stats,
                centro: grupo.centro || null,
                bounds: grupo.bounds || null
            };

        transaction.set(enderecoRef, {
            grupoId: null,
            grupoCodigo: null,
            grupoDesignadoPara: null,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });

        transaction.set(grupoRef, {
            enderecoIds: proximosEnderecoIds,
            enderecos_visitados: proximosVisitados,
            ...statsPersistidos,
            ultimaAlteracao: agora,
            atualizadoEm: agora,
            atualizadoPor: actorEmail
        }, { merge: true });
    });
}
