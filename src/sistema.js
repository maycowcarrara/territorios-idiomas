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
            headerBg: 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900',
            headerBorder: 'border-blue-500/20',
            headerHover: 'hover:bg-white/10',
            headerSoft: 'bg-white/10',
            headerSoftHover: 'hover:bg-white/20',
            chipBg: 'bg-blue-900/60',
            chipText: 'text-blue-100',
            chipBorder: 'border-blue-400/30',
            panelBg: 'bg-slate-50',
            panelBorder: 'border-slate-200',
            panelText: 'text-slate-700',
            accentText: 'text-blue-600'
        };
    }

    return {
        headerBg: 'bg-gradient-to-r from-purple-950 via-violet-900 to-slate-900',
        headerBorder: 'border-violet-400/30',
        headerHover: 'hover:bg-white/10',
        headerSoft: 'bg-white/10',
        headerSoftHover: 'hover:bg-white/20',
        chipBg: 'bg-violet-900/70',
        chipText: 'text-violet-100',
        chipBorder: 'border-violet-400/30',
        panelBg: 'bg-violet-50/50',
        panelBorder: 'border-violet-100',
        panelText: 'text-violet-800',
        accentText: 'text-violet-600'
    };
}
