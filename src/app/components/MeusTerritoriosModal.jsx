import React, { useState, useEffect, useCallback } from 'react';
import { setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getSistemaTheme } from '../../sistema';
import { useUiFeedback } from '../../uiFeedback';
import { finalizarGrupoEnderecoDesignado } from '../../enderecoModel';
import { getTerritorioStateRef } from '../../territorioContext';
import { finalizarTerritorioDesignado } from '../../territorioActions';
import { ModalFrame } from '../../uiPrimitives';
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
            Ordenado das designações mais antigas para as mais recentes.
          </div>
          {lista.map((t) => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-gray-800 text-lg">{t.nome || `Território ${t.numeroId}`}</h4>
                  <p className="text-xs text-gray-500">Recebido em: <span className="font-medium text-gray-700">{t.dataFormatada}</span></p>
                </div>
                <div className={`${t.tipo === 'grupo_endereco' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'} text-xs font-bold px-2 py-1 rounded-full`}>
                  {t.tipoLabel || 'Território'} {t.numeroId}
                </div>
              </div>
              <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
                  <span>{t.quadrasFeitas} de {t.totalQuadras} {t.unidadeProgresso || 'quadras'}</span>
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
