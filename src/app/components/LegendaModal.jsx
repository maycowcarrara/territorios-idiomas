import React from 'react';
import { MAP_COLORS } from '../../mapLegend';
import { ModalFrame } from '../../uiPrimitives';
import { buttonClass } from '../../uiClasses';

const Swatch = ({ colors, round = false, dashed = false }) => {
  const fill = typeof colors === 'string' ? colors : colors.fill;
  const border = typeof colors === 'string' ? colors : colors.border;

  return (
    <span
      className={`h-8 w-8 shrink-0 ${round ? 'rounded-full' : 'rounded-lg'} border`}
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

export const LegendaModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Legenda do Mapa"
      subtitle="A cor indica a situação. Código e símbolos identificam os itens."
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
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Situações dos territórios</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LegendItem colors={MAP_COLORS.grupoEndereco.ativo} title="Disponível" description="Livre para designação." round />
            <LegendItem colors={MAP_COLORS.grupoEndereco.designado} title="Designado / em andamento" description="Com você ou com outro responsável." round />
            <LegendItem colors={MAP_COLORS.grupoEndereco.aguardandoFinalizacao} title="◷ Aguardando finalização" description="Tudo marcado; falta confirmar o encerramento." round />
            <LegendItem colors={MAP_COLORS.grupoEndereco.finalizado} title="✓ Concluído" description="Finalização confirmada." round />
          </div>
        </section>
        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Endereços</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LegendItem colors={MAP_COLORS.endereco.pendente} title="Pendente" description="Ainda não marcado como feito." round />
            <LegendItem colors={MAP_COLORS.endereco.visitado} title="✓ Visitado" description="Endereço marcado como feito." round />
          </div>
        </section>
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <p><strong>Seleção:</strong> um anel escuro destaca o endereço sem mudar a cor da situação.</p>
          <p><strong>Comigo:</strong> um ponto no balão do território e a indicação no detalhe identificam sua designação.</p>
          <p><strong>Números pequenos:</strong> indicam o território vinculado ao endereço ou a quantidade de endereços do território.</p>
          <p><strong>▤ Arquivados:</strong> cinza e borda tracejada; aparecem ao ativar o filtro.</p>
          <p><strong>Bairros:</strong> contorno cinza fino, sem preenchimento. Referências e condomínios se distinguem pelo ícone.</p>
          <p><strong>Tempo sem trabalhar:</strong> aparece em texto, como “3 meses” ou “Nunca”, sem mudar a cor.</p>
        </div>
      </div>
    </ModalFrame>
  );
};
