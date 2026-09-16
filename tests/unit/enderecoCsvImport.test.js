import { describe, it, expect } from 'vitest';
import {
    parseEnderecoCsvRows,
    buildEnderecoCsvPreview,
    analyzeEnderecoCsvImport,
    applyEnderecoCsvGeocoding
} from '../../src/enderecoCsvImport.js';
import { ENDERECO_STATUS } from '../../src/enderecoModel.js';

describe('enderecoCsvImport', () => {
    const mockConfig = {
        idiomaPadraoId: 'es',
        prefixoEnderecoPadrao: 'ES-SBS-',
        prefixoTerritorioPadrao: 'ES-SBS-T',
        cidadePadrao: 'São Bento do Sul',
        ufPadrao: 'SC',
        buscaEndereco: {
            viewbox: {
                left: -49.55,
                bottom: -26.35,
                right: -49.25,
                top: -26.15
            }
        }
    };

    describe('parseEnderecoCsvRows', () => {
        it('deve processar cabeçalhos com aliases em espanhol, português e inglês', () => {
            const csvText = [
                'Territory,Codigo,Barrio,Direccion,Informacion,Class,LatLong',
                'ES-SBS-T01,ES-SBS-001,Centro,"Rua das Flores, 100",Apto 1,confirmado,"-26.25, -49.38"'
            ].join('\n');

            const rows = parseEnderecoCsvRows(csvText, mockConfig);
            expect(rows).toHaveLength(1);
            expect(rows[0].territorioCodigo).toBe('ES-SBS-T01');
            expect(rows[0].codigo).toBe('ES-SBS-001');
            expect(rows[0].bairro).toBe('Centro');
            expect(rows[0].endereco).toBe('Rua das Flores, 100');
            expect(rows[0].informacao).toBe('Apto 1');
            expect(rows[0].lat).toBeCloseTo(-26.25);
            expect(rows[0].lng).toBeCloseTo(-49.38);
        });

        it('deve tratar aspas duplas escapadas e quebras de linha dentro de células', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-002,Cruzeiro,"Rua Principal, 50","Observacao com ""aspas"" e\nquebra de linha",estudo,1,"-26.24, -49.39"'
            ].join('\n');

            const rows = parseEnderecoCsvRows(csvText, mockConfig);
            expect(rows).toHaveLength(1);
            expect(rows[0].endereco).toBe('Rua Principal, 50');
            expect(rows[0].informacao).toContain('Observacao com "aspas" e\nquebra de linha');
            expect(rows[0].lat).toBeCloseTo(-26.24);
            expect(rows[0].lng).toBeCloseTo(-49.39);
        });

        it('deve suportar BOM (Byte Order Mark) no início do arquivo', () => {
            const csvText = '\uFEFFterritorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong\nES-SBS-T01,ES-SBS-003,Centro,Rua A,,,,"-26.25,-49.38"';
            const rows = parseEnderecoCsvRows(csvText, mockConfig);
            expect(rows).toHaveLength(1);
            expect(rows[0].territorioCodigo).toBe('ES-SBS-T01');
            expect(rows[0].codigo).toBe('ES-SBS-003');
        });

        it('deve corrigir o sinal da longitude positiva quando estiver na área do Brasil', () => {
            // Em SBS a longitude é oeste (-49.38). Se vier positivo (49.38), deve inverter para -49.38
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-005,Centro,Rua C,,,, "-26.25, 49.38"'
            ].join('\n');

            const rows = parseEnderecoCsvRows(csvText, mockConfig);
            expect(rows).toHaveLength(1);
            expect(rows[0].lng).toBeCloseTo(-49.38);
        });

        it('deve deixar coordenadas nulas quando o ponto estiver fora da área delimitada', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-006,Centro,Rua Longe,,,, "-20.00, -40.00"'
            ].join('\n');

            const rows = parseEnderecoCsvRows(csvText, mockConfig);
            expect(rows).toHaveLength(1);
            expect(rows[0].lat).toBeNull();
            expect(rows[0].lng).toBeNull();
        });
    });

    describe('buildEnderecoCsvPreview e analyzeEnderecoCsvImport', () => {
        it('deve classificar inserções de novos endereços corretamente', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua Nova 1,,,, "-26.25, -49.38"'
            ].join('\n');

            const preview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig,
                existingEnderecos: [],
                existingGrupos: []
            });

            expect(preview.totals.total).toBe(1);
            expect(preview.totals.novos).toBe(1);
            expect(preview.totals.inserir).toBe(1);
            expect(preview.totals.aplicar).toBe(1);
            expect(preview.rows[0].action).toBe('novo');
            expect(preview.rows[0].canInsert).toBe(true);
        });

        it('deve gerar prévia diretamente a partir de linhas parseadas via buildEnderecoCsvPreview', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua Direta 1,,,, "-26.25, -49.38"'
            ].join('\n');

            const rows = parseEnderecoCsvRows(csvText, mockConfig);
            const preview = buildEnderecoCsvPreview(rows, { config: mockConfig });
            expect(preview.totals.total).toBe(1);
            expect(preview.totals.novos).toBe(1);
            expect(preview.rows[0].canInsert).toBe(true);
        });

        it('deve detectar código duplicado dentro da própria planilha', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua A,,,, "-26.25, -49.38"',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua B,,,, "-26.26, -49.37"'
            ].join('\n');

            const preview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig,
                existingEnderecos: [],
                existingGrupos: []
            });

            expect(preview.totals.duplicados).toBe(2);
            expect(preview.totals.aplicar).toBe(0);
            expect(preview.rows[0].duplicate).toBe(true);
            expect(preview.rows[0].errors).toContain('Código duplicado na planilha.');
            expect(preview.rows[1].duplicate).toBe(true);
        });

        it('deve classificar endereço existente sem alterações como "existente"', () => {
            const existingEnderecos = [{
                id: 'e_es_sbs_001',
                codigo: 'ES-SBS-001',
                grupoCodigo: 'ES-SBS-T01',
                bairro: 'Centro',
                endereco: 'Rua A',
                informacao: '',
                observacao: '',
                classe: 'confirmado',
                quantidadeEstrangeiros: 1,
                idiomaId: 'es',
                idiomaNome: 'Espanhol',
                lat: -26.25,
                lng: -49.38,
                status: ENDERECO_STATUS.ATIVO
            }];

            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua A,,confirmado,1,"-26.25, -49.38"'
            ].join('\n');

            const preview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig,
                existingEnderecos,
                existingGrupos: []
            });

            expect(preview.totals.existentes).toBe(1);
            expect(preview.totals.atualizar).toBe(0);
            expect(preview.rows[0].action).toBe('existente');
            expect(preview.rows[0].canUpdate).toBe(false);
            expect(preview.rows[0].canApply).toBe(false);
        });

        it('deve classificar endereço existente com alterações permitidas como "atualizar"', () => {
            const existingEnderecos = [{
                id: 'e_es_sbs_001',
                codigo: 'ES-SBS-001',
                grupoCodigo: 'ES-SBS-T01',
                bairro: 'Centro',
                endereco: 'Rua A',
                informacao: 'Antiga info',
                observacao: 'Antiga info',
                classe: 'verificar',
                quantidadeEstrangeiros: 1,
                idiomaId: 'es',
                idiomaNome: 'Espanhol',
                lat: -26.25,
                lng: -49.38,
                status: ENDERECO_STATUS.ATIVO
            }];

            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua A,Nova info,confirmado,2,"-26.25, -49.38"'
            ].join('\n');

            const preview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig,
                existingEnderecos,
                existingGrupos: []
            });

            expect(preview.totals.existentes).toBe(1);
            expect(preview.totals.atualizar).toBe(1);
            expect(preview.totals.aplicar).toBe(1);
            expect(preview.rows[0].action).toBe('atualizar');
            expect(preview.rows[0].canUpdate).toBe(true);
            expect(preview.rows[0].canApply).toBe(true);
        });

        it('deve bloquear conflito se o endereço já pertencer a outro território', () => {
            const existingEnderecos = [{
                id: 'e_es_sbs_001',
                codigo: 'ES-SBS-001',
                grupoCodigo: 'ES-SBS-T01',
                bairro: 'Centro',
                endereco: 'Rua A',
                lat: -26.25,
                lng: -49.38,
                status: ENDERECO_STATUS.ATIVO
            }];

            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T02,ES-SBS-001,Centro,Rua A,,,, "-26.25, -49.38"'
            ].join('\n');

            const preview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig,
                existingEnderecos,
                existingGrupos: []
            });

            expect(preview.totals.conflitos).toBe(1);
            expect(preview.rows[0].action).toBe('conflito');
            expect(preview.rows[0].canApply).toBe(false);
            expect(preview.rows[0].conflicts).toContain('Endereço já está no território ES-SBS-T01.');
        });

        it('deve identificar linhas sem coordenadas e montar query de geocodificação', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua Sem GPS,,,,'
            ].join('\n');

            const preview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig,
                existingEnderecos: [],
                existingGrupos: []
            });

            expect(preview.totals.semCoordenada).toBe(1);
            expect(preview.rows[0].action).toBe('sem-coordenada');
            expect(preview.rows[0].hasCoordinates).toBe(false);
            expect(preview.rows[0].canInsert).toBe(false);
            expect(preview.rows[0].geocodeQuery).toContain('Rua Sem GPS');
        });
    });

    describe('applyEnderecoCsvGeocoding', () => {
        it('deve aplicar coordenadas geocodificadas sintéticas sem efetuar chamadas externas', () => {
            const csvText = [
                'territorio,codigo,bairro,endereco,informacao,classe,quantidade,latLong',
                'ES-SBS-T01,ES-SBS-001,Centro,Rua Sem GPS,,,,'
            ].join('\n');

            const initialPreview = analyzeEnderecoCsvImport({
                csvText,
                config: mockConfig
            });

            const rowKey = initialPreview.rows[0].rowKey;
            const updatedPreview = applyEnderecoCsvGeocoding(initialPreview, {
                coordinatesByRowKey: {
                    [rowKey]: { lat: -26.251, lng: -49.381 }
                },
                config: mockConfig
            });

            expect(updatedPreview.rows[0].hasCoordinates).toBe(true);
            expect(updatedPreview.rows[0].lat).toBeCloseTo(-26.251);
            expect(updatedPreview.rows[0].lng).toBeCloseTo(-49.381);
            expect(updatedPreview.rows[0].coordenadaOrigem).toBe('geocodificacao');
            expect(updatedPreview.rows[0].canInsert).toBe(true);
            expect(updatedPreview.totals.semCoordenada).toBe(0);
            expect(updatedPreview.totals.novos).toBe(1);
        });
    });
});
