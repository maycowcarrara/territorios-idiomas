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
    excluirEndereco,
    getProximoEnderecoSequencia,
    verificarNumeroEnderecoExistente
} from '../../src/enderecoModel.js';

describe('Exclusão de endereço (excluirEndereco) e liberação de código sequencial', () => {
    const mockAdminUser = {
        email: 'admin@teste.com',
        isAdmin: true
    };

    beforeEach(() => {
        currentTransaction = null;
    });

    it('deve rejeitar chamada sem enderecoId válido', async () => {
        const mockDb = {};
        await expect(excluirEndereco(mockDb, '', mockAdminUser))
            .rejects.toThrow('Identificador do endereço inválido.');
        await expect(excluirEndereco(mockDb, null, mockAdminUser))
            .rejects.toThrow('Identificador do endereço inválido.');
    });

    it('deve rejeitar chamada de usuário não administrador', async () => {
        const mockDb = {};
        const nonAdminUser = { email: 'publicador@teste.com', isAdmin: false };
        await expect(excluirEndereco(mockDb, 'e_001', nonAdminUser))
            .rejects.toThrow('Apenas administradores podem excluir endereços.');

        const plainUser = { email: 'publicador@teste.com' };
        await expect(excluirEndereco(mockDb, 'e_001', plainUser))
            .rejects.toThrow('Apenas administradores podem excluir endereços.');
    });

    it('deve lançar erro se o endereço não existir no banco', async () => {
        const mockDb = {};
        currentTransaction = {
            get: vi.fn().mockResolvedValue({
                exists: () => false
            }),
            delete: vi.fn(),
            set: vi.fn()
        };

        await expect(excluirEndereco(mockDb, 'e_inexistente', mockAdminUser))
            .rejects.toThrow('Endereço não encontrado.');
    });

    it('deve excluir fisicamente endereço avulso (sem território) com sucesso', async () => {
        const mockDb = {};
        const deletedRefs = [];

        currentTransaction = {
            get: vi.fn().mockImplementation((ref) => {
                if (ref.id === 'e_001') {
                    return Promise.resolve({
                        exists: () => true,
                        data: () => ({
                            codigo: 'ES-SBS-001',
                            endereco: 'Rua das Flores, 100',
                            grupoId: null,
                            grupoCodigo: null
                        })
                    });
                }
                return Promise.resolve({ exists: () => false });
            }),
            delete: vi.fn().mockImplementation((ref) => {
                deletedRefs.push(ref);
            }),
            set: vi.fn()
        };

        const res = await excluirEndereco(mockDb, 'e_001', mockAdminUser);
        expect(res).toEqual({
            id: 'e_001',
            codigo: 'ES-SBS-001'
        });
        expect(deletedRefs).toHaveLength(1);
        expect(deletedRefs[0].id).toBe('e_001');
        expect(currentTransaction.set).not.toHaveBeenCalled();
    });

    it('deve excluir endereço vinculado a território, removendo-o do território e recalculando estatísticas', async () => {
        const mockDb = {};
        const deletedRefs = [];
        let updatedGrupoData = null;

        const mockEndereco1 = {
            id: 'e_001',
            codigo: 'ES-SBS-001',
            lat: -26.25,
            lng: -49.38,
            quantidadeEstrangeiros: 2,
            status: 'ativo',
            grupoId: 'g_001'
        };

        const mockEndereco2 = {
            id: 'e_002',
            codigo: 'ES-SBS-002',
            lat: -26.26,
            lng: -49.39,
            quantidadeEstrangeiros: 3,
            status: 'ativo',
            grupoId: 'g_001'
        };

        const mockGrupo = {
            codigo: 'ES-SBS-T01',
            enderecoIds: ['e_001', 'e_002'],
            enderecos_visitados: ['e_001'],
            totalEnderecos: 2,
            totalEstrangeiros: 5
        };

        currentTransaction = {
            get: vi.fn().mockImplementation((ref) => {
                if (ref.id === 'e_001') {
                    return Promise.resolve({
                        exists: () => true,
                        id: 'e_001',
                        data: () => mockEndereco1
                    });
                }
                if (ref.id === 'e_002') {
                    return Promise.resolve({
                        exists: () => true,
                        id: 'e_002',
                        data: () => mockEndereco2
                    });
                }
                if (ref.id === 'g_001') {
                    return Promise.resolve({
                        exists: () => true,
                        id: 'g_001',
                        data: () => mockGrupo
                    });
                }
                return Promise.resolve({ exists: () => false });
            }),
            delete: vi.fn().mockImplementation((ref) => {
                deletedRefs.push(ref);
            }),
            set: vi.fn().mockImplementation((ref, data) => {
                if (ref.id === 'g_001') {
                    updatedGrupoData = data;
                }
            })
        };

        const res = await excluirEndereco(mockDb, 'e_001', mockAdminUser);
        expect(res).toEqual({
            id: 'e_001',
            codigo: 'ES-SBS-001'
        });

        // Verificou exclusão física do documento
        expect(deletedRefs).toHaveLength(1);
        expect(deletedRefs[0].id).toBe('e_001');

        // Verificou atualização do território
        expect(updatedGrupoData).toBeDefined();
        expect(updatedGrupoData.enderecoIds).toEqual(['e_002']);
        expect(updatedGrupoData.enderecos_visitados).toEqual([]); // e_001 foi desmarcado de visitado
        expect(updatedGrupoData.totalEnderecos).toBe(1);
        expect(updatedGrupoData.totalEstrangeiros).toBe(3);
    });

    describe('Liberação de código do último número para novos endereços', () => {
        it('ao excluir o último número da sequência, a numeração é liberada para reuso imediato', () => {
            let enderecosNoBanco = [
                { id: 'e_001', codigo: 'ES-SBS-001' },
                { id: 'e_002', codigo: 'ES-SBS-002' },
                { id: 'e_003', codigo: 'ES-SBS-003' }
            ];

            // Com 001, 002, 003 existentes, o próximo sugerido é 004
            let seq = getProximoEnderecoSequencia(enderecosNoBanco, 'ES-SBS-');
            expect(seq.proximoNumero).toBe(4);
            expect(seq.proximoSufixo).toBe('004');
            expect(seq.proximoCodigo).toBe('ES-SBS-004');

            // 003 está ocupado
            expect(verificarNumeroEnderecoExistente(enderecosNoBanco, 'ES-SBS-', '003').existe).toBe(true);

            // Simula a exclusão física do último endereço (e_003 / ES-SBS-003)
            enderecosNoBanco = enderecosNoBanco.filter((e) => e.id !== 'e_003');

            // Agora a lista tem apenas 001 e 002: o próximo sugerido passa a ser 003 novamente!
            seq = getProximoEnderecoSequencia(enderecosNoBanco, 'ES-SBS-');
            expect(seq.proximoNumero).toBe(3);
            expect(seq.proximoSufixo).toBe('003');
            expect(seq.proximoCodigo).toBe('ES-SBS-003');

            // O número 003 não conflita mais
            expect(verificarNumeroEnderecoExistente(enderecosNoBanco, 'ES-SBS-', '003').existe).toBe(false);
            expect(verificarNumeroEnderecoExistente(enderecosNoBanco, 'ES-SBS-', '3').existe).toBe(false);
        });

        it('ao excluir um número intermediário, libera o número específico para reuso sem alterar o próximo maior', () => {
            let enderecosNoBanco = [
                { id: 'e_001', codigo: 'ES-SBS-001' },
                { id: 'e_002', codigo: 'ES-SBS-002' },
                { id: 'e_003', codigo: 'ES-SBS-003' }
            ];

            // Exclui o intermediário 002
            enderecosNoBanco = enderecosNoBanco.filter((e) => e.id !== 'e_002');

            // O código 002 agora está livre
            expect(verificarNumeroEnderecoExistente(enderecosNoBanco, 'ES-SBS-', '002').existe).toBe(false);

            // O maior ainda é 003, então a próxima sequência após o maior segue 004
            const seq = getProximoEnderecoSequencia(enderecosNoBanco, 'ES-SBS-');
            expect(seq.proximoNumero).toBe(4);
            expect(seq.proximoCodigo).toBe('ES-SBS-004');
        });
    });
});
