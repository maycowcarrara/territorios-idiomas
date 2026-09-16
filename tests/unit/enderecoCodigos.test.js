import { describe, it, expect } from 'vitest';
import {
    normalizeCodigoManual,
    isCodigoManualValido,
    getEnderecoDocIdFromCodigo,
    getGrupoEnderecoDocIdFromCodigo,
    formatEnderecoCodigo,
    formatEnderecoCodigoExibicao,
    getEnderecoDocIdFromSequence,
    formatGrupoEnderecoCodigo,
    formatGrupoEnderecoCodigoExibicao,
    formatGrupoEnderecoNomeExibicao,
    getGrupoEnderecoDocIdFromSequence
} from '../../src/enderecoModel.js';

describe('enderecoCodigos e formatadores', () => {
    describe('normalizeCodigoManual', () => {
        it('deve converter para maiúsculas e remover espaços periféricos', () => {
            expect(normalizeCodigoManual('  es-sbs-001  ')).toBe('ES-SBS-001');
            expect(normalizeCodigoManual('t-01')).toBe('T-01');
            expect(normalizeCodigoManual(null)).toBe('');
            expect(normalizeCodigoManual(undefined)).toBe('');
        });
    });

    describe('isCodigoManualValido', () => {
        it('deve aceitar códigos válidos com letras, números e hífens', () => {
            expect(isCodigoManualValido('ES-SBS-001')).toBe(true);
            expect(isCodigoManualValido('ES-SBS-T01')).toBe(true);
            expect(isCodigoManualValido('E-0001')).toBe(true);
            expect(isCodigoManualValido('T-001')).toBe(true);
            expect(isCodigoManualValido('ABC-123')).toBe(true);
            expect(isCodigoManualValido('es-sbs-01')).toBe(true); // normaliza antes
        });

        it('deve rejeitar formatos inválidos', () => {
            expect(isCodigoManualValido('')).toBe(false);
            expect(isCodigoManualValido('   ')).toBe(false);
            expect(isCodigoManualValido('12345')).toBe(false); // sem hífen
            expect(isCodigoManualValido('ES--01')).toBe(false); // hífen duplo
            expect(isCodigoManualValido('ES-')).toBe(false); // hífen no final
            expect(isCodigoManualValido('-ES')).toBe(false); // hífen no início
            expect(isCodigoManualValido('ES SBS 01')).toBe(false); // espaços
            expect(isCodigoManualValido('ES_SBS_01')).toBe(false); // underscore
        });
    });

    describe('distinção entre código e ID do documento', () => {
        it('getEnderecoDocIdFromCodigo deve gerar ID canônico em minúsculas com prefixo e_ e underscores', () => {
            expect(getEnderecoDocIdFromCodigo('ES-SBS-001')).toBe('e_es_sbs_001');
            expect(getEnderecoDocIdFromCodigo('E-0001')).toBe('e_e_0001');
        });

        it('getGrupoEnderecoDocIdFromCodigo deve gerar ID canônico em minúsculas com prefixo g_ e underscores', () => {
            expect(getGrupoEnderecoDocIdFromCodigo('ES-SBS-T01')).toBe('g_es_sbs_t01');
            expect(getGrupoEnderecoDocIdFromCodigo('T-001')).toBe('g_t_001');
        });
    });

    describe('formatadores e geradores de sequência de endereços', () => {
        it('formatEnderecoCodigo deve formatar com largura padrão de 4 dígitos', () => {
            expect(formatEnderecoCodigo(1)).toBe('E-0001');
            expect(formatEnderecoCodigo(25)).toBe('E-0025');
            expect(formatEnderecoCodigo(9999)).toBe('E-9999');
            expect(formatEnderecoCodigo(0)).toBe('E-0001'); // fallback mínimo 1
        });

        it('formatEnderecoCodigoExibicao deve simplificar zeros à esquerda mantendo padrão amigável', () => {
            expect(formatEnderecoCodigoExibicao('E-0001')).toBe('E-1');
            expect(formatEnderecoCodigoExibicao('e_0025')).toBe('E-25');
            expect(formatEnderecoCodigoExibicao('ES-SBS-001')).toBe('ES-SBS-001'); // não altera código manual
        });

        it('getEnderecoDocIdFromSequence deve gerar ID sequencial e_XXXX', () => {
            expect(getEnderecoDocIdFromSequence(1)).toBe('e_0001');
            expect(getEnderecoDocIdFromSequence(123)).toBe('e_0123');
        });
    });

    describe('formatadores e geradores de sequência de grupos/territórios', () => {
        it('formatGrupoEnderecoCodigo deve formatar com largura padrão de 3 dígitos', () => {
            expect(formatGrupoEnderecoCodigo(1)).toBe('T-001');
            expect(formatGrupoEnderecoCodigo(10)).toBe('T-010');
            expect(formatGrupoEnderecoCodigo(0)).toBe('T-001');
        });

        it('formatGrupoEnderecoCodigoExibicao deve simplificar zeros à esquerda', () => {
            expect(formatGrupoEnderecoCodigoExibicao('T-001')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoExibicao('g_010')).toBe('T-10');
            expect(formatGrupoEnderecoCodigoExibicao('ES-SBS-T01')).toBe('ES-SBS-T01');
        });

        it('formatGrupoEnderecoNomeExibicao deve formatar o nome ou fallback para Território T-X', () => {
            expect(formatGrupoEnderecoNomeExibicao('', 'T-001')).toBe('Território T-1');
            expect(formatGrupoEnderecoNomeExibicao('T-001', 'T-001')).toBe('Território T-1');
            expect(formatGrupoEnderecoNomeExibicao('T-005 Centro', 'T-005')).toBe('T-5 Centro');
            expect(formatGrupoEnderecoNomeExibicao('Região Industrial', 'T-002')).toBe('Região Industrial');
        });

        it('getGrupoEnderecoDocIdFromSequence deve gerar ID sequencial g_XXX', () => {
            expect(getGrupoEnderecoDocIdFromSequence(1)).toBe('g_001');
            expect(getGrupoEnderecoDocIdFromSequence(42)).toBe('g_042');
        });
    });
});
