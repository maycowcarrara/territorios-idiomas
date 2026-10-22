// Presentation-only. Stored/editable/digital addresses remain exact.
export function enderecoParaCartao(endereco) {
  return String(endereco || "").replace(/(?:,\s*|[–—]\s*|\s+-\s+)S[aã]o Bento do Sul\s*[,/–—-]\s*(?:SC|Santa Catarina)\b(?:\s*,\s*Bra[sz]il)?(?:\s*[,–—-]\s*\d{5}-?\d{3})?/giu, "").trim();
}
