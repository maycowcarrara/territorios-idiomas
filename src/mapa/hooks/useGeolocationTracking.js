import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { calcularDistanciaMetros, calcularRumo } from '../utils/mapGeoUtils';

const DISTANCIA_MINIMA_ATUALIZACAO_METROS = 0.8;
const DISTANCIA_MINIMA_TRILHA_METROS = 3;
const DISTANCIA_MINIMA_DIRECAO_METROS = 2;
const PRECISAO_MAXIMA_INICIAL_NATIVE_METROS = 120;
const PRECISAO_MAXIMA_RASTREAMENTO_NATIVE_METROS = 80;
const PRECISAO_MAXIMA_INICIAL_WEB_METROS = 300;
const PRECISAO_MAXIMA_RASTREAMENTO_WEB_METROS = 150;
const GEOLOCATION_TIMEOUT_NATIVE_MS = 10000;
const GEOLOCATION_TIMEOUT_WEB_MS = 20000;
const GEOLOCATION_MAXIMUM_AGE_NATIVE_MS = 1500;
const GEOLOCATION_MAXIMUM_AGE_WEB_MS = 5000;

export const useGeolocationTracking = ({
    map,
    rastreandoLocalizacao,
    setRastreandoLocalizacao,
    setPosicaoUsuario,
    setTrilhaUsuario,
    setDirecaoUsuario,
    notify
}) => {
    const [buscando, setBuscando] = useState(false);
    const isNativePlatform = Capacitor.isNativePlatform();
    const watchIdRef = useRef(null);
    const primeiraCentralizacaoRef = useRef(false);
    const ultimaPosicaoBrutaRef = useRef(null);
    const ultimaPosicaoAceitaRef = useRef(null);
    const limparDirecaoTimeoutRef = useRef(null);

    useEffect(() => {
        const limparRastreamentoVisual = () => {
            setPosicaoUsuario(null);
            setTrilhaUsuario([]);
            setDirecaoUsuario(null);
            ultimaPosicaoBrutaRef.current = null;
            ultimaPosicaoAceitaRef.current = null;
            primeiraCentralizacaoRef.current = false;
            setBuscando(false);
            if (limparDirecaoTimeoutRef.current) {
                window.clearTimeout(limparDirecaoTimeoutRef.current);
                limparDirecaoTimeoutRef.current = null;
            }
        };

        const pararWatch = () => {
            if (watchIdRef.current === null) return;

            if (isNativePlatform) {
                void Geolocation.clearWatch({ id: watchIdRef.current });
            } else if (navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }

            watchIdRef.current = null;
        };

        if (!rastreandoLocalizacao) {
            pararWatch();
            limparRastreamentoVisual();
            return undefined;
        }

        if (!isNativePlatform && !navigator.geolocation) {
            notify({
                title: 'Localização indisponível',
                message: 'Seu navegador não suporta localização.',
                variant: 'warning'
            });
            setRastreandoLocalizacao(false);
            return undefined;
        }

        const processarPosicao = (position) => {
            const novaPosicao = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            const precisao = position.coords.accuracy ?? null;
            const ultimaPosicaoAceita = ultimaPosicaoAceitaRef.current;
            const precisaoMaximaInicial = isNativePlatform
                ? PRECISAO_MAXIMA_INICIAL_NATIVE_METROS
                : PRECISAO_MAXIMA_INICIAL_WEB_METROS;
            const precisaoMaximaRastreamento = isNativePlatform
                ? PRECISAO_MAXIMA_RASTREAMENTO_NATIVE_METROS
                : PRECISAO_MAXIMA_RASTREAMENTO_WEB_METROS;

            if (!ultimaPosicaoAceita && precisao && precisao > precisaoMaximaInicial) {
                return;
            }

            if (ultimaPosicaoAceita && precisao && precisao > precisaoMaximaRastreamento) {
                setBuscando(false);
                return;
            }

            if (ultimaPosicaoAceita) {
                const deslocamentoCurto = calcularDistanciaMetros(ultimaPosicaoAceita, novaPosicao);
                if (deslocamentoCurto < DISTANCIA_MINIMA_ATUALIZACAO_METROS) {
                    setBuscando(false);
                    return;
                }
            }

            ultimaPosicaoAceitaRef.current = novaPosicao;
            setPosicaoUsuario(novaPosicao);

            setTrilhaUsuario((caminhoAtual) => {
                if (!caminhoAtual.length) return [novaPosicao];

                const ultimaPosicaoTrilha = caminhoAtual[caminhoAtual.length - 1];
                if (calcularDistanciaMetros(ultimaPosicaoTrilha, novaPosicao) < DISTANCIA_MINIMA_TRILHA_METROS) {
                    return caminhoAtual;
                }

                return [...caminhoAtual, novaPosicao];
            });

            if (!primeiraCentralizacaoRef.current) {
                primeiraCentralizacaoRef.current = true;
                map?.flyTo?.(novaPosicao, Math.max(map?.getZoom?.() ?? 17, 17), { animate: true, duration: 1.2 });
            }

            if (ultimaPosicaoBrutaRef.current) {
                const distanciaPercorrida = calcularDistanciaMetros(ultimaPosicaoBrutaRef.current, novaPosicao);
                if (distanciaPercorrida >= DISTANCIA_MINIMA_DIRECAO_METROS) {
                    setDirecaoUsuario(calcularRumo(ultimaPosicaoBrutaRef.current, novaPosicao));
                    ultimaPosicaoBrutaRef.current = novaPosicao;

                    if (limparDirecaoTimeoutRef.current) {
                        window.clearTimeout(limparDirecaoTimeoutRef.current);
                    }

                    limparDirecaoTimeoutRef.current = window.setTimeout(() => {
                        setDirecaoUsuario(null);
                    }, 2000);
                }
            } else {
                ultimaPosicaoBrutaRef.current = novaPosicao;
            }

            setBuscando(false);
        };

        const tratarErro = (error) => {
            console.error("Erro ao obter localização:", error);
            setBuscando(false);

            if (error?.code === 1 || error?.code === 'NOT_AUTHORIZED') {
                pararWatch();
                setRastreandoLocalizacao(false);
                notify({
                    title: 'Permissão de localização',
                    message: isNativePlatform
                        ? 'Permita o acesso à localização do app para usar o GPS do celular.'
                        : 'Permita o acesso à localização no navegador ou no app para usar sua posição no mapa.',
                    variant: 'warning'
                });
                return;
            }

            if (!ultimaPosicaoBrutaRef.current) {
                pararWatch();
                setRastreandoLocalizacao(false);
                notify({
                    title: isNativePlatform ? 'GPS necessário' : 'Localização indisponível',
                    message: isNativePlatform
                        ? 'Ative o GPS do celular para usar a sua localização no mapa.'
                        : 'Não foi possível obter sua localização no navegador. Verifique a permissão do site/app e a localização do sistema.',
                    variant: 'warning'
                });
            }
        };

        let cancelado = false;

        const iniciarRastreamento = async () => {
            setBuscando(true);

            if (isNativePlatform) {
                try {
                    let permissaoLocalizacao = await Geolocation.checkPermissions();
                    if (cancelado) return;

                    if (permissaoLocalizacao.location !== 'granted' && permissaoLocalizacao.coarseLocation !== 'granted') {
                        permissaoLocalizacao = await Geolocation.requestPermissions();
                    }
                    if (cancelado) return;

                    if (permissaoLocalizacao.location === 'denied' && permissaoLocalizacao.coarseLocation === 'denied') {
                        throw { code: 'NOT_AUTHORIZED' };
                    }

                    const watchId = await Geolocation.watchPosition(
                        {
                            enableHighAccuracy: true,
                            maximumAge: GEOLOCATION_MAXIMUM_AGE_NATIVE_MS,
                            timeout: GEOLOCATION_TIMEOUT_NATIVE_MS
                        },
                        (position, error) => {
                            if (cancelado) return;
                            if (error) {
                                tratarErro(error);
                                return;
                            }

                            if (position) {
                                processarPosicao(position);
                            }
                        }
                    );

                    if (cancelado) {
                        void Geolocation.clearWatch({ id: watchId });
                        return;
                    }

                    watchIdRef.current = watchId;
                    return;
                } catch (error) {
                    if (cancelado) return;
                    tratarErro(error);
                    return;
                }
            }

            if (cancelado) return;
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    if (!cancelado) processarPosicao(position);
                },
                (error) => {
                    if (!cancelado) tratarErro(error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: GEOLOCATION_MAXIMUM_AGE_WEB_MS,
                    timeout: GEOLOCATION_TIMEOUT_WEB_MS
                }
            );
        };

        void iniciarRastreamento();

        return () => {
            cancelado = true;
            pararWatch();
            limparRastreamentoVisual();
        };
    }, [
        isNativePlatform,
        map,
        notify,
        rastreandoLocalizacao,
        setDirecaoUsuario,
        setPosicaoUsuario,
        setRastreandoLocalizacao,
        setTrilhaUsuario
    ]);

    return { buscando };
};
