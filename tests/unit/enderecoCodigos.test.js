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
    formatGrupoEnderecoCodigoMarcador,
    formatGrupoEnderecoCodigoBadge,
    formatGrupoEnderecoNomeExibicao,
    getGrupoEnderecoDocIdFromSequence,
    getProximoGrupoEnderecoSequencia,
    verificarNumeroGrupoEnderecoExistente,
    getProximoEnderecoSequencia,
    verificarNumeroEnderecoExistente
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

        it('formatGrupoEnderecoCodigoExibicao deve simplificar zeros à esquerda e decodificar docId', () => {
            expect(formatGrupoEnderecoCodigoExibicao('T-001')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoExibicao('g_010')).toBe('T-10');
            expect(formatGrupoEnderecoCodigoExibicao('ES-SBS-T01')).toBe('ES-SBS-T01');
            expect(formatGrupoEnderecoCodigoExibicao('g_es_sbs_t01')).toBe('ES-SBS-T01');
            expect(formatGrupoEnderecoCodigoExibicao('g_t_001')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoExibicao('g_t_01')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoExibicao('')).toBe('');
        });

        it('formatGrupoEnderecoCodigoMarcador deve extrair formato curto para pino do mapa', () => {
            expect(formatGrupoEnderecoCodigoMarcador('ES-SBS-T01')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoMarcador('g_es_sbs_t01')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoMarcador('T-001')).toBe('T-1');
            expect(formatGrupoEnderecoCodigoMarcador('g_010')).toBe('T-10');
            expect(formatGrupoEnderecoCodigoMarcador('T-15')).toBe('T-15');
            expect(formatGrupoEnderecoCodigoMarcador('ES-SBS-T99')).toBe('T-99');
            expect(formatGrupoEnderecoCodigoMarcador('')).toBe('T');
        });

        it('formatGrupoEnderecoCodigoBadge deve extrair formato compacto TX (sem hífen) para o badge do marcador do endereço', () => {
            expect(formatGrupoEnderecoCodigoBadge('ES-SBS-T01')).toBe('T1');
            expect(formatGrupoEnderecoCodigoBadge('g_es_sbs_t01')).toBe('T1');
            expect(formatGrupoEnderecoCodigoBadge('T-001')).toBe('T1');
            expect(formatGrupoEnderecoCodigoBadge('T-1')).toBe('T1');
            expect(formatGrupoEnderecoCodigoBadge('T-9')).toBe('T9');
            expect(formatGrupoEnderecoCodigoBadge('T-11')).toBe('T11');
            expect(formatGrupoEnderecoCodigoBadge('g_010')).toBe('T10');
            expect(formatGrupoEnderecoCodigoBadge('T-15')).toBe('T15');
            expect(formatGrupoEnderecoCodigoBadge('ES-SBS-T99')).toBe('T99');
            expect(formatGrupoEnderecoCodigoBadge('1')).toBe('T1');
            expect(formatGrupoEnderecoCodigoBadge('T1')).toBe('T1');
            expect(formatGrupoEnderecoCodigoBadge('')).toBe('T');
            expect(formatGrupoEnderecoCodigoBadge(null)).toBe('T');
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

        describe('getProximoGrupoEnderecoSequencia', () => {
            it('deve retornar 001 quando lista de grupos for vazia', () => {
                const res = getProximoGrupoEnderecoSequencia([], 'ES-SBS-T');
                expect(res.proximoNumero).toBe(1);
                expect(res.proximoSufixo).toBe('001');
                expect(res.proximoCodigo).toBe('ES-SBS-T001');
                expect(res.prefixo).toBe('ES-SBS-T');
            });

            it('deve encontrar o próximo número da sequência a partir de grupos existentes em formato 3 dígitos', () => {
                const grupos = [
                    { codigo: 'ES-SBS-T001' },
                    { codigo: 'ES-SBS-T002' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'ES-SBS-T');
                expect(res.proximoNumero).toBe(3);
                expect(res.proximoSufixo).toBe('003');
                expect(res.proximoCodigo).toBe('ES-SBS-T003');
            });

            it('deve lidar com lacunas na numeração e pegar o maior número + 1', () => {
                const grupos = [
                    { codigo: 'ES-SBS-T001' },
                    { codigo: 'ES-SBS-T005' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'ES-SBS-T');
                expect(res.proximoNumero).toBe(6);
                expect(res.proximoSufixo).toBe('006');
                expect(res.proximoCodigo).toBe('ES-SBS-T006');
            });

            it('deve preservar ou expandir a largura quando houver 3 dígitos', () => {
                const grupos = [
                    { codigo: 'ES-SBS-T001' },
                    { codigo: 'ES-SBS-T002' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'ES-SBS-T');
                expect(res.proximoNumero).toBe(3);
                expect(res.proximoSufixo).toBe('003');
                expect(res.proximoCodigo).toBe('ES-SBS-T003');
            });

            it('deve formatar número 10 como 010', () => {
                const grupos = [
                    { codigo: 'ES-SBS-T009' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'ES-SBS-T');
                expect(res.proximoNumero).toBe(10);
                expect(res.proximoSufixo).toBe('010');
                expect(res.proximoCodigo).toBe('ES-SBS-T010');
            });

            it('deve reconhecer grupos através do id no padrão docId g_es_sbs_tXX e sugerir 3 dígitos', () => {
                const grupos = [
                    { id: 'g_es_sbs_t04' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'ES-SBS-T');
                expect(res.proximoNumero).toBe(5);
                expect(res.proximoSufixo).toBe('005');
                expect(res.proximoCodigo).toBe('ES-SBS-T005');
            });

            it('deve respeitar prefixos alternativos de idioma com 3 dígitos (ex: EN-SBS-T)', () => {
                const grupos = [
                    { codigo: 'ES-SBS-T005' },
                    { codigo: 'EN-SBS-T001' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'EN-SBS-T');
                expect(res.proximoNumero).toBe(2);
                expect(res.proximoSufixo).toBe('002');
                expect(res.proximoCodigo).toBe('EN-SBS-T002');
            });

            it('deve usar fallback de territórios legados T-01 se nenhum tiver o prefixo atual com 3 dígitos', () => {
                const grupos = [
                    { codigo: 'T-01' },
                    { codigo: 'T-02' }
                ];
                const res = getProximoGrupoEnderecoSequencia(grupos, 'ES-SBS-T');
                expect(res.proximoNumero).toBe(3);
                expect(res.proximoSufixo).toBe('003');
                expect(res.proximoCodigo).toBe('ES-SBS-T003');
            });
        });

        describe('verificarNumeroGrupoEnderecoExistente', () => {
            const grupos = [
                { codigo: 'ES-SBS-T01' },
                { codigo: 'ES-SBS-T05' }
            ];

            it('deve detectar repetição com o número exato 05', () => {
                const res = verificarNumeroGrupoEnderecoExistente(grupos, 'ES-SBS-T', '05');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-T05');
            });

            it('deve detectar repetição quando informado apenas 5 (sem zero à esquerda)', () => {
                const res = verificarNumeroGrupoEnderecoExistente(grupos, 'ES-SBS-T', '5');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-T05');
            });

            it('deve detectar repetição quando informado com mais zeros à esquerda como 005', () => {
                const res = verificarNumeroGrupoEnderecoExistente(grupos, 'ES-SBS-T', '005');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-T05');
            });

            it('deve permitir número novo como 6 ou 06', () => {
                const res1 = verificarNumeroGrupoEnderecoExistente(grupos, 'ES-SBS-T', '6');
                expect(res1.existe).toBe(false);
                expect(res1.codigoExistente).toBeNull();

                const res2 = verificarNumeroGrupoEnderecoExistente(grupos, 'ES-SBS-T', '06');
                expect(res2.existe).toBe(false);
                expect(res2.codigoExistente).toBeNull();
            });

            it('deve reconhecer territórios armazenados como docId g_es_sbs_t05', () => {
                const gruposComDocId = [{ id: 'g_es_sbs_t05' }];
                const res = verificarNumeroGrupoEnderecoExistente(gruposComDocId, 'ES-SBS-T', '5');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-T05');
            });

            it('não deve acusar colisão se o número pertencer a outro prefixo de idioma', () => {
                const gruposOutroIdioma = [{ codigo: 'EN-SBS-T05' }];
                const res = verificarNumeroGrupoEnderecoExistente(gruposOutroIdioma, 'ES-SBS-T', '5');
                expect(res.existe).toBe(false);
            });
        });
    });

    describe('geradores de sequência e validação de endereços com 3 dígitos', () => {
        describe('getProximoEnderecoSequencia', () => {
            it('deve retornar 001 quando a lista de endereços for vazia', () => {
                const res = getProximoEnderecoSequencia([]);
                expect(res.proximoNumero).toBe(1);
                expect(res.proximoSufixo).toBe('001');
                expect(res.proximoCodigo).toBe('ES-SBS-001');
                expect(res.prefixo).toBe('ES-SBS-');
            });

            it('deve calcular próximo endereço considerando formato de 3 dígitos', () => {
                const enderecos = [
                    { codigo: 'ES-SBS-001' },
                    { codigo: 'ES-SBS-026' }
                ];
                const res = getProximoEnderecoSequencia(enderecos);
                expect(res.proximoNumero).toBe(27);
                expect(res.proximoSufixo).toBe('027');
                expect(res.proximoCodigo).toBe('ES-SBS-027');
            });

            it('deve lidar com saltos na numeração pegando o maior + 1', () => {
                const enderecos = [
                    { codigo: 'ES-SBS-001' },
                    { codigo: 'ES-SBS-010' }
                ];
                const res = getProximoEnderecoSequencia(enderecos);
                expect(res.proximoNumero).toBe(11);
                expect(res.proximoSufixo).toBe('011');
                expect(res.proximoCodigo).toBe('ES-SBS-011');
            });

            it('deve expandir para 4 dígitos se a contagem atingir 1000', () => {
                const enderecos = [{ codigo: 'ES-SBS-999' }];
                const res = getProximoEnderecoSequencia(enderecos);
                expect(res.proximoNumero).toBe(1000);
                expect(res.proximoSufixo).toBe('1000');
                expect(res.proximoCodigo).toBe('ES-SBS-1000');
            });

            it('deve respeitar prefixos alternativos de idioma (ex: EN-SBS-)', () => {
                const enderecos = [
                    { codigo: 'ES-SBS-025' },
                    { codigo: 'EN-SBS-003' }
                ];
                const res = getProximoEnderecoSequencia(enderecos, 'EN-SBS-');
                expect(res.proximoNumero).toBe(4);
                expect(res.proximoSufixo).toBe('004');
                expect(res.proximoCodigo).toBe('EN-SBS-004');
            });

            it('deve usar fallback de endereços legados E-01 ou E-0001 se nenhum tiver o prefixo atual', () => {
                const enderecos = [
                    { codigo: 'E-01' },
                    { codigo: 'E-02' }
                ];
                const res = getProximoEnderecoSequencia(enderecos, 'ES-SBS-');
                expect(res.proximoNumero).toBe(3);
                expect(res.proximoSufixo).toBe('003');
                expect(res.proximoCodigo).toBe('ES-SBS-003');
            });
        });

        describe('verificarNumeroEnderecoExistente', () => {
            const enderecos = [
                { codigo: 'ES-SBS-001' },
                { codigo: 'ES-SBS-026' }
            ];

            it('deve detectar repetição com o número exato 026', () => {
                const res = verificarNumeroEnderecoExistente(enderecos, 'ES-SBS-', '026');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-026');
            });

            it('deve detectar repetição quando informado apenas 26 (sem zero à esquerda)', () => {
                const res = verificarNumeroEnderecoExistente(enderecos, 'ES-SBS-', '26');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-026');
            });

            it('deve detectar repetição quando informado com zeros extras como 0026', () => {
                const res = verificarNumeroEnderecoExistente(enderecos, 'ES-SBS-', '0026');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-026');
            });

            it('deve permitir número novo como 27 ou 027', () => {
                const res1 = verificarNumeroEnderecoExistente(enderecos, 'ES-SBS-', '27');
                expect(res1.existe).toBe(false);
                expect(res1.codigoExistente).toBeNull();

                const res2 = verificarNumeroEnderecoExistente(enderecos, 'ES-SBS-', '027');
                expect(res2.existe).toBe(false);
                expect(res2.codigoExistente).toBeNull();
            });

            it('deve reconhecer endereços armazenados como docId e_es_sbs_001', () => {
                const enderecosComDocId = [{ id: 'e_es_sbs_001' }];
                const res = verificarNumeroEnderecoExistente(enderecosComDocId, 'ES-SBS-', '1');
                expect(res.existe).toBe(true);
                expect(res.codigoExistente).toBe('ES-SBS-001');
            });

            it('não deve acusar colisão se o número pertencer a outro prefixo de idioma', () => {
                const enderecosOutroIdioma = [{ codigo: 'EN-SBS-026' }];
                const res = verificarNumeroEnderecoExistente(enderecosOutroIdioma, 'ES-SBS-', '26');
                expect(res.existe).toBe(false);
            });
        });
    });
});


