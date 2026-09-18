import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { Capacitor } from '@capacitor/core';
import { signOutGoogleNative } from './nativeGoogleAuth';
import {
  ativarPushNotifications,
  confirmarVerificacaoOneSignal,
  desativarPushNotifications,
  describePushActivationError,
  ONESIGNAL_VERIFICATION_EVENT
} from './pushNotifications';
import { useUsuario } from './useUsuario';
import AutoUpdate from './AutoUpdate';
import AjudaModal from './AjudaModal';
import { useSistema } from './useSistema';
import { getSistemaTheme } from './sistema';
import { useCoberturaCampanha } from './useCoberturaCampanha';
import { useOnlineStatus } from './useOnlineStatus';
import { UiFeedbackProvider, useUiFeedback } from './uiFeedback';
import { SistemaChip } from './app/components/SistemaChip';
import { ModalConfirmacaoLogout } from './app/components/ModalConfirmacaoLogout';
import { SobreModal } from './app/components/SobreModal';
import { InformacoesGeraisModal } from './app/components/InformacoesGeraisModal';
import { MeusTerritoriosModal } from './app/components/MeusTerritoriosModal';
import { StatusSincronizacaoChip } from './app/components/StatusSincronizacaoChip';
import { LegendaModal } from './app/components/LegendaModal';
import { SininhoNotificacoes } from './app/components/SininhoNotificacoes';
import { MenuLateral } from './app/components/MenuLateral';
import {
  carregarMeusTerritoriosDocs,
  carregarMeusGruposEnderecoDocs,
  montarListaMeusTerritorios,
  montarListaMeusGruposEndereco
} from './app/utils/meusTerritoriosUtils';
import { setDeferredPrompt } from './app/utils/pwaInstallPrompt';
import { buttonClass } from './uiClasses';
import { MAP_COLORS, TERRITORIO_RECENCY_STEPS } from './mapLegend';
import { APP_TITLE, APP_SHORT_NAME, APP_ICON_192 } from './app/constants/appConstants';
import { rememberPostLoginRedirect } from './app/utils/redirectUtils';
import { useAuthSessionState, buildSafeAuthUser } from './app/auth/useAuthSessionState';
import { AuthStatusScreen } from './app/auth/AuthStatusScreen';
import { Login } from './app/auth/Login';
import { RouteGuard } from './app/navigation/RouteGuard';
import { LazyPage } from './app/navigation/LazyPage';
import { MagicLinkOpenHandler } from './app/navigation/MagicLinkOpenHandler';
import { BackButtonExitHandler } from './app/navigation/BackButtonExitHandler';

const Mapa = lazy(() => import('./Mapa'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const Relatorios = lazy(() => import('./Relatorios'));

if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
  });
}

const buildSafeOneSignalVerification = (detail) => {
  if (!detail || typeof detail !== 'object') return {};

  return {
    title: String(detail.title || detail.titulo || ''),
    message: String(detail.message || detail.mensagem || ''),
    buttonLabel: String(detail.buttonLabel || detail.confirmLabel || ''),
    plataforma: String(detail.plataforma || ''),
    subscriptionId: detail.subscriptionId ? String(detail.subscriptionId) : null
  };
};

// --- DASHBOARD (CORRIGIDO: BOTÕES VISÍVEIS + LOGO NO MOBILE) ---
function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [informacoesGeraisAberto, setInformacoesGeraisAberto] = useState(false);
  const [meusTerritoriosAberto, setMeusTerritoriosAberto] = useState(false);
  const [confirmarLogoutAberto, setConfirmarLogoutAberto] = useState(false);
  const [pushStatus, setPushStatus] = useState('oculto');
  const [ativandoPush, setAtivandoPush] = useState(false);
  const [verificacaoOneSignal, setVerificacaoOneSignal] = useState(null);
  const [statusSyncAberto, setStatusSyncAberto] = useState(false);
  const [meusTerritoriosPrecarregados, setMeusTerritoriosPrecarregados] = useState(null);
  const { notify } = useUiFeedback();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        rememberPostLoginRedirect(`${location.pathname}${location.search}`);
        navigate('/');
      } else {
        setUser(buildSafeAuthUser(currentUser));
      }
      setVerificandoLogin(false);
    });
    return () => unsubscribe();
  }, [location.pathname, location.search, navigate]);

  const { isAdmin, autorizado, loading: verificandoBanco, role } = useUsuario(user);
  const isOnline = useOnlineStatus();

  const usuarioCompleto = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      isAdmin,
      role
    };
  }, [user, isAdmin, role]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOneSignalReady = (event) => {
      setVerificacaoOneSignal(buildSafeOneSignalVerification(event.detail));
    };

    window.addEventListener(ONESIGNAL_VERIFICATION_EVENT, handleOneSignalReady);
    return () => window.removeEventListener(ONESIGNAL_VERIFICATION_EVENT, handleOneSignalReady);
  }, []);

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
      const resultado = await ativarPushNotifications(user);
      if (resultado?.aguardandoConfirmacao) {
        return;
      }

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

  const handleConfirmarVerificacaoOneSignal = async () => {
    if (ativandoPush) return;

    setAtivandoPush(true);

    try {
      await confirmarVerificacaoOneSignal();
      setVerificacaoOneSignal(null);
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
        const [meusDocs, meusGruposDocs] = await Promise.all([
          carregarMeusTerritoriosDocs({
            email: user.email,
            contextoId
          }),
          carregarMeusGruposEnderecoDocs({
            email: user.email
          })
        ]);

        if (ativo && (meusDocs.length > 0 || meusGruposDocs.length > 0)) {
          const [territorios, grupos] = await Promise.all([
            montarListaMeusTerritorios({ docs: meusDocs }),
            Promise.resolve(montarListaMeusGruposEndereco({ docs: meusGruposDocs }))
          ]);
          const items = [...territorios, ...grupos].sort((a, b) => {
            const diffTempo = a.dataDesignacaoOrdenacao - b.dataDesignacaoOrdenacao;
            if (diffTempo !== 0) return diffTempo;
            return String(a.nome || a.id).localeCompare(String(b.nome || b.id));
          });
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
        <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200/90 p-6">
          <div className="w-full max-w-md bg-white shadow-xl shadow-slate-900/10 rounded-2xl p-8 text-center border border-slate-200/80 animate-fade-in">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Cadastro em Análise</h2>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Olá, <strong>{user.displayName || user.email}</strong>! <br />
              Seu acesso já foi solicitado e notificamos os administradores.
              <br /><br />
              <span className="inline-block text-xs font-semibold bg-blue-50 text-blue-700 py-1.5 px-3.5 rounded-full border border-blue-100">
                Fique tranquilo, em breve será liberado!
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => window.location.reload()} className={buttonClass('primary', 'w-full')}>
                Verificar novamente
              </button>
              <button onClick={handleLogout} className={buttonClass('secondary', 'w-full')}>
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
      <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-4">
        <div className="w-full max-w-md bg-white shadow-xl shadow-slate-900/10 rounded-2xl p-6 text-center border border-red-100 animate-fade-in">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h2>
          <p className="mb-6 text-sm text-slate-600">O e-mail <strong>{user.email}</strong> não possui permissão de acesso.</p>
          <button onClick={handleLogout} className={buttonClass('secondary', 'w-full')}>Sair</button>
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

      <InformacoesGeraisModal
        isOpen={isAdmin && informacoesGeraisAberto}
        onClose={() => setInformacoesGeraisAberto(false)}
      />

      <MeusTerritoriosModal
        isOpen={meusTerritoriosAberto}
        onClose={() => setMeusTerritoriosAberto(false)}
        user={usuarioCompleto}
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

      {verificacaoOneSignal ? (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-blue-600 px-5 py-4 text-white">
              <h3 className="text-lg font-black leading-tight">
                {verificacaoOneSignal.title || 'Your OneSignal SDK integration is complete!'}
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm font-medium leading-6 text-slate-600">
                {verificacaoOneSignal.message || 'You can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.'}
              </p>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={handleConfirmarVerificacaoOneSignal}
                disabled={ativandoPush}
                className={buttonClass('primary', 'w-full')}
              >
                {ativandoPush ? 'Ativando...' : (verificacaoOneSignal.buttonLabel || 'Got it')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CABEÇALHO */}
      <div className="relative z-20 flex-shrink-0">
        <div className={`app-safe-header min-h-16 ${temaSistema.headerBg} text-white shadow-md border-b border-white/10 px-2.5 sm:px-4 flex items-center justify-between`}>
          
          {/* LADO ESQUERDO: LOGO E TÍTULO */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <img 
              src={APP_ICON_192} 
              alt="Logo" 
              className="h-9 w-9 rounded-xl shadow-sm border border-white/20 object-cover"
            />
            <div className="min-w-0 flex-1">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white hidden sm:block">Territórios</span>
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
          <div className="ml-1.5 sm:ml-3 flex shrink-0 items-center gap-1 sm:gap-2">
            <StatusSincronizacaoChip
              isAdmin={isAdmin}
              isOnline={isOnline}
              aberto={statusSyncAberto}
              onToggle={() => setStatusSyncAberto((current) => !current)}
              onClose={() => setStatusSyncAberto(false)}
            />

            {isAdmin && (
              <button
                type="button"
                onClick={() => setInformacoesGeraisAberto(true)}
                className="flex h-9 w-9 items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                title="Informações gerais"
                aria-label="Informações gerais"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zM9 8a1 1 0 112 0v5a1 1 0 11-2 0V8zm1-3a1.25 1.25 0 100 2.5A1.25 1.25 0 0010 5z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
            {/* ATALHO 1: RELATÓRIOS (SÓ ADMIN) */}
            {isAdmin && (
              <button
                onClick={() => navigate('/relatorios')}
                className="flex h-9 w-9 items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                title="Relatórios"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </button>
            )}

            {/* ATALHO 2: AJUDA (QUEM NÃO É ADMIN) */}
            {!isAdmin && (
              <button
                onClick={() => setAjudaAberta(true)}
                className="flex h-9 w-9 items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                title="Como Usar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}

            <SininhoNotificacoes
              user={usuarioCompleto}
              isAdmin={isAdmin}
              pushStatus={pushStatus}
              ativandoPush={ativandoPush}
              onAtivarPush={handleAtivarPush}
            />

            <button
              onClick={() => setMeusTerritoriosAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/25 border border-white/20 text-white shadow-sm transition-all active:scale-95"
              title="Meus Territórios"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Meus</span>
            </button>

            <button
              onClick={() => setMenuAberto(true)}
              className="flex h-9 w-9 items-center justify-center text-white/85 hover:text-white hover:bg-white/10 rounded-xl transition-all ml-0.5"
              title="Abrir menu"
              aria-label="Abrir menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
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
            user={usuarioCompleto}
            isAdmin={isAdmin}
            contextoSistema={contextoSistema}
            isOnline={isOnline}
          />
        </Suspense>
      </div>
    </div>
  );
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
