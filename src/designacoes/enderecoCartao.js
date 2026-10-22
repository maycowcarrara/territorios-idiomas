// Presentation-only. Stored/editable/digital addresses remain exact.
export function cidadeParaCartao(dados, cidadePadrao = "") {
  if (dados.cidade?.trim()) return dados.cidade.trim();
  const cidades = (dados.enderecos || []).map(e => e.cidade?.trim() || String(e.endereco || "").match(/,\s*([^,\n–—]+?)\s*[-–—,/]\s*(?:[A-Z]{2}|Santa Catarina)\b/u)?.[1]?.trim()).filter(Boolean);
  const unicas = new Map(cidades.map(cidade => [cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), cidade]));
  return [...unicas.values()].join(" / ") || cidadePadrao.trim();
}

export function enderecoParaCartao(endereco) {
  return String(endereco || "").replace(/(?:,\s*|[–—]\s*|\s+-\s+)S[aã]o Bento do Sul\s*[,/–—-]\s*(?:SC|Santa Catarina)\b(?:\s*,\s*Bra[sz]il)?(?:\s*[,–—-]\s*\d{5}-?\d{3})?/giu, "").trim();
}
