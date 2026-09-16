import { DEFAULT_ENDERECO_CONFIG } from '../../enderecoConfig';

export const getEnderecoConfigFormIdiomas = (config) => (
    Array.isArray(config?.idiomas) && config.idiomas.length
        ? config.idiomas
        : DEFAULT_ENDERECO_CONFIG.idiomas
).map((idioma, index) => ({
    id: String(idioma?.id || '').trim().toLowerCase(),
    nome: String(idioma?.nome || ''),
    codigoPrefixoEndereco: String(idioma?.codigoPrefixoEndereco || ''),
    codigoPrefixoTerritorio: String(idioma?.codigoPrefixoTerritorio || ''),
    ativo: idioma?.ativo !== false,
    ordem: Number(idioma?.ordem) || index + 1
}));

export const criarEnderecoIdiomaForm = (ordem) => ({
    id: '',
    nome: '',
    codigoPrefixoEndereco: '',
    codigoPrefixoTerritorio: '',
    ativo: true,
    ordem
});

export const formatViewboxValue = (value) => (
    Number.isFinite(Number(value)) ? String(Number(value)) : ''
);

export const formatarTelefone = (valor) => {
    return String(valor || '')
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d)(\d{4})$/, '$1-$2');
};
