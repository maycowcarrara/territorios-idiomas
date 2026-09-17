import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { getSistemaTheme } from '../../sistema';
import { useUiFeedback } from '../../uiFeedback';
import { checkForUpdateStatus } from '../../updateUtils';
import appInfo from '../../version.json';
import { getDeferredPrompt, setDeferredPrompt, clearDeferredPrompt } from '../utils/pwaInstallPrompt';
import { SistemaChip } from './SistemaChip';
import { buttonClass } from '../../uiClasses';

export const MenuLateral = ({
  isOpen,
  onClose,
  user,
  isAdmin,
  navigate,
  handleLogout,
  abrirAjuda,
  abrirLegenda,
  abrirSobre,
  contextoSistema,
  coberturaCampanha,
  carregandoCobertura
}) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  const [instalacaoDisponivel, setInstalacaoDisponivel] = useState(() => Boolean(!isNativePlatform && getDeferredPrompt()));
  const [photoUrlComErro, setPhotoUrlComErro] = useState(null);
  const [verificandoAtualizacao, setVerificandoAtualizacao] = useState(false);
  const temaSistema = getSistemaTheme(contextoSistema);
  const { notify } = useUiFeedback();
  const mostrarFotoPerfil = Boolean(user?.photoURL) && photoUrlComErro !== user?.photoURL;
  const exibirSistemaChip = Boolean(contextoSistema?.campanhaAtiva);
  const menuActionClass = 'flex min-h-12 items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98]';
  const menuActionIconClass = 'h-5 w-5 shrink-0';

  useEffect(() => {
    if (isNativePlatform || typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalacaoDisponivel(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isNativePlatform]);

  const instalarApp = async () => {
    const deferredPrompt = getDeferredPrompt();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        clearDeferredPrompt();
        setInstalacaoDisponivel(false);
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

  const verificarAtualizacaoManual = async () => {
    if (verificandoAtualizacao) return;

    setVerificandoAtualizacao(true);
    try {
      const status = await checkForUpdateStatus(true);

      if (status?.error) {
        notify({
          title: 'Atualização não verificada',
          message: 'Não foi possível verificar a atualização agora. Confira sua conexão e tente novamente.',
          variant: 'error'
        });
        return;
      }

      if (status?.installed) {
        notify({
          title: 'Atualização instalada',
          message: 'Abrindo a versão mais recente agora.',
          variant: 'success'
        });
        return;
      }

      if (!status?.updateAvailable) {
        notify({
          title: 'App atualizado',
          message: 'Seu sistema já está atualizado.',
          variant: 'success'
        });
      }
    } catch {
      notify({
        title: 'Atualização não verificada',
        message: 'Não foi possível verificar a atualização agora. Confira sua conexão e tente novamente.',
        variant: 'error'
      });
    } finally {
      setVerificandoAtualizacao(false);
    }
  };

  const isStandalone = !isNativePlatform
    && typeof window !== 'undefined'
    && window.matchMedia('(display-mode: standalone)').matches;
  const podeExibirInstalacao = !isNativePlatform && !isStandalone;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-[2000] bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>}
      <div className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-[2001] transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>

        {/* CABEÇALHO DO MENU */}
        <div className={`${temaSistema.headerBg} app-safe-panel-header px-5 pt-5 pb-4 text-white flex-shrink-0 border-b border-white/10`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span
              className={`inline-flex h-8 items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.14em] shadow-sm ${
                isAdmin
                  ? 'border border-violet-400/40 bg-violet-500/20 text-violet-100'
                  : 'border border-sky-400/40 bg-sky-500/20 text-sky-100'
              }`}
            >
              {isAdmin ? 'Administrador' : 'Dirigente'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                title="Sair do sistema"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/20 px-3 text-xs font-semibold text-red-100 shadow-sm transition-colors hover:bg-red-500/30 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                <span>Sair</span>
              </button>
              <button
                onClick={onClose}
                title="Fechar menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-800 text-white shadow-md ring-2 ring-white/25">
              {mostrarFotoPerfil ? (
                <img
                  src={user.photoURL}
                  alt={`Foto de perfil de ${user?.displayName || 'Usuário'}`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoUrlComErro(user?.photoURL || null)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-lg text-blue-300">
                  {(user?.displayName || user?.email || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="pt-0.5 text-base font-bold leading-tight whitespace-normal break-words text-white">
                {user?.displayName || 'Usuário'}
              </p>
              <p className="mt-1 text-xs leading-snug text-slate-300/90 whitespace-normal break-all">
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
        <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
          {/* 1 & 2. ITENS DE ADMIN */}
          {isAdmin && (
            <>
              <button onClick={() => { navigate('/admin'); onClose(); }} className={`${menuActionClass} text-slate-700 hover:bg-slate-100/80 hover:text-slate-900`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-slate-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h3l.56 2.02a5.98 5.98 0 0 1 1.5.87l1.93-.56 1.5 2.6-1.37 1.46c.06.4.08.79.08 1.11s-.02.71-.08 1.11l1.37 1.46-1.5 2.6-1.93-.56a5.98 5.98 0 0 1-1.5.87L13.5 21h-3l-.56-2.02a5.98 5.98 0 0 1-1.5-.87l-1.93.56-1.5-2.6 1.37-1.46A7.62 7.62 0 0 1 6.3 13.5c0-.32.02-.71.08-1.11L5 10.93l1.5-2.6 1.93.56c.46-.36.97-.65 1.5-.87L10.5 6Z" />
                  <circle cx="12" cy="13.5" r="2.25" />
                </svg>
                Painel de Controle
              </button>

              <button onClick={() => { navigate('/relatorios'); onClose(); }} className={`${menuActionClass} text-slate-700 hover:bg-slate-100/80 hover:text-slate-900`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-slate-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 16.5V12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V8.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5V5.5" />
                </svg>
                Relatórios
              </button>
            </>
          )}

          {/* 3. COMO USAR */}
          <button onClick={() => { abrirAjuda(); onClose(); }} className={`${menuActionClass} text-slate-700 hover:bg-amber-50 hover:text-amber-900`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-amber-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="12" cy="12" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.25a2.25 2.25 0 1 1 2.06 3.15c-.9.12-1.56.9-1.56 1.8v.3" />
              <circle cx="12" cy="17.25" r="1" fill="currentColor" stroke="none" />
            </svg>
            Como usar (Ajuda)
          </button>

          {/* 4. LEGENDA */}
          <button onClick={() => { abrirLegenda(); onClose(); }} className={`${menuActionClass} text-slate-700 hover:bg-slate-100/80 hover:text-slate-900`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-slate-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5h10.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h10.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 16.5h10.5" />
              <circle cx="5.25" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
              <circle cx="5.25" cy="12" r="1.25" fill="currentColor" stroke="none" />
              <circle cx="5.25" cy="16.5" r="1.25" fill="currentColor" stroke="none" />
            </svg>
            Legenda do Mapa
          </button>

          {/* 5. INSTALAR */}
          {podeExibirInstalacao && (
            <button onClick={instalarApp} className={`${menuActionClass} mt-1 border border-dashed border-emerald-300 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-50`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`${menuActionIconClass} text-emerald-600`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v10.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 11.25 3.75 3.75 3.75-3.75" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15" />
              </svg>
              {instalacaoDisponivel ? 'Instalar Aplicativo' : 'Como instalar'}
            </button>
          )}

        </div>

        {/* --- RODAPÉ COM BOTÕES DE SUPORTE --- */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex-shrink-0 flex flex-col items-center gap-2">
          <div className="text-center text-[11px] text-slate-400">
            <p className="font-semibold text-slate-600">Territórios Digitais v{appInfo.version}</p>
            <p className="opacity-75">{appInfo.buildDate}</p>
          </div>

          <button 
            onClick={verificarAtualizacaoManual}
            disabled={verificandoAtualizacao}
            className={buttonClass('secondary', 'w-full py-2')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-blue-600 ${verificandoAtualizacao ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{verificandoAtualizacao ? 'Verificando...' : 'Verificar Atualização'}</span>
          </button>

          <button
            onClick={() => {
              abrirSobre();
              onClose();
            }}
            className={buttonClass('subtle', 'w-full py-2')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Sobre o app</span>
          </button>

          <p className="text-[10px] text-slate-400 mt-0.5">Territórios Digitais</p>
        </div>
      </div>
    </>
  );
};
