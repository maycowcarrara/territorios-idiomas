import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  query,
  where,
  getDocs,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useUiFeedback } from '../../uiFeedback';

export const SininhoNotificacoes = ({
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
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
        title="Notificações"
        aria-label="Notificações"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {temNovas && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full ring-2 ring-slate-900 animate-pulse"></span>}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-start justify-end p-4 pt-16 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 w-80 overflow-hidden animate-fade-in mr-2 border border-slate-200/90" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <span>Notificações</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                aria-label="Fechar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {pushStatus !== 'oculto' && (
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-semibold ${pushStatus === 'ativo' ? 'text-emerald-700' : pushStatus === 'bloqueado' ? 'text-red-600' : 'text-slate-500'}`}>
                    {pushStatus === 'ativo' ? 'Push ativo' : pushStatus === 'bloqueado' ? 'Push bloqueado' : 'Push desativado'}
                  </span>
                  {pushStatus !== 'ativo' && pushStatus !== 'bloqueado' && (
                    <button
                      type="button"
                      onClick={onAtivarPush}
                      disabled={ativandoPush}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70 transition-colors"
                    >
                      {ativandoPush ? 'Ativando...' : 'Ativar'}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="max-h-96 overflow-y-auto bg-slate-50/50">
              {notificacoes.length === 0 ? (
                <div className="py-10 px-4 text-center text-slate-400 text-sm flex flex-col items-center">
                  <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Nenhuma notificação nova.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notificacoes.map(notif => (
                    <div key={notif.id} className="p-3.5 hover:bg-white transition-colors flex gap-3 items-start group">
                      <div className="shrink-0 bg-white rounded-xl h-8 w-8 flex items-center justify-center shadow-sm border border-slate-100 text-slate-600">
                        {notif.tipo === 'devolucao' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 font-medium leading-snug">{notif.texto}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                          {notif.data?.toDate ? notif.data.toDate().toLocaleString() : 'Agora'}
                        </p>
                      </div>
                      <button
                        onClick={() => limparNotificacao(notif)}
                        className="text-slate-300 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors"
                        title="Marcar como lida"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
