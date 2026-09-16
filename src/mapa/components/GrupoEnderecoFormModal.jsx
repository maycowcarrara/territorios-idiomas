import React, { useState, useEffect, useMemo } from 'react';
import {
    getGrupoEnderecoCodigoPadraoFromConfig,
    normalizeEnderecoConfig
} from '../../enderecoConfig';
import { formatEnderecoCodigoExibicao } from '../../enderecoModel';

export const GrupoEnderecoFormModal = ({ isOpen, selectedEnderecos, gruposDisponiveis, enderecoConfig, loading, onClose, onSubmit }) => {
    const config = useMemo(() => normalizeEnderecoConfig(enderecoConfig), [enderecoConfig]);
    const codigoPadrao = getGrupoEnderecoCodigoPadraoFromConfig(config);
    const [codigo, setCodigo] = useState(codigoPadrao);
    const [nome, setNome] = useState('');
    const [modo, setModo] = useState('novo');
    const [grupoIdSelecionado, setGrupoIdSelecionado] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setCodigo(codigoPadrao);
        setNome('');
        setModo(gruposDisponiveis.length ? 'existente' : 'novo');
        setGrupoIdSelecionado(gruposDisponiveis[0]?.id || '');
    }, [codigoPadrao, gruposDisponiveis, isOpen]);

    if (!isOpen) return null;

    const totalEstrangeiros = selectedEnderecos.reduce((total, endereco) => total + (Number(endereco.quantidadeEstrangeiros) || 0), 0);

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit({ modo, codigo, nome, grupoId: grupoIdSelecionado });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <form onSubmit={handleSubmit} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-indigo-700 px-4 py-3">
                    <h3 className="text-lg font-bold text-white">Vincular a território</h3>
                </div>
                <div className="space-y-3 p-4">
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">
                        {selectedEnderecos.length} endereço(s) · {totalEstrangeiros} estrangeiro(s)
                    </div>
                    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
                        <button
                            type="button"
                            onClick={() => setModo('existente')}
                            disabled={loading || !gruposDisponiveis.length}
                            className={`rounded-md px-3 py-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${modo === 'existente' ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Existente
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo('novo')}
                            disabled={loading}
                            className={`rounded-md px-3 py-2 text-xs font-extrabold transition disabled:opacity-45 ${modo === 'novo' ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Novo
                        </button>
                    </div>
                    {modo === 'existente' ? (
                        <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Território existente</span>
                            <select
                                value={grupoIdSelecionado}
                                onChange={(event) => setGrupoIdSelecionado(event.target.value)}
                                disabled={loading || !gruposDisponiveis.length}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                            >
                                {gruposDisponiveis.map((grupo) => (
                                    <option key={grupo.id} value={grupo.id}>
                                        {grupo.codigoExibicao} · {grupo.totalEnderecos} endereço(s) · {grupo.nomeExibicao}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Código</span>
                                <input
                                    value={codigo}
                                    onChange={(event) => setCodigo(event.target.value)}
                                    maxLength={40}
                                    required
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    placeholder={codigoPadrao}
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome do território</span>
                                <input
                                    value={nome}
                                    onChange={(event) => setNome(event.target.value)}
                                    maxLength={120}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    placeholder="Ex.: Jardim São João"
                                />
                            </label>
                        </div>
                    )}
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {selectedEnderecos.map((endereco) => (
                            <div key={endereco.id} className="border-b border-slate-200 py-1 text-xs last:border-0">
                                <span className="font-bold text-slate-700">{formatEnderecoCodigoExibicao(endereco.codigo || endereco.id)}</span>
                                <span className="text-slate-500"> · {endereco.endereco || 'Sem endereço'}</span>
                            </div>
                        ))}
                    </div>
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
                        disabled={loading || selectedEnderecos.length === 0 || (modo === 'existente' && !grupoIdSelecionado)}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-70"
                    >
                        {loading ? 'Salvando...' : modo === 'existente' ? 'Vincular' : 'Criar território'}
                    </button>
                </div>
            </form>
        </div>
    );
};
