import { expect, it } from 'vitest';
import { getGrupoMapaAppearance, getTerritorioDisponivelColors, MAP_COLORS } from '../../src/mapLegend';

it('mantém o mesmo disponível antes e depois dos limites de antiguidade', () => {
  for (const dias of [0, 60, 61, 120, 121, 180, 181, 720]) {
    expect(getTerritorioDisponivelColors(dias, true)).toEqual(MAP_COLORS.grupoEndereco.ativo);
  }
  expect(getTerritorioDisponivelColors(null, false)).toEqual(MAP_COLORS.grupoEndereco.ativo);
});

it('todos marcados aguardam finalização; só o encerramento confirmado usa verde', () => {
  const designacao = { designado: true, completo: true };
  expect(getGrupoMapaAppearance(designacao).className).toBe('waiting');
  expect(getGrupoMapaAppearance(designacao).colors).toBe(MAP_COLORS.territorio.aguardandoFinalizacao);
  expect(getGrupoMapaAppearance({ ...designacao, finalizado: true }).className).toBe('finished');
  expect(getGrupoMapaAppearance({ ...designacao, finalizado: true }).symbol).toBe('✓');
});

it('arquivamento prevalece sobre designação e finalização anteriores', () => {
  expect(getGrupoMapaAppearance({ arquivado: true, finalizado: true, designado: true, completo: true })).toMatchObject({
    className: 'archived', label: 'Arquivado', colors: MAP_COLORS.grupoEndereco.arquivado
  });
});

it('remoção da designação retorna ao disponível e não indica espera por marcações antigas', () => {
  expect(getGrupoMapaAppearance({ designado: false, completo: true }).label).toBe('Disponível');
  expect(getGrupoMapaAppearance({ designado: true, completo: false }).colors).toBe(MAP_COLORS.territorio.meu);
  expect(MAP_COLORS.territorio.meuAdmin).toEqual(MAP_COLORS.territorio.ocupado);
});
