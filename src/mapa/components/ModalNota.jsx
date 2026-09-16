import React, { useState, useEffect, useRef, useMemo } from 'react';
import { isLegacyNoteId } from '../../territorioNotes';

export const ModalNota = ({ isOpen, onClose, onAdicionar, onEditar, onExcluir, dados, user, isAdmin, canWrite }) => {
    const [texto, setTexto] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const scrollRef = useRef(null);

    const notas = useMemo(() => {
        if (!dados?.notas) return [];
        if (typeof dados.notas === 'string') {
            return [{ id: 'legacy', texto: dados.notas, autorNome: 'Sistema (Antigo)', data: null, autorEmail: 'sistema' }];
        }
        return dados.notas;
    }, [dados]);

    useEffect(() => {
        if (!isOpen) return;
        const timeoutId = window.setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);

        return () => window.clearTimeout(timeoutId);
    }, [isOpen, dados]);

    const handleSubmit = async () => {
        if (!canWrite || salvando) return;
        if (!texto.trim()) return;

        try {
            setSalvando(true);
            if (editandoId) {
                await onEditar(dados.quadraId, editandoId, texto);
            } else {
                await onAdicionar(dados.quadraId, texto);
            }
            setTexto('');
            setEditandoId(null);
        } finally {
            setSalvando(false);
        }
    };

    const iniciarEdicao = (nota) => {
        setTexto(nota.texto);
        setEditandoId(nota.id);
    };

    const cancelarEdicao = () => {
        setTexto('');
        setEditandoId(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[500px]">
                <div className="bg-blue-600 p-4 flex justify-between items-center shrink-0">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        💬 Notas: {dados?.quadraId}
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white text-xl font-bold">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3" ref={scrollRef}>
                    {notas.length === 0 && (
                        <p className="text-center text-gray-400 text-sm italic mt-10">Nenhuma observação ainda.</p>
                    )}
                    {notas.map((nota) => {
                        const isMe = user?.email === nota.autorEmail;
                        const isLegacy = isLegacyNoteId(nota.id);
                        const podeExcluir = canWrite && !isLegacy && (isAdmin || isMe);
                        const podeEditar = canWrite && !isLegacy && (isMe || isAdmin);
                        return (
                            <div key={nota.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 shadow-sm relative group ${isMe ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}`}>
                                    <div className="flex justify-between items-center gap-4 mb-1 border-b border-black/5 pb-1">
                                        <span className="text-[10px] font-bold uppercase opacity-70">{nota.autorNome || 'Anônimo'}</span>
                                        <span className="text-[9px] opacity-50">
                                            {nota.data ? new Date(nota.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{nota.texto}</p>
                                    <div className="absolute -top-2 -right-2 flex gap-1">
                                        {podeEditar && (
                                            <button onClick={() => iniciarEdicao(nota)} className="bg-white text-blue-600 border border-blue-200 p-1 rounded-full shadow hover:bg-blue-50" title="Editar">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        )}
                                        {podeExcluir && (
                                            <button onClick={() => onExcluir(dados.quadraId, nota.id)} className="bg-white text-red-600 border border-red-200 p-1 rounded-full shadow hover:bg-red-50" title="Excluir">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-3 bg-white border-t border-gray-200">
                    {!canWrite && (
                        <div className="mb-2 rounded bg-gray-100 px-3 py-2 text-xs text-gray-600">
                            Modo consulta. Conecte-se e abra o território correto para adicionar ou corrigir observações.
                        </div>
                    )}
                    {editandoId && (
                        <div className="flex justify-between items-center text-xs text-blue-600 mb-2 bg-blue-50 p-1 px-2 rounded">
                            <span>✏️ Editando mensagem...</span>
                            <button onClick={cancelarEdicao} className="underline hover:text-blue-800">Cancelar</button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <textarea
                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
                            placeholder="Escreva uma observação..."
                            rows="2"
                            value={texto}
                            disabled={!canWrite || salvando}
                            onChange={(e) => setTexto(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                        />
                        <button onClick={handleSubmit} disabled={!canWrite || salvando || !texto.trim()} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end">
                            {salvando ? (
                                <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
