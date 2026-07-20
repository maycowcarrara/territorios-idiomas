export const NORMAL_CONTEXT_ID = 'normal';
export const SISTEMA_CONFIG_PATH = ['configuracoes', 'sistema'];

export function slugifyCampanha(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
}

export function getDefaultSistemaConfig() {
    return {
        contextoAtivoId: NORMAL_CONTEXT_ID,
        contextoAtivoTipo: 'normal',
        contextoAtivoTitulo: 'Pregação normal',
        contextoAtivoCor: 'blue',
        campanhaAtiva: false
    };
}

export function normalizeSistemaConfig(rawConfig) {
    const fallback = getDefaultSistemaConfig();
    if (!rawConfig) return fallback;

    const campanhaLegada = rawConfig.campanha_ativa;
    const nomeCampanhaLegada = rawConfig.nome_campanha;

    if (campanhaLegada && campanhaLegada !== NORMAL_CONTEXT_ID) {
        return {
            contextoAtivoId: campanhaLegada,
            contextoAtivoTipo: 'campanha',
            contextoAtivoTitulo: nomeCampanhaLegada || rawConfig.contextoAtivoTitulo || 'Campanha ativa',
            contextoAtivoCor: rawConfig.contextoAtivoCor || 'violet',
            campanhaAtiva: true
        };
    }

    const contextoAtivoId = rawConfig.contextoAtivoId || NORMAL_CONTEXT_ID;
    const contextoAtivoTipo = rawConfig.contextoAtivoTipo || (contextoAtivoId === NORMAL_CONTEXT_ID ? 'normal' : 'campanha');
    const campanhaAtiva = contextoAtivoTipo === 'campanha' && contextoAtivoId !== NORMAL_CONTEXT_ID;

    return {
        contextoAtivoId,
        contextoAtivoTipo,
        contextoAtivoTitulo: rawConfig.contextoAtivoTitulo || (campanhaAtiva ? 'Campanha ativa' : fallback.contextoAtivoTitulo),
        contextoAtivoCor: rawConfig.contextoAtivoCor || (campanhaAtiva ? 'violet' : fallback.contextoAtivoCor),
        campanhaAtiva
    };
}

export function isNormalContext(contextoId) {
    return !contextoId || contextoId === NORMAL_CONTEXT_ID;
}

export function getSistemaTheme(config) {
    const contexto = normalizeSistemaConfig(config);

    if (!contexto.campanhaAtiva) {
        return {
            headerBg: 'bg-blue-600',
            headerBorder: 'border-blue-400/40',
            headerHover: 'hover:bg-blue-700',
            headerSoft: 'bg-blue-700/80',
            headerSoftHover: 'hover:bg-blue-800',
            chipBg: 'bg-blue-800/60',
            chipText: 'text-blue-50',
            chipBorder: 'border-blue-300/40',
            panelBg: 'bg-blue-50',
            panelBorder: 'border-blue-100',
            panelText: 'text-blue-700',
            accentText: 'text-blue-600'
        };
    }

    return {
        headerBg: 'bg-violet-600',
        headerBorder: 'border-violet-300/40',
        headerHover: 'hover:bg-violet-700',
        headerSoft: 'bg-violet-700/80',
        headerSoftHover: 'hover:bg-violet-800',
        chipBg: 'bg-violet-900/50',
        chipText: 'text-violet-50',
        chipBorder: 'border-violet-200/40',
        panelBg: 'bg-violet-50',
        panelBorder: 'border-violet-100',
        panelText: 'text-violet-700',
        accentText: 'text-violet-600'
    };
}
