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
