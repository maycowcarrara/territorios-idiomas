import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createStore } from "../workers/designacoes/src/store.js";
import { createService } from "../workers/designacoes/src/service.js";

// Hard-coded demo and loopback are intentional: this helper cannot target production.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8185";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9195";
const projectId = "demo-territorios-designacoes";
const secretPath = new URL("../workers/designacoes/.dev.vars", import.meta.url);
let secret;
try {
  secret = await readFile(secretPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  secret = `TOKEN_KEYS_JSON='${JSON.stringify({ "local-v1": randomBytes(32).toString("base64") })}'\n`;
  await writeFile(secretPath, secret, { flag: "wx" });
}
if (!/^PIN_HMAC_KEY=/m.test(secret)) {
  secret += `\nPIN_HMAC_KEY=${randomBytes(32).toString("base64url")}\n`;
  await writeFile(secretPath, secret);
}
const pinKey = secret.match(/^PIN_HMAC_KEY=(.+)$/m)?.[1]?.trim();
const keys = secret.match(/^TOKEN_KEYS_JSON='([^']+)'/m)?.[1];
if (!keys) throw new Error("Confira TOKEN_KEYS_JSON no .dev.vars local.");
const app = initializeApp({ projectId }, "preparacao-local");
const db = getFirestore(app);
const auth = getAuth(app);
const email = "admin-designacoes@example.test";
const password = "DemonstracaoLocal123!";
try {
  await auth.getUserByEmail(email);
} catch (error) {
  if (error.code !== "auth/user-not-found") throw error;
  await auth.createUser({ email, password, emailVerified: true });
}
await db
  .doc(`usuarios/${email}`)
  .set({ role: "admin", nome: "Administrador local" });
const grupoId = "demo-whatsapp";
const ids = ["demo-local-1", "demo-local-2", "demo-local-3"];
const grupo = await db.doc(`grupos_enderecos/${grupoId}`).get();
if (!grupo.exists) {
  await db
    .doc(`grupos_enderecos/${grupoId}`)
    .set({
      codigo: "ES-SBS-T013",
      nome: "Centro — demonstração",
      status: "ativo",
      enderecoIds: ids,
      totalEnderecos: ids.length,
      enderecos_visitados: [],
    });
  for (const [i, id] of ids.entries())
    await db
      .doc(`enderecos/${id}`)
      .set({
        codigo: `ES-SBS-02${i + 1}`,
        endereco: `Rua Exemplo, ${i + 1}`,
        bairro: "Centro",
        idiomaId: "es",
        idiomaNome: "Espanhol",
        grupoId,
        grupoCodigo: "ES-SBS-T013",
        grupoDesignadoPara: null,
        status: "ativo",
        lat: -26.25 - i * 0.001,
        lng: -49.38,
      });
}
const env = {
  CODIGOS_ENABLED: "true",
  FIREBASE_PROJECT_ID: projectId,
  LOCAL_EMULATORS: "true",
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  PUBLIC_APP_URL: "http://localhost:5185",
  TOKEN_KEYS_JSON: keys,
  PIN_HMAC_KEY: pinKey,
  TOKEN_KEY_VERSION: "local-v1",
};
const service = createService(createStore(env), env);
await service.adminAction(
  "configurar",
  null,
  { prazoDevolucaoAutomaticaDias: 90 },
  email,
);
const atual = (await db.doc(`grupos_enderecos/${grupoId}`).get()).data();
const share = atual.designacaoId
  ? await service.adminAction("compartilhar", atual.designacaoId, {}, email)
  : await service.adminAction(
      "criar",
      null,
      {
        requestId: crypto.randomUUID(),
        grupoId,
        contato: { nome: "Ana — contato fictício", telefone: "+5547999991234" },
      },
      email,
    );
await writeFile(
  new URL("../.designacoes-local.json", import.meta.url),
  JSON.stringify(
    { link: share.link, revisaoLink: share.revisaoLink, email, password },
    null,
    2,
  ),
);
console.log(
  "Demonstração pronta. Link e conta fictícia em .designacoes-local.json (ignorado pelo Git). Nenhuma mensagem enviada.",
);
await db.terminate();
