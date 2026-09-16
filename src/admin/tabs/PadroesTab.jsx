import React from 'react';
import {
    DEFAULT_ENDERECO_CONFIG,
    normalizeEnderecoConfig,
    getEnderecoCodigoPadraoFromConfig,
    getGrupoEnderecoCodigoPadraoFromConfig
} from '../../enderecoConfig';
import { ADMIN_OFFLINE_ACTION_CLASS, UF_OPTIONS } from '../constants/adminConstants';
import { formatViewboxValue } from '../utils/adminUtils';
import { ImportacaoCsvSection } from './ImportacaoCsvSection';

export function PadroesTab({
    enderecoConfig,
    enderecoConfigForm,
    setEnderecoConfigForm,
    salvandoEnderecoConfig,
    salvarEnderecoConfig,
    enderecoConfigFormIdiomaPadrao,
    enderecoConfigFormIdiomaPadraoResolvida,
    enderecoConfigFormIdiomasAtivos,
    enderecoConfigFormIdiomas,
    selecionarIdiomaPadraoEndereco,
    adicionarEnderecoIdioma,
    handleEnderecoIdiomaChange,
    removerEnderecoIdioma,
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
    buscaEnderecoConfigForm,
    aplicarPresetBuscaEnderecoRegional,
    selecionarUfBuscaEndereco,
    atualizarBuscaEnderecoConfig,
    municipioBuscaEnderecoTexto,
    setMunicipioBuscaEnderecoTexto,
    adicionarMunicipioBuscaEndereco,
    removerMunicipioBuscaEndereco,
    municipiosBuscaEnderecoSugestoes,
    calculandoAreaBuscaEndereco,
    carregandoMunicipiosBuscaEndereco,
    adminActionsDisabled
}) {
    return (
        <section role="tabpanel" aria-labelledby="tab-padroes" className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Padrões operacionais</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {enderecoConfig.idiomaPadraoNome} · {enderecoConfig.prefixoEnderecoPadrao} · {enderecoConfig.prefixoTerritorioPadrao}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setEnderecoConfigForm(normalizeEnderecoConfig(DEFAULT_ENDERECO_CONFIG))}
                        disabled={salvandoEnderecoConfig || adminActionsDisabled}
                        className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                    >
                        Restaurar inicial
                    </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">Endereço sugerido</p>
                        <p className="mt-1 font-mono text-lg font-black text-teal-900">{getEnderecoCodigoPadraoFromConfig(enderecoConfigFormIdiomaPadraoResolvida)}</p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Território sugerido</p>
                        <p className="mt-1 font-mono text-lg font-black text-indigo-900">{getGrupoEnderecoCodigoPadraoFromConfig(enderecoConfigFormIdiomaPadraoResolvida)}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={salvarEnderecoConfig} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <fieldset disabled={adminActionsDisabled || salvandoEnderecoConfig} className={`space-y-5 ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Idioma padrão</label>
                        <select
                            value={enderecoConfigFormIdiomaPadrao?.id || ''}
                            onChange={(event) => selecionarIdiomaPadraoEndereco(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        >
                            {enderecoConfigFormIdiomasAtivos.map((idioma) => (
                                <option key={idioma.id} value={idioma.id}>{idioma.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-800">Idiomas de trabalho</h3>
                                <p className="mt-1 text-xs font-medium text-slate-500">{enderecoConfigFormIdiomasAtivos.length} ativo(s)</p>
                            </div>
                            <button
                                type="button"
                                onClick={adicionarEnderecoIdioma}
                                className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-bold uppercase text-teal-700 transition-all hover:bg-teal-50"
                            >
                                Adicionar idioma
                            </button>
                        </div>
                        <div className="space-y-3">
                            {enderecoConfigFormIdiomas.map((idioma, index) => (
                                <div key={`${idioma.id || 'novo'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <label className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                                            <input
                                                type="checkbox"
                                                checked={idioma.ativo}
                                                onChange={(event) => handleEnderecoIdiomaChange(index, 'ativo', event.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                                            />
                                            Ativo
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => removerEnderecoIdioma(index)}
                                            disabled={enderecoConfigFormIdiomas.length <= 1}
                                            className={`rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                        >
                                            Remover
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">ID</label>
                                            <input
                                                type="text"
                                                value={idioma.id}
                                                onChange={(event) => handleEnderecoIdiomaChange(index, 'id', event.target.value)}
                                                maxLength={32}
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                                placeholder="es"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome</label>
                                            <input
                                                type="text"
                                                value={idioma.nome}
                                                onChange={(event) => handleEnderecoIdiomaChange(index, 'nome', event.target.value)}
                                                maxLength={80}
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                                placeholder="Espanhol"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Prefixo de endereço</label>
                                            <input
                                                type="text"
                                                value={idioma.codigoPrefixoEndereco}
                                                onChange={(event) => handleEnderecoIdiomaChange(index, 'codigoPrefixoEndereco', event.target.value)}
                                                maxLength={40}
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                                placeholder="ES-SBS-"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Prefixo de território</label>
                                            <input
                                                type="text"
                                                value={idioma.codigoPrefixoTerritorio}
                                                onChange={(event) => handleEnderecoIdiomaChange(index, 'codigoPrefixoTerritorio', event.target.value)}
                                                maxLength={40}
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                                placeholder="ES-SBS-T"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Classe padrão</label>
                            <select
                                value={enderecoConfigForm.classeEnderecoPadrao}
                                onChange={(event) => handleEnderecoConfigChange('classeEnderecoPadrao', event.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            >
                                {enderecoConfig.tiposEndereco.filter((tipo) => tipo.ativo).map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Quantidade padrão</label>
                            <input
                                type="number"
                                min="0"
                                max="99"
                                value={enderecoConfigForm.quantidadeEstrangeirosPadrao}
                                onChange={(event) => handleEnderecoConfigChange('quantidadeEstrangeirosPadrao', event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Cidade padrão</label>
                            <input
                                type="text"
                                value={enderecoConfigForm.cidadePadrao}
                                onChange={(event) => handleEnderecoConfigChange('cidadePadrao', event.target.value)}
                                maxLength={120}
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">UF padrão</label>
                            <input
                                type="text"
                                value={enderecoConfigForm.ufPadrao}
                                onChange={(event) => handleEnderecoConfigChange('ufPadrao', event.target.value.toUpperCase())}
                                maxLength={2}
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            />
                        </div>
                    </div>

                    <ImportacaoCsvSection
                        enderecoConfigForm={enderecoConfigForm}
                        handleEnderecoConfigChange={handleEnderecoConfigChange}
                        salvarPlanilhaCsvUrl={salvarPlanilhaCsvUrl}
                        salvandoPlanilhaCsvUrl={salvandoPlanilhaCsvUrl}
                        verificarPlanilhaEnderecos={verificarPlanilhaEnderecos}
                        verificandoPlanilha={verificandoPlanilha}
                        inserirNovosEnderecosPlanilha={inserirNovosEnderecosPlanilha}
                        importandoPlanilha={importandoPlanilha}
                        enderecoCsvPreview={enderecoCsvPreview}
                        buscarPinsFaltantesPlanilha={buscarPinsFaltantesPlanilha}
                        buscandoPinsPlanilha={buscandoPinsPlanilha}
                        buscarPinLinhaPlanilha={buscarPinLinhaPlanilha}
                        enderecoCsvGeocodeStatus={enderecoCsvGeocodeStatus}
                        adminActionsDisabled={adminActionsDisabled}
                    />

                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-800">Área de busca no mapa</h3>
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                    {buscaEnderecoConfigForm.areas.length
                                        ? `${buscaEnderecoConfigForm.areas.length} área(s) · margem ${buscaEnderecoConfigForm.margemKm} km`
                                        : `${buscaEnderecoConfigForm.uf} · sem município fixo`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={aplicarPresetBuscaEnderecoRegional}
                                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold uppercase text-emerald-700 transition-all hover:bg-emerald-50"
                            >
                                Usar região SBS
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_140px_1fr_auto]">
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado</label>
                                <select
                                    value={buscaEnderecoConfigForm.uf}
                                    onChange={(event) => selecionarUfBuscaEndereco(event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono uppercase outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                >
                                    {UF_OPTIONS.map((uf) => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Margem km</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    step="0.5"
                                    value={buscaEnderecoConfigForm.margemKm}
                                    onChange={(event) => atualizarBuscaEnderecoConfig({ margemKm: event.target.value })}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Município</label>
                                <input
                                    type="text"
                                    value={municipioBuscaEnderecoTexto}
                                    onChange={(event) => setMunicipioBuscaEnderecoTexto(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            adicionarMunicipioBuscaEndereco();
                                        }
                                    }}
                                    list="municipios-busca-endereco"
                                    maxLength={120}
                                    placeholder={calculandoAreaBuscaEndereco ? 'Calculando área...' : carregandoMunicipiosBuscaEndereco ? 'Carregando municípios...' : 'Digite ou escolha um município'}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                                <datalist id="municipios-busca-endereco">
                                    {municipiosBuscaEnderecoSugestoes.map((municipio) => (
                                        <option key={municipio} value={municipio} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={() => adicionarMunicipioBuscaEndereco()}
                                    disabled={calculandoAreaBuscaEndereco}
                                    className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                                >
                                    {calculandoAreaBuscaEndereco ? 'Calculando...' : 'Adicionar'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {buscaEnderecoConfigForm.areas.length ? buscaEnderecoConfigForm.areas.map((area) => (
                                <span key={`${area.uf}-${area.cidade}`} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold text-emerald-800">
                                    {area.cidade}
                                    <button
                                        type="button"
                                        onClick={() => removerMunicipioBuscaEndereco(area.cidade)}
                                        className="rounded-full px-1 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
                                        aria-label={`Remover ${area.cidade}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            )) : (
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
                                    Nenhum município selecionado
                                </span>
                            )}
                        </div>

                        {buscaEnderecoConfigForm.areas.length ? (
                            <div className="mt-3 grid gap-2">
                                {buscaEnderecoConfigForm.areas.map((area) => (
                                    <div key={`${area.uf}-${area.cidade}-bounds`} className="grid grid-cols-1 gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 md:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
                                        <span className="font-bold text-slate-700">{area.cidade}</span>
                                        <span>O {formatViewboxValue(area.viewbox.left)}</span>
                                        <span>N {formatViewboxValue(area.viewbox.top)}</span>
                                        <span>L {formatViewboxValue(area.viewbox.right)}</span>
                                        <span>S {formatViewboxValue(area.viewbox.bottom)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                            {[
                                { key: 'left', label: 'Oeste', helper: 'lng mín.' },
                                { key: 'top', label: 'Norte', helper: 'lat máx.' },
                                { key: 'right', label: 'Leste', helper: 'lng máx.' },
                                { key: 'bottom', label: 'Sul', helper: 'lat mín.' }
                            ].map((field) => (
                                <div key={field.key}>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                        {field.label} <span className="font-medium normal-case text-slate-400">({field.helper})</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formatViewboxValue(buscaEnderecoConfigForm.viewbox[field.key])}
                                        readOnly
                                        className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-3 font-mono text-slate-500 outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Idiomas ativos</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {enderecoConfig.idiomas.filter((idioma) => idioma.ativo).map((idioma) => (
                                    <span key={idioma.id} className="rounded-full border border-teal-100 bg-white px-3 py-1 text-xs font-bold text-teal-700">
                                        {idioma.nome}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Classes ativas</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {enderecoConfig.tiposEndereco.filter((tipo) => tipo.ativo).map((tipo) => (
                                    <span key={tipo.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                                        {tipo.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={salvandoEnderecoConfig || adminActionsDisabled}
                            className={`rounded-xl bg-teal-700 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-teal-800 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                        >
                            {salvandoEnderecoConfig ? 'Salvando...' : 'Salvar padrões'}
                        </button>
                    </div>
                </fieldset>
            </form>
        </section>
    );
}
