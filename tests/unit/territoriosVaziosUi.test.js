import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TerritoriosVaziosLista } from '../../src/mapa/components/TerritoriosVaziosLista.jsx';
import { GrupoEnderecoEditModal } from '../../src/mapa/components/GrupoEnderecoEditModal.jsx';
vi.mock('../../src/mapa/utils/mapDomEvents', () => ({ stopMapDomEvent() {}, useLeafletDomEventIsolation: () => null }));
let renderer;
const grupo = { id: 'g14', codigo: 'ES-SBS-T014', nome: 'Território teste', enderecoIds: [], totalEnderecos: 0, status: 'ativo' };
const text = node => node.children.map(c => typeof c === 'string' ? c : text(c)).join('');
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, 'error').mockImplementation(message => { if (!String(message).includes('react-test-renderer is deprecated')) throw new Error(message); });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; vi.restoreAllMocks(); });
it('lista ativos e arquivados sem coordenadas e permite editar, arquivar e reativar', async () => {
    const onEdit = vi.fn(), onToggleArchive = vi.fn();
    const arquivado = { ...grupo, id: 'g15', codigo: 'ES-SBS-T015', status: 'arquivado' };
    await act(async () => { renderer = create(React.createElement(TerritoriosVaziosLista, { grupos: [grupo, arquivado], onEdit, onToggleArchive })); });
    const buttons = renderer.root.findAllByType('button');
    await act(async () => buttons.find(b => text(b) === 'Arquivar').props.onClick());
    expect(onToggleArchive).toHaveBeenLastCalledWith(grupo);
    await act(async () => buttons.find(b => text(b) === 'Reativar').props.onClick());
    expect(onToggleArchive).toHaveBeenLastCalledWith(arquivado);
    await act(async () => buttons.find(b => text(b) === 'Editar').props.onClick());
    expect(onEdit).toHaveBeenCalledWith(grupo);
});
it('bloqueia ações offline ou durante operação e orienta devolução de designações por link', async () => {
    await act(async () => { renderer = create(React.createElement(TerritoriosVaziosLista, { grupos: [grupo, { ...grupo, id: 'g15', designacaoTipo: 'link' }], disabled: true })); });
    expect(renderer.root.findAllByType('button').filter(b => text(b) !== 'Fechar').every(b => b.props.disabled)).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('Devolva a designação');
});
it('exibe o estado vazio e arquivamento dentro da edição', async () => {
    const onToggleArchive = vi.fn();
    await act(async () => { renderer = create(React.createElement(GrupoEnderecoEditModal, { isOpen: true, grupo, todosGrupos: [grupo], onToggleArchive })); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Sem endereços.');
    const archive = renderer.root.findAllByType('button').find(b => text(b) === 'Arquivar território');
    expect(archive.props.type).toBe('button');
    await act(async () => archive.props.onClick());
    expect(onToggleArchive).toHaveBeenCalledWith(grupo);
});
