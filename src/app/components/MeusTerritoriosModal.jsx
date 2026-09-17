import React, { useState, useEffect, useCallback } from 'react';
import { setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getSistemaTheme } from '../../sistema';
import { useUiFeedback } from '../../uiFeedback';
import { finalizarGrupoEnderecoDesignado } from '../../enderecoModel';
import { getTerritorioStateRef } from '../../territorioContext';
import { finalizarTerritorioDesignado } from '../../territorioActions';
import { ModalFrame } from '../../uiPrimitives';
import { buttonClass } from '../../uiClasses';
import { SistemaChip } from './SistemaChip';
import {
  carregarMeusTerritoriosDocs,
  carregarMeusGruposEnderecoDocs,
  montarListaMeusTerritorios,
  montarListaMeusGruposEndereco
} from '../utils/meusTerritoriosUtils';

export const MeusTerritoriosModal = ({ isOpen, onClose, user, navigate, contextoSistema, listaInicial, onConsumirListaInicial }) => {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [territorioProcessandoId, setTerritorioProcessandoId] = useState(null);
  const temaSistema = getSistemaTheme(contextoSistema);
  const { notify, confirm } = useUiFeedback();
  const contextoIdAtual = contextoSistema?.contextoAtivoId || 'normal';

  const carregarLista = useCallback(async () => {
    if (!user?.email) return [];

    const [meusDocs, meusGruposDocs] = await Promise.all([
      carregarMeusTerritoriosDocs({
        email: user.email,
        contextoId: contextoIdAtual
      }),
      carregarMeusGruposEnderecoDocs({
        email: user.email
      })
    ]);

    const [territorios, grupos] = await Promise.all([
      montarListaMeusTerritorios({ docs: meusDocs }),
      Promise.resolve(montarListaMeusGruposEndereco({ docs: meusGruposDocs }))
    ]);

    return [...territorios, ...grupos].sort((a, b) => {
      const diffTempo = a.dataDesignacaoOrdenacao - b.dataDesignacaoOrdenacao;
      if (diffTempo !== 0) return diffTempo;
      return String(a.nome || a.id).localeCompare(String(b.nome || b.id));
    });
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
    } else if (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
      navigate(`/app?lat=${item.lat}&lng=${item.lng}&z=17`);
      onClose();
    } else {
      notify("Localização não encontrada.");
      onClose();
    }
  };

  const finalizarDireto = async (item) => {
    if (!user?.email || !item?.podeFinalizarDireto) return;
    const isGrupoEndereco = item.tipo === 'grupo_endereco';
    if (!(await confirm({
      title: 'Finalizar território',
      message: `Confirmar a finalização do território ${item.nome || item.numeroId}?`,
      tone: 'warning',
      confirmLabel: 'Finalizar'
    }))) return;

    setTerritorioProcessandoId(item.id);

    try {
      if (isGrupoEndereco) {
        await finalizarGrupoEnderecoDesignado(db, {
          grupoId: item.id,
          user
        });
        setLista((listaAtual) => listaAtual.filter((registro) => registro.id !== item.id));
        notify({
          title: 'Território finalizado',
          message: `Território ${item.numeroId || item.nome} finalizado com sucesso.`,
          variant: 'success'
        });
        return;
      }

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
        const notificacaoMensagem = resultado.notificacaoEnviada
          ? ''
          : ' A finalização foi salva, mas o aviso automático aos admins não saiu.';
        setLista((listaAtual) => listaAtual.filter((territorio) => territorio.id !== item.id));
        notify({
          title: 'Território finalizado',
          message: `Território finalizado com sucesso${resultado.contextoSufixo}.${notificacaoMensagem}`,
          variant: 'success'
        });
      }
    } catch (error) {
      console.error(error);
      notify({
        title: 'Finalização indisponível',
        message: 'Não foi possível finalizar esta designação agora. Tente novamente.',
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
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Carregando seus territórios...</p>
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-10 text-slate-500">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-200 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <p className="font-bold text-slate-700 text-sm">Nenhum território designado no momento.</p>
          <p className="text-xs mt-1 text-slate-400">Fale com o Servo de Territórios para receber uma designação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2 text-xs font-semibold text-blue-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Ordenado das designações mais antigas para as mais recentes.</span>
          </div>
          {lista.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex justify-between items-start mb-2.5">
                <div>
                  <h4 className="font-bold text-slate-800 text-base sm:text-lg leading-tight">{t.nome || `Território ${t.numeroId}`}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Recebido em: <span className="font-semibold text-slate-600">{t.dataFormatada}</span></p>
                </div>
                <div className={`${t.tipo === 'grupo_endereco' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-200'} text-[11px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide`}>
                  {t.tipoLabel || 'Território'} {t.numeroId}
                </div>
              </div>
              <div className="mb-3.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>{t.quadrasFeitas} de {t.totalQuadras} {t.unidadeProgresso || 'quadras'}</span>
                  <span className="font-bold text-slate-700">{t.percentual}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${t.barraClasse}`}
                    style={{ width: `${t.percentual}%` }}
                  ></div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    {t.descricaoResumo}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.badgeClasse}`}>
                    {t.statusResumo}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {t.podeFinalizarDireto && (
                  <button
                    onClick={() => finalizarDireto(t)}
                    disabled={territorioProcessandoId === t.id}
                    className={buttonClass('success', 'flex-1 py-2 text-xs')}
                  >
                    {territorioProcessandoId === t.id ? 'Finalizando...' : 'Finalizar agora'}
                  </button>
                )}
                <button
                  onClick={() => irParaMapa(t)}
                  className={buttonClass('primary', 'flex-1 py-2 text-xs')}
                >
                  <span>Ir para o Mapa</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalFrame>
  );
};
