import { doc } from 'firebase/firestore';
import {
    ENDERECO_CLASSES,
    ENDERECO_CLASSE_LABELS,
    ENDERECO_CODIGO_PADRAO,
    GRUPO_ENDERECO_CODIGO_PADRAO,
    IDIOMA_PADRAO_ENDERECOS,
    normalizeCodigoManual,
    normalizeEnderecoClasse
} from './enderecoModel.js';

export const ENDERECO_CONFIG_COLLECTION = 'configuracoes';
export const ENDERECO_CONFIG_DOC_ID = 'cadastros_enderecos';

const DEFAULT_PREFIXO_ENDERECO = IDIOMA_PADRAO_ENDERECOS.codigoPrefixoEndereco;
const DEFAULT_PREFIXO_TERRITORIO = IDIOMA_PADRAO_ENDERECOS.codigoPrefixoTerritorio;

export const DEFAULT_ENDERECO_CONFIG = Object.freeze({
    idiomaPadraoId: IDIOMA_PADRAO_ENDERECOS.id,
    idiomaPadraoNome: IDIOMA_PADRAO_ENDERECOS.nome,
    prefixoEnderecoPadrao: DEFAULT_PREFIXO_ENDERECO,
    prefixoTerritorioPadrao: DEFAULT_PREFIXO_TERRITORIO,
    classeEnderecoPadrao: ENDERECO_CLASSES.CONFIRMADO,
    quantidadeEstrangeirosPadrao: 1,
    cidadePadrao: 'Sao Bento do Sul',
    ufPadrao: 'SC',
    idiomas: [
        {
            id: IDIOMA_PADRAO_ENDERECOS.id,
            nome: IDIOMA_PADRAO_ENDERECOS.nome,
            codigoPrefixoEndereco: DEFAULT_PREFIXO_ENDERECO,
            codigoPrefixoTerritorio: DEFAULT_PREFIXO_TERRITORIO,
            ativo: true,
            ordem: 1
        }
    ],
    tiposEndereco: Object.values(ENDERECO_CLASSES).map((id, index) => ({
        id,
        label: ENDERECO_CLASSE_LABELS[id],
        statusPadrao: id === ENDERECO_CLASSES.EXCLUIDO ? 'arquivado' : 'ativo',
        ordem: index + 1,
        ativo: true
    }))
});

function normalizeText(value, fallback, maxLength = 120) {
    const text = String(value ?? '').trim().slice(0, maxLength);
    return text || fallback;
}

function normalizePrefix(value, fallback) {
    const normalized = normalizeCodigoManual(value || fallback);
    return normalized || fallback;
}

function normalizePositiveInt(value, fallback, min = 0, max = 99) {
    const number = Math.trunc(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

function normalizeIdiomas(value) {
    const raw = Array.isArray(value) && value.length ? value : DEFAULT_ENDERECO_CONFIG.idiomas;
    const idiomas = raw
        .map((idioma, index) => ({
            id: normalizeText(idioma?.id, '', 32).toLowerCase(),
            nome: normalizeText(idioma?.nome, '', 80),
            codigoPrefixoEndereco: normalizePrefix(idioma?.codigoPrefixoEndereco, DEFAULT_PREFIXO_ENDERECO),
            codigoPrefixoTerritorio: normalizePrefix(idioma?.codigoPrefixoTerritorio, DEFAULT_PREFIXO_TERRITORIO),
            ativo: idioma?.ativo !== false,
            ordem: normalizePositiveInt(idioma?.ordem, index + 1, 1, 999)
        }))
        .filter((idioma) => idioma.id && idioma.nome)
        .filter((idioma, index, list) => list.findIndex((item) => item.id === idioma.id) === index)
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

    return idiomas.length ? idiomas : DEFAULT_ENDERECO_CONFIG.idiomas;
}

function normalizeTiposEndereco(value) {
    const raw = Array.isArray(value) && value.length ? value : DEFAULT_ENDERECO_CONFIG.tiposEndereco;
    const tipos = raw
        .map((tipo, index) => {
            const id = normalizeEnderecoClasse(tipo?.id);
            return {
                id,
                label: normalizeText(tipo?.label, ENDERECO_CLASSE_LABELS[id], 80),
                statusPadrao: id === ENDERECO_CLASSES.EXCLUIDO ? 'arquivado' : 'ativo',
                ordem: normalizePositiveInt(tipo?.ordem, index + 1, 1, 999),
                ativo: tipo?.ativo !== false
            };
        })
        .filter((tipo, index, list) => list.findIndex((item) => item.id === tipo.id) === index)
        .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label));

    return tipos.length ? tipos : DEFAULT_ENDERECO_CONFIG.tiposEndereco;
}

export function normalizeEnderecoConfig(data = {}) {
    const idiomas = normalizeIdiomas(data.idiomas);
    const tiposEndereco = normalizeTiposEndereco(data.tiposEndereco);
    const idiomaPadraoId = normalizeText(data.idiomaPadraoId, DEFAULT_ENDERECO_CONFIG.idiomaPadraoId, 32).toLowerCase();
    const idiomaPadrao = idiomas.find((idioma) => idioma.id === idiomaPadraoId && idioma.ativo) ||
        idiomas.find((idioma) => idioma.ativo) ||
        idiomas[0];

    return {
        idiomaPadraoId: idiomaPadrao.id,
        idiomaPadraoNome: idiomaPadrao.nome,
        prefixoEnderecoPadrao: normalizePrefix(data.prefixoEnderecoPadrao, idiomaPadrao.codigoPrefixoEndereco),
        prefixoTerritorioPadrao: normalizePrefix(data.prefixoTerritorioPadrao, idiomaPadrao.codigoPrefixoTerritorio),
        classeEnderecoPadrao: normalizeEnderecoClasse(data.classeEnderecoPadrao),
        quantidadeEstrangeirosPadrao: normalizePositiveInt(
            data.quantidadeEstrangeirosPadrao,
            DEFAULT_ENDERECO_CONFIG.quantidadeEstrangeirosPadrao,
            0,
            99
        ),
        cidadePadrao: normalizeText(data.cidadePadrao, DEFAULT_ENDERECO_CONFIG.cidadePadrao, 120),
        ufPadrao: normalizeText(data.ufPadrao, DEFAULT_ENDERECO_CONFIG.ufPadrao, 2).toUpperCase(),
        idiomas,
        tiposEndereco
    };
}

export function getEnderecoIdiomasAtivos(config) {
    return normalizeEnderecoConfig(config).idiomas.filter((idioma) => idioma.ativo);
}

export function getEnderecoConfigForIdioma(config, idiomaId) {
    const normalized = normalizeEnderecoConfig(config);
    const idiomasAtivos = getEnderecoIdiomasAtivos(normalized);
    const normalizedIdiomaId = normalizeText(idiomaId, '', 32).toLowerCase();
    const idiomaSelecionado = idiomasAtivos.find((idioma) => idioma.id === normalizedIdiomaId) ||
        idiomasAtivos.find((idioma) => idioma.id === normalized.idiomaPadraoId) ||
        idiomasAtivos[0] ||
        normalized.idiomas[0];

    if (!idiomaSelecionado) return normalized;

    return normalizeEnderecoConfig({
        ...normalized,
        idiomaPadraoId: idiomaSelecionado.id,
        idiomaPadraoNome: idiomaSelecionado.nome,
        prefixoEnderecoPadrao: idiomaSelecionado.codigoPrefixoEndereco,
        prefixoTerritorioPadrao: idiomaSelecionado.codigoPrefixoTerritorio,
        idiomas: normalized.idiomas,
        tiposEndereco: normalized.tiposEndereco
    });
}

function appendDefaultSuffix(prefix, suffix) {
    const normalizedPrefix = normalizePrefix(prefix, '');
    if (!normalizedPrefix) return normalizeCodigoManual(suffix);
    if (/\d$/.test(normalizedPrefix)) return normalizedPrefix;
    return `${normalizedPrefix}${suffix}`;
}

export function getEnderecoCodigoPadraoFromConfig(config) {
    const normalized = normalizeEnderecoConfig(config);
    return appendDefaultSuffix(normalized.prefixoEnderecoPadrao, '001') || ENDERECO_CODIGO_PADRAO;
}

export function getGrupoEnderecoCodigoPadraoFromConfig(config) {
    const normalized = normalizeEnderecoConfig(config);
    return appendDefaultSuffix(normalized.prefixoTerritorioPadrao, '01') || GRUPO_ENDERECO_CODIGO_PADRAO;
}

export function getEnderecoConfigRef(db) {
    return doc(db, ENDERECO_CONFIG_COLLECTION, ENDERECO_CONFIG_DOC_ID);
}
