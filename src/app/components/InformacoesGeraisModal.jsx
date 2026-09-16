import React, { useState, useEffect } from 'react';
import { query, where, getAggregateFromServer, count, sum } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ENDERECO_STATUS,
  GRUPO_ENDERECO_STATUS,
  getEnderecosCollectionRef,
  getGruposEnderecoCollectionRef
} from '../../enderecoModel';
import { ModalFrame } from '../../uiPrimitives';
import { buttonClass } from '../../uiClasses';

const formatInfoNumber = (value) => (
  new Intl.NumberFormat('pt-BR').format(Math.max(0, Math.trunc(Number(value) || 0)))
);

const INFORMACOES_GERAIS_CACHE_KEY = 'territorios-informacoes-gerais-v1';
const INFORMACOES_GERAIS_CACHE_TTL_MS = 2 * 60 * 1000;

const readInformacoesGeraisCache = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(INFORMACOES_GERAIS_CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached?.resumo || !Number.isFinite(Number(cached.cachedAt))) return null;

    return cached;
  } catch {
    return null;
  }
};

const writeInformacoesGeraisCache = (resumo) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(INFORMACOES_GERAIS_CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      resumo
    }));
  } catch {
    // Session cache is only an optimization; ignore storage failures.
  }
};

export const InformacoesGeraisModal = ({ isOpen, onClose }) => {
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    if (!isOpen) return undefined;

    const carregarResumo = async () => {
      const cached = readInformacoesGeraisCache();
      const cacheFresh = cached && Date.now() - Number(cached.cachedAt) < INFORMACOES_GERAIS_CACHE_TTL_MS;

      if (cached?.resumo) {
        setResumo(cached.resumo);
      }

      if (cacheFresh) {
        setLoading(false);
        setErro('');
        return;
      }

      setLoading(true);
      setErro('');

      try {
        const enderecosRef = getEnderecosCollectionRef(db);
        const gruposRef = getGruposEnderecoCollectionRef(db);
        const enderecosAtivosQuery = query(enderecosRef, where('status', '==', ENDERECO_STATUS.ATIVO));

        const [
          enderecosAtivosSnapshot,
          enderecosArquivadosSnapshot,
          gruposAtivosSnapshot,
          gruposFinalizadosSnapshot,
          gruposArquivadosSnapshot
        ] = await Promise.all([
          getAggregateFromServer(enderecosAtivosQuery, {
            totalEnderecos: count(),
            totalPessoas: sum('quantidadeEstrangeiros')
          }),
          getAggregateFromServer(
            query(enderecosRef, where('status', '==', ENDERECO_STATUS.ARQUIVADO)),
            { total: count() }
          ),
          getAggregateFromServer(
            query(gruposRef, where('status', '==', GRUPO_ENDERECO_STATUS.ATIVO)),
            { total: count() }
          ),
          getAggregateFromServer(
            query(gruposRef, where('status', '==', GRUPO_ENDERECO_STATUS.FINALIZADO)),
            { total: count() }
          ),
          getAggregateFromServer(
            query(gruposRef, where('status', '==', GRUPO_ENDERECO_STATUS.ARQUIVADO)),
            { total: count() }
          )
        ]);

        if (!ativo) return;

        const enderecosAtivos = enderecosAtivosSnapshot.data().totalEnderecos || 0;
        const pessoasAtivas = enderecosAtivosSnapshot.data().totalPessoas || 0;
        const enderecosArquivados = enderecosArquivadosSnapshot.data().total || 0;
        const gruposAtivos = gruposAtivosSnapshot.data().total || 0;
        const gruposFinalizados = gruposFinalizadosSnapshot.data().total || 0;
        const gruposArquivados = gruposArquivadosSnapshot.data().total || 0;

        const resumoAtualizado = {
          territorios: gruposAtivos,
          enderecos: enderecosAtivos,
          pessoas: pessoasAtivas,
          atualizadoEm: Date.now(),
          detalhes: [
            { label: 'Territórios finalizados', value: gruposFinalizados },
            { label: 'Territórios arquivados', value: gruposArquivados },
            { label: 'Endereços arquivados', value: enderecosArquivados }
          ]
        };

        setResumo(resumoAtualizado);
        writeInformacoesGeraisCache(resumoAtualizado);
      } catch (error) {
        console.error('Erro ao carregar informações gerais:', error);
        if (!ativo) return;
        setErro('Não foi possível carregar os números gerais agora.');
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    };

    void carregarResumo();

    return () => {
      ativo = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const cards = [
    {
      label: 'Territórios',
      value: resumo?.territorios,
      description: 'ativos para uso',
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-100',
      textClass: 'text-blue-700'
    },
    {
      label: 'Endereços',
      value: resumo?.enderecos,
      description: 'ativos cadastrados',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-100',
      textClass: 'text-emerald-700'
    },
    {
      label: 'Pessoas',
      value: resumo?.pessoas,
      description: 'cadastradas nos endereços',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-100',
      textClass: 'text-amber-700'
    }
  ];

  const atualizadoEmLabel = resumo?.atualizadoEm
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(resumo.atualizadoEm))
    : null;

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Informações gerais"
      subtitle="Resumo atualizado dos territórios de idiomas."
      size="md"
      accentClass="bg-slate-800"
      titleIcon={(
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zM9 8a1 1 0 112 0v5a1 1 0 11-2 0V8zm1-3a1.25 1.25 0 100 2.5A1.25 1.25 0 0010 5z" clipRule="evenodd" />
        </svg>
      )}
      footer={(
        <button onClick={onClose} className={buttonClass('primary', 'w-full')}>
          Fechar
        </button>
      )}
    >
      {loading && !resumo ? (
        <div className="py-10 flex flex-col items-center justify-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-sm font-medium">Carregando informações...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {erro ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className={`rounded-xl border px-4 py-3 ${card.bgClass} ${card.borderClass}`}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                <p className={`mt-2 text-3xl font-black leading-none ${card.textClass}`}>
                  {resumo ? formatInfoNumber(card.value) : '--'}
                </p>
                <p className="mt-2 min-h-8 text-xs font-semibold leading-4 text-slate-500">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            {(resumo?.detalhes || []).map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <span className="text-sm font-semibold text-slate-600">{item.label}</span>
                <span className="text-sm font-black text-slate-900">{formatInfoNumber(item.value)}</span>
              </div>
            ))}
          </div>

          <p className="text-xs font-medium leading-5 text-slate-500">
            Os totais principais consideram apenas endereços e territórios ativos. Arquivados e finalizados aparecem separados para conferência.
            {atualizadoEmLabel ? ` Atualizado às ${atualizadoEmLabel}.` : ''}
          </p>
        </div>
      )}
    </ModalFrame>
  );
};
