import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { Buffer } from 'node:buffer';
import { createHandler } from "../../workers/designacoes/src/index.js";

let signingKey;
let jwk;
const project = "demo-designacoes-auth";
const base64 = (value) => Buffer.from(value).toString("base64url");
async function jwt(overrides = {}, wrongKey = false) {
  const now = Math.floor(Date.now() / 1000);
  const data = `${base64(JSON.stringify({ alg: "RS256", kid: "local-key" }))}.${base64(JSON.stringify({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: "local-admin", email: "admin@example.test", email_verified: true, iat: now, exp: now + 3600, ...overrides }))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    wrongKey
      ? (
          await crypto.subtle.generateKey(
            {
              name: "RSASSA-PKCS1-v1_5",
              modulusLength: 2048,
              publicExponent: new Uint8Array([1, 0, 1]),
              hash: "SHA-256",
            },
            true,
            ["sign", "verify"],
          )
        ).privateKey
      : signingKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64(signature)}`;
}
beforeAll(async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  signingKey = keys.privateKey;
  jwk = {
    ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
    kid: "local-key",
    alg: "RS256",
  };
});
afterEach(() => vi.unstubAllGlobals());
describe("autorização da API administrativa com assinatura real simulada", () => {
  const env = {
    ENABLED: "true",
    FIREBASE_PROJECT_ID: project,
    REQUEST_LIMITER: { limit: async () => ({ success: true }) },
    WRITE_LIMITER: { limit: async () => ({ success: true }) },
  };
  async function request(token, role = "admin") {
    vi.stubGlobal("fetch", async (url) => {
      expect(String(url)).toContain("securetoken@system.gserviceaccount.com");
      return new Response(JSON.stringify({ keys: [jwk] }), {
        headers: { "Cache-Control": "public,max-age=3600" },
      });
    });
    const store = {
      transaction: async (work) =>
        work({
          get: async (path) => (path.startsWith("usuarios/") ? { role } : null),
        }),
    };
    return createHandler({ storeFactory: () => store }).fetch(
      new Request("https://local/admin/configuracao", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "{}",
      }),
      env,
    );
  }
  it("aceita assinatura e permissão atuais", async () =>
    expect((await request(await jwt())).status).toBe(200));
  it.each([
    { aud: "outro-projeto" },
    { iss: "https://intruso.test" },
    { exp: 1 },
    { iat: Math.floor(Date.now() / 1000) + 3600 },
    { sub: "" },
    { email_verified: false },
  ])("nega claim inválido %j", async (claims) =>
    expect((await request(await jwt(claims))).status).toBe(401),
  );
  it("nega assinatura de outra chave", async () =>
    expect((await request(await jwt({}, true))).status).toBe(401));
  it("não confunde assinatura válida com role administrativo", async () =>
    expect((await request(await jwt(), "comum")).status).toBe(403));
  it("limita abuso antes de consultar os dados", async () => {
    const handler = createHandler({
      storeFactory: () => {
        throw new Error("Não deveria acessar dados");
      },
    });
    const r = await handler.fetch(
      new Request("https://local/public/territorio", {
        method: "POST",
        headers: { Authorization: "Bearer abc" },
        body: "{}",
      }),
      { ...env, REQUEST_LIMITER: { limit: async () => ({ success: false }) } },
    );
    expect(r.status).toBe(429);
  });
});
