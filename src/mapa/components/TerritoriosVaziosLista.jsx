import React from 'react';
import { formatGrupoEnderecoCodigoExibicao } from '../../enderecoModel';

export function TerritoriosVaziosLista({ grupos, onEdit, onToggleArchive, onClose, disabled }) {
    return <section aria-label="Territórios sem endereços" className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800">Sem endereços</h3>
            <button type="button" onClick={onClose} aria-label="Fechar lista de territórios sem endereços" className="rounded border px-2 py-1">Fechar</button>
        </div>
        <p className="my-2 text-xs text-slate-600">Ocultos por padrão. O filtro “Mostrar territórios sem endereços” exibe os marcadores. O número e o cadastro ficam preservados.</p>
        <ul className="max-h-[45dvh] space-y-2 overflow-y-auto">
            {grupos.map(grupo => <li key={grupo.id} className="rounded-lg border border-slate-200 p-2">
                <p className="text-sm font-bold">{formatGrupoEnderecoCodigoExibicao(grupo.codigo || grupo.id)} · {grupo.status === 'arquivado' ? 'Arquivado' : 'Sem endereços'}</p>
                <p className="break-words text-xs text-slate-600">{grupo.nome}{grupo.bairro ? ` · ${grupo.bairro}` : ''}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={disabled || grupo.designacaoTipo === 'link'} onClick={() => onEdit(grupo)} className="rounded border px-3 py-2 text-xs font-bold disabled:opacity-50">Editar</button>
                    <button type="button" disabled={disabled || grupo.designacaoTipo === 'link'} onClick={() => onToggleArchive(grupo)} className="rounded border px-3 py-2 text-xs font-bold disabled:opacity-50">{grupo.status === 'arquivado' ? 'Reativar' : 'Arquivar'}</button>
                </div>
                {grupo.designacaoTipo === 'link' && <p className="mt-1 text-xs text-amber-800">Devolva a designação antes de editar ou arquivar.</p>}
            </li>)}
        </ul>
        {!grupos.length && <p className="text-sm text-slate-600">Nenhum território sem endereços neste idioma.</p>}
    </section>;
}
