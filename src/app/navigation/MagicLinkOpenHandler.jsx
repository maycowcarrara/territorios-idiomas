import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { isMagicLinkSignInUrl, rememberPendingMagicLinkUrl } from '../../emailLinkAuth';

export function MagicLinkOpenHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }

    let ativo = true;
    let listenerHandle = null;

    const registrarLink = (url) => {
      if (!isMagicLinkSignInUrl(url)) return;

      rememberPendingMagicLinkUrl(url);
      navigate('/', { replace: true });
    };

    const registrar = async () => {
      try {
        const launchData = await CapacitorApp.getLaunchUrl();
        if (ativo && launchData?.url) {
          registrarLink(launchData.url);
        }
      } catch (error) {
        console.warn('Não foi possível verificar a URL inicial do app:', error);
      }

      listenerHandle = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        registrarLink(url);
      });
    };

    void registrar();

    return () => {
      ativo = false;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [navigate]);

  return null;
}
