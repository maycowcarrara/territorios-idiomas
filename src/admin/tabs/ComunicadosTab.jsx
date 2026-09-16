import React from 'react';
import { relayDisponivel } from '../../notificationRelay';
import { ADMIN_OFFLINE_ACTION_CLASS } from '../constants/adminConstants';

export function ComunicadosTab({
    comunicadoGeral,
    setComunicadoGeral,
    destinoComunicado,
    setDestinoComunicado,
    enviandoComunicado,
    enviarComunicadoGeral,
    totalDestinoComunicado,
    totalAprovados,
    totalAdmins,
    adminActionsDisabled
}) {
    return (
        <section role="tabpanel" aria-labelledby="tab-comunicados" className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-black text-slate-900">Comunicado geral</h2>
                    <span className="text-sm text-slate-500">{totalDestinoComunicado} destino(s)</span>
                </div>

                <form onSubmit={enviarComunicadoGeral} className="mt-4">
                    <fieldset disabled={adminActionsDisabled || enviandoComunicado} className={`space-y-5 ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase text-slate-500">Destino</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'todos', label: `Todos os aprovados (${totalAprovados})` },
                                    { value: 'admins', label: `Somente admins (${totalAdmins})` }
                                ].map((option) => {
                                    const ativa = destinoComunicado === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setDestinoComunicado(option.value)}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${ativa ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mensagem</label>
                            <textarea
                                rows={5}
                                placeholder="Ex: O app foi atualizado. Fechem e abram novamente para carregar a nova versão."
                                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                value={comunicadoGeral}
                                onChange={(e) => setComunicadoGeral(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <p className="text-sm text-slate-500">
                                {relayDisponivel()
                                    ? 'Push e aviso interno para quem estiver habilitado.'
                                    : 'Aviso interno disponível dentro do app.'}
                            </p>
                            <button
                                type="submit"
                                disabled={enviandoComunicado || totalDestinoComunicado === 0 || adminActionsDisabled}
                                className={`rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-amber-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                            >
                                {enviandoComunicado ? 'Enviando...' : 'Enviar comunicado'}
                            </button>
                        </div>
                    </fieldset>
                </form>
            </div>
        </section>
    );
}
