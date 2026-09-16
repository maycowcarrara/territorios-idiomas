import React from 'react';
import { MAP_COLORS, TERRITORIO_RECENCY_STEPS } from '../../mapLegend';
import { ModalFrame } from '../../uiPrimitives';
import { buttonClass } from '../../uiClasses';

const Swatch = ({ colors, round = false, dashed = false }) => {
  const fill = typeof colors === 'string' ? colors : colors.fill;
  const border = typeof colors === 'string' ? colors : colors.border;

  return (
    <span
      className={`h-8 w-8 shrink-0 ${round ? 'rounded-full' : 'rounded-lg'} border-2 shadow-sm`}
      style={{
        backgroundColor: fill,
        borderColor: border || fill,
        borderStyle: dashed ? 'dashed' : 'solid'
      }}
    />
  );
};

const LegendItem = ({ colors, title, description, round = false, dashed = false }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <Swatch colors={colors} round={round} dashed={dashed} />
    <div className="min-w-0">
      <p className="text-sm font-black leading-tight text-slate-800">{title}</p>
      <p className="mt-0.5 text-xs font-medium leading-snug text-slate-500">{description}</p>
    </div>
  </div>
);

export const LegendaModal = ({ isOpen, onClose, isAdmin }) => {
  if (!isOpen) return null;

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Legenda do Mapa"
      subtitle="Marcadores atuais e referência futura de áreas."
      size="md"
      accentClass="bg-slate-900"
      footer={(
        <button onClick={onClose} className={buttonClass('primary', 'w-full')}>
          Entendi
        </button>
      )}
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">Territórios de endereços</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LegendItem colors={MAP_COLORS.grupoEndereco.ativo} title="T ativo" description="Território de endereços disponível no mapa." round dashed />
            <LegendItem colors={MAP_COLORS.grupoEndereco.designado} title="T designado" description="Território de endereços em andamento." round dashed />
            <LegendItem colors={MAP_COLORS.grupoEndereco.finalizado} title="T finalizado" description="Território de endereços concluído." round dashed />
            <LegendItem colors={MAP_COLORS.grupoEndereco.arquivado} title="T arquivado" description="Território guardado fora da visualização padrão." round dashed />
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Marcadores</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LegendItem colors={MAP_COLORS.endereco.ativo} title="E ativo" description="Endereço individual disponível." round />
            <LegendItem colors={MAP_COLORS.endereco.agrupado} title="E agrupado" description="Endereço já ligado a um território." round />
            <LegendItem colors={MAP_COLORS.endereco.selecionado} title="E selecionado" description="Endereço escolhido para formar um território." round />
            <LegendItem colors={MAP_COLORS.endereco.visitado} title="E pregado" description="Endereço marcado como feito durante o foco." round />
            <LegendItem colors={MAP_COLORS.apoio.referencia} title="Referência" description="Ponto de apoio ou referência no mapa." round />
            <LegendItem colors={MAP_COLORS.apoio.condominio} title="Condomínio" description="Ponto de condomínio exibido no mapa." round />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">Áreas e bairros</h4>
            <p className="mt-1 text-xs font-medium leading-snug text-slate-500">
              Referência para polígonos de bairros e áreas maiores que agrupam territórios e mostram o progresso consolidado.
            </p>
          </div>

          <div className="space-y-2">
            <h5 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Andamento</h5>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <LegendItem colors={MAP_COLORS.territorio.meu} title="Meu território" description="Designado para você e ainda em andamento." />
              {isAdmin && (
                <LegendItem colors={MAP_COLORS.territorio.meuAdmin} title="Meu território como admin" description="Você está vendo sua própria designação com perfil admin." />
              )}
              <LegendItem colors={MAP_COLORS.territorio.aguardandoFinalizacao} title="Aguardando finalização" description="Tudo foi marcado, mas o encerramento ainda não foi confirmado." />
              <LegendItem colors={MAP_COLORS.territorio.finalizado} title="Finalizado" description="Território encerrado oficialmente." />
              <LegendItem colors={MAP_COLORS.territorio.ocupado} title="Ocupado" description="Outro publicador está cuidando deste território." />
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-700">Disponíveis</h5>
            <p className="text-xs font-medium leading-snug text-slate-500">
              Laranja indica área livre. Quanto mais escuro, maior a prioridade por tempo parado.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TERRITORIO_RECENCY_STEPS.map((step) => (
                <LegendItem
                  key={step.id}
                  colors={step.colors}
                  title={step.label}
                  description={step.description}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium leading-snug text-slate-600">
          No zoom mais distante, o mapa mostra o código e o tempo desde a última conclusão. Ao aproximar, aparecem nome, status e detalhes permitidos para o seu perfil.
        </div>
      </div>
    </ModalFrame>
  );
};
