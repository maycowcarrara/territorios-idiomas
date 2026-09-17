import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentTransaction = null;

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        runTransaction: vi.fn((db, callback) => callback(currentTransaction)),
        doc: vi.fn((db, coll, id) => ({ id, coll })),
        collection: vi.fn((db, name) => ({ name }))
    };
});

import {
    updateGrupoEnderecoBasico
} from '../../src/enderecoModel.js';

describe('Edição de dados do território (updateGrupoEnderecoBasico)', () => {
    const mockUser = {
        email: 'admin@teste.com',
        isAdmin: true
    };

    beforeEach(() => {
        currentTransaction = null;
    });

    it('deve rejeitar chamada sem grupoId válido', async () => {
        const mockDb = {};
        await expect(updateGrupoEnderecoBasico(mockDb, '', { nome: 'Centro' }, mockUser))
            .rejects.toThrow('Identificador do território inválido.');
    });

    it('deve rejeitar chamada se o usuário não for administrador', async () => {
        const mockDb = {};
        const nonAdminUser = { email: 'publicador@teste.com', isAdmin: false };
        await expect(updateGrupoEnderecoBasico(mockDb, 'g_001', { nome: 'Centro' }, nonAdminUser))
            .rejects.toThrow('Apenas administradores podem editar os dados do território.');
    });

    it('deve rejeitar código manual inválido', async () => {
        const mockDb = {};
        await expect(updateGrupoEnderecoBasico(mockDb, 'g_001', { codigo: 'ES_SBS_01' }, mockUser))
            .rejects.toThrow();
    });

    it('deve atualizar dados básicos e timestamps em transação', async () => {
        let setCalls = [];
        const mockGrupoData = {
            codigo: 'ES-SBS-T01',
            nome: 'Território Antigo',
            bairro: 'Centro',
            enderecoIds: ['e_001', 'e_002']
        };

        currentTransaction = {
            get: vi.fn().mockImplementation(async (ref) => {
                if (ref.id === 'g_es_sbs_t01') {
                    return {
                        exists: () => true,
                        id: ref.id,
                        data: () => mockGrupoData
                    };
                }
                return { exists: () => false };
            }),
            set: vi.fn().mockImplementation((ref, data, options) => {
                setCalls.push({ id: ref.id, data, options });
            })
        };

        const mockDb = {};

        const resultado = await updateGrupoEnderecoBasico(
            mockDb,
            'g_es_sbs_t01',
            {
                codigo: 'ES-SBS-T01',
                nome: 'Centro Comercial',
                bairro: 'Centro Expandido',
                observacao: 'Focar no período da tarde'
            },
            mockUser
        );

        expect(resultado.id).toBe('g_es_sbs_t01');
        expect(resultado.codigo).toBe('ES-SBS-T01');
        expect(resultado.nome).toBe('Centro Comercial');

        const updateGrupo = setCalls.find((c) => c.id === 'g_es_sbs_t01');
        expect(updateGrupo).toBeDefined();
        expect(updateGrupo.data.nome).toBe('Centro Comercial');
        expect(updateGrupo.data.bairro).toBe('Centro Expandido');
        expect(updateGrupo.data.observacao).toBe('Focar no período da tarde');
        expect(updateGrupo.data.atualizadoPor).toBe('admin@teste.com');
    });

    it('deve sincronizar grupoCodigo nos endereços vinculados quando o código mudar', async () => {
        let setCalls = [];
        const mockGrupoData = {
            codigo: 'ES-SBS-T01',
            nome: 'Centro',
            enderecoIds: ['e_es_sbs_001', 'e_es_sbs_002']
        };

        currentTransaction = {
            get: vi.fn().mockImplementation(async (ref) => {
                if (ref.id === 'g_es_sbs_t01') {
                    return {
                        exists: () => true,
                        id: ref.id,
                        data: () => mockGrupoData
                    };
                }
                // Outro grupo com o novo código não existe ainda
                return { exists: () => false };
            }),
            set: vi.fn().mockImplementation((ref, data, options) => {
                setCalls.push({ id: ref.id, data, options });
            })
        };

        const mockDb = {};

        const resultado = await updateGrupoEnderecoBasico(
            mockDb,
            'g_es_sbs_t01',
            {
                codigo: 'ES-SBS-T05',
                nome: 'Centro Novo'
            },
            mockUser
        );

        expect(resultado.codigo).toBe('ES-SBS-T05');

        // Deve ter atualizado os 2 endereços vinculados
        const updateEnd1 = setCalls.find((c) => c.id === 'e_es_sbs_001');
        const updateEnd2 = setCalls.find((c) => c.id === 'e_es_sbs_002');
        expect(updateEnd1).toBeDefined();
        expect(updateEnd1.data.grupoCodigo).toBe('ES-SBS-T05');
        expect(updateEnd2).toBeDefined();
        expect(updateEnd2.data.grupoCodigo).toBe('ES-SBS-T05');
    });

    it('deve rejeitar alteração se já existir outro território com o novo código', async () => {
        const mockGrupoData = {
            codigo: 'ES-SBS-T01',
            nome: 'Centro',
            enderecoIds: []
        };

        currentTransaction = {
            get: vi.fn().mockImplementation(async (ref) => {
                if (ref.id === 'g_es_sbs_t01') {
                    return { exists: () => true, id: ref.id, data: () => mockGrupoData };
                }
                if (ref.id === 'g_es_sbs_t02') {
                    // Outro território já existe com esse ID
                    return { exists: () => true, id: ref.id, data: () => ({ codigo: 'ES-SBS-T02' }) };
                }
                return { exists: () => false };
            }),
            set: vi.fn()
        };

        const mockDb = {};

        await expect(updateGrupoEnderecoBasico(
            mockDb,
            'g_es_sbs_t01',
            { codigo: 'ES-SBS-T02' },
            mockUser
        )).rejects.toThrow('Já existe um território cadastrado com o código ES-SBS-T02.');
    });
});
