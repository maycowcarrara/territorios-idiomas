import { TERRITORIO_STATUS } from '../../territorioContext';
import {
    ENDERECO_CLASSES,
    ENDERECO_CLASSE_LABELS,
    getGrupoEnderecoProgresso,
    GRUPO_ENDERECO_STATUS
} from '../../enderecoModel';
import { normalizeBairroKey } from '../../bairrosSbs';
import {
    STATUS_ARQUIVADO,
    FILTRO_ARQUIVADOS_SEM,
    FILTRO_ARQUIVADOS_SOMENTE
} from '../constants/relatorioConstants';

export const toDateValue = (value) => {
    if (!value) return null;
    const date = value.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateValue = (value) => {
    const date = toDateValue(value);
    return date ? date.toLocaleDateString('pt-BR') : '-';
};

export const getDiasDesde = (date) => {
    if (!date) return 0;
    return Math.ceil(Math.abs(new Date() - date) / (1000 * 60 * 60 * 24));
};

export const normalizeKey = (value) => String(value || '').trim().toLowerCase();

export const getGrupoEnderecoIdentityKey = (value) => {
    const texto = normalizeKey(value);
    const match = texto.match(/^(?:t-|g_)?0*(\d+)$/i);
    return match ? `n:${Number.parseInt(match[1], 10)}` : texto;
};

export const getCodigoOrdenacao = (value) => {
    const match = String(value || '').match(/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

export const getUltimaEdicaoTexto = ({ dataRef, hasDesignacao }) => {
    if (!hasDesignacao) return { diasSemEdicao: 0, ultimaEdicaoTexto: 'Sem dados' };

    const referencia = dataRef || new Date();
    const diferencaMs = Math.abs(new Date() - referencia);
    const diferencaMinutos = Math.floor(diferencaMs / (1000 * 60));
    const diferencaHoras = Math.floor(diferencaMs / (1000 * 60 * 60));
    const diasSemEdicao = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

    if (diferencaMinutos < 2) {
        return { diasSemEdicao, ultimaEdicaoTexto: 'agora mesmo' };
    }

    if (diferencaMinutos < 60) {
        return { diasSemEdicao, ultimaEdicaoTexto: `há ${diferencaMinutos} min` };
    }

    if (diferencaHoras < 24) {
        return { diasSemEdicao, ultimaEdicaoTexto: `há ${diferencaHoras} h` };
    }

    if (diasSemEdicao === 1) {
        return { diasSemEdicao, ultimaEdicaoTexto: 'ontem' };
    }

    return { diasSemEdicao, ultimaEdicaoTexto: `há ${diasSemEdicao} dias` };
};

export const processarHistorico = (historico) => {
    if (!Array.isArray(historico)) return [];

    return historico
        .map((item) => {
            const inicio = toDateValue(item.dataInicio) || toDateValue(item.dataRetirada) || new Date();
            const fim = toDateValue(item.dataTermino) || toDateValue(item.dataDevolucao) || new Date();
            const listaNomes = Array.isArray(item.responsaveis)
                ? item.responsaveis.join(', ')
                : (item.responsavel || 'Desconhecido');

            return {
                nomes: listaNomes,
                inicio: inicio && !Number.isNaN(inicio.getTime()) ? inicio.toLocaleDateString('pt-BR') : '?',
                termino: fim && !Number.isNaN(fim.getTime()) ? fim.toLocaleDateString('pt-BR') : '?',
                timestampFim: fim || new Date(0)
            };
        })
        .sort((a, b) => b.timestampFim - a.timestampFim)
        .slice(0, 10);
};

export const getGrupoEnderecoBoundsStr = (grupo) => {
    const bounds = grupo?.bounds;
    if (!bounds) return null;

    const { minLat, minLng, maxLat, maxLng } = bounds;
    if (![minLat, minLng, maxLat, maxLng].every((value) => Number.isFinite(Number(value)))) {
        return null;
    }

    return `${minLat},${minLng},${maxLat},${maxLng}`;
};

export const getGrupoEnderecoCentro = (grupo) => {
    const lat = Number(grupo?.centro?.lat);
    const lng = Number(grupo?.centro?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
    }

    const bounds = grupo?.bounds;
    if (!bounds) return null;

    const minLat = Number(bounds.minLat);
    const minLng = Number(bounds.minLng);
    const maxLat = Number(bounds.maxLat);
    const maxLng = Number(bounds.maxLng);
    if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) {
        return null;
    }

    return {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2
    };
};

export const getGrupoEnderecoStatusRelatorio = (grupo) => {
    const status = grupo?.status || GRUPO_ENDERECO_STATUS.ATIVO;
    if (status === GRUPO_ENDERECO_STATUS.ARQUIVADO) return STATUS_ARQUIVADO;
    if (status === GRUPO_ENDERECO_STATUS.FINALIZADO) return TERRITORIO_STATUS.FINALIZADO;
    if (grupo?.designadoPara && getGrupoEnderecoProgresso(grupo).completo) {
        return TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO;
    }
    return grupo?.designadoPara ? 'ocupado' : 'livre';
};

export const getGrupoEnderecoCanonicalKeys = (grupo) => [
    getGrupoEnderecoIdentityKey(grupo?.id),
    getGrupoEnderecoIdentityKey(grupo?.codigo)
].filter(Boolean);

export const buildMapaLinkSearch = (registro) => {
    if (registro.boundsStr) {
        return `bounds=${encodeURIComponent(registro.boundsStr)}`;
    }

    if (Number.isFinite(Number(registro.lat)) && Number.isFinite(Number(registro.lng))) {
        return new URLSearchParams({
            lat: String(registro.lat),
            lng: String(registro.lng),
            z: '17'
        }).toString();
    }

    return '';
};

export const getEnderecoClasseLabel = (classe) => (
    ENDERECO_CLASSE_LABELS[classe] || ENDERECO_CLASSE_LABELS[ENDERECO_CLASSES.CONFIRMADO]
);

export const normalizeFiltroOptionValue = (value) => String(value || '').trim().toLowerCase();
export const normalizeBairroFiltroValue = (value) => normalizeBairroKey(value).toLowerCase();

export const uniqueSortedOptions = (items, getValue, getLabel = getValue, normalizeValue = normalizeFiltroOptionValue) => {
    const optionsMap = new Map();

    items.forEach((item) => {
        const value = normalizeValue(getValue(item));
        if (!value) return;
        if (!optionsMap.has(value)) {
            optionsMap.set(value, String(getLabel(item) || getValue(item) || '').trim());
        }
    });

    return [...optionsMap.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
};

export const getStatusArquivadoFiltroMatch = (registro, filtro) => {
    const isArquivado = registro.status === STATUS_ARQUIVADO;
    if (filtro === FILTRO_ARQUIVADOS_SEM) return !isArquivado;
    if (filtro === FILTRO_ARQUIVADOS_SOMENTE) return isArquivado;
    return true;
};

export const formatarTempo = (dias) => {
    if (!Number.isFinite(Number(dias))) return "Nunca";
    if (dias === 0) return "Hoje";
    if (dias < 30) return `${dias} dias`;
    const meses = Math.floor(dias / 30);
    const restoDias = dias % 30;
    let texto = `${meses} ${meses > 1 ? 'meses' : 'mês'}`;
    if (restoDias > 0) texto += ` e ${restoDias} ${restoDias > 1 ? 'dias' : 'dia'}`;
    return texto;
};

export const formatarTempoTerritorio = (territorio) => (
    territorio?.nuncaTrabalhado ? 'Nunca' : formatarTempo(territorio?.diasParado || 0)
);

export const getStatusVisual = (status, porcentagem) => {
    if (status === STATUS_ARQUIVADO) {
        return {
            label: 'Arquivado',
            badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
            detailClass: 'text-slate-500',
            style: null,
            progressoTexto: 'Fora do mapa padrão'
        };
    }

    if (status === TERRITORIO_STATUS.FINALIZADO) {
        return {
            label: 'Finalizado',
            badgeClass: 'bg-green-100 text-green-700 border border-green-200',
            detailClass: 'text-green-600',
            style: null,
            progressoTexto: 'Concluído oficialmente'
        };
    }

    if (status === TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO) {
        return {
            label: 'Aguardando',
            badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
            detailClass: 'text-yellow-700',
            style: null,
            progressoTexto: '100% aguardando confirmação'
        };
    }

    if (status === 'ocupado') {
        return {
            label: 'Ocupado',
            badgeClass: null,
            detailClass: 'text-slate-400',
            style: {
                background: `linear-gradient(90deg, #15803d ${porcentagem}%, #3b82f6 ${porcentagem}%)`,
                textShadow: '0px 1px 1px rgba(0,0,0,0.3)'
            },
            progressoTexto: `${porcentagem}% concluído`
        };
    }

    return {
        label: 'Livre',
        badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
        detailClass: 'text-slate-400',
        style: null,
        progressoTexto: 'Disponível'
    };
};

export const getCorTempo = (dias) => {
    if (!Number.isFinite(Number(dias))) return 'bg-orange-600 text-white';
    if (dias > 180) return 'bg-orange-600 text-white';
    if (dias > 120) return 'bg-orange-500 text-white';
    if (dias > 60) return 'bg-orange-300 text-orange-900';
    if (dias > 0) return 'bg-orange-100 text-orange-800';
    return 'bg-slate-100 text-slate-500';
};

export const getBadgeColorTempo = getCorTempo;


