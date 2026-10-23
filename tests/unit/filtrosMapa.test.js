import { expect, it } from 'vitest';
import { grupoVisivelNosFiltros } from '../../src/mapa/utils/grupoSemEnderecos.js';

const ativo = { status: 'ativo', enderecoIds: ['e1'] };
const vazio = { status: 'ativo', enderecoIds: [], centro: { lat: -26, lng: -49 } };
const arquivado = { ...ativo, status: 'arquivado' };
const vazioArquivado = { ...vazio, status: 'arquivado' };
it('mantém vazios e arquivados ocultos por padrão e respeita a visão de endereços para os territórios comuns', () => {
    expect(grupoVisivelNosFiltros(ativo)).toBe(true);
    expect(grupoVisivelNosFiltros({ ...ativo, status: 'finalizado' })).toBe(true);
    for (const grupo of [vazio, arquivado, vazioArquivado]) expect(grupoVisivelNosFiltros(grupo)).toBe(false);
    expect(grupoVisivelNosFiltros(ativo, { modoEnderecos: true })).toBe(false);
});
it.each([false, true])('mostrar arquivados inclui também o território vazio arquivado, com visão de endereços=%s', modoEnderecos => {
    const filtro = { modoEnderecos, mostrarArquivados: true };
    expect(grupoVisivelNosFiltros(arquivado, filtro)).toBe(true);
    expect(grupoVisivelNosFiltros(vazioArquivado, filtro)).toBe(true);
    expect(grupoVisivelNosFiltros(vazio, filtro)).toBe(false);
});
it.each([false, true])('mostrar sem endereços inclui ativos e arquivados vazios, com visão de endereços=%s', modoEnderecos => {
    const filtro = { modoEnderecos, mostrarSemEnderecos: true };
    expect(grupoVisivelNosFiltros(vazio, filtro)).toBe(true);
    expect(grupoVisivelNosFiltros(vazioArquivado, filtro)).toBe(true);
    expect(grupoVisivelNosFiltros(arquivado, filtro)).toBe(false);
});
it('combina os filtros somando categorias; desmarcar uma mantém as categorias ainda selecionadas', () => {
    const grupos = [ativo, vazio, arquivado, vazioArquivado];
    expect(grupos.filter(g => grupoVisivelNosFiltros(g, { mostrarSemEnderecos: true, mostrarArquivados: true }))).toEqual(grupos);
    expect(grupos.filter(g => grupoVisivelNosFiltros(g, { mostrarSemEnderecos: true }))).toEqual([ativo, vazio, vazioArquivado]);
    expect(grupos.filter(g => grupoVisivelNosFiltros(g, { mostrarArquivados: true }))).toEqual([ativo, arquivado, vazioArquivado]);
    expect(grupos.filter(g => grupoVisivelNosFiltros(g))).toEqual([ativo]);
});
