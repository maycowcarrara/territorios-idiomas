import {
    DEFAULT_ENDERECO_CONFIG,
    getEnderecoCodigoPadraoFromConfig,
    getGrupoEnderecoCodigoPadraoFromConfig
} from '../../enderecoConfig';
import {
    ENDERECO_CLASSES,
    IDIOMA_PADRAO_ENDERECOS
} from '../../enderecoModel';

export const formatAuditDateTime = (value) => {
    const date = value?.toDate?.() || (value instanceof Date ? value : null);
    if (!date || Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

export const getEnderecoAuditOriginLabel = (endereco) => {
    if (endereco?.importacaoId) {
        return endereco?.origem === 'importacao' ? 'Importado por CSV' : 'Atualizado por CSV';
    }

    return `Origem: ${endereco?.origem || 'manual'}`;
};

export const hasEnderecoAuditInfo = (endereco) => Boolean(
    endereco?.origem || endereco?.importacaoId || endereco?.atualizadoEm || endereco?.atualizadoPor
);

export const getEnderecoInitialForm = (endereco, ponto, enderecoConfig = DEFAULT_ENDERECO_CONFIG) => ({
    codigo: endereco?.codigo || getEnderecoCodigoPadraoFromConfig(enderecoConfig),
    idiomaId: endereco?.idiomaId || enderecoConfig.idiomaPadraoId || IDIOMA_PADRAO_ENDERECOS.id,
    idiomaNome: endereco?.idiomaNome || enderecoConfig.idiomaPadraoNome || IDIOMA_PADRAO_ENDERECOS.nome,
    bairro: endereco?.bairro || ponto?.bairro || '',
    endereco: endereco?.endereco || ponto?.endereco || '',
    informacao: endereco?.informacao ?? endereco?.observacao ?? '',
    classe: endereco?.classe || enderecoConfig.classeEnderecoPadrao || ENDERECO_CLASSES.CONFIRMADO,
    quantidadeEstrangeiros: String(endereco?.quantidadeEstrangeiros ?? enderecoConfig.quantidadeEstrangeirosPadrao ?? 1),
    observacao: endereco?.observacao || '',
    lat: endereco?.lat ?? ponto?.lat ?? '',
    lng: endereco?.lng ?? ponto?.lng ?? '',
    grupoEscolha: '',
    grupoCodigo: getGrupoEnderecoCodigoPadraoFromConfig(enderecoConfig),
    grupoNome: ''
});
