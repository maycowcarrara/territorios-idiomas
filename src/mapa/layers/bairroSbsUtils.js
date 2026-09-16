export const createEmptyBairroResumo = () => ({
    total: 0,
    cobertos: 0,
    faltando: 0,
    emAndamento: 0
});

export const BAIRRO_SBS_COLOR_PALETTE = [
    { fill: '#fecaca', border: '#dc2626', text: '#991b1b' },
    { fill: '#fed7aa', border: '#ea580c', text: '#9a3412' },
    { fill: '#fde68a', border: '#d97706', text: '#92400e' },
    { fill: '#d9f99d', border: '#65a30d', text: '#3f6212' },
    { fill: '#bbf7d0', border: '#16a34a', text: '#166534' },
    { fill: '#99f6e4', border: '#0d9488', text: '#115e59' },
    { fill: '#a7f3d0', border: '#059669', text: '#065f46' },
    { fill: '#bae6fd', border: '#0284c7', text: '#075985' },
    { fill: '#bfdbfe', border: '#2563eb', text: '#1d4ed8' },
    { fill: '#c7d2fe', border: '#4f46e5', text: '#3730a3' },
    { fill: '#ddd6fe', border: '#7c3aed', text: '#5b21b6' },
    { fill: '#f5d0fe', border: '#c026d3', text: '#86198f' },
    { fill: '#fbcfe8', border: '#db2777', text: '#9d174d' },
    { fill: '#e9d5ff', border: '#9333ea', text: '#6b21a8' },
    { fill: '#ccfbf1', border: '#0f766e', text: '#134e4a' },
    { fill: '#cffafe', border: '#0891b2', text: '#155e75' },
    { fill: '#e0f2fe', border: '#0369a1', text: '#075985' },
    { fill: '#fef3c7', border: '#b45309', text: '#78350f' },
    { fill: '#dcfce7', border: '#15803d', text: '#14532d' },
    { fill: '#fae8ff', border: '#a21caf', text: '#701a75' },
    { fill: '#ffe4e6', border: '#e11d48', text: '#9f1239' }
];

export const getBairroSbsColor = (index) => (
    BAIRRO_SBS_COLOR_PALETTE[index % BAIRRO_SBS_COLOR_PALETTE.length]
);
