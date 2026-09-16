import React from 'react';
import { ADMIN_OFFLINE_ACTION_CLASS } from '../constants/adminConstants';
import { formatarTelefone } from '../utils/adminUtils';

export function UsuariosTab({
    totalPendentes,
    usuariosPendentes,
    userRoleFilter,
    setUserRoleFilter,
    userSearch,
    setUserSearch,
    usuariosFiltrados,
    totalUsers,
    cadastroAberto,
    setCadastroAberto,
    novoNome,
    setNovoNome,
    novoEmail,
    setNovoEmail,
    novoWhats,
    setNovoWhats,
    loadingAdd,
    handleAdicionar,
    mudarRole,
    remover,
    iniciarEdicao,
    cancelarEdicao,
    editandoId,
    dadosEditados,
    handleEditChange,
    salvarEdicao,
    adminActionsDisabled
}) {
    return (
        <section role="tabpanel" aria-labelledby="tab-usuarios" className="space-y-6">
            <div className={`grid grid-cols-1 gap-6 ${totalPendentes > 0 ? 'xl:grid-cols-[0.95fr_1.05fr]' : ''}`}>
                {totalPendentes > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{totalPendentes} pendência(s)</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setUserRoleFilter('aguardando');
                                    setUserSearch('');
                                }}
                                className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-700 transition-all hover:bg-amber-50"
                            >
                                Ver só pendentes
                            </button>
                        </div>
                        <div className="mt-5 space-y-3">
                            {usuariosPendentes.slice(0, 3).map((user) => (
                                <div key={user.id} className="rounded-2xl border border-white bg-white/90 p-3.5 shadow-sm">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800">{user.nome || 'Sem nome'}</p>
                                            <p className="mt-1 truncate text-xs font-mono text-slate-400">{user.id}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => mudarRole(user, 'comum')}
                                            disabled={adminActionsDisabled}
                                            className={`rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                        >
                                            Aprovar agora
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-black text-slate-900">Cadastrar novo usuário</h2>
                        <button
                            type="button"
                            onClick={() => setCadastroAberto((prev) => !prev)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:bg-slate-100"
                            aria-label={cadastroAberto ? 'Recolher cadastro' : 'Abrir cadastro'}
                        >
                            <span aria-hidden="true">{cadastroAberto ? '−' : '+'}</span>
                        </button>
                    </div>
                    {cadastroAberto ? (
                        <form onSubmit={handleAdicionar} className="mt-5">
                            <fieldset disabled={adminActionsDisabled || loadingAdd} className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome completo</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: João Silva"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        value={novoNome}
                                        onChange={(e) => setNovoNome(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">E-mail</label>
                                    <input
                                        type="email"
                                        placeholder="Ex: joao@exemplo.com"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        value={novoEmail}
                                        onChange={(e) => setNovoEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">WhatsApp</label>
                                    <input
                                        type="text"
                                        placeholder="(46) 99999-9999"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        value={novoWhats}
                                        maxLength={15}
                                        onChange={(e) => setNovoWhats(formatarTelefone(e.target.value))}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <button
                                        type="submit"
                                        disabled={loadingAdd || adminActionsDisabled}
                                        className={`inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                    >
                                        {loadingAdd ? 'Salvando...' : '+ Adicionar usuário'}
                                    </button>
                                </div>
                            </fieldset>
                        </form>
                    ) : null}
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Lista de usuários</h2>
                    </div>
                    <div className="w-full max-w-md">
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Buscar usuário</label>
                            <input
                                type="text"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="Nome, e-mail ou telefone"
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {[
                        { value: 'todos', label: 'Todos' },
                        { value: 'aguardando', label: 'Pendentes' },
                        { value: 'comum', label: 'Dirigentes' },
                        { value: 'admin', label: 'Admins' }
                    ].map((option) => {
                        const ativa = userRoleFilter === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setUserRoleFilter(option.value)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${ativa ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                        Exibindo <span className="font-bold text-slate-800">{usuariosFiltrados.length}</span> de <span className="font-bold text-slate-800">{totalUsers}</span> usuário(s).
                    </p>
                    {(userSearch || userRoleFilter !== 'todos') && (
                        <button
                            type="button"
                            onClick={() => {
                                setUserSearch('');
                                setUserRoleFilter('todos');
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>

                <div className="mt-6 space-y-4 md:hidden">
                    {usuariosFiltrados.map((user) => (
                        <div key={user.id} className={`rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm ${editandoId === user.id ? 'ring-2 ring-blue-100 bg-blue-50/20' : ''}`}>
                            <div className="mb-3 flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">
                                        {(user.nome || user.id || '?')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        {editandoId === user.id ? (
                                            <input
                                                type="text"
                                                value={dadosEditados.nome || ''}
                                                onChange={(e) => handleEditChange('nome', e.target.value)}
                                                className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="Nome"
                                                disabled={adminActionsDisabled}
                                            />
                                        ) : (
                                            <h4 className="text-sm font-bold text-slate-800">{user.nome || 'Sem Nome'}</h4>
                                        )}
                                        <p className="max-w-[170px] truncate text-xs font-mono text-slate-400">{user.id}</p>
                                    </div>
                                </div>
                                <div>
                                    {user.role === 'admin' ? (
                                        <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-1 text-[10px] font-bold text-purple-700">ADMIN</span>
                                    ) : user.role === 'aguardando' ? (
                                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">PENDENTE</span>
                                    ) : (
                                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">DIRIGENTE</span>
                                    )}
                                </div>
                            </div>

                            <div className="mb-4 pl-[3.25rem]">
                                {editandoId === user.id ? (
                                    <input
                                        type="text"
                                        value={dadosEditados.whatsapp || ''}
                                        onChange={(e) => handleEditChange('whatsapp', e.target.value)}
                                        className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="WhatsApp"
                                        disabled={adminActionsDisabled}
                                    />
                                ) : user.whatsapp ? (
                                    <a href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-green-700">
                                        <span className="text-xs">🟢</span> {user.whatsapp}
                                    </a>
                                ) : (
                                    <span className="text-sm italic text-slate-300">Sem WhatsApp</span>
                                )}
                            </div>

                            <div className="flex gap-2 border-t border-slate-100 pt-3">
                                {editandoId === user.id ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={salvarEdicao}
                                            disabled={adminActionsDisabled}
                                            className={`flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                        >
                                            Salvar
                                        </button>
                                        <button type="button" onClick={cancelarEdicao} className="flex-1 rounded-xl bg-slate-200 py-2 text-sm font-bold text-slate-700">Cancelar</button>
                                    </>
                                ) : (
                                    <>
                                        {user.role === 'aguardando' ? (
                                            <button
                                                type="button"
                                                onClick={() => mudarRole(user, 'comum')}
                                                disabled={adminActionsDisabled}
                                                className={`flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                            >
                                                Aprovar acesso
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => iniciarEdicao(user)}
                                                    disabled={adminActionsDisabled}
                                                    className={`flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-blue-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => mudarRole(user, user.role === 'admin' ? 'comum' : 'admin')}
                                                    disabled={adminActionsDisabled}
                                                    className={`flex flex-1 items-center justify-center rounded-xl border p-2 transition-colors ${user.role === 'admin' ? 'border-red-100 bg-red-50 text-red-600' : 'border-yellow-100 bg-yellow-50 text-yellow-600'} ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                >
                                                    {user.role === 'admin' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 2.25a.75.75 0 0 1 .75.75v9.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                                                            <path d="M5.5 15.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 17.75a.75.75 0 0 1-.75-.75V7.81L7.03 10.03a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06l-2.22-2.22V17a.75.75 0 0 1-.75.75Z" clipRule="evenodd" />
                                                            <path d="M5.5 3.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => remover(user.id)}
                                            disabled={adminActionsDisabled}
                                            className={`flex flex-1 items-center justify-center rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {usuariosFiltrados.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400">
                            Nenhum usuário encontrado com os filtros atuais.
                        </div>
                    )}
                </div>

                <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                    <th className="px-6 py-4 font-bold">Usuário / E-mail</th>
                                    <th className="px-6 py-4 font-bold">WhatsApp</th>
                                    <th className="px-6 py-4 text-center font-bold">Permissão</th>
                                    <th className="px-6 py-4 text-right font-bold">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {usuariosFiltrados.map((user) => (
                                    <tr key={user.id} className={`transition-colors hover:bg-blue-50/30 ${editandoId === user.id ? 'bg-yellow-50' : ''}`}>
                                        <td className="px-6 py-4">
                                            {editandoId === user.id ? (
                                                <div className="flex flex-col gap-1">
                                                    <input
                                                        type="text"
                                                        value={dadosEditados.nome || ''}
                                                        onChange={(e) => handleEditChange('nome', e.target.value)}
                                                        className="rounded-lg border border-blue-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Nome"
                                                        disabled={adminActionsDisabled}
                                                    />
                                                    <span className="pl-1 text-xs font-mono text-slate-400">{user.id} (fixo)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-500 shadow-sm">
                                                        {(user.nome || user.id || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{user.nome || 'Sem Nome'}</div>
                                                        <div className="text-xs font-mono text-slate-400">{user.id}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {editandoId === user.id ? (
                                                <input
                                                    type="text"
                                                    value={dadosEditados.whatsapp || ''}
                                                    onChange={(e) => handleEditChange('whatsapp', e.target.value)}
                                                    className="w-36 rounded-lg border border-blue-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                    placeholder="WhatsApp"
                                                    disabled={adminActionsDisabled}
                                                />
                                            ) : user.whatsapp ? (
                                                <a href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-sm font-medium text-green-700 transition-colors hover:bg-green-100">
                                                    <span className="text-xs">🟢</span> {user.whatsapp}
                                                </a>
                                            ) : (
                                                <span className="text-sm italic text-slate-300">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {user.role === 'admin' ? (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                                                    🛡️ Admin
                                                </span>
                                            ) : user.role === 'aguardando' ? (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                                    ⏳ Pendente
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                                                    👤 Dirigente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {editandoId === user.id ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={salvarEdicao}
                                                            disabled={adminActionsDisabled}
                                                            className={`rounded-lg bg-green-100 p-2 text-green-700 transition-colors hover:bg-green-200 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                            title="Salvar"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                        </button>
                                                        <button type="button" onClick={cancelarEdicao} className="rounded-lg bg-red-100 p-2 text-red-700 transition-colors hover:bg-red-200" title="Cancelar">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {user.role === 'aguardando' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => mudarRole(user, 'comum')}
                                                                disabled={adminActionsDisabled}
                                                                className={`rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                            >
                                                                Aprovar
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => iniciarEdicao(user)}
                                                                disabled={adminActionsDisabled}
                                                                className={`rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                                title="Editar dados"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => mudarRole(user, user.role === 'admin' ? 'comum' : 'admin')}
                                                            disabled={adminActionsDisabled}
                                                            className={`rounded-lg p-2 transition-colors ${user.role === 'admin' ? 'text-purple-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-yellow-50 hover:text-yellow-600'} ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                            title={user.role === 'admin' ? 'Remover admin' : 'Promover a admin'}
                                                        >
                                                            {user.role === 'admin' ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M10 2.25a.75.75 0 0 1 .75.75v9.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                                                                    <path d="M5.5 15.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M10 17.75a.75.75 0 0 1-.75-.75V7.81L7.03 10.03a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06l-2.22-2.22V17a.75.75 0 0 1-.75.75Z" clipRule="evenodd" />
                                                                    <path d="M5.5 3.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                                </svg>
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => remover(user.id)}
                                                            disabled={adminActionsDisabled}
                                                            className={`rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                            title="Remover usuário"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {usuariosFiltrados.length === 0 && (
                        <div className="p-8 text-center italic text-slate-400">Nenhum usuário encontrado com os filtros atuais.</div>
                    )}
                </div>
            </div>
        </section>
    );
}
