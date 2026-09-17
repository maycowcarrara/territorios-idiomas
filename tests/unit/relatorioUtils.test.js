import { describe, it, expect } from 'vitest';
import {
    toDateValue,
    formatDateValue,
    getDiasDesde,
    getGrupoEnderecoIdentityKey,
    getCodigoOrdenacao,
    getUltimaEdicaoTexto,
    processarHistorico,
    getGrupoEnderecoBoundsStr,
    getGrupoEnderecoCentro,
    getGrupoEnderecoStatusRelatorio,
    getGrupoEnderecoCanonicalKeys,
    getEnderecoClasseLabel,
    normalizeFiltroOptionValue,
    uniqueSortedOptions,
    getStatusArquivadoFiltroMatch,
    formatarTempo,
    formatarTempoTerritorio,
    getStatusVisual,
    getCorTempo,
    buildMapaLinkSearch
} from '../../src/relatorios/utils/relatorioUtils';
import {
    STATUS_ARQUIVADO,
    FILTRO_ARQUIVADOS_SEM,
    FILTRO_ARQUIVADOS_SOMENTE,
    FILTRO_TODOS
} from '../../src/relatorios/constants/relatorioConstants';
import { TERRITORIO_STATUS } from '../../src/territorioContext';
import { GRUPO_ENDERECO_STATUS, ENDERECO_CLASSES } from '../../src/enderecoModel';

describe('relatorioUtils', () => {
    describe('toDateValue and formatDateValue', () => {
        it('deve converter Firestore Timestamp e strings para Date', () => {
            const fakeTimestamp = { toDate: () => new Date(2026, 8, 16) };
            expect(toDateValue(fakeTimestamp)).toBeInstanceOf(Date);
            expect(toDateValue('2026-09-16T12:00:00Z')).toBeInstanceOf(Date);
            expect(toDateValue(null)).toBeNull();
            expect(toDateValue('invalido')).toBeNull();
        });

        it('deve formatar data para pt-BR ou retornar "-" se nulo', () => {
            const date = new Date(2026, 8, 16);
            expect(formatDateValue(date)).toBe('16/09/2026');
            expect(formatDateValue(null)).toBe('-');
        });

        it('deve calcular dias decorridos com getDiasDesde', () => {
            expect(getDiasDesde(null)).toBe(0);
            const pastDate = new Date(Date.now() - (5 * 24 * 60 * 60 * 1000 - 1000));
            expect(getDiasDesde(pastDate)).toBe(5);
        });
    });

    describe('getGrupoEnderecoIdentityKey and getCodigoOrdenacao', () => {
        it('deve extrair chave canônica numérica', () => {
            expect(getGrupoEnderecoIdentityKey('T-004')).toBe('n:4');
            expect(getGrupoEnderecoIdentityKey('G_012')).toBe('n:12');
            expect(getGrupoEnderecoIdentityKey('007')).toBe('n:7');
            expect(getGrupoEnderecoIdentityKey('custom-name')).toBe('custom-name');
        });

        it('deve extrair número de ordenação de strings', () => {
            expect(getCodigoOrdenacao('T-05')).toBe(5);
            expect(getCodigoOrdenacao('SemNumero')).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('deve extrair chaves canônicas de um grupo', () => {
            const grupo = { id: 'T-01', codigo: '01' };
            expect(getGrupoEnderecoCanonicalKeys(grupo)).toEqual(['n:1', 'n:1']);
        });
    });

    describe('processarHistorico', () => {
        it('deve formatar e ordenar histórico por data recente', () => {
            expect(processarHistorico(null)).toEqual([]);
            const historico = [
                { dataInicio: '2026-01-01', dataTermino: '2026-01-10', responsavel: 'João' },
                { dataInicio: '2026-02-01', dataTermino: '2026-02-15', responsaveis: ['Maria', 'José'] }
            ];
            const processado = processarHistorico(historico);
            expect(processado).toHaveLength(2);
            expect(processado[0].nomes).toBe('Maria, José');
            expect(processado[1].nomes).toBe('João');
        });
    });

    describe('getUltimaEdicaoTexto e labels de classe', () => {
        it('deve retornar rótulo de classe correto', () => {
            expect(getEnderecoClasseLabel(ENDERECO_CLASSES.CONFIRMADO)).toBe('Confirmado');
        });

        it('deve normalizar valores de opção de filtro', () => {
            expect(normalizeFiltroOptionValue('  Inglês  ')).toBe('inglês');
            expect(normalizeFiltroOptionValue(null)).toBe('');
        });
    });

    describe('getUltimaEdicaoTexto', () => {
        it('deve retornar "Sem dados" se não tiver designação', () => {
            const res = getUltimaEdicaoTexto({ dataRef: new Date(), hasDesignacao: false });
            expect(res.ultimaEdicaoTexto).toBe('Sem dados');
            expect(res.diasSemEdicao).toBe(0);
        });

        it('deve retornar "agora mesmo" para menos de 2 minutos', () => {
            const res = getUltimaEdicaoTexto({ dataRef: new Date(), hasDesignacao: true });
            expect(res.ultimaEdicaoTexto).toBe('agora mesmo');
        });
    });

    describe('getGrupoEnderecoBoundsStr and getGrupoEnderecoCentro', () => {
        it('deve formatar boundsStr se válidos', () => {
            const grupo = {
                bounds: { minLat: -26.25, minLng: -49.38, maxLat: -26.23, maxLng: -49.36 }
            };
            expect(getGrupoEnderecoBoundsStr(grupo)).toBe('-26.25,-49.38,-26.23,-49.36');
        });

        it('deve calcular centro a partir de bounds ou centro prévio', () => {
            const grupoComCentro = { centro: { lat: -26.25, lng: -49.38 } };
            expect(getGrupoEnderecoCentro(grupoComCentro)).toEqual({ lat: -26.25, lng: -49.38 });

            const grupoComBounds = {
                bounds: { minLat: -26.25, minLng: -49.40, maxLat: -26.23, maxLng: -49.36 }
            };
            const centro = getGrupoEnderecoCentro(grupoComBounds);
            expect(centro.lat).toBeCloseTo(-26.24, 5);
            expect(centro.lng).toBeCloseTo(-49.38, 5);
        });
    });

    describe('getGrupoEnderecoStatusRelatorio', () => {
        it('deve identificar status arquivado, finalizado, aguardando e ocupado/livre', () => {
            expect(getGrupoEnderecoStatusRelatorio({ status: GRUPO_ENDERECO_STATUS.ARQUIVADO })).toBe(STATUS_ARQUIVADO);
            expect(getGrupoEnderecoStatusRelatorio({ status: GRUPO_ENDERECO_STATUS.FINALIZADO })).toBe(TERRITORIO_STATUS.FINALIZADO);
            expect(getGrupoEnderecoStatusRelatorio({
                designadoPara: 'Irmão',
                totalEnderecos: 2,
                enderecos_visitados: ['e1', 'e2']
            })).toBe(TERRITORIO_STATUS.AGUARDANDO_FINALIZACAO);
            expect(getGrupoEnderecoStatusRelatorio({
                designadoPara: 'Irmão',
                totalEnderecos: 2,
                enderecos_visitados: ['e1']
            })).toBe('ocupado');
            expect(getGrupoEnderecoStatusRelatorio({ designadoPara: null })).toBe('livre');
        });
    });

    describe('buildMapaLinkSearch', () => {
        it('deve priorizar boundsStr quando presente', () => {
            const link = buildMapaLinkSearch({ boundsStr: '-26,-49,-25,-48' });
            expect(link).toContain('bounds=-26%2C-49%2C-25%2C-48');
        });

        it('deve usar lat/lng quando bounds não existirem', () => {
            const link = buildMapaLinkSearch({ lat: -26.25, lng: -49.38 });
            expect(link).toBe('lat=-26.25&lng=-49.38&z=17');
        });
    });

    describe('uniqueSortedOptions and getStatusArquivadoFiltroMatch', () => {
        it('deve extrair opções ordenadas e únicas', () => {
            const items = [{ idioma: 'Inglês' }, { idioma: 'Espanhol' }, { idioma: 'inglês' }];
            const opts = uniqueSortedOptions(items, (i) => i.idioma);
            expect(opts).toHaveLength(2);
            expect(opts[0].label).toBe('Espanhol');
            expect(opts[1].label).toBe('Inglês');
        });

        it('deve filtrar status de arquivamento corretamente', () => {
            const itemArquivado = { status: STATUS_ARQUIVADO };
            const itemAtivo = { status: 'livre' };

            expect(getStatusArquivadoFiltroMatch(itemArquivado, FILTRO_ARQUIVADOS_SEM)).toBe(false);
            expect(getStatusArquivadoFiltroMatch(itemAtivo, FILTRO_ARQUIVADOS_SEM)).toBe(true);
            expect(getStatusArquivadoFiltroMatch(itemArquivado, FILTRO_ARQUIVADOS_SOMENTE)).toBe(true);
            expect(getStatusArquivadoFiltroMatch(itemAtivo, FILTRO_ARQUIVADOS_SOMENTE)).toBe(false);
            expect(getStatusArquivadoFiltroMatch(itemArquivado, FILTRO_TODOS)).toBe(true);
        });
    });

    describe('formatarTempo e status visual', () => {
        it('deve formatar períodos de dias em linguagem natural', () => {
            expect(formatarTempo(0)).toBe('Hoje');
            expect(formatarTempo(15)).toBe('15 dias');
            expect(formatarTempo(30)).toBe('1 mês');
            expect(formatarTempo(45)).toBe('1 mês e 15 dias');
            expect(formatarTempo(62)).toBe('2 meses e 2 dias');
            expect(formatarTempo(Number.POSITIVE_INFINITY)).toBe('Nunca');
        });

        it('deve formatar tempo para território', () => {
            expect(formatarTempoTerritorio({ nuncaTrabalhado: true })).toBe('Nunca');
            expect(formatarTempoTerritorio({ nuncaTrabalhado: false, diasParado: 10 })).toBe('10 dias');
        });

        it('deve retornar configuração visual correta por status', () => {
            const visualLivre = getStatusVisual('livre', 0);
            expect(visualLivre.label).toBe('Livre');

            const visualOcupado = getStatusVisual('ocupado', 60);
            expect(visualOcupado.label).toBe('Ocupado');
            expect(visualOcupado.style.background).toContain('60%');
        });

        it('deve retornar cores de alerta baseadas no tempo sem trabalhar', () => {
            expect(getCorTempo(200)).toContain('bg-orange-600');
            expect(getCorTempo(150)).toContain('bg-orange-500');
            expect(getCorTempo(70)).toContain('bg-orange-300');
            expect(getCorTempo(10)).toContain('bg-orange-100');
            expect(getCorTempo(0)).toContain('bg-slate-100');
        });
    });
});
