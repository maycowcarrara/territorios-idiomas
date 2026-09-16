import { describe, it, expect } from 'vitest';
import {
    normalizeEnderecoConfig,
    getEnderecoIdiomasAtivos,
    getEnderecoConfigForIdioma,
    getEnderecoCodigoPadraoFromConfig,
    getGrupoEnderecoCodigoPadraoFromConfig,
    DEFAULT_ENDERECO_CONFIG
} from '../../src/enderecoConfig.js';

describe('enderecoConfig', () => {
    describe('normalizeEnderecoConfig', () => {
        it('deve retornar configuração padrão completa quando receber objeto vazio', () => {
            const config = normalizeEnderecoConfig({});
            expect(config.idiomaPadraoId).toBe(DEFAULT_ENDERECO_CONFIG.idiomaPadraoId);
            expect(config.cidadePadrao).toBe(DEFAULT_ENDERECO_CONFIG.cidadePadrao);
            expect(config.ufPadrao).toBe(DEFAULT_ENDERECO_CONFIG.ufPadrao);
            expect(config.idiomas.length).toBeGreaterThan(0);
        });

        it('deve deduplicar idiomas com mesmo ID e normalizar ID para minúsculas', () => {
            const config = normalizeEnderecoConfig({
                idiomas: [
                    { id: 'es-ES', nome: 'Espanhol', ativo: true },
                    { id: 'es-es', nome: 'Espanhol Duplicado', ativo: true },
                    { id: 'en-US', nome: 'Inglês', ativo: true }
                ]
            });

            const esLanguages = config.idiomas.filter((item) => item.id === 'es-es');
            expect(esLanguages).toHaveLength(1);
            expect(config.idiomas).toHaveLength(2);
        });

        it('deve selecionar como padrão o primeiro idioma ativo caso o indicado seja inativo', () => {
            const config = normalizeEnderecoConfig({
                idiomaPadraoId: 'es-es',
                idiomas: [
                    { id: 'es-es', nome: 'Espanhol', ativo: false },
                    { id: 'en-us', nome: 'Inglês', ativo: true }
                ]
            });

            expect(config.idiomaPadraoId).toBe('en-us');
            expect(config.idiomaPadraoNome).toBe('Inglês');
        });
    });

    describe('getEnderecoIdiomasAtivos', () => {
        it('deve filtrar apenas idiomas marcados como ativos com IDs normalizados', () => {
            const config = {
                idiomas: [
                    { id: 'es-ES', nome: 'Espanhol', ativo: true },
                    { id: 'fr-FR', nome: 'Francês', ativo: false },
                    { id: 'en-US', nome: 'Inglês', ativo: true }
                ]
            };

            const ativos = getEnderecoIdiomasAtivos(config);
            expect(ativos).toHaveLength(2);
            expect(ativos.map((i) => i.id)).toEqual(['es-es', 'en-us']);
        });
    });

    describe('getEnderecoConfigForIdioma', () => {
        it('deve retornar prefixos específicos do idioma selecionado', () => {
            const config = {
                idiomaPadraoId: 'es-es',
                idiomas: [
                    {
                        id: 'es-es',
                        nome: 'Espanhol',
                        ativo: true,
                        codigoPrefixoEndereco: 'ES-SBS-',
                        codigoPrefixoTerritorio: 'ES-SBS-T'
                    },
                    {
                        id: 'en-us',
                        nome: 'Inglês',
                        ativo: true,
                        codigoPrefixoEndereco: 'EN-SBS-',
                        codigoPrefixoTerritorio: 'EN-SBS-T'
                    }
                ]
            };

            const configEn = getEnderecoConfigForIdioma(config, 'en-US');
            expect(configEn.idiomaPadraoId).toBe('en-us');
            expect(configEn.prefixoEnderecoPadrao).toBe('EN-SBS-');
            expect(configEn.prefixoTerritorioPadrao).toBe('EN-SBS-T');
        });

        it('deve fazer fallback para o idioma padrão quando o solicitado não for encontrado', () => {
            const config = {
                idiomaPadraoId: 'es-es',
                idiomas: [
                    {
                        id: 'es-es',
                        nome: 'Espanhol',
                        ativo: true,
                        codigoPrefixoEndereco: 'ES-SBS-',
                        codigoPrefixoTerritorio: 'ES-SBS-T'
                    }
                ]
            };

            const configInexistente = getEnderecoConfigForIdioma(config, 'de-DE');
            expect(configInexistente.idiomaPadraoId).toBe('es-es');
            expect(configInexistente.prefixoEnderecoPadrao).toBe('ES-SBS-');
        });
    });

    describe('getEnderecoCodigoPadraoFromConfig e getGrupoEnderecoCodigoPadraoFromConfig', () => {
        it('deve gerar códigos padrão com sufixo numérico inicial', () => {
            const config = {
                prefixoEnderecoPadrao: 'ES-SBS-',
                prefixoTerritorioPadrao: 'ES-SBS-T'
            };

            expect(getEnderecoCodigoPadraoFromConfig(config)).toBe('ES-SBS-001');
            expect(getGrupoEnderecoCodigoPadraoFromConfig(config)).toBe('ES-SBS-T01');
        });

        it('não deve duplicar números se o prefixo já terminar com dígito', () => {
            const config = {
                prefixoEnderecoPadrao: 'ES-SBS-1',
                prefixoTerritorioPadrao: 'ES-SBS-T1'
            };

            expect(getEnderecoCodigoPadraoFromConfig(config)).toBe('ES-SBS-1');
            expect(getGrupoEnderecoCodigoPadraoFromConfig(config)).toBe('ES-SBS-T1');
        });
    });
});
