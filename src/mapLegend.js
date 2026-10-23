// A cor representa a situação; bairro, vínculo e seleção usam texto ou símbolos.
const disponivel = { fill: '#64748b', border: '#64748b', marker: '#64748b' };
const andamento = { fill: '#2563eb', border: '#2563eb', marker: '#2563eb' };
const concluido = { fill: '#15803d', border: '#15803d', marker: '#15803d' };
const aguardando = { fill: '#b45309', border: '#b45309', marker: '#b45309' };
const arquivado = { fill: '#94a3b8', border: '#64748b', marker: '#64748b' };

export const MAP_COLORS = {
  territorio: {
    disponivelNunca: disponivel,
    disponivelRecente: disponivel,
    disponivel60a120: disponivel,
    disponivel120a180: disponivel,
    disponivel180Mais: disponivel,
    meu: andamento,
    meuAdmin: andamento,
    aguardandoFinalizacao: aguardando,
    finalizado: concluido,
    ocupado: andamento
  },
  grupoEndereco: {
    ativo: disponivel,
    designado: andamento,
    aguardandoFinalizacao: aguardando,
    finalizado: concluido,
    arquivado
  },
  endereco: {
    ativo: '#64748b',
    agrupado: '#64748b',
    selecionado: '#1e293b',
    arquivado: '#64748b',
    visitado: '#15803d',
    pendente: '#64748b'
  },
  apoio: {
    referencia: '#64748b',
    condominio: '#64748b',
    clique: '#2563eb',
    trilha: '#94a3b8',
    barraProgressoBase: '#374151'
  }
};

export function getGrupoMapaAppearance({ arquivado, finalizado, designado, completo }) {
  if (arquivado) return { colors: MAP_COLORS.grupoEndereco.arquivado, className: 'archived', label: 'Arquivado', symbol: '▤' };
  if (finalizado) return { colors: MAP_COLORS.grupoEndereco.finalizado, className: 'finished', label: 'Finalizado', symbol: '✓' };
  if (designado && completo) return { colors: MAP_COLORS.grupoEndereco.aguardandoFinalizacao, className: 'waiting', label: 'Aguardando finalização', symbol: '◷' };
  if (designado) return { colors: MAP_COLORS.grupoEndereco.designado, className: 'assigned', label: 'Designado', symbol: '' };
  return { colors: MAP_COLORS.grupoEndereco.ativo, className: '', label: 'Disponível', symbol: '' };
}

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
