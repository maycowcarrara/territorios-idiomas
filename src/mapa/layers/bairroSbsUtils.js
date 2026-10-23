export const createEmptyBairroResumo = () => ({
    total: 0,
    cobertos: 0,
    faltando: 0,
    emAndamento: 0
});

// Bairros são contexto geográfico; a cor fica reservada às situações.
export const BAIRRO_SBS_COLOR_PALETTE = [
    { fill: '#64748b', border: '#64748b', text: '#475569' }
];

export const getBairroSbsColor = () => BAIRRO_SBS_COLOR_PALETTE[0];
