import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, db } from './firebase';
import { arrayUnion, collection, query, where, getDocs, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { signInWithGoogleNative, signOutGoogleNative } from './nativeGoogleAuth';
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
} from './emailLinkAuth';
import { ativarPushNotifications, desativarPushNotifications, describePushActivationError } from './pushNotifications';
import { useUsuario } from './useUsuario';
import appInfo from './version.json';
import AutoUpdate from './AutoUpdate';
import { checkForUpdate } from './updateUtils';
import AjudaModal from './AjudaModal';
import { loadMapaData } from './mapData';
import { buildFeatureIndex, getFeatureBoundsStr, getTerritorioQuadrasCount } from './mapaUtils';
import { useSistema } from './useSistema';
import { getSistemaTheme, isNormalContext } from './sistema';
import { getTerritorioContextCollectionRef, getTerritorioProgresso, getTerritorioStateRef } from './territorioContext';
import { normalizeTerritorioNome } from './territorioNome';
import { useCoberturaCampanha } from './useCoberturaCampanha';
import { finalizarTerritorioDesignado } from './territorioActions';
import { describeOutboxConflict } from './territorioOfflineModel';
import { useTerritorioOutbox, useTerritorioSync } from './useTerritorioOffline';
import { UiFeedbackProvider, useUiFeedback } from './uiFeedback';
import { ModalFrame } from './uiPrimitives';
import { buttonClass } from './uiClasses';
import {
  buildOfflineAreaDownloadPlan,
  clearOfflineMapCaches,
  downloadOfflineMapArea,
  getOfflineMapFreshnessInfo,
  OFFLINE_MAP_DOWNLOAD_PROFILES,
  OFFLINE_MAP_MAX_AGE_DAYS,
  getOfflineMapCacheSummary,
  readOfflineMapDownloadState,
  writeOfflineMapDownloadState
} from './mapOfflineCache';

const Mapa = lazy(() => import('./Mapa'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const Relatorios = lazy(() => import('./Relatorios'));
const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Territórios';
const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME || 'Territórios';
const APP_SUBTITLE = import.meta.env.VITE_APP_SUBTITLE || '';
const APP_ICON_192 = import.meta.env.VITE_APP_ICON_192 || './icon-192.png';

function AuthStatusScreen({ message = 'Entrando...' }) {
  return (
    <div className="flex items-center justify-center h-[100dvh] bg-gray-100 px-6">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 animate-fade-in">
        <div className="p-8 text-center">
          <img
            src={APP_ICON_192}
            alt={`Logo ${APP_SHORT_NAME}`}
            className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-sm"
          />
          <h2 className="text-3xl font-bold text-blue-600 mb-2">{APP_SHORT_NAME}</h2>
          <p className="text-gray-500 mb-8">{APP_SUBTITLE || APP_TITLE}</p>
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <span className="text-blue-600 font-semibold text-sm animate-pulse">{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function useAuthSessionState() {
  const [authState, setAuthState] = useState(() => ({
    user: auth.currentUser,
    loading: true
  }));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthState({
        user: currentUser,
        loading: false
      });
    });

    return () => unsubscribe();
  }, []);

  return authState;
}

const getMeusTerritoriosQuery = ({ email, contextoId }) => {
  if (isNormalContext(contextoId)) {
    return query(collection(db, "territorios"), where("designadoPara", "==", email));
  }

  return query(
    getTerritorioContextCollectionRef(db),
    where("contextoId", "==", contextoId),
    where("designadoPara", "==", email)
  );
};

const carregarMeusTerritoriosDocs = async ({ email, contextoId }) => {
  const querySnapshot = await getDocs(getMeusTerritoriosQuery({ email, contextoId }));
  return querySnapshot.docs.map((territorioDoc) => ({
    id: territorioDoc.id,
    ...territorioDoc.data()
  }));
};

const montarListaMeusTerritorios = async ({ docs }) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return [];
  }

  const geoData = await loadMapaData();
  const featureMap = buildFeatureIndex(geoData);
  const listaCompleta = docs.map((territorioDoc) => {
    const numeroId = territorioDoc.territorioNumero || parseInt(String(territorioDoc.id).replace(/.*t_/, ''), 10);
    const feature = featureMap.get(numeroId);
    const nome = normalizeTerritorioNome(
      territorioDoc.nome || feature?.properties?.nome,
      `Território ${numeroId}`
    );
    const boundsStr = getFeatureBoundsStr(feature);
    const totalQuadras = getTerritorioQuadrasCount(feature);
    const progresso = getTerritorioProgresso(territorioDoc, totalQuadras);
    const quadrasFeitas = progresso.quadrasFeitasExibicao;
    const quadrasRestantes = Math.max(totalQuadras - quadrasFeitas, 0);
    const percentual = progresso.percentualExibicao;

    let statusResumo = 'Em andamento';
    let descricaoResumo = `${quadrasRestantes} quadra${quadrasRestantes === 1 ? '' : 's'} faltando`;
    let barraClasse = 'bg-blue-600';
    let badgeClasse = 'bg-amber-100 text-amber-700';

    if (progresso.isAguardandoFinalizacao) {
      statusResumo = 'Aguardando finalização';
      descricaoResumo = 'Todas as quadras marcadas; falta confirmar a finalização';
      barraClasse = 'bg-yellow-400';
      badgeClasse = 'bg-yellow-100 text-yellow-700';
    } else if (progresso.isFinalizado) {
      statusResumo = 'Finalizado';
      descricaoResumo = 'Território encerrado e aguardando nova liberação';
      barraClasse = 'bg-green-500';
      badgeClasse = 'bg-green-100 text-green-700';
    }

    let dataFormatada = "Data desc.";
    let dataDesignacaoOrdenacao = 0;
    if (territorioDoc.dataDesignacao) {
      const d = territorioDoc.dataDesignacao.toDate ? territorioDoc.dataDesignacao.toDate() : new Date(territorioDoc.dataDesignacao);
      dataFormatada = d.toLocaleDateString('pt-BR');
      dataDesignacaoOrdenacao = d.getTime();
    }

    return {
      ...territorioDoc,
      numeroId,
      nome,
      boundsStr,
      dataFormatada,
      dataDesignacaoOrdenacao,
      totalQuadras,
      quadrasFeitas,
      quadrasRestantes,
      percentual,
      statusResumo,
      descricaoResumo,
      barraClasse,
      badgeClasse,
      podeFinalizarDireto: progresso.isAguardandoFinalizacao && Boolean(territorioDoc.designadoPara)
    };
  });

  listaCompleta.sort((a, b) => {
    const diffTempo = a.dataDesignacaoOrdenacao - b.dataDesignacaoOrdenacao;
    if (diffTempo !== 0) return diffTempo;
    return a.numeroId - b.numeroId;
  });

  return listaCompleta;
};

// --- CAPTURA GLOBAL DO EVENTO DE INSTALAÇÃO ---
let deferredPromptGlobal = null;

if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptGlobal = e;
  });
}

// --- TELA DE LOGIN ---
function Login() {
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

  const extrairMensagemErroGoogle = (error) => {
    const partes = [
      error?.message,
      error?.errorMessage,
      error?.result?.message,
      error?.result?.errorMessage,
      error?.details?.message
    ].filter(Boolean);

    const mensagem = partes.map((parte) => String(parte)).join(' | ');

    if (!mensagem) {
      return 'Erro ao conectar com Google. Tente novamente.';
    }

    if (mensagem.includes('VITE_GOOGLE_WEB_CLIENT_ID')) {
      return 'Falta configurar o client ID do Google para o app Android.';
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
      || mensagem.includes('VITE_EMAILJS_PUBLIC_KEY')
      || mensagem.includes('VITE_EMAILJS_SERVICE_ID')
      || mensagem.includes('VITE_EMAILJS_TEMPLATE_ID')
    ) {
      return 'O link mágico ainda não foi configurado corretamente neste ambiente.';
    }

    if (mensagem.includes('Aguarde 1 minuto')) {
      return 'Aguarde cerca de 1 minuto antes de pedir outro link para este e-mail.';
    }

    if (mensagem.includes('magic-link-emailjs-unavailable')) {
      return 'O envio por e-mail ainda não foi configurado corretamente neste ambiente.';
    }

    if (mensagem.includes('The Public Key is required') || mensagem.includes('publicKey')) {
      return 'Falta configurar a chave pública do EmailJS neste ambiente.';
    }

    if (mensagem.includes('The Service ID is required') || mensagem.includes('service ID')) {
      return 'Falta configurar o serviço do EmailJS neste ambiente.';
    }

    if (mensagem.includes('The Template ID is required') || mensagem.includes('template ID')) {
      return 'Falta configurar o template do EmailJS neste ambiente.';
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
        navigate('/app', { replace: true });
      } else {
        setVerificandoSessao(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const processarLinkPendente = useCallback(async () => {
    if (auth.currentUser) return;

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

      navigate('/app', { replace: true });
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
  }, [navigate]);

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
        navigate('/app', { replace: true });
        return;
      }

      await signInWithPopup(auth, googleProvider);
      navigate('/app', { replace: true });
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
      const normalized = await sendMagicLink(email);
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
      navigate('/app', { replace: true });
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

// --- SININHO DE NOTIFICAÇÕES ---
const SininhoNotificacoes = ({
  user,
  isAdmin,
  pushStatus = 'oculto',
  ativandoPush = false,
  onAtivarPush
}) => {
  const [notificacoesPessoais, setNotificacoesPessoais] = useState([]);
  const [notificacoesAdminLegado, setNotificacoesAdminLegado] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const { notify } = useUiFeedback();
  const idsNotificadosRef = useRef(new Set());
  const snapshotsIniciaisRef = useRef({ pessoais: false });
  const carregarNotificacoesAdminLegado = useCallback(async () => {
    if (!user?.email || !isAdmin) return [];

    const emailNormalizado = user.email.toLowerCase();
    const q2 = query(collection(db, "notificacoes"), where("para", "==", "ADMINS"));
    const snap = await getDocs(q2);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data(), escopoNotificacao: 'admins' }))
      .filter((notif) => !(Array.isArray(notif.lidaPor) && notif.lidaPor.includes(emailNormalizado)));
  }, [isAdmin, user]);

  const notificacoes = useMemo(
    () => {
      const notificacoesAdminExibidas = isAdmin ? notificacoesAdminLegado : [];
      return [...notificacoesPessoais, ...notificacoesAdminExibidas]
        .sort((a, b) => (b.data?.seconds || 0) - (a.data?.seconds || 0));
    },
    [isAdmin, notificacoesAdminLegado, notificacoesPessoais]
  );

  useEffect(() => {
    if (!user) return;
    const emailNormalizado = user.email.toLowerCase();
    const q1 = query(
      collection(db, "notificacoes"),
      where("para", "==", user.email),
      where("lida", "==", false)
    );
    idsNotificadosRef.current = new Set();
    snapshotsIniciaisRef.current = { pessoais: false };

    const getTituloNotificacao = (notif) => {
      const titulos = {
        cadastro: 'Novo cadastro',
        comunicado: 'Comunicado',
        conclusao: 'Território finalizado',
        devolucao: 'Território devolvido',
        sistema: 'Notificação'
      };

      return titulos[notif.tipo] || 'Notificação';
    };

    const notificacaoEstaLida = (notif) => {
      if (notif.escopoNotificacao === 'admins') {
        return Array.isArray(notif.lidaPor) && notif.lidaPor.includes(emailNormalizado);
      }

      return Boolean(notif.lida);
    };

    const filtrarNaoLidas = (lista) => lista.filter((notif) => !notificacaoEstaLida(notif));

    const registrarNotificacoesInApp = (lista, escopo) => {
      const snapshotInicialConcluido = snapshotsIniciaisRef.current[escopo];

      filtrarNaoLidas(lista).forEach((notif) => {
        if (idsNotificadosRef.current.has(notif.id)) return;

        idsNotificadosRef.current.add(notif.id);

        if (snapshotInicialConcluido) {
          notify({
            title: getTituloNotificacao(notif),
            message: notif.texto,
            variant: notif.tipo === 'devolucao' || notif.tipo === 'conclusao' ? 'success' : 'info'
          });
        }
      });

      snapshotsIniciaisRef.current = {
        ...snapshotsIniciaisRef.current,
        [escopo]: true
      };
    };

    const unsub1 = onSnapshot(q1, (snap) => {
      const minhas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      registrarNotificacoesInApp(minhas, 'pessoais');
      setNotificacoesPessoais(filtrarNaoLidas(minhas));
    });

    return () => unsub1();
  }, [user, notify]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    let ativo = true;

    const sincronizarLegado = async () => {
      try {
        const deAdmin = await carregarNotificacoesAdminLegado();
        if (!ativo) return;
        setNotificacoesAdminLegado(deAdmin);
      } catch (error) {
        if (!ativo) return;
        console.error("Erro ao verificar notificações legadas de admins:", error);
      }
    };

    const handleFocus = () => {
      void sincronizarLegado();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sincronizarLegado();
      }
    };

    void sincronizarLegado();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ativo = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [carregarNotificacoesAdminLegado, isAdmin, user]);

  useEffect(() => {
    if (!user || !isAdmin || !isOpen) return;

    const emailNormalizado = user.email.toLowerCase();
    const q2 = query(collection(db, "notificacoes"), where("para", "==", "ADMINS"));

    const unsub2 = onSnapshot(q2, (snap) => {
      const deAdmin = snap.docs
        .map(d => ({ id: d.id, ...d.data(), escopoNotificacao: 'admins' }))
        .filter((notif) => !(Array.isArray(notif.lidaPor) && notif.lidaPor.includes(emailNormalizado)));
      setNotificacoesAdminLegado(deAdmin);
    });

    return () => {
      unsub2();
    };
  }, [isAdmin, isOpen, user]);

  const limparNotificacao = async (notif) => {
    try {
      const notificacaoRef = doc(db, "notificacoes", notif.id);

      if (notif.escopoNotificacao === 'admins') {
        await updateDoc(notificacaoRef, {
          lidaPor: arrayUnion(user.email.toLowerCase())
        });
        return;
      }

      await updateDoc(notificacaoRef, { lida: true });
    } catch (e) {
      console.error("Erro ao limpar notificação:", e);
    }
  };

  const temNovas = notificacoes.length > 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-white hover:bg-blue-700 rounded-full transition-colors active:scale-95"
        title="Notificações"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {temNovas && <span className="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-blue-600 animate-pulse"></span>}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-start justify-end p-4 pt-16 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-80 overflow-hidden animate-fade-in mr-2 border border-blue-100" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
              <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2">🔔 Notificações</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold px-2">✕</button>
            </div>
            {pushStatus !== 'oculto' && (
              <div className="border-b border-blue-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-bold ${pushStatus === 'ativo' ? 'text-emerald-700' : pushStatus === 'bloqueado' ? 'text-red-600' : 'text-gray-600'}`}>
                    {pushStatus === 'ativo' ? 'Push ativo' : pushStatus === 'bloqueado' ? 'Push bloqueado' : 'Push desativado'}
                  </span>
                  {pushStatus !== 'ativo' && pushStatus !== 'bloqueado' && (
                    <button
                      type="button"
                      onClick={onAtivarPush}
                      disabled={ativandoPush}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
                    >
                      {ativandoPush ? 'Ativando...' : 'Ativar'}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="max-h-96 overflow-y-auto bg-gray-50/50">
              {notificacoes.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center">
                  <span className="text-2xl mb-2">😴</span>
                  <span>Nenhuma notificação nova.</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notificacoes.map(notif => (
                    <div key={notif.id} className="p-3 hover:bg-white transition-colors flex gap-3 items-start group">
                      <div className="text-xl pt-0.5 bg-white rounded-full h-8 w-8 flex items-center justify-center shadow-sm border border-gray-100">
                        {notif.tipo === 'devolucao' ? '🏁' : '📍'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 leading-snug">{notif.texto}</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium">
                          {notif.data?.toDate ? notif.data.toDate().toLocaleString() : 'Agora'}
                        </p>
                      </div>
                      <button
                        onClick={() => limparNotificacao(notif)}
                        className="text-gray-300 hover:text-red-500 self-start p-1 hover:bg-red-50 rounded transition-colors"
                        title="Marcar como lida"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- MODAL MEUS TERRITÓRIOS ---
const SistemaChip = ({ contextoSistema, compact = false, coberturaCampanha = null, carregandoCobertura = false, stacked = false, coverageOnly = false }) => {
  if (!contextoSistema?.campanhaAtiva) return null;

  const coberturaBadge = carregandoCobertura ? (
    <span className="rounded-full bg-violet-950/35 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-100">
      ...
    </span>
  ) : coberturaCampanha ? (
    <span className="rounded-full bg-violet-950/35 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-100 whitespace-nowrap">
      {coberturaCampanha.percentualCoberto}% coberto
    </span>
  ) : null;

  if (coverageOnly) {
    if (carregandoCobertura) {
      return (
        <span className="inline-flex items-center rounded-full bg-violet-950/35 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-100">
          ...
        </span>
      );
    }

    if (coberturaCampanha) {
      return (
        <span className="inline-flex items-center rounded-full bg-violet-950/35 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-100">
          {coberturaCampanha.percentualCoberto}%
        </span>
      );
    }

    return null;
  }

  if (stacked) {
    return (
      <span className="flex max-w-full flex-col rounded-2xl border border-violet-200/35 bg-violet-900/45 px-2.5 py-1.5 text-violet-50 shadow-sm">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold leading-tight">
          <span className="shrink-0">📢</span>
          <span className="truncate">{contextoSistema.contextoAtivoTitulo}</span>
        </span>
        {coberturaBadge ? (
          <span className="mt-1 pl-5">
            {coberturaBadge}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 font-bold ${compact ? 'text-[10px]' : 'text-xs'} bg-violet-900/45 text-violet-50 border-violet-200/35`}>
      <span>📢</span>
      <span className="truncate max-w-[180px]">{contextoSistema.contextoAtivoTitulo}</span>
      {coberturaBadge}
    </span>
  );
};

const ModalConfirmacaoLogout = ({ isOpen, onConfirmar, onCancelar }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-red-600 px-4 py-3">
          <h3 className="text-lg font-bold text-white">Confirmar saída</h3>
        </div>
        <div className="p-4 text-sm text-gray-700">
          <p>Deseja realmente sair da sua conta do Google?</p>
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={onConfirmar}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700"
          >
            Sair
          </button>
          <button
            onClick={onCancelar}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-700 hover:bg-gray-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

const SobreModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const links = [
    { href: '/privacy-policy.html', label: 'Política de Privacidade', emoji: '🔒' },
    { href: '/terms-of-use.html', label: 'Termos de Uso', emoji: '📄' },
    { href: '/account-deletion.html', label: 'Exclusão de Conta', emoji: '👤' },
    { href: '/data-deletion-request.html', label: 'Exclusão de Dados', emoji: '🗑️' }
  ];

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Sobre o app"
      subtitle="Informações, versão atual e documentos importantes."
      size="md"
      accentClass="bg-blue-600"
      footer={(
        <button onClick={onClose} className={buttonClass('primary', 'w-full')}>
          Fechar
        </button>
      )}
    >
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center">
            <p className="text-sm font-bold text-blue-900">Territórios Digitais</p>
            <p className="mt-1 text-xs font-semibold text-blue-700">Versão {appInfo.version}</p>
            <p className="mt-1 text-[11px] text-blue-600/80">{appInfo.buildDate}</p>
          </div>

          <div className="mt-5">
            <h4 className="mb-2 text-sm font-bold text-gray-800">Documentos e privacidade</h4>
            <div className="space-y-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-base">{link.emoji}</span>
                    <span>{link.label}</span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-gray-400">Desenvolvido com carinho ❤️</p>
    </ModalFrame>
  );
};

const MeusTerritoriosModal = ({ isOpen, onClose, user, navigate, contextoSistema, listaInicial, onConsumirListaInicial }) => {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [territorioProcessandoId, setTerritorioProcessandoId] = useState(null);
  const temaSistema = getSistemaTheme(contextoSistema);
  const { notify, confirm } = useUiFeedback();
  const contextoIdAtual = contextoSistema?.contextoAtivoId || 'normal';
  const carregarLista = useCallback(async () => {
    if (!user?.email) return [];

    const meusDocs = await carregarMeusTerritoriosDocs({
      email: user.email,
      contextoId: contextoIdAtual
    });

    return montarListaMeusTerritorios({ docs: meusDocs });
  }, [contextoIdAtual, user?.email]);

  useEffect(() => {
    if (!isOpen || !user) return;

    if (listaInicial?.contextoId === contextoIdAtual && listaInicial?.email === user.email) {
      setLista(listaInicial.items);
      setCarregando(false);
      onConsumirListaInicial?.();
      return;
    }

    let ativo = true;

    const carregarMeusTerritorios = async () => {
      if (ativo) {
        setCarregando(true);
      }

      try {
        const listaCompleta = await carregarLista();
        if (ativo) {
          setLista(listaCompleta);
        }
      } catch (error) {
        console.error(error);
        if (ativo) {
          setLista([]);
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    };

    carregarMeusTerritorios();

    return () => {
      ativo = false;
    };
  }, [carregarLista, contextoIdAtual, isOpen, listaInicial, onConsumirListaInicial, user]);

  const irParaMapa = (item) => {
    if (item.boundsStr) {
      navigate(`/app?bounds=${item.boundsStr}`);
      onClose();
    } else {
      notify("Localização não encontrada.");
      onClose();
    }
  };

  const finalizarDireto = async (item) => {
    if (!user?.email || !item?.podeFinalizarDireto) return;
    if (!(await confirm({
      title: 'Finalizar territorio',
      message: `Confirmar a finalização do território ${item.nome || item.numeroId}?`,
      tone: 'warning',
      confirmLabel: 'Finalizar'
    }))) return;

    setTerritorioProcessandoId(item.id);

    try {
      const stateRef = getTerritorioStateRef(db, item.numeroId, contextoSistema?.contextoAtivoId);
      const salvarEstadoTerritorio = async (updates) => {
        await setDoc(stateRef, updates, { merge: true });
      };

      const resultado = await finalizarTerritorioDesignado({
        salvarEstadoTerritorio,
        dadosBanco: item,
        nome: item.nome || `Território ${item.numeroId}`,
        contextoSistema
      });

      if (resultado.ok) {
        setLista((listaAtual) => listaAtual.filter((territorio) => territorio.id !== item.id));
        notify({
          title: 'Território finalizado',
          message: `Território finalizado com sucesso${resultado.contextoSufixo}.`,
          variant: 'success'
        });
      }
    } catch (error) {
      console.error(error);
      notify({
        title: 'Finalização indisponível',
        message: 'Não foi possível finalizar o território agora. Tente novamente.',
        variant: 'error'
      });
    } finally {
      setTerritorioProcessandoId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Meus Territórios"
      size="md"
      accentClass={temaSistema.headerBg}
      titleIcon={(
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
      )}
      headerExtra={<SistemaChip contextoSistema={contextoSistema} compact />}
    >
          {carregando ? (
            <div className="py-10 flex flex-col items-center justify-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-sm font-medium">Carregando seus territórios...</p>
            </div>
          ) : lista.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2 text-4xl">🤷‍♂️</p>
              <p>Nenhum território designado para você no momento.</p>
              <p className="text-xs mt-2 text-gray-400">Fale com o Servo de Territórios.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Ordenado dos territórios mais antigos para os mais recentes.
              </div>
              {lista.map((t) => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg">{t.nome || `Território ${t.numeroId}`}</h4>
                      <p className="text-xs text-gray-500">Recebido em: <span className="font-medium text-gray-700">{t.dataFormatada}</span></p>
                    </div>
                    <div className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">#{t.numeroId}</div>
                  </div>
                  <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
                      <span>{t.quadrasFeitas} de {t.totalQuadras} quadras</span>
                      <span>{t.percentual}%</span>
                    </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${t.barraClasse}`}
                        style={{ width: `${t.percentual}%` }}
                      ></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-600">
                        {t.descricaoResumo}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-bold ${t.badgeClasse}`}>
                        {t.statusResumo}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {t.podeFinalizarDireto && (
                      <button
                        onClick={() => finalizarDireto(t)}
                        disabled={territorioProcessandoId === t.id}
                        className={`flex-1 text-white text-sm font-bold py-2 rounded-lg active:scale-95 transition-transform ${territorioProcessandoId === t.id ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      >
                        {territorioProcessandoId === t.id ? 'Finalizando...' : 'Finalizar agora'}
                      </button>
                    )}
                    <button onClick={() => irParaMapa(t)} className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                      Ir para o Mapa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </ModalFrame>
  );
};

const MapaOfflineModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [downloadState, setDownloadState] = useState(() => readOfflineMapDownloadState());
  const [profileId, setProfileId] = useState('medio');
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const downloadingRef = useRef(false);
  const mountedRef = useRef(false);
  const { notify, confirm } = useUiFeedback();
  const profile = OFFLINE_MAP_DOWNLOAD_PROFILES[profileId] || OFFLINE_MAP_DOWNLOAD_PROFILES.medio;
  const layerTypes = useMemo(
    () => (includeSatellite ? ['padrao', 'google', 'satelite'] : ['padrao', 'google']),
    [includeSatellite]
  );

  const plan = useMemo(() => {
    if (!geoData) return null;
    return buildOfflineAreaDownloadPlan(geoData, {
      zooms: profile.zooms,
      layerTypes
    });
  }, [geoData, layerTypes, profile.zooms]);

  useEffect(() => {
    downloadingRef.current = downloading;
  }, [downloading]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [geoData, cacheSummary] = await Promise.all([
        loadMapaData(),
        getOfflineMapCacheSummary()
      ]);

      if (!mountedRef.current) return;
      setGeoData(geoData);
      setSummary(cacheSummary);
      const persistedState = readOfflineMapDownloadState();
      if (persistedState.status === 'running' && !downloadingRef.current) {
        writeOfflineMapDownloadState('interrupted');
        if (mountedRef.current) {
          setDownloadState(readOfflineMapDownloadState());
        }
      } else {
        if (mountedRef.current) {
          setDownloadState(persistedState);
        }
      }
    } catch (error) {
      console.error(error);
      if (!mountedRef.current) return;
      notify({
        title: 'Mapa offline indisponível',
        message: 'Não foi possível carregar os dados para o gerenciamento offline agora.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (!isOpen) return;
    refreshData();
  }, [isOpen, refreshData]);

  const handleDownload = async () => {
    if (downloading) return;

    writeOfflineMapDownloadState('running');
    if (mountedRef.current) {
      setDownloadState(readOfflineMapDownloadState());
    }
    setDownloading(true);
    setProgress({
      total: plan?.totalTiles ? plan.totalTiles + 1 : 1,
      completed: 0,
      downloaded: 0,
      skipped: 0,
      phase: 'Preparando download...'
    });

    try {
      await downloadOfflineMapArea({
        geoJsonData: geoData,
        zooms: profile.zooms,
        layerTypes,
        onProgress: (next) => setProgress(next)
      });

      writeOfflineMapDownloadState('completed');
      if (mountedRef.current) {
        setDownloadState(readOfflineMapDownloadState());
      }
      await refreshData();
      if (!mountedRef.current) return;
      notify({
        title: 'Mapas baixados',
        message: 'A área principal dos territórios ficou salva para uso offline.',
        variant: 'success'
      });
    } catch (error) {
      console.error(error);
      writeOfflineMapDownloadState('interrupted');
      if (mountedRef.current) {
        setDownloadState(readOfflineMapDownloadState());
      }
      if (!mountedRef.current) return;
      notify({
        title: 'Download interrompido',
        message: String(error?.message || 'Não foi possível baixar os mapas offline agora.'),
        variant: 'error'
      });
    } finally {
      if (mountedRef.current) {
        setDownloading(false);
      }
    }
  };

  const handleClear = async () => {
    if (downloading) return;

    const shouldClear = await confirm({
      title: 'Excluir mapas offline',
      message: 'Remover os mapas baixados desta área do aparelho?',
      tone: 'warning',
      confirmLabel: 'Excluir'
    });

    if (!shouldClear) return;

    try {
      await clearOfflineMapCaches();
      writeOfflineMapDownloadState('idle');
      if (mountedRef.current) {
        setDownloadState(readOfflineMapDownloadState());
      }
      await refreshData();
      if (!mountedRef.current) return;
      notify({
        title: 'Mapas removidos',
        message: 'Os arquivos offline desta área foram apagados do aparelho.',
        variant: 'success'
      });
    } catch (error) {
      console.error(error);
      notify({
        title: 'Não foi possível excluir',
        message: 'Tente novamente em alguns instantes.',
        variant: 'error'
      });
    }
  };

  if (!isOpen) return null;

  const totalTiles = plan?.totalTiles || 0;
  const tileEntries = summary?.tileEntries || 0;
  const totalEntries = summary?.totalEntries || 0;
  const percent = progress?.total ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;
  const zoomLabel = `${Math.min(...profile.zooms)} a ${Math.max(...profile.zooms)}`;
  const estimateMb = plan?.estimatedTotalMb ? Math.round(plan.estimatedTotalMb) : 0;
  const canDownload = !loading && !downloading && !!geoData && totalTiles > 0;
  const freshness = getOfflineMapFreshnessInfo();
  const downloadButtonLabel = freshness.isExpired ? 'Atualizar mapas' : 'Baixar área';

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Mapas Offline"
      subtitle="Baixe todos os territórios com o nível de detalhe desejado."
      titleIcon={<span>🗺️</span>}
      size="md"
      accentClass="bg-blue-600"
      bodyClassName="space-y-4 p-4"
      footer={(
        <div className="flex gap-2">
          {totalEntries > 0 && (
            <button
              onClick={handleClear}
              disabled={loading || downloading}
              className={buttonClass('dangerSoft', 'px-4')}
            >
              Excluir
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={!canDownload}
            className={buttonClass('primary', 'flex-[1.2] disabled:cursor-wait')}
          >
            {downloading ? 'Baixando...' : downloadButtonLabel}
          </button>
        </div>
      )}
    >
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
            Salva a área útil de <strong>todos os territórios</strong> nos mapas <strong>rua</strong> e <strong>Google</strong>. O <strong>satélite</strong> é opcional.
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-sm font-medium">Lendo dados offline...</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Detalhe</p>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={includeSatellite}
                      onChange={(e) => setIncludeSatellite(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Incluir satélite
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Object.values(OFFLINE_MAP_DOWNLOAD_PROFILES).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setProfileId(preset.id)}
                      className={`rounded-xl border px-3 py-2.5 text-center transition-colors ${profileId === preset.id ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span className="font-bold text-sm">{preset.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  <strong className="text-gray-700">{profile.label}:</strong> {profile.description} · Zoom {zoomLabel}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Resumo</p>
                    <p className="mt-2 text-sm font-semibold text-gray-800">
                      ~{estimateMb} MB para {totalTiles.toLocaleString('pt-BR')} partes do mapa
                    </p>
                  </div>
                  {totalEntries > 0 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {totalEntries.toLocaleString('pt-BR')} itens salvos
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Todos os territórios · Zoom {zoomLabel}
                  {includeSatellite ? ' · Com satélite' : ''}
                  {tileEntries > 0 ? ` · ${tileEntries} partes do mapa já salvas` : ''}
                </p>
              </div>

              {downloadState.status === 'interrupted' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  Um download anterior foi interrompido. Toque em <strong>Baixar área</strong> para retomar aproveitando o que já ficou salvo.
                </div>
              )}

              {freshness.isExpired && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                  Seus mapas offline passaram de <strong>{OFFLINE_MAP_MAX_AGE_DAYS} dias</strong>. Para continuar confiando no conteúdo salvo, faça um novo download desta área.
                </div>
              )}

              {freshness.hasOfflineDownload && !freshness.isExpired && freshness.ageDays !== null && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  Último pacote offline baixado há <strong>{freshness.ageDays} dia{freshness.ageDays === 1 ? '' : 's'}</strong>.
                </div>
              )}

              {progress && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-emerald-800">
                    <span>{progress.phase}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${percent}%` }}></div>
                  </div>
                  <p className="mt-2 text-xs text-emerald-800">
                    {progress.completed} de {progress.total} itens processados
                    {progress.downloaded > 0 ? ` · ${progress.downloaded} baixados` : ''}
                    {progress.skipped > 0 ? ` · ${progress.skipped} já estavam salvos` : ''}
                  </p>
                </div>
              )}
            </>
          )}
    </ModalFrame>
  );
};

const StatusSincronizacaoChip = ({
  isAdmin,
  isOnline,
  onlineSyncCount,
  offlinePendingCount,
  failedCount,
  conflictCount,
  conflictActions,
  aberto,
  onToggle,
  onClose
}) => {
  const hasStatus = !isOnline || offlinePendingCount > 0 || failedCount > 0 || conflictCount > 0;
  if (!hasStatus) return null;

  const infoOffline = isAdmin
    ? 'Você está offline. Ações administrativas precisam de conexão para evitar conflito de designações.'
    : 'Você está offline. As alterações do seu território ficam salvas localmente e sincronizam quando a conexão voltar.';

  let chipClasses = 'border-white/20 bg-white/12 text-white';
  let chipLabel = 'Status';

  if (conflictCount > 0) {
    chipClasses = 'border-red-200/70 bg-red-50 text-red-700';
    chipLabel = `${conflictCount} conflito${conflictCount === 1 ? '' : 's'}`;
  } else if (failedCount > 0) {
    chipClasses = 'border-orange-200/70 bg-orange-50 text-orange-700';
    chipLabel = `${failedCount} retry`;
  } else if (!isOnline) {
    chipClasses = 'border-amber-200/70 bg-amber-50 text-amber-800';
    chipLabel = offlinePendingCount > 0 ? `Offline · ${offlinePendingCount}` : 'Offline';
  } else if (onlineSyncCount > 0) {
    chipClasses = 'border-sky-200/70 bg-sky-50 text-sky-700';
    chipLabel = onlineSyncCount === 1 ? 'Salvando' : `Salvando ${onlineSyncCount}`;
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] shadow-sm transition-all active:scale-95 ${chipClasses}`}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          title="Status da sincronização offline"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current opacity-80"></span>
          <span>{chipLabel}</span>
        </button>
        <div className={`fixed left-3 right-3 top-[4.75rem] z-[60] origin-top overflow-hidden rounded-2xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur transition-all duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[24rem] sm:origin-top-right ${aberto ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-[0.98] opacity-0'}`}>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Status do envio</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Sincronização e modo offline</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                aria-label="Fechar status"
              >
                x
              </button>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4 text-sm">
            {!isOnline && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">
                {infoOffline}
              </div>
            )}
            {onlineSyncCount > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sky-800">
                Salvando alteraç{onlineSyncCount === 1 ? 'ão' : 'ões'} agora.
              </div>
            )}
            {offlinePendingCount > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-slate-800">
                {offlinePendingCount} alteraç{offlinePendingCount === 1 ? 'ão pendente' : 'ões pendentes'} aguardando sincronização.
              </div>
            )}
            {failedCount > 0 && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-orange-800">
                {failedCount} alteraç{failedCount === 1 ? 'ão precisa' : 'ões precisam'} de nova tentativa de sincronização.
              </div>
            )}
            {conflictCount > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-red-800">
                <p>{conflictCount} alteraç{conflictCount === 1 ? 'ão não pôde ser enviada' : 'ões não puderam ser enviadas'} porque a designação mudou.</p>
                {conflictActions.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs font-medium text-red-700">
                    {conflictActions.map((action) => (
                      <div key={action.id}>{describeOutboxConflict(action)}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {aberto && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[50] cursor-default bg-transparent"
          aria-label="Fechar status"
        />
      )}
    </>
  );
};

const BarraSalvandoHeader = ({ visible, count }) => (
  <div className={`overflow-hidden transition-all duration-300 ease-out ${visible ? 'max-h-16 opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`}>
    <div className="relative border-b border-sky-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500"></span>
          </span>
          <span>Salvando alterações</span>
        </div>
        <span>{count === 1 ? '1 envio' : `${count} envios`}</span>
      </div>
      <div className="h-0.5 w-full overflow-hidden bg-sky-100">
        <div className="h-full w-1/3 animate-[header-saving-slide_1.2s_ease-in-out_infinite] rounded-full bg-sky-500"></div>
      </div>
    </div>
  </div>
);

// --- MODAL DE LEGENDA ---
const LegendaModal = ({ isOpen, onClose, isAdmin }) => {
  if (!isOpen) return null;
  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Legenda do Mapa"
      subtitle="Cores e estados usados nos territórios."
      size="sm"
      accentClass="bg-blue-600"
      footer={(
        <button onClick={onClose} className={buttonClass('primary', 'w-full')}>
          Entendi
        </button>
      )}
    >
        <div className="space-y-4">
          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-orange-100 border border-orange-300 opacity-90 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Disponível Recente</p><p className="text-gray-500 text-xs">Trabalhado há menos tempo</p></div></div>
          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-orange-500 border border-orange-700 opacity-70 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Disponível Antigo</p><p className="text-gray-500 text-xs">Quanto mais escuro, mais tempo parado</p></div></div>
          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-blue-500 border border-blue-800 opacity-60 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Seu Território</p><p className="text-gray-500 text-xs">Em andamento</p></div></div>
          {isAdmin && <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-purple-500 border border-purple-800 opacity-60 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Seu (Admin)</p><p className="text-gray-500 text-xs">Designado para você</p></div></div>}
          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-yellow-400 border border-yellow-700 opacity-70 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Aguardando Finalização</p><p className="text-gray-500 text-xs">100% marcado, mas ainda com o dirigente</p></div></div>
          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-green-500 border border-green-800 opacity-60 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Finalizado</p><p className="text-gray-500 text-xs">Território encerrado oficialmente</p></div></div>
          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded bg-gray-500 border border-gray-700 opacity-30 flex-shrink-0"></span><div><p className="text-gray-800 font-bold text-sm">Ocupado</p><p className="text-gray-500 text-xs">Outro dirigente cuidando</p></div></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            No zoom mais longe, abaixo do código do território aparece há quanto tempo ele foi trabalhado pela última vez.
          </div>
        </div>
    </ModalFrame>
  );
};

// --- MENU LATERAL (ATUALIZADO - ORDEM REAJUSTADA) ---
const MenuLateral = ({ isOpen, onClose, user, isAdmin, navigate, handleLogout, abrirAjuda, abrirLegenda, abrirSobre, abrirMapaOffline, mapaOfflineNeedsRefresh, contextoSistema, coberturaCampanha, carregandoCobertura }) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  const [deferredPrompt, setDeferredPrompt] = useState(() => (isNativePlatform ? null : deferredPromptGlobal));
  const [photoUrlComErro, setPhotoUrlComErro] = useState(null);
  const temaSistema = getSistemaTheme(contextoSistema);
  const { notify } = useUiFeedback();
  const mostrarFotoPerfil = Boolean(user?.photoURL) && photoUrlComErro !== user?.photoURL;
  const exibirSistemaChip = Boolean(contextoSistema?.campanhaAtiva);
  const menuActionClass = 'flex min-h-12 items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-medium transition-colors md:text-[15px]';
  const menuActionIconClass = 'h-[22px] w-[22px] shrink-0';

  useEffect(() => {
    if (isNativePlatform || typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      deferredPromptGlobal = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isNativePlatform]);

  const instalarApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        deferredPromptGlobal = null;
      }
    } else {
      notify({
        title: 'Como instalar',
        message: 'Abra o menu do navegador (três pontinhos) e procure "Adicionar à Tela Inicial" ou "Instalar Aplicativo".',
        variant: 'info',
        durationMs: 7000
      });
    }
  };

  const isStandalone = !isNativePlatform
    && typeof window !== 'undefined'
    && window.matchMedia('(display-mode: standalone)').matches;
  const podeExibirInstalacao = !isNativePlatform && !isStandalone;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-[2000] bg-black/50 transition-opacity" onClick={onClose}></div>}
      <div className={`fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-[2001] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>

        {/* CABEÇALHO DO MENU */}
        <div className={`${temaSistema.headerBg} app-safe-panel-header px-5 pt-5 pb-4 text-white flex-shrink-0`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span
              className={`inline-flex h-9 items-center rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.14em] shadow-sm ${
                isAdmin
                  ? 'border border-violet-200/80 bg-violet-500 text-white'
                  : 'border border-sky-200/90 bg-sky-100 text-sky-900'
              }`}
            >
              {isAdmin ? 'Administrador' : 'Dirigente'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                title="Sair do sistema"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200/80 bg-red-500 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                <span>Sair</span>
              </button>
              <button
                onClick={onClose}
                title="Fechar menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white text-blue-600 shadow-lg ring-2 ring-white/35">
              {mostrarFotoPerfil ? (
                <img
                  src={user.photoURL}
                  alt={`Foto de perfil de ${user?.displayName || 'Usuário'}`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoUrlComErro(user?.photoURL || null)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-lg">
                  {(user?.displayName || user?.email || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="pt-0.5 text-base font-bold leading-tight whitespace-normal break-words">
                {user?.displayName || 'Usuário'}
              </p>
              <p className="mt-1 text-xs leading-snug text-blue-100/90 whitespace-normal break-all">
                {user?.email}
              </p>
            </div>
          </div>
          {exibirSistemaChip ? (
            <div className="mt-2.5">
              <SistemaChip
                contextoSistema={contextoSistema}
                coberturaCampanha={coberturaCampanha}
                carregandoCobertura={carregandoCobertura}
              />
            </div>
          ) : null}
        </div>

        {/* CORPO DO MENU */}
        <div className="p-4 flex flex-col gap-2.5 flex-1 overflow-y-auto">
          {/* 1 & 2. ITENS DE ADMIN */}
          {isAdmin && (
            <>
              <button onClick={() => { navigate('/admin'); onClose(); }} className={`${menuActionClass} text-gray-700 hover:bg-gray-50`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-gray-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h3l.56 2.02a5.98 5.98 0 0 1 1.5.87l1.93-.56 1.5 2.6-1.37 1.46c.06.4.08.79.08 1.11s-.02.71-.08 1.11l1.37 1.46-1.5 2.6-1.93-.56a5.98 5.98 0 0 1-1.5.87L13.5 21h-3l-.56-2.02a5.98 5.98 0 0 1-1.5-.87l-1.93.56-1.5-2.6 1.37-1.46A7.62 7.62 0 0 1 6.3 13.5c0-.32.02-.71.08-1.11L5 10.93l1.5-2.6 1.93.56c.46-.36.97-.65 1.5-.87L10.5 6Z" />
                  <circle cx="12" cy="13.5" r="2.25" />
                </svg>
                Painel de Controle
              </button>

              <button onClick={() => { navigate('/relatorios'); onClose(); }} className={`${menuActionClass} text-gray-700 hover:bg-gray-50`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-gray-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 16.5V12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V8.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5V5.5" />
                </svg>
                Relatórios
              </button>
            </>
          )}

          {/* 3. MAPAS OFFLINE */}
          <button onClick={() => { abrirMapaOffline(); onClose(); }} className={`${menuActionClass} text-cyan-700 hover:bg-cyan-50`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={menuActionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75 15 4.5l6 2.25v12L15 21l-6-2.25L3 21V8.25L9 6.75Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v12M15 4.5v12.75" />
            </svg>
            <span>Mapas Offline</span>
            {mapaOfflineNeedsRefresh && (
              <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-800">
                Atualizar
              </span>
            )}
          </button>

          {/* 4. COMO USAR */}
          <button onClick={() => { abrirAjuda(); onClose(); }} className={`${menuActionClass} text-yellow-700 hover:bg-yellow-50`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={menuActionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="12" cy="12" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.25a2.25 2.25 0 1 1 2.06 3.15c-.9.12-1.56.9-1.56 1.8v.3" />
              <circle cx="12" cy="17.25" r="1" fill="currentColor" stroke="none" />
            </svg>
            Como usar (Ajuda)
          </button>

          {/* 5. LEGENDA */}
          <button onClick={() => { abrirLegenda(); onClose(); }} className={`${menuActionClass} text-gray-700 hover:bg-gray-50`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-gray-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5h10.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h10.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 16.5h10.5" />
              <circle cx="5.25" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
              <circle cx="5.25" cy="12" r="1.25" fill="currentColor" stroke="none" />
              <circle cx="5.25" cy="16.5" r="1.25" fill="currentColor" stroke="none" />
            </svg>
            Legenda do Mapa
          </button>

          {/* 6. INSTALAR */}
          {podeExibirInstalacao && (
            <button onClick={instalarApp} className={`${menuActionClass} mt-2 border border-dashed border-green-200 text-green-700 hover:bg-green-50`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={menuActionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v10.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 11.25 3.75 3.75 3.75-3.75" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15" />
              </svg>
              Instalar Aplicativo
            </button>
          )}
        </div>

        {/* --- RODAPÉ COM BOTÃO DE UPDATE --- */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex flex-col items-center gap-1">
            <div className="mb-2 text-center text-[11px] text-gray-400 md:text-[10px]">
              <p className="font-semibold text-gray-500">Territórios Digitais v{appInfo.version}</p>
              <p className="opacity-75">{appInfo.buildDate}</p>
            </div>

          <button 
            onClick={async () => {
                const temUpdate = await checkForUpdate(true);
                if (!temUpdate) {
                  notify({
                    title: 'App atualizado',
                    message: 'Seu sistema já está atualizado.',
                    variant: 'success'
                  });
                }
            }}
            className="flex items-center gap-2.5 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-blue-600 text-sm font-bold hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Verificar Atualização
          </button>

          <button
            onClick={() => {
              abrirSobre();
              onClose();
            }}
            className="mt-3 flex items-center gap-2.5 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-slate-700 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sobre o app
          </button>

          <p className="mt-2 text-[10px] text-gray-300">Desenvolvido com carinho ❤️</p>
        </div>
      </div>
    </>
  );
};

// --- DASHBOARD (CORRIGIDO: BOTÕES VISÍVEIS + LOGO NO MOBILE) ---
function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [verificandoLogin, setVerificandoLogin] = useState(true);
  const { config: contextoSistema, loading: carregandoSistema } = useSistema();
  const temaSistema = getSistemaTheme(contextoSistema);
  const coberturaCampanha = useCoberturaCampanha(contextoSistema);

  // Estados dos modais
  const [menuAberto, setMenuAberto] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [mapaOfflineAberto, setMapaOfflineAberto] = useState(false);
  const [meusTerritoriosAberto, setMeusTerritoriosAberto] = useState(false);
  const [confirmarLogoutAberto, setConfirmarLogoutAberto] = useState(false);
  const [pushStatus, setPushStatus] = useState('oculto');
  const [ativandoPush, setAtivandoPush] = useState(false);
  const [statusSyncAberto, setStatusSyncAberto] = useState(false);
  const [meusTerritoriosPrecarregados, setMeusTerritoriosPrecarregados] = useState(null);
  const { notify } = useUiFeedback();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
      }
      setVerificandoLogin(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const { isAdmin, autorizado, loading: verificandoBanco, role } = useUsuario(user);
  const isOnline = useTerritorioSync({
    db,
    userEmail: user?.email,
    enabled: Boolean(user?.email && autorizado)
  });
  const { actions: outboxActions, summary: outboxSummary } = useTerritorioOutbox(user?.email);
  const conflictActions = useMemo(
    () => outboxActions.filter((action) => action.status === 'conflict').slice(0, 3),
    [outboxActions]
  );
  const onlineSyncCount = isOnline ? (outboxSummary.pendingCount + outboxSummary.syncingCount) : 0;
  const offlinePendingCount = !isOnline ? outboxSummary.pendingCount : 0;
  const mapaOfflineFreshness = getOfflineMapFreshnessInfo();

  useEffect(() => {
    if (!mapaOfflineFreshness.isExpired || typeof window === 'undefined') return;

    const key = 'offline-map-expired-toast-shown';
    if (window.sessionStorage.getItem(key)) return;

    window.sessionStorage.setItem(key, '1');
    notify({
      title: 'Mapas offline precisam de atualização',
      message: 'Abra "Mapas Offline" no menu e baixe novamente a área salva.',
      variant: 'warning',
      durationMs: 7000
    });
  }, [mapaOfflineFreshness.isExpired, notify]);

  useEffect(() => {
    if (!user || !autorizado || !Capacitor.isNativePlatform()) return;

    ativarPushNotifications(user).catch((error) => {
      console.warn('Push notifications nao puderam ser ativadas:', error);
    });
  }, [autorizado, user]);

  useEffect(() => {
    if (!user || !autorizado || Capacitor.isNativePlatform() || typeof window === 'undefined') {
      setPushStatus('oculto');
      return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !window.isSecureContext) {
      setPushStatus('bloqueado');
      return;
    }

    if (Notification.permission === 'granted') {
      setPushStatus('ativo');
      return;
    }

    if (Notification.permission === 'denied') {
      setPushStatus('bloqueado');
      return;
    }

    setPushStatus('desativado');
  }, [autorizado, user]);

  const handleAtivarPush = async () => {
    if (!user || ativandoPush) return;

    setAtivandoPush(true);

    try {
      await ativarPushNotifications(user);
      setPushStatus(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'bloqueado' : 'ativo');
      notify({
        title: 'Push ativado',
        message: 'Este dispositivo receberá notificações.',
        variant: 'success'
      });
    } catch (error) {
      console.warn('Push notifications nao puderam ser ativadas:', error);
      setPushStatus(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'bloqueado' : 'desativado');
      notify({
        title: 'Push indisponível',
        message: describePushActivationError(error),
        variant: 'warning'
      });
    } finally {
      setAtivandoPush(false);
    }
  };

  useEffect(() => {
    if (!user || !autorizado) return;

    let ativo = true;

    const verificarSeTemTerritorios = async () => {
      try {
        const contextoId = contextoSistema?.contextoAtivoId || 'normal';
        const meusDocs = await carregarMeusTerritoriosDocs({
          email: user.email,
          contextoId
        });

        if (ativo && meusDocs.length > 0) {
          const items = await montarListaMeusTerritorios({ docs: meusDocs });
          setMeusTerritoriosPrecarregados({
            email: user.email,
            contextoId,
            items
          });
          setMeusTerritoriosAberto(true);
        }
      } catch (error) {
        console.error('Erro ao verificar territórios designados:', error);
      }
    };

    verificarSeTemTerritorios();

    return () => {
      ativo = false;
    };
  }, [autorizado, contextoSistema?.contextoAtivoId, user]);

  const confirmarLogout = async () => {
    setConfirmarLogoutAberto(false);
    await desativarPushNotifications(user?.email);
    await signOutGoogleNative();
    navigate('/');
  };

  const handleLogout = () => {
    setConfirmarLogoutAberto(true);
  };

  // 1. TELA DE CARREGANDO
  if (verificandoLogin || (user && verificandoBanco) || carregandoSistema) {
    const mensagem = verificandoLogin ? 'Entrando...' : 'Carregando sistema...';
    return <AuthStatusScreen message={mensagem} />;
  }

  if (!user) return null;

  // 2. TELAS DE BLOQUEIO / PENDÊNCIA
  if (!autorizado) {
    if (role === 'aguardando') {
      return (
        <div className="h-[100dvh] flex items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 text-center border border-blue-100 animate-fade-in">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              🕒
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Cadastro em Análise</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Olá, <strong>{user.displayName || user.email}</strong>! <br />
              Seu acesso já foi solicitado e notificamos os administradores.
              <br /><br />
              <span className="text-sm bg-blue-50 text-blue-700 py-1 px-3 rounded-full">
                Fique tranquilo, em breve será liberado!
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => window.location.reload()} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
                Verificar novamente
              </button>
              <button onClick={handleLogout} className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Sair por enquanto
              </button>
            </div>
          </div>
          <ModalConfirmacaoLogout
            isOpen={confirmarLogoutAberto}
            onConfirmar={confirmarLogout}
            onCancelar={() => setConfirmarLogoutAberto(false)}
          />
        </div>
      );
    }
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-6 text-center border border-red-100">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Restrito</h2>
          <p className="mb-6 text-gray-600">O e-mail <strong>{user.email}</strong> não possui permissão de acesso.</p>
          <button onClick={handleLogout} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700">Sair</button>
        </div>
        <ModalConfirmacaoLogout
          isOpen={confirmarLogoutAberto}
          onConfirmar={confirmarLogout}
          onCancelar={() => setConfirmarLogoutAberto(false)}
        />
      </div>
    );
  }

  // 3. TELA PRINCIPAL (DASHBOARD)
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden relative">
      <style>{`
        @keyframes header-saving-slide {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(420%); }
        }
      `}</style>
      <MenuLateral
        isOpen={menuAberto}
        onClose={() => setMenuAberto(false)}
        user={user}
        isAdmin={isAdmin}
        navigate={navigate}
        handleLogout={handleLogout}
        abrirAjuda={() => setAjudaAberta(true)}
        abrirLegenda={() => setLegendaAberta(true)}
        abrirSobre={() => setSobreAberto(true)}
        abrirMapaOffline={() => setMapaOfflineAberto(true)}
        mapaOfflineNeedsRefresh={mapaOfflineFreshness.isExpired}
        contextoSistema={contextoSistema}
        coberturaCampanha={coberturaCampanha}
        carregandoCobertura={coberturaCampanha.loading}
      />

      <LegendaModal
        isOpen={legendaAberta}
        onClose={() => setLegendaAberta(false)}
        isAdmin={isAdmin}
      />

      <AjudaModal
        isOpen={ajudaAberta}
        onClose={() => setAjudaAberta(false)}
        isAdmin={isAdmin}
      />

      <SobreModal
        isOpen={sobreAberto}
        onClose={() => setSobreAberto(false)}
      />

      <MapaOfflineModal
        isOpen={mapaOfflineAberto}
        onClose={() => setMapaOfflineAberto(false)}
      />

      <MeusTerritoriosModal
        isOpen={meusTerritoriosAberto}
        onClose={() => setMeusTerritoriosAberto(false)}
        user={user}
        navigate={navigate}
        contextoSistema={contextoSistema}
        listaInicial={meusTerritoriosPrecarregados}
        onConsumirListaInicial={() => setMeusTerritoriosPrecarregados(null)}
      />
      <ModalConfirmacaoLogout
        isOpen={confirmarLogoutAberto}
        onConfirmar={confirmarLogout}
        onCancelar={() => setConfirmarLogoutAberto(false)}
      />

      {/* CABEÇALHO */}
      <div className="relative z-20 flex-shrink-0">
        <div className={`app-safe-header min-h-16 ${temaSistema.headerBg} text-white shadow-md px-2.5 sm:px-4 flex items-center justify-between`}>
          
          {/* LADO ESQUERDO: LOGO E TÍTULO */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <img 
              src={APP_ICON_192} 
              alt="Logo" 
              className={`h-9 w-9 rounded-lg shadow-sm ${temaSistema.headerBorder} border`} 
            />
            <div className="min-w-0 flex-1">
              <span className="text-xl font-bold tracking-wide hidden sm:block">Territórios</span>
              <div className="sm:hidden">
                <SistemaChip
                  contextoSistema={contextoSistema}
                  coverageOnly
                  coberturaCampanha={coberturaCampanha}
                  carregandoCobertura={coberturaCampanha.loading}
                />
              </div>
            </div>
            <div className="hidden sm:block">
              <SistemaChip
                contextoSistema={contextoSistema}
                coberturaCampanha={coberturaCampanha}
                carregandoCobertura={coberturaCampanha.loading}
              />
            </div>
          </div>

          {/* LADO DIREITO: ÍCONES E BOTÕES */}
          <div className="ml-1.5 sm:ml-3 flex shrink-0 items-center gap-1 sm:gap-3">
            <StatusSincronizacaoChip
              isAdmin={isAdmin}
              isOnline={isOnline}
              onlineSyncCount={onlineSyncCount}
              offlinePendingCount={offlinePendingCount}
              failedCount={outboxSummary.failedCount}
              conflictCount={outboxSummary.conflictCount}
              conflictActions={conflictActions}
              aberto={statusSyncAberto}
              onToggle={() => setStatusSyncAberto((current) => !current)}
              onClose={() => setStatusSyncAberto(false)}
            />
            
            {/* ATALHO 1: RELATÓRIOS (SÓ ADMIN) - Sempre visível agora */}
            {isAdmin && (
              <button
                onClick={() => navigate('/relatorios')}
                className={`p-1.5 sm:p-2 text-white/90 hover:text-white ${temaSistema.headerHover} rounded-full transition-colors relative`}
                title="Relatórios"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </button>
            )}

            {/* ATALHO 2: AJUDA (QUEM NÃO É ADMIN) - Sempre visível agora */}
            {!isAdmin && (
              <button
                onClick={() => setAjudaAberta(true)}
                className={`p-1.5 sm:p-2 text-white/90 hover:text-white ${temaSistema.headerHover} rounded-full transition-colors relative`}
                title="Como Usar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}

            <SininhoNotificacoes
              user={user}
              isAdmin={isAdmin}
              pushStatus={pushStatus}
              ativandoPush={ativandoPush}
              onAtivarPush={handleAtivarPush}
            />

            <button
              onClick={() => setMeusTerritoriosAberto(true)}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 ${temaSistema.headerSoft} ${temaSistema.headerSoftHover} rounded-full shadow-sm text-sm font-semibold transition-colors active:scale-95 ${temaSistema.headerBorder} border`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs uppercase tracking-wider">Meus</span>
            </button>

            <button
              onClick={() => setMenuAberto(true)}
              className={`p-1 ${temaSistema.headerHover} rounded transition-colors ml-0.5 sm:ml-1`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute left-0 right-0 top-full">
          <BarraSalvandoHeader visible={isOnline && onlineSyncCount > 0} count={onlineSyncCount} />
        </div>
      </div>

      <div className="flex-1 bg-gray-100 relative z-0">
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center bg-gray-100">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <span className="text-blue-600 font-semibold text-sm animate-pulse">Carregando mapa...</span>
              </div>
            </div>
          }
        >
          <Mapa
            user={user}
            isAdmin={isAdmin}
            contextoSistema={contextoSistema}
            isOnline={isOnline}
            outboxActions={outboxActions}
          />
        </Suspense>
      </div>
    </div>
  );
}

function RouteGuard({ children, adminOnly = false }) {
  const authState = useAuthSessionState();
  const { user, loading } = authState;
  const { autorizado, isAdmin, loading: loadingUsuario } = useUsuario(user);

  if (loading || (user && loadingUsuario)) {
    return <AuthStatusScreen message="Verificando acesso..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!autorizado) {
    return <Navigate to="/app" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function LazyPage({ children }) {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <span className="text-blue-600 font-semibold text-sm animate-pulse">Abrindo tela...</span>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const APP_ROUTE = '/app';
const BACK_TO_EXIT_WINDOW_MS = 5000;

function MagicLinkOpenHandler() {
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

function BackButtonExitHandler() {
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

    let listenerHandle = null;

    const registrar = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', () => {
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
    };

    void registrar();

    return () => {
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

// --- APP PRINCIPAL ---
function App() {
  const { user, loading } = useAuthSessionState();

  return (
    <UiFeedbackProvider>
      <HashRouter>
        <MagicLinkOpenHandler />
        <BackButtonExitHandler />
        <AutoUpdate />
        <Routes>
          <Route
            path="/"
            element={
              loading
                ? <AuthStatusScreen message="Entrando..." />
                : (user ? <Navigate to="/app" replace /> : <Login />)
            }
          />
          <Route path="/app" element={<Dashboard />} />
          <Route path="/admin" element={<RouteGuard adminOnly><LazyPage><AdminPanel /></LazyPage></RouteGuard>} />
          <Route path="/relatorios" element={<RouteGuard adminOnly><LazyPage><Relatorios /></LazyPage></RouteGuard>} />
          <Route
            path="*"
            element={
              loading
                ? <AuthStatusScreen message="Entrando..." />
                : <Navigate to={user ? '/app' : '/'} replace />
            }
          />
        </Routes>
      </HashRouter>
    </UiFeedbackProvider>
  );
}

export default App;
