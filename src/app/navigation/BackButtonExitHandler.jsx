import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useUiFeedback } from '../../uiFeedback';
import { APP_ROUTE, BACK_TO_EXIT_WINDOW_MS } from '../constants/appConstants';

export function BackButtonExitHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const ultimaTentativaSaidaRef = useRef(0);
  const { notify } = useUiFeedback();

  useEffect(() => {
    ultimaTentativaSaidaRef.current = 0;
  }, [location.pathname]);

  const avisarSaida = useCallback(() => {
    ultimaTentativaSaidaRef.current = Date.now();
    notify({
      title: 'Pressione novamente para sair',
      message: 'Toque em voltar outra vez em até 5 segundos para fechar o app.',
      variant: 'info',
      durationMs: 3000
    });
  }, [notify]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return undefined;
    }

    let ativo = true;
    let listenerHandle = null;

    const registrar = async () => {
      try {
        const handle = await CapacitorApp.addListener('backButton', () => {
          const rotaAtual = location.pathname;

          if (rotaAtual === '/admin' || rotaAtual === '/relatorios') {
            navigate(APP_ROUTE);
            return;
          }

          if (rotaAtual !== '/' && rotaAtual !== APP_ROUTE) {
            navigate(-1);
            return;
          }

          const agora = Date.now();
          if (agora - ultimaTentativaSaidaRef.current <= BACK_TO_EXIT_WINDOW_MS) {
            void CapacitorApp.exitApp();
            return;
          }

          avisarSaida();
        });

        if (!ativo) {
          void handle.remove();
          return;
        }

        listenerHandle = handle;
      } catch (error) {
        console.warn('Não foi possível registrar listener do botão voltar:', error);
      }
    };

    void registrar();

    return () => {
      ativo = false;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [avisarSaida, location.pathname, navigate]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || location.pathname !== APP_ROUTE || typeof window === 'undefined') {
      return undefined;
    }

    const isStandalonePwa = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true;
    const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches;

    if (!isStandalonePwa && !isTouchDevice) {
      return undefined;
    }

    let liberarProximoVoltar = false;

    const armarHistoricoDeSaida = () => {
      const stateAtual = window.history.state || {};
      if (stateAtual?.territoriosBackExitGuard) return;

      window.history.pushState(
        { ...stateAtual, territoriosBackExitGuard: true },
        '',
        window.location.href
      );
    };

    const handlePopState = () => {
      if (liberarProximoVoltar) return;

      const agora = Date.now();
      if (agora - ultimaTentativaSaidaRef.current <= BACK_TO_EXIT_WINDOW_MS) {
        liberarProximoVoltar = true;
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
      }

      avisarSaida();
      armarHistoricoDeSaida();
    };

    armarHistoricoDeSaida();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [avisarSaida, location.pathname]);

  return null;
}
