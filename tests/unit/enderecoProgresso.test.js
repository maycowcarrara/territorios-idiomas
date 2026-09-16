import { describe, it, expect } from 'vitest';
import {
    getGrupoEnderecoProgresso,
    calculateGrupoEnderecoStats,
    ENDERECO_STATUS,
    GRUPO_ENDERECO_STATUS
} from '../../src/enderecoModel.js';

describe('enderecoProgresso e estatísticas de grupo', () => {
    describe('getGrupoEnderecoProgresso', () => {
        it('deve retornar progresso zerado para grupo sem endereços', () => {
            const grupo = {
                totalEnderecos: 0,
                enderecos_visitados: [],
                status: GRUPO_ENDERECO_STATUS.ATIVO
            };

            const progresso = getGrupoEnderecoProgresso(grupo);
            expect(progresso.totalEnderecos).toBe(0);
            expect(progresso.visitadosReais).toBe(0);
            expect(progresso.percentualExibicao).toBe(0);
            expect(progresso.completo).toBe(false);
            expect(progresso.isFinalizado).toBe(false);
            expect(progresso.isArquivado).toBe(false);
        });

        it('deve calcular progresso parcial corretamente', () => {
            const grupo = {
                totalEnderecos: 4,
                enderecos_visitados: ['e_1', 'e_2'],
                status: GRUPO_ENDERECO_STATUS.ATIVO
            };

            const progresso = getGrupoEnderecoProgresso(grupo);
            expect(progresso.totalEnderecos).toBe(4);
            expect(progresso.visitadosReais).toBe(2);
            expect(progresso.visitadosExibicao).toBe(2);
            expect(progresso.faltantes).toBe(2);
            expect(progresso.percentualExibicao).toBe(50);
            expect(progresso.completo).toBe(false);
        });

        it('deve marcar completo quando todos os endereços forem visitados', () => {
            const grupo = {
                totalEnderecos: 3,
                enderecos_visitados: ['e_1', 'e_2', 'e_3'],
                status: GRUPO_ENDERECO_STATUS.ATIVO
            };

            const progresso = getGrupoEnderecoProgresso(grupo);
            expect(progresso.visitadosReais).toBe(3);
            expect(progresso.faltantes).toBe(0);
            expect(progresso.percentualExibicao).toBe(100);
            expect(progresso.completo).toBe(true);
        });

        it('deve deduplicar IDs visitados repetidos ou vazios', () => {
            const grupo = {
                totalEnderecos: 4,
                enderecos_visitados: ['e_1', 'e_1', '', null, 'e_2'],
                status: GRUPO_ENDERECO_STATUS.ATIVO
            };

            const progresso = getGrupoEnderecoProgresso(grupo);
            expect(progresso.visitadosReais).toBe(2);
            expect(progresso.percentualExibicao).toBe(50);
        });

        it('deve refletir status finalizado e arquivado', () => {
            const grupoFinalizado = {
                totalEnderecos: 2,
                enderecos_visitados: ['e_1', 'e_2'],
                status: GRUPO_ENDERECO_STATUS.FINALIZADO
            };
            expect(getGrupoEnderecoProgresso(grupoFinalizado).isFinalizado).toBe(true);

            const grupoArquivado = {
                totalEnderecos: 2,
                enderecos_visitados: [],
                status: GRUPO_ENDERECO_STATUS.ARQUIVADO
            };
            expect(getGrupoEnderecoProgresso(grupoArquivado).isArquivado).toBe(true);
        });
    });

    describe('calculateGrupoEnderecoStats', () => {
        it('deve retornar zeros e nulos para lista vazia de endereços', () => {
            const stats = calculateGrupoEnderecoStats([]);
            expect(stats.totalEnderecos).toBe(0);
            expect(stats.totalEstrangeiros).toBe(0);
            expect(stats.centro).toBeNull();
            expect(stats.bounds).toBeNull();
        });

        it('deve ignorar endereços sem coordenadas válidas ou com status arquivado', () => {
            const enderecos = [
                { id: 'e_1', lat: undefined, lng: -49.38, status: ENDERECO_STATUS.ATIVO, quantidadeEstrangeiros: 1 },
                { id: 'e_2', lat: -26.25, lng: 'invalido', status: ENDERECO_STATUS.ATIVO, quantidadeEstrangeiros: 2 },
                { id: 'e_3', lat: -26.25, lng: -49.38, status: ENDERECO_STATUS.ARQUIVADO, quantidadeEstrangeiros: 3 },
                { id: 'e_4', lat: -26.25, lng: -49.38, status: ENDERECO_STATUS.ATIVO, quantidadeEstrangeiros: 2 }
            ];

            const stats = calculateGrupoEnderecoStats(enderecos);
            expect(stats.totalEnderecos).toBe(1);
            expect(stats.totalEstrangeiros).toBe(2);
            expect(stats.centro).toEqual({ lat: -26.25, lng: -49.38 });
        });

        it('deve calcular centroide médio e limites geográficos (bounds)', () => {
            const enderecos = [
                { id: 'e_1', lat: -26.20, lng: -49.40, status: ENDERECO_STATUS.ATIVO, quantidadeEstrangeiros: 2 },
                { id: 'e_2', lat: -26.30, lng: -49.30, status: ENDERECO_STATUS.ATIVO, quantidadeEstrangeiros: 3 }
            ];

            const stats = calculateGrupoEnderecoStats(enderecos);
            expect(stats.totalEnderecos).toBe(2);
            expect(stats.totalEstrangeiros).toBe(5);
            expect(stats.centro.lat).toBeCloseTo(-26.25);
            expect(stats.centro.lng).toBeCloseTo(-49.35);
            expect(stats.bounds).toEqual({
                minLat: -26.30,
                minLng: -49.40,
                maxLat: -26.20,
                maxLng: -49.30
            });
        });
    });
});
