import React, { useState, useEffect, useMemo } from 'react';
import {
    getEnderecoCodigoPadraoFromConfig,
    getGrupoEnderecoCodigoPadraoFromConfig,
    normalizeEnderecoConfig
} from '../../enderecoConfig';
import { ENDERECO_CLASSES } from '../../enderecoModel';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';
import {
    formatAuditDateTime,
    getEnderecoAuditOriginLabel,
    getEnderecoInitialForm,
    hasEnderecoAuditInfo
} from '../utils/enderecoModalUtils';

export const EnderecoFormModal = ({ isOpen, mode, endereco, ponto, gruposDisponiveis = [], enderecoConfig, loading, onClose, onSubmit }) => {
    const modalRef = useLeafletDomEventIsolation();
    const config = useMemo(() => normalizeEnderecoConfig(enderecoConfig), [enderecoConfig]);
    const tiposEnderecoAtivos = config.tiposEndereco.filter((tipo) => tipo.ativo);
    const [form, setForm] = useState(getEnderecoInitialForm(endereco, ponto, config));
    const [activeTab, setActiveTab] = useState('dados');

    useEffect(() => {
        if (!isOpen) return;
        setForm(getEnderecoInitialForm(endereco, ponto, config));
        setActiveTab('dados');
    }, [config, endereco, isOpen, ponto]);

    if (!isOpen) return null;

    const isEdit = mode === 'edit';
    const titulo = isEdit ? `Editar ${endereco?.codigo || 'endereço'}` : 'Cadastrar endereço';
    const auditInfoAvailable = hasEnderecoAuditInfo(endereco);
    const activeSection = isEdit ? activeTab : 'dados';

    const handleChange = (field) => (event) => {
        setForm((current) => ({
            ...current,
            [field]: event.target.value
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;

        if (!form.codigo || !form.endereco || (!isEdit && form.grupoEscolha === '__novo__' && !form.grupoCodigo)) {
            setActiveTab('dados');
            window.requestAnimationFrame(() => formElement?.reportValidity?.());
            return;
        }

        onSubmit({
            ...form,
            codigo: form.codigo,
            informacao: form.informacao,
            observacao: form.informacao,
            lat: Number(form.lat),
            lng: Number(form.lng),
            quantidadeEstrangeiros: Number(form.quantidadeEstrangeiros)
        });
    };

    return (
        <div
            ref={modalRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            style={{ zIndex: 9999 }}
            onClick={stopMapDomEvent}
            onMouseDown={stopMapDomEvent}
            onTouchStart={stopMapDomEvent}
        >
            <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={stopMapDomEvent}>
                <div className="bg-teal-700 px-4 py-3">
                    <h3 className="text-lg font-bold text-white">{titulo}</h3>
                </div>
                <div className="space-y-3 p-4">
                    {isEdit && (
                        <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('dados')}
                                className={`rounded-md px-3 py-2 text-xs font-extrabold transition ${activeSection === 'dados' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Dados
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('historico')}
                                className={`rounded-md px-3 py-2 text-xs font-extrabold transition ${activeSection === 'historico' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Histórico
                            </button>
                        </div>
                    )}
                    {activeSection === 'dados' ? (
                        <>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                Lat {Number(form.lat).toFixed(6)} · Lng {Number(form.lng).toFixed(6)}
                            </div>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Código</span>
                                <input
                                    value={form.codigo}
                                    onChange={handleChange('codigo')}
                                    maxLength={40}
                                    required
                                    disabled={loading || isEdit}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                    placeholder={getEnderecoCodigoPadraoFromConfig(config)}
                                />
                            </label>
                            {!isEdit && (
                                <label className="block">
                                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Território</span>
                                    <select
                                        value={form.grupoEscolha}
                                        onChange={handleChange('grupoEscolha')}
                                        disabled={loading}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                    >
                                        <option value="">Sem território por enquanto</option>
                                        <option value="__novo__">Criar novo território com este endereço</option>
                                        {gruposDisponiveis.map((grupo) => (
                                            <option key={grupo.id} value={grupo.id}>
                                                {grupo.codigoExibicao}{grupo.distanciaExibicao ? ` · ${grupo.distanciaExibicao}` : ''} · {grupo.totalEnderecos} endereço(s) · {grupo.nomeExibicao}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            {!isEdit && form.grupoEscolha === '__novo__' && (
                                <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Código do território</span>
                                        <input
                                            value={form.grupoCodigo}
                                            onChange={handleChange('grupoCodigo')}
                                            maxLength={40}
                                            required
                                            disabled={loading}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                            placeholder={getGrupoEnderecoCodigoPadraoFromConfig(config)}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome do território</span>
                                        <input
                                            value={form.grupoNome}
                                            onChange={handleChange('grupoNome')}
                                            maxLength={120}
                                            disabled={loading}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                            placeholder="Ex.: Jardim São João"
                                        />
                                    </label>
                                </div>
                            )}
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Bairro</span>
                                <input
                                    value={form.bairro}
                                    onChange={handleChange('bairro')}
                                    maxLength={120}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                    placeholder="Ex.: Serra Alta"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Endereço</span>
                                <input
                                    value={form.endereco}
                                    onChange={handleChange('endereco')}
                                    maxLength={220}
                                    required
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                    placeholder="Rua, número, referência"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Classe</span>
                                <select
                                    value={form.classe}
                                    onChange={handleChange('classe')}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                >
                                    {(tiposEnderecoAtivos.length ? tiposEnderecoAtivos : config.tiposEndereco).map((tipo) => (
                                        <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estrangeiros</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={form.quantidadeEstrangeiros}
                                    onChange={handleChange('quantidadeEstrangeiros')}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Informação</span>
                                <textarea
                                    value={form.informacao}
                                    onChange={handleChange('informacao')}
                                    maxLength={2000}
                                    rows="4"
                                    disabled={loading}
                                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                                    placeholder="Nome, idioma, melhor horário, detalhes úteis"
                                />
                            </label>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                                <span className="font-black uppercase">Auditoria</span>
                                {auditInfoAvailable ? (
                                    <>
                                        <span className="block">
                                            {getEnderecoAuditOriginLabel(endereco)}
                                            {endereco?.importacaoId ? ` · ${endereco.importacaoId}` : ''}
                                        </span>
                                        <span className="block text-amber-700">
                                            {formatAuditDateTime(endereco?.atualizadoEm) || 'Sem data registrada'}
                                            {endereco?.atualizadoPor ? ` · ${endereco.atualizadoPor}` : ''}
                                        </span>
                                    </>
                                ) : (
                                    <span className="block text-amber-700">Sem histórico registrado para este endereço.</span>
                                )}
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                Lat {Number(form.lat).toFixed(6)} · Lng {Number(form.lng).toFixed(6)}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-70"
                    >
                        {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar'}
                    </button>
                </div>
            </form>
        </div>
    );
};
