const bytes = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
const base64 = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const gerarToken = () =>
  base64(crypto.getRandomValues(new Uint8Array(12)));
export const hashToken = async (token) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
async function chave(env, versao) {
  const chaves = JSON.parse(env.TOKEN_KEYS_JSON || "{}");
  if (!chaves[versao] || bytes(chaves[versao]).length !== 32)
    throw new Error("Chave de acesso não configurada.");
  return crypto.subtle.importKey(
    "raw",
    bytes(chaves[versao]),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function cifrar(token, id, env) {
  const chaveVersao = env.TOKEN_KEY_VERSION;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const valor = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id) },
    await chave(env, chaveVersao),
    new TextEncoder().encode(token),
  );
  return { tokenCifrado: base64(valor), iv: base64(iv), chaveVersao };
}
export async function decifrar(d, id, env) {
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(d.iv),
        additionalData: new TextEncoder().encode(id),
      },
      await chave(env, d.chaveVersao),
      bytes(d.tokenCifrado),
    ),
  );
}

// Fixed-size digest comparison; never compare the four-digit secret directly.
export function digestsIguais(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== 64 || b.length !== 64) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
