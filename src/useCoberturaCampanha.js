import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { loadMapaData } from './mapData';
import { buildFeatureIndex, getTerritorioQuadrasCount } from './mapaUtils';
import { isNormalContext } from './sistema';
import { getTerritorioContextCollectionRef, getTerritorioProgresso } from './territorioContext';

const defaultCoberturaState = {
    loading: false,
    totalTerritorios: 0,
    territoriosCobertos: 0,
    percentualCoberto: 0
};

export function useCoberturaCampanha(contextoSistema) {
    const [state, setState] = useState(defaultCoberturaState);
    const campanhaAtiva = contextoSistema?.campanhaAtiva && !isNormalContext(contextoSistema?.contextoAtivoId);

    useEffect(() => {
        if (!campanhaAtiva) {
            return;
        }

        let ativo = true;
        let unsubscribe = null;

        const iniciar = async () => {
            setState((prev) => ({ ...prev, loading: true }));

            try {
                const geoData = await loadMapaData();
                const featureMap = buildFeatureIndex(geoData);
                const totalTerritorios = featureMap.size;

                const contextoQuery = query(
                    getTerritorioContextCollectionRef(db),
                    where('contextoId', '==', contextoSistema.contextoAtivoId)
                );

                unsubscribe = onSnapshot(contextoQuery, (snapshot) => {
                    if (!ativo) return;

                    const progressoMap = new Map();
                    snapshot.forEach((territorioDoc) => {
                        const data = territorioDoc.data();
                        if (data.territorioNumero) {
                            progressoMap.set(data.territorioNumero, data);
                        }
                    });

                    let territoriosCobertos = 0;
                    featureMap.forEach((feature, numeroId) => {
                        const totalQuadras = getTerritorioQuadrasCount(feature);
                        const progresso = getTerritorioProgresso(progressoMap.get(numeroId), totalQuadras);
                        if (progresso.isFinalizado || progresso.temTodasQuadrasFeitas) {
                            territoriosCobertos += 1;
                        }
                    });

                    const percentualCoberto = totalTerritorios > 0
                        ? Math.round((territoriosCobertos / totalTerritorios) * 100)
                        : 0;

                    setState({
                        loading: false,
                        totalTerritorios,
                        territoriosCobertos,
                        percentualCoberto
                    });
                }, (error) => {
                    console.error('Erro ao calcular cobertura da campanha:', error);
                    if (ativo) {
                        setState({
                            loading: false,
                            totalTerritorios,
                            territoriosCobertos: 0,
                            percentualCoberto: 0
                        });
                    }
                });
            } catch (error) {
                console.error('Erro ao carregar dados da campanha:', error);
                if (ativo) {
                    setState(defaultCoberturaState);
                }
            }
        };

        iniciar();

        return () => {
            ativo = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [campanhaAtiva, contextoSistema]);

    return campanhaAtiva ? state : defaultCoberturaState;
}
