import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import { Capacitor } from '@capacitor/core';
import { signInWithGoogleNative } from '../../nativeGoogleAuth';
import {
  clearPendingMagicLinkUrl,
  MAGIC_LINK_STATE_EVENT,
  completeMagicLinkSignIn,
  consumePendingMagicLinkUrl,
  getMagicLinkFromCurrentUrl,
  getRememberedMagicLinkEmail,
  isMagicLinkSignInUrl,
  isValidAuthEmail,
  rememberPendingMagicLinkUrl,
  sendMagicLink
} from '../../emailLinkAuth';
import { APP_TITLE, APP_SHORT_NAME, APP_SUBTITLE, APP_ICON_192 } from '../constants/appConstants';
import {
  consumePostLoginRedirect,
  peekPostLoginRedirect,
  rememberRedirectFromCurrentUrl
} from '../utils/redirectUtils';
import { AuthStatusScreen } from './AuthStatusScreen';

const getGoogleAuthErrorText = (error) => [
  error?.code,
  error?.message,
  error?.errorMessage,
  error?.result?.message,
  error?.result?.errorMessage,
  error?.details?.message
].filter(Boolean).map((parte) => String(parte)).join(' | ');

const isGooglePopupUnavailableError = (error) => {
  const mensagem = getGoogleAuthErrorText(error);
  return (
    mensagem.includes('popup-closed-by-user')
    || mensagem.includes('popup-blocked')
    || mensagem.includes('cancelled-popup-request')
  );
};

export function Login() {
  const navigate = useNavigate();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMagicLink, setLoadingMagicLink] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirmacao, setEmailConfirmacao] = useState('');
  const [magicLinkUrl, setMagicLinkUrl] = useState('');
  const [aguardandoConfirmacaoEmail, setAguardandoConfirmacaoEmail] = useState(false);
  const navegarAposLogin = useCallback(() => {
    rememberRedirectFromCurrentUrl();
    navigate(consumePostLoginRedirect(), { replace: true });
  }, [navigate]);

  const extrairMensagemErroGoogle = (error) => {
    const mensagem = getGoogleAuthErrorText(error);

    if (!mensagem) {
      return 'Erro ao conectar com Google. Tente novamente.';
    }

    if (mensagem.includes('VITE_GOOGLE_WEB_CLIENT_ID')) {
      return 'Falta configurar o client ID do Google para o app Android.';
    }

    if (isGooglePopupUnavailableError(error)) {
      return 'A janela do Google foi fechada ou bloqueada antes de concluir. Neste navegador, use o link mágico por e-mail ou abra o app no Chrome/Edge em http://localhost:5173/admin.';
    }

    if (
      mensagem.includes('No credentials available')
      || mensagem.includes('Cannot find a matching credential')
      || mensagem.includes('no google account')
    ) {
      return 'O emulador precisa ter uma conta Google conectada para esse login funcionar.';
    }

    if (mensagem.includes('scopes without modifying the main activity')) {
      return 'A configuração nativa do login Google no Android ainda não está válida.';
    }

    if (mensagem.includes('10:') || mensagem.includes('28444') || mensagem.includes('Developer console is not set up correctly')) {
      return 'O Google recusou o login no Android. Verifique se o SHA-1/SHA-256 do APK está cadastrado no Firebase/Google Cloud e baixe um google-services.json atualizado.';
    }

    if (mensagem.includes('16:')) {
      return 'Não foi possível concluir o login Google agora. Tente remover e adicionar a conta Google no emulador.';
    }

    return `Erro ao conectar com Google: ${mensagem}`;
  };

  const extrairMensagemErroMagicLink = (error) => {
    const mensagem = String(error?.message || error || '');

    if (!mensagem) {
      return 'Não foi possível concluir o login por e-mail. Tente novamente.';
    }

    if (mensagem.includes('invalid-email')) {
      return 'O e-mail informado parece inválido. Revise e tente novamente.';
    }

    if (
      mensagem.includes('missing-continue-uri')
      || mensagem.includes('VITE_PUBLIC_APP_URL')
    ) {
      return 'O link mágico ainda não foi configurado corretamente neste ambiente.';
    }

    if (
      mensagem.includes('operation-not-allowed')
      || mensagem.includes('EMAIL_SIGNIN')
    ) {
      return 'Ative o provedor de link por e-mail no Firebase Authentication deste projeto.';
    }

    if (
      mensagem.includes('unauthorized-continue-uri')
      || mensagem.includes('unauthorized-domain')
    ) {
      return 'Autorize o domínio do app nas configurações do Firebase Authentication.';
    }

    if (mensagem.includes('too-many-requests') || mensagem.includes('Aguarde 1 minuto')) {
      return 'Aguarde cerca de 1 minuto antes de pedir outro link para este e-mail.';
    }

    if (
      mensagem.includes('invalid-action-code')
      || mensagem.includes('expired-action-code')
      || mensagem.includes('invalid-oob-code')
      || mensagem.includes('invalid-email-link')
    ) {
      return 'Esse link expirou, já foi usado ou não é válido. Solicite um novo link para entrar.';
    }

    if (mensagem.includes('user-disabled')) {
      return 'Esta conta foi desativada. Fale com um administrador.';
    }

    return `Erro ao entrar com link mágico: ${mensagem}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navegarAposLogin();
      } else {
        setVerificandoSessao(false);
      }
    });
    return () => unsubscribe();
  }, [navegarAposLogin]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || !verificandoSessao) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setVerificandoSessao(false);
      setErro('Não foi possível concluir a verificação de login neste navegador. Tente o link mágico por e-mail ou abra o app no Chrome/Edge em http://localhost:5173/admin.');
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [verificandoSessao]);

  const processarLinkPendente = useCallback(async () => {
    if (auth.currentUser) return;

    rememberRedirectFromCurrentUrl();

    const linkAtual = getMagicLinkFromCurrentUrl();
    if (linkAtual) {
      rememberPendingMagicLinkUrl(linkAtual);
    }

    const linkPendente = consumePendingMagicLinkUrl() || linkAtual;
    if (!linkPendente) {
      setMagicLinkUrl('');
      setAguardandoConfirmacaoEmail(false);
      return;
    }

    setMagicLinkUrl(linkPendente);
    setErro('');
    setInfo('');

    const emailGuardado = getRememberedMagicLinkEmail();
    if (!emailGuardado) {
      if (!linkAtual) {
        clearPendingMagicLinkUrl();
        setMagicLinkUrl('');
        setAguardandoConfirmacaoEmail(false);
        setVerificandoSessao(false);
        return;
      }

      setAguardandoConfirmacaoEmail(true);
      setVerificandoSessao(false);
      return;
    }

    setAguardandoConfirmacaoEmail(false);
    setEmail(emailGuardado);
    setEmailConfirmacao(emailGuardado);
    setLoadingMagicLink(true);

    try {
      await completeMagicLinkSignIn({
        email: emailGuardado,
        emailLink: linkPendente
      });

      navegarAposLogin();
    } catch (error) {
      console.error(error);
      const mensagem = String(error?.message || error || '');
      if (
        mensagem.includes('invalid-action-code')
        || mensagem.includes('expired-action-code')
        || mensagem.includes('invalid-oob-code')
        || mensagem.includes('invalid-email-link')
      ) {
        clearPendingMagicLinkUrl();
        setMagicLinkUrl('');
        setAguardandoConfirmacaoEmail(false);
      }
      setErro(extrairMensagemErroMagicLink(error));
      setVerificandoSessao(false);
    } finally {
      setLoadingMagicLink(false);
    }
  }, [navegarAposLogin]);

  useEffect(() => {
    void processarLinkPendente();
  }, [processarLinkPendente]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const reprocessar = () => {
      void processarLinkPendente();
    };

    window.addEventListener(MAGIC_LINK_STATE_EVENT, reprocessar);
    window.addEventListener('storage', reprocessar);
    window.addEventListener('focus', reprocessar);
    window.addEventListener('pageshow', reprocessar);
    document.addEventListener('visibilitychange', reprocessar);

    return () => {
      window.removeEventListener(MAGIC_LINK_STATE_EVENT, reprocessar);
      window.removeEventListener('storage', reprocessar);
      window.removeEventListener('focus', reprocessar);
      window.removeEventListener('pageshow', reprocessar);
      document.removeEventListener('visibilitychange', reprocessar);
    };
  }, [processarLinkPendente]);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    setErro('');
    setInfo('');
    try {
      if (Capacitor.isNativePlatform()) {
        await signInWithGoogleNative();
        navegarAposLogin();
        return;
      }

      await signInWithPopup(auth, googleProvider);
      navegarAposLogin();
    } catch (error) {
      console.error(error);
      setErro(extrairMensagemErroGoogle(error));
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEnviarMagicLink = async (event) => {
    event.preventDefault();

    if (!isValidAuthEmail(email)) {
      setErro('Informe um e-mail válido para receber o link mágico.');
      setInfo('');
      return;
    }

    setLoadingMagicLink(true);
    setErro('');
    setInfo('');

    try {
      const normalized = await sendMagicLink(email, {
        redirectPath: peekPostLoginRedirect()
      });
      setEmail(normalized);
      setEmailConfirmacao(normalized);
      setAguardandoConfirmacaoEmail(false);
      setInfo(`Enviamos um link de acesso para ${normalized}. Abra o e-mail, toque no link e volte para o app.`);
    } catch (error) {
      console.error(error);
      setErro(extrairMensagemErroMagicLink(error));
    } finally {
      setLoadingMagicLink(false);
    }
  };

  const handleConfirmarMagicLink = async (event) => {
    event.preventDefault();

    if (!magicLinkUrl || !isMagicLinkSignInUrl(magicLinkUrl)) {
      setErro('Não encontramos um link mágico pendente neste dispositivo. Solicite um novo link.');
      setInfo('');
      return;
    }

    if (!isValidAuthEmail(emailConfirmacao)) {
      setErro('Confirme o mesmo e-mail usado para solicitar o link.');
      setInfo('');
      return;
    }

    setLoadingMagicLink(true);
    setErro('');
    setInfo('');

    try {
      await completeMagicLinkSignIn({
        email: emailConfirmacao,
        emailLink: magicLinkUrl
      });
      navegarAposLogin();
    } catch (error) {
      console.error(error);
      const mensagem = String(error?.message || error || '');
      if (
        mensagem.includes('invalid-action-code')
        || mensagem.includes('expired-action-code')
        || mensagem.includes('invalid-oob-code')
        || mensagem.includes('invalid-email-link')
      ) {
        clearPendingMagicLinkUrl();
        setMagicLinkUrl('');
        setAguardandoConfirmacaoEmail(false);
      }
      setErro(extrairMensagemErroMagicLink(error));
    } finally {
      setLoadingMagicLink(false);
    }
  };

  if (verificandoSessao) {
    return (
      <AuthStatusScreen message="Entrando..." />
    );
  }

  return (
    <div className="flex items-center justify-center h-[100dvh] bg-gray-100">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 m-4 animate-fade-in">
        <div className="p-8 text-center">
          <img
            src={APP_ICON_192}
            alt={`Logo ${APP_SHORT_NAME}`}
            className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-sm"
          />
          <h2 className="text-3xl font-bold text-blue-600 mb-2">{APP_SHORT_NAME}</h2>
          <p className="text-gray-500 mb-8">{APP_SUBTITLE || APP_TITLE}</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loadingGoogle || loadingMagicLink}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-lg transition-all shadow-sm active:scale-95"
            >
              {loadingGoogle ? (
                <span className="text-sm">Conectando...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Entrar com Google
                </>
              )}
            </button>
            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.18em] text-gray-400">
              <span className="h-px flex-1 bg-gray-200"></span>
              ou
              <span className="h-px flex-1 bg-gray-200"></span>
            </div>
            {aguardandoConfirmacaoEmail ? (
              <form onSubmit={handleConfirmarMagicLink} className="flex flex-col gap-3 text-left">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  Confirme seu e-mail
                </label>
                <input
                  type="email"
                  value={emailConfirmacao}
                  onChange={(event) => setEmailConfirmacao(event.target.value)}
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={loadingMagicLink || loadingGoogle}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMagicLink ? 'Concluindo login...' : 'Concluir com link mágico'}
                </button>
                <p className="text-xs text-gray-500">
                  Esse passo é necessário quando o link foi aberto em outro dispositivo ou navegador.
                </p>
              </form>
            ) : (
              <form onSubmit={handleEnviarMagicLink} className="flex flex-col gap-3 text-left">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  Entrar com link mágico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={loadingMagicLink || loadingGoogle}
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMagicLink ? 'Enviando link...' : 'Receber link por e-mail'}
                </button>
                <p className="text-xs text-gray-500">
                  O acesso continua sujeito à aprovação do administrador para o e-mail informado.
                </p>
              </form>
            )}
            {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
            {info && <p className="text-emerald-600 text-xs mt-1">{info}</p>}
            <div className="pt-2 text-xs text-gray-500">
              <p className="mb-2">Ao continuar, você concorda com os Termos de Uso e com a Política de Privacidade do aplicativo.</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                <a href="/privacy-policy.html" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  Política de Privacidade
                </a>
                <a href="/terms-of-use.html" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  Termos de Uso
                </a>
                <a href="/account-deletion.html" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  Exclusão de Conta
                </a>
                <a href="/data-deletion-request.html" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  Exclusão de Dados
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
