import { describe, it, expect } from 'vitest';
import {
    normalizeBairroNome,
    normalizeBairroKey,
    resolveBairroNomeOficial,
    buildBairroId
} from '../../src/bairrosSbs.js';

describe('bairrosSbs', () => {
    describe('normalizeBairroNome', () => {
        it('deve remover acentos, caracteres especiais e normalizar espaços em maiúsculas', () => {
            expect(normalizeBairroNome('Centenário')).toBe('CENTENARIO');
            expect(normalizeBairroNome('  bela   aliança  ')).toBe('BELA ALIANCA');
            expect(normalizeBairroNome('25 de Julho')).toBe('25 DE JULHO');
            expect(normalizeBairroNome('Lençol!')).toBe('LENCOL');
        });

        it('deve tratar valores vazios, nulos ou indefinidos', () => {
            expect(normalizeBairroNome('')).toBe('');
            expect(normalizeBairroNome(null)).toBe('');
            expect(normalizeBairroNome(undefined)).toBe('');
        });
    });

    describe('normalizeBairroKey', () => {
        it('deve remover palavras de parada comuns (BAIRRO, DE, DA, DO, DAS, DOS)', () => {
            expect(normalizeBairroKey('Bairro Cruzeiro')).toBe('CRUZEIRO');
            expect(normalizeBairroKey('Bairro de 25 de Julho')).toBe('25JULHO');
            expect(normalizeBairroKey('Bela Aliança')).toBe('BELAALIANCA');
            expect(normalizeBairroKey('Centro')).toBe('CENTRO');
        });
    });

    describe('resolveBairroNomeOficial', () => {
        it('deve resolver o nome oficial com acentuação e grafia correta', () => {
            expect(resolveBairroNomeOficial('cruzeiro')).toBe('Cruzeiro');
            expect(resolveBairroNomeOficial('CENTRO')).toBe('Centro');
            expect(resolveBairroNomeOficial('bela alianca')).toBe('Bela Aliança');
            expect(resolveBairroNomeOficial('centenario')).toBe('Centenário');
            expect(resolveBairroNomeOficial('lencol')).toBe('Lençol');
            expect(resolveBairroNomeOficial('25 de julho')).toBe('25 de Julho');
        });

        it('deve manter o valor original para bairros desconhecidos fora da lista oficial', () => {
            expect(resolveBairroNomeOficial('Bairro Desconhecido ABC')).toBe('Bairro Desconhecido ABC');
            expect(resolveBairroNomeOficial('')).toBe('');
        });
    });

    describe('buildBairroId', () => {
        it('deve gerar identificador em minúsculas separado por hífens', () => {
            expect(buildBairroId('Bela Aliança')).toBe('bela-alianca');
            expect(buildBairroId('25 de Julho')).toBe('25-de-julho');
            expect(buildBairroId('Centro')).toBe('centro');
            expect(buildBairroId('Rio Vermelho Estação')).toBe('rio-vermelho-estacao');
        });
    });
});
