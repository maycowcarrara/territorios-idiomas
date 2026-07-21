export const MAP_COLORS = {
  territorio: {
    disponivelNunca: { fill: '#fed7aa', border: '#c2410c' },
    disponivelRecente: { fill: '#ffedd5', border: '#c2410c' },
    disponivel60a120: { fill: '#fb923c', border: '#c2410c' },
    disponivel120a180: { fill: '#ea580c', border: '#c2410c' },
    disponivel180Mais: { fill: '#c2410c', border: '#c2410c' },
    meu: { fill: '#3b82f6', border: '#1e40af' },
    meuAdmin: { fill: '#a855f7', border: '#6b21a8' },
    aguardandoFinalizacao: { fill: '#facc15', border: '#ca8a04' },
    finalizado: { fill: '#22c55e', border: '#15803d' },
    ocupado: { fill: '#9ca3af', border: '#4b5563' }
  },
  grupoEndereco: {
    ativo: { fill: '#818cf8', border: '#4f46e5', marker: '#4338ca' },
    designado: { fill: '#bfdbfe', border: '#2563eb', marker: '#2563eb' },
    finalizado: { fill: '#22c55e', border: '#15803d', marker: '#15803d' },
    arquivado: { fill: '#94a3b8', border: '#64748b', marker: '#475569' }
  },
  endereco: {
    ativo: '#0f766e',
    agrupado: '#7c3aed',
    selecionado: '#f59e0b',
    arquivado: '#64748b',
    visitado: '#16a34a',
    pendente: '#ef4444'
  },
  apoio: {
    referencia: '#f43f5e',
    condominio: '#2563eb',
    clique: '#2563eb',
    trilha: '#94a3b8',
    barraProgressoBase: '#374151'
  }
};

export const TERRITORIO_RECENCY_STEPS = [
  {
    id: 'nunca',
    label: 'Nunca trabalhado',
    description: 'Disponível, mas ainda sem registro de conclusão.',
    colors: MAP_COLORS.territorio.disponivelNunca
  },
  {
    id: 'recente',
    label: 'Menos de 2 meses',
    description: 'Disponível e trabalhado recentemente.',
    colors: MAP_COLORS.territorio.disponivelRecente
  },
  {
    id: 'dois-quatro',
    label: '2 a 4 meses',
    description: 'Disponível, com prioridade intermediária.',
    colors: MAP_COLORS.territorio.disponivel60a120
  },
  {
    id: 'quatro-seis',
    label: '4 a 6 meses',
    description: 'Disponível, parado há mais tempo.',
    colors: MAP_COLORS.territorio.disponivel120a180
  },
  {
    id: 'seis-mais',
    label: 'Mais de 6 meses',
    description: 'Disponível com maior prioridade pela antiguidade.',
    colors: MAP_COLORS.territorio.disponivel180Mais
  }
];

export const getTerritorioDisponivelColors = (diasSemTrabalhar, hasUltimaConclusao) => {
  if (!hasUltimaConclusao) return MAP_COLORS.territorio.disponivelNunca;
  if (diasSemTrabalhar > 180) return MAP_COLORS.territorio.disponivel180Mais;
  if (diasSemTrabalhar > 120) return MAP_COLORS.territorio.disponivel120a180;
  if (diasSemTrabalhar > 60) return MAP_COLORS.territorio.disponivel60a120;
  return MAP_COLORS.territorio.disponivelRecente;
};
