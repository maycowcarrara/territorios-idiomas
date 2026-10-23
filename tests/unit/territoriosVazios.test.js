import { beforeEach, expect, it, vi } from 'vitest';
import { grupoSemEnderecos } from '../../src/mapa/utils/grupoSemEnderecos.js';
let docs, writes;
vi.mock('firebase/firestore', async original => ({
    ...await original(),
    doc: (_db, coll, id) => ({ path: `${coll}/${id}` }),
    runTransaction: async (_db, callback) => callback({
        get: async ref => ({ exists: () => docs.has(ref.path), data: () => structuredClone(docs.get(ref.path)) }),
        set: (ref, data, options) => { writes.push({ path: ref.path, data, options }); docs.set(ref.path, { ...docs.get(ref.path), ...data }); }
    })
}));
import { removerEnderecoDoGrupo, setGrupoEnderecoArquivado, adicionarEnderecosAoGrupo, getProximoGrupoEnderecoSequencia } from '../../src/enderecoModel.js';
const admin = { email: 'admin@example.test', isAdmin: true };
const seed = { codigo: 'ES-SBS-T014', status: 'ativo', enderecoIds: ['e1'], totalEnderecos: 1, centro: { lat: -26, lng: -49 }, historico: [{ nota: 'preservar' }], cartaoId: 'permanente' };
beforeEach(() => {
    writes = [];
    docs = new Map([
        ['grupos_enderecos/g14', structuredClone(seed)],
        ['enderecos/e1', { codigo: 'E-1', status: 'ativo', grupoId: 'g14', lat: -26, lng: -49 }]
    ]);
});
it('reconhece vazio sem depender da existência de posição antiga', () => {
    expect(grupoSemEnderecos({ enderecoIds: [], centro: seed.centro })).toBe(true);
    expect(grupoSemEnderecos({ totalEnderecos: 0 })).toBe(true);
    expect(grupoSemEnderecos({ enderecoIds: ['e1'], totalEnderecos: 0 })).toBe(false);
    expect(grupoSemEnderecos({ totalEnderecos: 2 })).toBe(false);
});
it('retorna o esvaziamento confirmado pela transação e preserva identidade/histórico', async () => {
    const result = await removerEnderecoDoGrupo({}, { enderecoId: 'e1', grupoId: 'g14', user: admin });
    expect(result).toEqual({ grupoId: 'g14', codigo: seed.codigo, grupoFicouVazio: true });
    expect(docs.get('grupos_enderecos/g14')).toMatchObject({ codigo: seed.codigo, historico: seed.historico, cartaoId: seed.cartaoId, enderecoIds: [], totalEnderecos: 0, centro: seed.centro });
    expect(docs.get('enderecos/e1').grupoId).toBe(null);
});
it('não oferece arquivamento por esvaziamento quando ainda há endereço', async () => {
    docs.get('grupos_enderecos/g14').enderecoIds.push('e2');
    docs.set('enderecos/e2', { status: 'ativo', grupoId: 'g14', lat: -26.1, lng: -49.1 });
    expect((await removerEnderecoDoGrupo({}, { enderecoId: 'e1', grupoId: 'g14', user: admin })).grupoFicouVazio).toBe(false);
});
it('arquiva e reativa o vazio mantendo número, histórico, QR e reserva da numeração', async () => {
    Object.assign(docs.get('grupos_enderecos/g14'), { enderecoIds: [], totalEnderecos: 0 });
    await setGrupoEnderecoArquivado({}, 'g14', true, admin, { somenteSeVazio: true });
    expect(docs.get('grupos_enderecos/g14')).toMatchObject({ status: 'arquivado', codigo: seed.codigo, cartaoId: seed.cartaoId, historico: seed.historico });
    expect(getProximoGrupoEnderecoSequencia([docs.get('grupos_enderecos/g14')]).proximoNumero).toBe(15);
    await setGrupoEnderecoArquivado({}, 'g14', false, admin);
    expect(docs.get('grupos_enderecos/g14')).toMatchObject({ status: 'ativo', enderecoIds: [], codigo: seed.codigo });
});
it('recusa arquivamento após remoção se outro endereço foi incluído enquanto o usuário confirmava', async () => {
    await expect(setGrupoEnderecoArquivado({}, 'g14', true, admin, { somenteSeVazio: true })).rejects.toThrow('recebeu endereços');
    expect(writes).toHaveLength(0);
});
it('recusa arquivamento sem administrador ou com designação por link', async () => {
    await expect(setGrupoEnderecoArquivado({}, 'g14', true, { email: 'comum@example.test' })).rejects.toThrow('administradores');
    docs.get('grupos_enderecos/g14').designacaoTipo = 'link';
    await expect(setGrupoEnderecoArquivado({}, 'g14', true, admin)).rejects.toThrow();
    expect(writes).toHaveLength(0);
});
it('permite reutilizar o território vazio ativo e recalcula sua posição', async () => {
    Object.assign(docs.get('grupos_enderecos/g14'), { enderecoIds: [], totalEnderecos: 0 });
    Object.assign(docs.get('enderecos/e1'), { grupoId: null, grupoCodigo: null, lat: -25, lng: -48 });
    await adicionarEnderecosAoGrupo({}, { enderecoIds: ['e1'], grupoId: 'g14', user: admin });
    expect(docs.get('grupos_enderecos/g14')).toMatchObject({ codigo: seed.codigo, enderecoIds: ['e1'], totalEnderecos: 1, centro: { lat: -25, lng: -48 } });
    expect(grupoSemEnderecos(docs.get('grupos_enderecos/g14'))).toBe(false);
});
