import { useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';

export const MAP_LONG_PRESS_DURATION_MS = 650;
export const MAP_LONG_PRESS_CLICK_SUPPRESSION_MS = 900;
export const BAIRRO_POPUP_CLICK_SUPPRESSION_MS = 500;

export const useMapTouchInteraction = ({ selecionarPontoMapa }) => {
    const mapLongPressTimerRef = useRef(null);
    const mapLongPressOpenAfterReleaseTimerRef = useRef(null);
    const mapLongPressPendingLatLngRef = useRef(null);
    const mapLongPressCompletedRef = useRef(false);
    const mapLongPressSuppressNextClickRef = useRef(false);
    const mapLongPressSuppressClickUntilRef = useRef(0);
    const bairroPopupClickSuppressUntilRef = useRef(0);

    const cancelarToqueLongoMapa = useCallback(() => {
        if (mapLongPressTimerRef.current) {
            window.clearTimeout(mapLongPressTimerRef.current);
            mapLongPressTimerRef.current = null;
        }

        if (mapLongPressOpenAfterReleaseTimerRef.current) {
            window.clearTimeout(mapLongPressOpenAfterReleaseTimerRef.current);
            mapLongPressOpenAfterReleaseTimerRef.current = null;
        }

        mapLongPressPendingLatLngRef.current = null;
        mapLongPressCompletedRef.current = false;
    }, []);

    const iniciarToqueLongoMapa = useCallback((event) => {
        const latlng = event?.latlng;
        if (!latlng) return;

        cancelarToqueLongoMapa();
        mapLongPressPendingLatLngRef.current = latlng;
        mapLongPressCompletedRef.current = false;
        mapLongPressTimerRef.current = window.setTimeout(() => {
            mapLongPressTimerRef.current = null;
            mapLongPressPendingLatLngRef.current = latlng;
            mapLongPressCompletedRef.current = true;
            mapLongPressSuppressNextClickRef.current = true;
            mapLongPressSuppressClickUntilRef.current = Date.now() + MAP_LONG_PRESS_CLICK_SUPPRESSION_MS;
        }, MAP_LONG_PRESS_DURATION_MS);
    }, [cancelarToqueLongoMapa]);

    const finalizarToqueLongoMapa = useCallback(() => {
        if (mapLongPressTimerRef.current) {
            window.clearTimeout(mapLongPressTimerRef.current);
            mapLongPressTimerRef.current = null;
        }

        const latlng = mapLongPressCompletedRef.current ? mapLongPressPendingLatLngRef.current : null;
        mapLongPressPendingLatLngRef.current = null;
        mapLongPressCompletedRef.current = false;

        if (!latlng) return;

        mapLongPressSuppressNextClickRef.current = true;
        mapLongPressSuppressClickUntilRef.current = Date.now() + MAP_LONG_PRESS_CLICK_SUPPRESSION_MS;
        mapLongPressOpenAfterReleaseTimerRef.current = window.setTimeout(() => {
            mapLongPressOpenAfterReleaseTimerRef.current = null;
            selecionarPontoMapa(latlng);
        }, 80);
    }, [selecionarPontoMapa]);

    const abrirPontoMapaPorContexto = useCallback((event) => {
        const latlng = event?.latlng;
        if (!latlng) return;

        cancelarToqueLongoMapa();
        mapLongPressSuppressClickUntilRef.current = Date.now() + MAP_LONG_PRESS_CLICK_SUPPRESSION_MS;
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        selecionarPontoMapa(latlng);
    }, [cancelarToqueLongoMapa, selecionarPontoMapa]);

    const ignorarCliqueAposToqueLongoMapa = useCallback(() => {
        if (mapLongPressSuppressNextClickRef.current) {
            mapLongPressSuppressNextClickRef.current = false;
            return true;
        }

        return Date.now() < mapLongPressSuppressClickUntilRef.current;
    }, []);

    const ignorarCliqueBairro = useCallback(() => {
        if (ignorarCliqueAposToqueLongoMapa()) return true;

        if (Date.now() < bairroPopupClickSuppressUntilRef.current) {
            return true;
        }

        return false;
    }, [ignorarCliqueAposToqueLongoMapa]);

    const registrarAberturaPopupBairro = useCallback(() => {
        bairroPopupClickSuppressUntilRef.current = Date.now() + BAIRRO_POPUP_CLICK_SUPPRESSION_MS;
    }, []);

    const deveSuprimirPopupBairro = useCallback(() => {
        const suprimir = Date.now() < bairroPopupClickSuppressUntilRef.current;
        bairroPopupClickSuppressUntilRef.current = 0;
        return suprimir;
    }, []);

    const resetarSupressaoPopupBairro = useCallback(() => {
        bairroPopupClickSuppressUntilRef.current = 0;
    }, []);

    useEffect(() => cancelarToqueLongoMapa, [cancelarToqueLongoMapa]);

    return {
        iniciarToqueLongoMapa,
        finalizarToqueLongoMapa,
        cancelarToqueLongoMapa,
        abrirPontoMapaPorContexto,
        ignorarCliqueAposToqueLongoMapa,
        ignorarCliqueBairro,
        registrarAberturaPopupBairro,
        deveSuprimirPopupBairro,
        resetarSupressaoPopupBairro
    };
};
