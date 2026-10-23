export function grupoSemEnderecos(grupo) {
    if (Array.isArray(grupo?.enderecoIds)) return grupo.enderecoIds.length === 0;
    return Number(grupo?.totalEnderecos || 0) === 0;
}

// Each checked category adds its territories, including those that are both
// archived and empty. Explicit filters also apply in address-only view.
export function grupoVisivelNosFiltros(grupo, { modoEnderecos = false, mostrarArquivados = false, mostrarSemEnderecos = false } = {}) {
    const arquivado = grupo.status === 'arquivado';
    const vazio = grupoSemEnderecos(grupo);
    if (arquivado && mostrarArquivados) return true;
    if (vazio && mostrarSemEnderecos) return true;
    if (arquivado || vazio) return false;
    return !modoEnderecos && ['ativo', 'finalizado'].includes(grupo.status || 'ativo');
}
