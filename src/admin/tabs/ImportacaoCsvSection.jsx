import React from 'react';
import { ADMIN_OFFLINE_ACTION_CLASS } from '../constants/adminConstants';

export function ImportacaoCsvSection({
    enderecoConfigForm,
    handleEnderecoConfigChange,
    salvarPlanilhaCsvUrl,
    salvandoPlanilhaCsvUrl,
    verificarPlanilhaEnderecos,
    verificandoPlanilha,
    inserirNovosEnderecosPlanilha,
    importandoPlanilha,
    enderecoCsvPreview,
    buscarPinsFaltantesPlanilha,
    buscandoPinsPlanilha,
    buscarPinLinhaPlanilha,
    enderecoCsvGeocodeStatus,
    adminActionsDisabled
}) {
    return (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h3 className="text-sm font-black text-slate-800">Importação por planilha CSV</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                        A verificação baixa a planilha publicada e não grava dados.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        onClick={salvarPlanilhaCsvUrl}
                        disabled={salvandoPlanilhaCsvUrl || verificandoPlanilha || importandoPlanilha || adminActionsDisabled}
                        className={`rounded-xl border border-cyan-200 bg-white px-4 py-2 text-xs font-bold uppercase text-cyan-800 transition-all hover:bg-cyan-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                    >
                        {salvandoPlanilhaCsvUrl ? 'Salvando...' : 'Salvar URL'}
                    </button>
                    <button
                        type="button"
                        onClick={verificarPlanilhaEnderecos}
                        disabled={verificandoPlanilha || importandoPlanilha || salvandoPlanilhaCsvUrl || adminActionsDisabled}
                        className={`rounded-xl border border-cyan-200 bg-white px-4 py-2 text-xs font-bold uppercase text-cyan-800 transition-all hover:bg-cyan-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                    >
                        {verificandoPlanilha ? 'Verificando...' : 'Verificar planilha'}
                    </button>
                    <button
                        type="button"
                        onClick={inserirNovosEnderecosPlanilha}
                        disabled={!enderecoCsvPreview?.totals?.aplicar || importandoPlanilha || verificandoPlanilha || adminActionsDisabled}
                        className={`rounded-xl bg-cyan-800 px-4 py-2 text-xs font-bold uppercase text-white transition-all hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                    >
                        {importandoPlanilha ? 'Aplicando...' : 'Aplicar importação'}
                    </button>
                </div>
            </div>

            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Link CSV publicado</label>
            <input
                type="url"
                value={enderecoConfigForm.planilhaCsvUrl || ''}
                onChange={(event) => handleEnderecoConfigChange('planilhaCsvUrl', event.target.value)}
                maxLength={1000}
                placeholder="https://docs.google.com/spreadsheets/...&output=csv"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />

            {enderecoCsvPreview && (
                <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
                        {[
                            { label: 'Linhas', value: enderecoCsvPreview.totals.total },
                            { label: 'Novos', value: enderecoCsvPreview.totals.novos },
                            { label: 'Atualizar', value: enderecoCsvPreview.totals.atualizar },
                            { label: 'Aplicar', value: enderecoCsvPreview.totals.aplicar },
                            { label: 'Inserir', value: enderecoCsvPreview.totals.inserir },
                            { label: 'Existentes', value: enderecoCsvPreview.totals.existentes },
                            { label: 'Duplicados', value: enderecoCsvPreview.totals.duplicados },
                            { label: 'Inválidos', value: enderecoCsvPreview.totals.invalidos },
                            { label: 'Sem pin', value: enderecoCsvPreview.totals.semCoordenada },
                            { label: 'Conflitos', value: enderecoCsvPreview.totals.conflitos }
                        ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-cyan-100 bg-white px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</p>
                                <p className="mt-1 text-lg font-black text-slate-800">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-cyan-100 bg-white px-3 py-2">
                            <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700">Territórios a criar</p>
                            <p className="mt-1 text-sm font-bold text-slate-700">
                                {enderecoCsvPreview.territoriosCriar.length ? enderecoCsvPreview.territoriosCriar.join(', ') : 'Nenhum'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-cyan-100 bg-white px-3 py-2">
                            <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700">Vínculos existentes</p>
                            <p className="mt-1 text-sm font-bold text-slate-700">
                                {enderecoCsvPreview.territoriosExistentes.length ? enderecoCsvPreview.territoriosExistentes.join(', ') : 'Nenhum'}
                            </p>
                        </div>
                        <div className="flex items-center rounded-xl border border-cyan-100 bg-white px-3 py-2">
                            <button
                                type="button"
                                onClick={buscarPinsFaltantesPlanilha}
                                disabled={!enderecoCsvPreview.totals.semCoordenada || buscandoPinsPlanilha || verificandoPlanilha || adminActionsDisabled}
                                className={`w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                            >
                                {buscandoPinsPlanilha ? 'Buscando pins...' : 'Buscar pins faltantes'}
                            </button>
                        </div>
                    </div>

                    {(enderecoCsvPreview.samples.aplicaveis.length || enderecoCsvPreview.samples.invalidos.length || enderecoCsvPreview.samples.conflitos.length || enderecoCsvPreview.samples.semCoordenada.length) ? (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                            {[
                                { title: 'Aplicar', rows: enderecoCsvPreview.samples.aplicaveis, tone: 'text-cyan-700' },
                                { title: 'Inválidos', rows: enderecoCsvPreview.samples.invalidos, tone: 'text-red-700' },
                                { title: 'Conflitos', rows: enderecoCsvPreview.samples.conflitos, tone: 'text-amber-700' },
                                { title: 'Sem coordenada', rows: enderecoCsvPreview.samples.semCoordenada, tone: 'text-slate-700' }
                            ].map((group) => (
                                <div key={group.title} className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className={`text-xs font-black uppercase ${group.tone}`}>{group.title}</p>
                                    <div className="mt-2 space-y-2">
                                        {group.rows.length ? group.rows.map((row) => (
                                            <div key={`${group.title}-${row.rowKey}`} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                                                <span className="font-bold">Linha {row.rowNumber}</span>
                                                {row.codigo ? ` · ${row.codigo}` : ''}
                                                {group.title === 'Sem coordenada' ? (
                                                    <div className="mt-1 space-y-1">
                                                        <p className="font-semibold text-slate-700">{row.endereco || 'Endereço não informado'}</p>
                                                        {row.bairro && <p>Bairro: {row.bairro}</p>}
                                                        <p>Query: {row.geocodeQuery || 'indisponível'}</p>
                                                        <p>
                                                            Estado: {enderecoCsvGeocodeStatus[row.rowKey]?.message || [...row.errors, ...row.conflicts].join(' ') || 'Aguardando busca de pin.'}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => buscarPinLinhaPlanilha(row)}
                                                            disabled={!row.geocodeQuery || buscandoPinsPlanilha || verificandoPlanilha || adminActionsDisabled}
                                                            className={`mt-1 rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] font-bold uppercase text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                        >
                                                            Buscar pin
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="mt-0.5">
                                                        {[...row.errors, ...row.conflicts].join(' ') || `${row.action === 'atualizar' ? 'Atualizar' : 'Inserir'} · ${row.endereco}`}
                                                    </p>
                                                )}
                                            </div>
                                        )) : (
                                            <p className="text-xs font-medium text-slate-400">Nenhuma linha.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
