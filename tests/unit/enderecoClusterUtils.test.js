import { describe, it, expect } from 'vitest';
import {
    projectLatLngToPixel,
    areCoordsCoincident,
    getPixelDistance,
    clusterEnderecos,
    isUsableCoordinateValue,
    isValidLatLng,
    UNCLUSTER_ZOOM
} from '../../src/mapa/utils/enderecoClusterUtils';

describe('enderecoClusterUtils', () => {
    describe('isUsableCoordinateValue', () => {
        it('deve aceitar números válidos e strings numéricas', () => {
            expect(isUsableCoordinateValue(-26.25)).toBe(true);
            expect(isUsableCoordinateValue('-49.38')).toBe(true);
            expect(isUsableCoordinateValue(0)).toBe(true);
            expect(isUsableCoordinateValue('0')).toBe(true);
        });

        it('deve rejeitar null, undefined, vazio e NaN', () => {
            expect(isUsableCoordinateValue(null)).toBe(false);
            expect(isUsableCoordinateValue(undefined)).toBe(false);
            expect(isUsableCoordinateValue('')).toBe(false);
            expect(isUsableCoordinateValue('   ')).toBe(false);
            expect(isUsableCoordinateValue('abc')).toBe(false);
            expect(isUsableCoordinateValue(NaN)).toBe(false);
        });
    });

    describe('isValidLatLng', () => {
        it('deve aceitar coordenadas dentro dos limites globais', () => {
            expect(isValidLatLng(-26.25, -49.38)).toBe(true);
            expect(isValidLatLng(90, 180)).toBe(true);
            expect(isValidLatLng(-90, -180)).toBe(true);
            expect(isValidLatLng(0, 0)).toBe(true);
        });

        it('deve rejeitar coordenadas fora dos limites geográficos', () => {
            expect(isValidLatLng(91, 0)).toBe(false);
            expect(isValidLatLng(-91, 0)).toBe(false);
            expect(isValidLatLng(0, 181)).toBe(false);
            expect(isValidLatLng(0, -181)).toBe(false);
            expect(isValidLatLng(200, -200)).toBe(false);
        });
    });

    describe('projectLatLngToPixel', () => {
        it('deve projetar coordenadas geográficas em pixels de forma consistente', () => {
            const p1 = projectLatLngToPixel(-26.25, -49.38, 15);
            const p2 = projectLatLngToPixel(-26.25, -49.38, 15);

            expect(p1.x).toBeCloseTo(p2.x, 5);
            expect(p1.y).toBeCloseTo(p2.y, 5);
            expect(p1.x).toBeGreaterThan(0);
            expect(p1.y).toBeGreaterThan(0);
        });

        it('deve aumentar a distância em pixels ao aumentar o zoom', () => {
            const pLowZoom1 = projectLatLngToPixel(-26.25, -49.38, 14);
            const pLowZoom2 = projectLatLngToPixel(-26.251, -49.38, 14);

            const pHighZoom1 = projectLatLngToPixel(-26.25, -49.38, 16);
            const pHighZoom2 = projectLatLngToPixel(-26.251, -49.38, 16);

            const distLow = getPixelDistance(pLowZoom1, pLowZoom2);
            const distHigh = getPixelDistance(pHighZoom1, pHighZoom2);

            expect(distHigh).toBeGreaterThan(distLow * 2);
        });
    });

    describe('areCoordsCoincident', () => {
        it('deve identificar coordenadas praticamente idênticas como coincidentes', () => {
            expect(areCoordsCoincident(-26.250001, -49.380001, -26.250002, -49.380002)).toBe(true);
        });

        it('deve identificar coordenadas afastadas como não coincidentes', () => {
            expect(areCoordsCoincident(-26.250000, -49.380000, -26.251000, -49.381000)).toBe(false);
        });
    });

    describe('clusterEnderecos', () => {
        const enderecoA = { id: 'end-1', codigo: 'E-01', lat: -26.25000, lng: -49.38000 };
        const enderecoB = { id: 'end-2', codigo: 'E-02', lat: -26.25005, lng: -49.38005 }; // muito perto de A
        const enderecoC = { id: 'end-3', codigo: 'E-03', lat: -26.26000, lng: -49.39000 }; // distante (~1.5 km)

        it('deve retornar lista vazia para array vazio', () => {
            expect(clusterEnderecos([])).toEqual([]);
        });

        it('deve retornar item único quando há apenas um endereço', () => {
            const res = clusterEnderecos([enderecoA], null, 15);
            expect(res).toHaveLength(1);
            expect(res[0].isCluster).toBe(false);
            expect(res[0].endereco).toEqual(enderecoA);
        });

        it('deve agrupar endereços próximos em zoom afastado (ex: zoom 15)', () => {
            const res = clusterEnderecos([enderecoA, enderecoB, enderecoC], null, 15);
            expect(res).toHaveLength(2);

            const clusterItem = res.find((item) => item.isCluster);
            const singleItem = res.find((item) => !item.isCluster);

            expect(clusterItem).toBeDefined();
            expect(clusterItem.count).toBe(2);
            expect(clusterItem.enderecos.map((e) => e.id)).toEqual(['end-1', 'end-2']);
            expect(singleItem.endereco.id).toBe('end-3');
        });

        it('deve desagrupar endereços em zoom alto (>= 18) se tiverem coordenadas distintas', () => {
            const res = clusterEnderecos([enderecoA, enderecoB, enderecoC], null, UNCLUSTER_ZOOM);
            expect(res).toHaveLength(3);
            expect(res.every((item) => !item.isCluster)).toBe(true);
        });

        it('deve manter agrupado em zoom alto (>= 18) se as coordenadas forem estritamente coincidentes (mesmo prédio)', () => {
            const apto1 = { id: 'ap-1', codigo: 'E-10', lat: -26.250000, lng: -49.380000 };
            const apto2 = { id: 'ap-2', codigo: 'E-11', lat: -26.250000, lng: -49.380000 };
            const casaVizinha = { id: 'casa-1', codigo: 'E-12', lat: -26.250200, lng: -49.380200 };

            const res = clusterEnderecos([apto1, apto2, casaVizinha], null, UNCLUSTER_ZOOM);
            expect(res).toHaveLength(2);

            const coincidentCluster = res.find((item) => item.isCluster);
            const separateItem = res.find((item) => !item.isCluster);

            expect(coincidentCluster).toBeDefined();
            expect(coincidentCluster.isCoincident).toBe(true);
            expect(coincidentCluster.count).toBe(2);
            expect(coincidentCluster.enderecos.map((e) => e.id)).toEqual(['ap-1', 'ap-2']);
            expect(separateItem.endereco.id).toBe('casa-1');
        });

        it('não deve fazer agrupamento transitivo em cadeia em zoom alto', () => {
            // Ponto A
            const pontoA = { id: 'pt-1', codigo: 'E-01', lat: -26.250000, lng: -49.380000 };
            // Ponto B é coincidente com A (distância 0.00002 <= epsilon de 0.00003)
            const pontoB = { id: 'pt-2', codigo: 'E-02', lat: -26.250020, lng: -49.380000 };
            // Ponto C é coincidente com B (dist 0.00002), mas NÃO com A (dist 0.00004 > 0.00003)
            const pontoC = { id: 'pt-3', codigo: 'E-03', lat: -26.250040, lng: -49.380000 };

            const res = clusterEnderecos([pontoA, pontoB, pontoC], null, UNCLUSTER_ZOOM);

            // pontoA e pontoB formam um cluster. pontoC não deve ser puxado para o cluster de pontoA
            const clusterA = res.find((item) => item.isCluster);
            expect(clusterA).toBeDefined();
            expect(clusterA.count).toBe(2);
            expect(clusterA.enderecos.map((e) => e.id)).toEqual(['pt-1', 'pt-2']);

            const itemC = res.find((item) => !item.isCluster);
            expect(itemC).toBeDefined();
            expect(itemC.endereco.id).toBe('pt-3');
        });

        it('deve manter a estabilidade visual independentemente da ordem de entrada dos endereços', () => {
            const list1 = [enderecoA, enderecoB];
            const list2 = [enderecoB, enderecoA];

            const res1 = clusterEnderecos(list1, null, 15);
            const res2 = clusterEnderecos(list2, null, 15);

            expect(res1[0].id).toBe(res2[0].id);
            expect(res1[0].enderecos.map((e) => e.id)).toEqual(res2[0].enderecos.map((e) => e.id));
        });

        it('ignora endereços com lat ou lng nulos, vazios, indefinidos ou fora da faixa válida', () => {
            const listaComInvalidos = [
                enderecoA,
                { id: 'inv-1', lat: null, lng: -49.38 }, // null parcial
                { id: 'inv-2', lat: -26.25, lng: null }, // null parcial
                { id: 'inv-3', lat: undefined, lng: -49.38 },
                { id: 'inv-4', lat: '', lng: -49.38 },
                { id: 'inv-5', lat: 'abc', lng: -49.38 },
                { id: 'inv-6', lat: NaN, lng: -49.38 },
                { id: 'inv-7', lat: 200, lng: -49.38 }, // fora da faixa válida [-90, 90]
                { id: 'inv-8', lat: -26.25, lng: -250 } // fora da faixa válida [-180, 180]
            ];

            const res = clusterEnderecos(listaComInvalidos, null, 15);
            expect(res).toHaveLength(1);
            expect(res[0].endereco.id).toBe('end-1');
        });

        it('respeita clusterRadiusPx customizado nas opções', () => {
            // Com raio muito pequeno (1px), dois pontos a 5 metros não devem se agrupar
            const resSmallRadius = clusterEnderecos([enderecoA, enderecoB], null, 15, { clusterRadiusPx: 1 });
            expect(resSmallRadius).toHaveLength(2);
            expect(resSmallRadius.every((item) => !item.isCluster)).toBe(true);

            // Com raio grande padrão, eles se agrupam
            const resDefaultRadius = clusterEnderecos([enderecoA, enderecoB], null, 15);
            expect(resDefaultRadius).toHaveLength(1);
            expect(resDefaultRadius[0].isCluster).toBe(true);
        });
    });
});
