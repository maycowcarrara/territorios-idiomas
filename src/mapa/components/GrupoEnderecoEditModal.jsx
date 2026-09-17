import React, { useState, useEffect } from 'react';
import {
    formatGrupoEnderecoCodigoExibicao,
    formatGrupoEnderecoNomeExibicao,
    GRUPO_ENDERECO_STATUS
} from '../../enderecoModel';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';
import { formatAuditDateTime } from '../utils/enderecoModalUtils';

export const GrupoEnderecoEditModal = ({ isOpen, grupo, loading, onClose, onSubmit }) => {
    const modalRef = useLeafletDomEventIsolation();
    const [form, setForm] = useState({
        codigo: '',
        nome: '',
        bairro: '',
        observacao: ''
    });
    const [activeTab, setActiveTab] = useState('dados');

    useEffect(() => {
        if (!isOpen || !grupo) return;
        const codigoInicial = grupo.codigo || formatGrupoEnderecoCodigoExibicao(grupo.id) || '';
        setForm({
            codigo: codigoInicial,
            nome: grupo.nome || '',
            bairro: grupo.bairro || '',
            observacao: grupo.observacao || ''
        });
        setActiveTab('dados');
    }, [grupo, isOpen]);

    if (!isOpen || !grupo) return null;

    const codigoExibicaoAtual = formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id);
    const titulo = `Editar ${codigoExibicaoAtual || 'território'}`;
    const totalEnderecos = Array.isArray(grupo.enderecoIds) ? grupo.enderecoIds.length : (Number(grupo.totalEnderecos) || 0);
    const totalEstrangeiros = Number(grupo.totalEstrangeiros) || 0;
    const statusLabel = grupo.status === GRUPO_ENDERECO_STATUS.ARQUIVADO
        ? 'Arquivado'
        : grupo.status === GRUPO_ENDERECO_STATUS.FINALIZADO
            ? 'Finalizado'
            : grupo.designadoPara
                ? 'Designado'
                : 'Ativo';

    const handleChange = (field) => (event) => {
        setForm((current) => ({
            ...current,
            [field]: event.target.value
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;

        const codigoLimpo = form.codigo.trim().toUpperCase();
        if (!codigoLimpo) {
            setActiveTab('dados');
            window.requestAnimationFrame(() => formElement?.reportValidity?.());
            return;
        }

        onSubmit({
            codigo: codigoLimpo,
            nome: form.nome.trim(),
            bairro: form.bairro.trim(),
            observacao: form.observacao.trim()
        });
    };

    return (
        <div
            ref={modalRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            style={{ zIndex: 9999 }}
            onClick={(event) => {
                stopMapDomEvent(event);
                if (event.target === event.currentTarget && !loading) onClose();
            }}
            onMouseDown={stopMapDomEvent}
            onTouchStart={stopMapDomEvent}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !loading) {
                    event.stopPropagation();
                    onClose();
                }
            }}
            tabIndex={-1}
        >
            <form
                onSubmit={handleSubmit}
                className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl"
                onClick={stopMapDomEvent}
            >
                <div className="flex items-start justify-between bg-indigo-700 px-4 py-3">
                    <div>
                        <h3 className="text-lg font-bold text-white">{titulo}</h3>
                        <p className="text-xs text-indigo-100">{formatGrupoEnderecoNomeExibicao(grupo.nome, codigoExibicaoAtual)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-indigo-200 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50"
                        title="Fechar"
                        aria-label="Fechar modal"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('dados')}
                            className={`rounded-md px-3 py-2 text-xs font-extrabold transition ${activeTab === 'dados' ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Dados
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('historico')}
                            className={`rounded-md px-3 py-2 text-xs font-extrabold transition ${activeTab === 'historico' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Histórico / Auditoria
                        </button>
                    </div>

                    {activeTab === 'dados' ? (
                        <>
                            <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
                                <span>{totalEnderecos} endereço(s) · {totalEstrangeiros} pessoa(s)</span>
                                <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-900">
                                    {statusLabel}
                                </span>
                            </div>

                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    Código do território <span className="text-rose-500">*</span>
                                </span>
                                <input
                                    value={form.codigo}
                                    onChange={handleChange('codigo')}
                                    maxLength={40}
                                    required
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    placeholder="Ex.: ES-SBS-T01"
                                />
                                <span className="mt-1 block text-[11px] text-slate-400">
                                    Identificador oficial do território (ex.: ES-SBS-T01 ou T-01).
                                </span>
                            </label>

                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    Nome do território
                                </span>
                                <input
                                    value={form.nome}
                                    onChange={handleChange('nome')}
                                    maxLength={120}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    placeholder="Ex.: Centro, Serra Alta"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    Bairro principal
                                </span>
                                <input
                                    value={form.bairro}
                                    onChange={handleChange('bairro')}
                                    maxLength={120}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    placeholder="Ex.: Centro"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    Observações / Detalhes úteis
                                </span>
                                <textarea
                                    value={form.observacao}
                                    onChange={handleChange('observacao')}
                                    maxLength={2000}
                                    rows="3"
                                    disabled={loading}
                                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    placeholder="Orientações de acesso, detalhes da região ou notas administrativas"
                                />
                            </label>
                        </>
                    ) : (
                        <div className="space-y-2.5">
                            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
                                <div className="font-black uppercase tracking-wider text-amber-800">Dados de Auditoria</div>
                                <div className="mt-2 space-y-1.5">
                                    <div>
                                        <span className="font-bold">Criado em: </span>
                                        <span>{formatAuditDateTime(grupo.criadoEm) || 'Sem registro'}</span>
                                        {grupo.criadoPor && <span className="text-amber-700"> ({grupo.criadoPor})</span>}
                                    </div>
                                    <div>
                                        <span className="font-bold">Última atualização: </span>
                                        <span>{formatAuditDateTime(grupo.atualizadoEm || grupo.ultimaAlteracao) || 'Sem registro'}</span>
                                        {grupo.atualizadoPor && <span className="text-amber-700"> ({grupo.atualizadoPor})</span>}
                                    </div>
                                    <div>
                                        <span className="font-bold">Responsável atual: </span>
                                        <span>{grupo.designadoNome || grupo.designadoPara || 'Sem responsável'}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold">Última conclusão: </span>
                                        <span>{formatAuditDateTime(grupo.ultimaConclusao) || 'Nunca concluído'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                <span className="font-bold text-slate-600">ID técnico no banco: </span>
                                <span className="font-mono text-[11px] text-slate-700">{grupo.id}</span>
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
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-70"
                    >
                        {loading ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                </div>
            </form>
        </div>
    );
};
