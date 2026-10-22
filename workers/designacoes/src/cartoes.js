import { ServiceError } from "./errors.js";
import { cifrar, gerarToken } from "./crypto.js";

const fail = (message, code = 409) => { throw new ServiceError(message, code); };
const namespace = env => env.FIREBASE_PROJECT_ID || "instance";
// This separate key is immutable for the lifetime of the PIN history. Rotation requires
// an explicit multi-key migration; changing it silently fails closed below.
export async function fingerprint(codigo, env) {
  const secret = env.PIN_HMAC_KEY;
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret))
    fail("Proteção dos códigos não configurada.", 503);
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`pin-v1:${namespace(env)}:${codigo}`));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,"0")).join("");
}
export function randomPinStart(max = 10000) {
  // Rejection sampling avoids modulo bias.
  let n;
  const limit = Math.floor(65536 / max) * max;
  do { n = crypto.getRandomValues(new Uint16Array(1))[0]; } while (n >= limit);
  return n % max;
}
export async function obterCartao(tx, grupoId, agora) {
  const inverse = `cartoes_por_grupo/${grupoId}`;
  const existing = await tx.get(inverse);
  if (existing) {
    const card = await tx.get(`cartoes_territorios/${existing.cartaoId}`);
    if (card?.grupoId !== grupoId) fail("Vínculo do cartão inconsistente.");
    return existing.cartaoId;
  }
  for (let i = 0; i < 4; i++) {
    const id = gerarToken();
    if (await tx.get(`cartoes_territorios/${id}`)) continue;
    tx.create(`cartoes_territorios/${id}`, { grupoId, criadoEm: agora });
    tx.create(inverse, { cartaoId: id });
    return id;
  }
  fail("Não foi possível reservar o cartão. Tente novamente.");
}
export async function reservarPin(tx, { id, grupoId, cartaoId, versao, agora }, env) {
  const keyId = await fingerprint("key-check", env);
  const config = await tx.get("controle_codigos/chave");
  if (config && config.keyId !== keyId) fail("Rotação da chave requer migração explícita do histórico.", 503);
  const path = `historico_codigos/${grupoId}`;
  const history = (await tx.get(path))?.usados || [];
  if (history.length >= 10000) fail("Os códigos deste território foram esgotados.");
  const used = new Set(history);
  const permutation = new Map();
  // Lazy unbiased Fisher-Yates permutation: no repeated candidates, bounded work.
  let checked = 0;
  for (let i = 0; i < 10000; i++) {
    const j = i + randomPinStart(10000 - i);
    const chosen = permutation.get(j) ?? j;
    permutation.set(j, permutation.get(i) ?? i);
    const codigo = String(chosen).padStart(4, "0");
    const hash = await fingerprint(codigo, env);
    if (used.has(hash)) continue;
    if (++checked > 128) break;
    const indexPath = `codigos_ativos/${hash}`;
    const owner = await tx.get(indexPath);
    if (owner) {
      const d = await tx.get(`designacoes_links/${owner.designacaoId}`);
      if (d?.operacionalAtiva && d.status === "ativa" && d.tokenVersao === owner.versao && new Date(d.expiraEm) > agora) continue;
    }
    const encrypted = await cifrar(codigo, id, env);
    tx.set(indexPath, { designacaoId: id, cartaoId, versao });
    tx.set(path, { usados: [...history, hash] });
    if (!config) tx.create("controle_codigos/chave", { keyId });
    return { acessoModo: "codigo4", cartaoId, pinHash: hash, pinCifrado: encrypted, tokenVersao: versao };
  }
  fail("Não foi possível reservar um código disponível. Capacidade ou concorrência: tente novamente; o acesso anterior foi preservado.");
}
