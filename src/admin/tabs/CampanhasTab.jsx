import React from 'react';
import { slugifyCampanha } from '../../sistema';
import { ADMIN_OFFLINE_ACTION_CLASS } from '../constants/adminConstants';

export function CampanhasTab({
    campanhas,
    campanhaTitulo,
    setCampanhaTitulo,
    campanhaSlug,
    setCampanhaSlug,
    salvandoCampanha,
    handleCriarCampanha,
    ativarCampanha,
    voltarModoNormal,
    abrirModalExclusaoCampanha,
    fecharModalExclusaoCampanha,
    campanhaParaExcluir,
    confirmacaoExclusao,
    setConfirmacaoExclusao,
    carregandoResumoExclusao,
    registrosCampanhaParaExcluir,
    excluindoCampanha,
    excluirCampanha,
    contextoSistema,
    adminActionsDisabled
}) {
    return (
        <>
            <section role="tabpanel" aria-labelledby="tab-campanhas" className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Campanhas</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {contextoSistema.campanhaAtiva
                                    ? `${contextoSistema.contextoAtivoTitulo} (${contextoSistema.contextoAtivoId})`
                                    : 'Pregação normal'}
                            </p>
                        </div>
                        {contextoSistema.campanhaAtiva ? (
                            <button
                                type="button"
                                onClick={voltarModoNormal}
                                disabled={salvandoCampanha || adminActionsDisabled}
                                className={`rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                            >
                                Desativar campanha
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900">Nova campanha</h3>
                    <form onSubmit={handleCriarCampanha} className="mt-4">
                        <fieldset disabled={adminActionsDisabled || salvandoCampanha} className={`grid grid-cols-1 items-end gap-3 lg:grid-cols-[1.4fr_1fr_auto] ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Título da campanha</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Convite da Celebração"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                    value={campanhaTitulo}
                                    onChange={(e) => setCampanhaTitulo(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Identificador interno</label>
                                <input
                                    type="text"
                                    placeholder="ex: celebracao_2026"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                    value={campanhaSlug}
                                    onChange={(e) => setCampanhaSlug(slugifyCampanha(e.target.value))}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={salvandoCampanha || adminActionsDisabled}
                                className={`rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-violet-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                            >
                                {salvandoCampanha ? 'Salvando...' : 'Ativar'}
                            </button>
                        </fieldset>
                    </form>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <h3 className="text-lg font-black text-slate-900">Campanhas salvas</h3>
                        <p className="text-sm text-slate-500">{campanhas.length} campanha(s)</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {campanhas.length > 0 ? campanhas.map((campanha) => {
                            const ativa = contextoSistema.contextoAtivoId === campanha.id;

                            return (
                                <div key={campanha.id} className={`rounded-2xl border p-3.5 ${ativa ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{campanha.titulo || campanha.id}</p>
                                            <p className="mt-1 text-xs font-mono text-slate-400">{campanha.id}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ativa ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>
                                            {ativa ? 'ATIVA' : 'SALVA'}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid gap-2">
                                        <button
                                            type="button"
                                            onClick={() => ativarCampanha({ id: campanha.id, titulo: campanha.titulo || campanha.id })}
                                            disabled={salvandoCampanha || ativa || adminActionsDisabled}
                                            className={`w-full rounded-xl border border-violet-200 bg-white py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                        >
                                            {ativa ? 'Campanha atual' : 'Reativar'}
                                        </button>
                                        {ativa && (
                                            <button
                                                type="button"
                                                onClick={voltarModoNormal}
                                                disabled={salvandoCampanha || adminActionsDisabled}
                                                className={`w-full rounded-xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                            >
                                                Desativar agora
                                            </button>
                                        )}
                                        {!ativa && (
                                            <button
                                                type="button"
                                                onClick={() => abrirModalExclusaoCampanha(campanha)}
                                                disabled={salvandoCampanha || excluindoCampanha || adminActionsDisabled}
                                                className={`w-full rounded-xl border border-red-200 bg-white py-2 text-sm font-bold text-red-700 hover:bg-red-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                            >
                                                Excluir campanha
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                                Nenhuma campanha cadastrada ainda.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {campanhaParaExcluir && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={fecharModalExclusaoCampanha}>
                    <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">Exclusão definitiva</p>
                                <h3 className="mt-1 text-xl font-extrabold text-red-700">
                                    Excluir campanha "{campanhaParaExcluir.titulo || campanhaParaExcluir.id}"
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={fecharModalExclusaoCampanha}
                                disabled={excluindoCampanha}
                                className="rounded-lg px-2 py-1 text-red-400 hover:bg-white hover:text-red-600 disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-5 px-6 py-5">
                            <p className="text-sm leading-relaxed text-gray-600">
                                Essa ação apaga a campanha cadastrada e todo o progresso salvo nela. Não existe restauração automática depois da exclusão.
                            </p>

                            <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Título</p>
                                    <p className="mt-1 font-bold text-gray-800">{campanhaParaExcluir.titulo || campanhaParaExcluir.id}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Identificador</p>
                                    <p className="mt-1 font-mono text-xs text-gray-600">{campanhaParaExcluir.id}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Registros de progresso vinculados</p>
                                    <p className="mt-1 font-bold text-gray-800">
                                        {carregandoResumoExclusao ? 'Carregando...' : `${registrosCampanhaParaExcluir} registro(s) em territorios_contexto`}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Digite <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">{campanhaParaExcluir.id}</span> para confirmar
                                </label>
                                <input
                                    type="text"
                                    value={confirmacaoExclusao}
                                    onChange={(e) => setConfirmacaoExclusao(e.target.value)}
                                    placeholder="Confirme o identificador"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-200"
                                    disabled={excluindoCampanha || adminActionsDisabled}
                                />
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={fecharModalExclusaoCampanha}
                                    disabled={excluindoCampanha}
                                    className="rounded-lg border border-gray-300 px-4 py-2.5 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={excluirCampanha}
                                    disabled={excluindoCampanha || carregandoResumoExclusao || confirmacaoExclusao.trim() !== campanhaParaExcluir.id || adminActionsDisabled}
                                    className={`rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                >
                                    {excluindoCampanha ? 'Excluindo...' : 'Excluir definitivamente'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
