import assert from "node:assert/strict";
import { initializeApp as adminApp } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  terminate,
} from "firebase/firestore";
import { createStore } from "../workers/designacoes/src/store.js";
import { createHandler } from "../workers/designacoes/src/index.js";
import { createService } from "../workers/designacoes/src/service.js";

const projectId = process.env.GCLOUD_PROJECT;
assert(
  projectId?.startsWith("demo-"),
  "Este smoke só pode executar com projeto demo.",
);
assert(
  /^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ""),
  "Firestore precisa estar no loopback.",
);
assert(
  /^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || ""),
  "Auth precisa estar no loopback.",
);
const admin = adminApp({ projectId }, "designacoes-smoke");
const db = adminFirestore(admin);
const authAdmin = adminAuth(admin);
const env = {
  CODIGOS_ENABLED: "true",
  ENABLED: "true",
  LOCAL_EMULATORS: "true",
  FIREBASE_PROJECT_ID: projectId,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  PUBLIC_APP_URL: "http://localhost:5173",
  ALLOWED_ORIGINS: "http://localhost:5173",
  TOKEN_KEY_VERSION: "local",
  PIN_HMAC_KEY: btoa("h".repeat(32)).replace(/=+$/, ""),
  TOKEN_KEYS_JSON: JSON.stringify({ local: btoa("z".repeat(32)) }),
};
let now = new Date("2026-10-21T12:00:00Z");
const store = createStore(env);
const service = createService(store, env, () => now);
const handler = createHandler({ clock: () => now });
const clients = [];
let assertions = 0;
const check = (value, message) => {
  assert(value, message);
  assertions++;
};
async function denied(work) {
  await assert.rejects(
    work,
    /permission-denied|PERMISSION_DENIED|insufficient permissions/i,
  );
  assertions++;
}
async function client(role) {
  const app = initializeApp(
    {
      projectId,
      apiKey: "demo-api-key",
      authDomain: `${projectId}.firebaseapp.com`,
    },
    `designacoes-${role}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  const firestore = getFirestore(app);
  const [host, port] = env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(firestore, host, Number(port));
  let token;
  if (role !== "anon") {
    const email = `designacoes-${role}@example.test`;
    const password = "LocalSmoke12345!";
    await authAdmin.createUser({ email, password, emailVerified: true });
    await db
      .doc(`usuarios/${email}`)
      .set({ role: role.startsWith("admin") ? "admin" : "comum", nome: role });
    token = await (
      await signInWithEmailAndPassword(auth, email, password)
    ).user.getIdToken();
  }
  const value = { app, db: firestore, token, auth };
  clients.push(value);
  return value;
}
async function http(path, token, body = {}) {
  const response = await handler.fetch(
    new Request(`http://local${path}`, {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    env,
  );
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
const group = "smoke-link-g";
const e1 = "smoke-link-e1";
const e2 = "smoke-link-e2";
try {
  const a = await client("admin");
  const c = await client("comum");
  const anon = await client("anon");
  await db.doc(`grupos_enderecos/${group}`).set({
    codigo: "ES-SBS-T099",
    nome: "Teste local",
    status: "ativo",
    enderecoIds: [e1, e2],
    totalEnderecos: 2,
    enderecos_visitados: [],
  });
  for (const [i, id] of [e1, e2].entries())
    await db.doc(`enderecos/${id}`).set({
      codigo: `ES-SBS-09${i}`,
      grupoId: group,
      grupoCodigo: "ES-SBS-T099",
      grupoDesignadoPara: null,
      endereco: "Rua de teste, 1",
      status: "ativo",
      lat: -26,
      lng: -49,
    });
  check(
    (await http("/admin/configuracao", c.token)).status === 403,
    "Comum não administra API",
  );
  check(
    (await http("/admin/configuracao", "falso")).status === 401,
    "Token Firebase falso não administra API",
  );
  check(
    (await http("/public/territorio", null)).status === 401,
    "Visitante sem token não consulta API",
  );
  let r = await http("/admin/configuracao", a.token, {
    salvar: true,
    prazoDevolucaoAutomaticaDias: 1,
  });
  check(r.status === 200, "Configuração administrativa");
  const createBody = {
    requestId: "emulator-r1",
    grupoId: group,
    contato: { nome: "Ana local", telefone: "+5547999991234" },
  };
  r = await http("/admin/designacoes", a.token, createBody);
  check(r.status === 200, `Criar via HTTP: ${JSON.stringify(r.body)}`);
  const share = r.body;
  const token = (await http("/public/acessar-cartao", null, {cartaoId:share.cartaoId,codigo:share.codigoAcesso})).body.token;
  check(
    (await http("/admin/designacoes", a.token, createBody)).body.link ===
      share.link,
    "Criação idempotente após resposta perdida",
  );
  r = await http("/public/territorio", token);
  check(
    r.status === 200 && r.body.enderecos.length === 2,
    "API publica lista restrita",
  );
  check(!JSON.stringify(r.body).includes("telefone"), "Projeção sem telefone");
  check(
    r.headers.get("Cache-Control") === "no-store",
    "Resposta não cacheável",
  );
  const d = (await db.doc(`designacoes_links/${share.id}`).get()).data();
  for (const cli of clients) {
    for (const collection of [
      "designacoes_links",
      "acessos_designacao",
      "contatos_publicadores",
      "indice_contatos_telefone",
      "requisicoes_designacoes",
      "cartoes_territorios",
      "cartoes_por_grupo",
      "codigos_ativos",
      "historico_codigos",
      "controle_codigos",
    ]) {
      const id =
        collection === "designacoes_links"
          ? share.id
          : collection === "contatos_publicadores"
            ? d.contatoId
            : "qualquer";
      await denied(() => getDoc(doc(cli.db, collection, id)));
      await denied(() =>
        setDoc(doc(cli.db, collection, "intruso"), { teste: true }),
      );
    }
    if (cli !== a)
      await denied(() => getDoc(doc(cli.db, "configuracoes", "designacoes")));
    await denied(() =>
      updateDoc(doc(cli.db, "configuracoes", "designacoes"), {
        prazoDevolucaoAutomaticaDias: 0,
      }),
    );
    await denied(() =>
      updateDoc(doc(cli.db, "grupos_enderecos", group), {
        enderecos_visitados: [e1],
      }),
    );
    await denied(() => deleteDoc(doc(cli.db, "enderecos", e1)));
    await denied(() =>
      updateDoc(doc(cli.db, "enderecos", e1), { grupoId: null }),
    );
  }
  await denied(() => getDoc(doc(anon.db, "grupos_enderecos", group)));
  await denied(() => getDoc(doc(anon.db, "enderecos", e1)));
  // Real Firestore transactions must serialize competing progress updates.
  const competing = await Promise.all([
    http("/public/endereco", token, {
      enderecoId: e1,
      pregado: true,
      composicaoVersao: 1,
      progressoVersao: 0,
    }),
    http("/public/endereco", token, {
      enderecoId: e2,
      pregado: true,
      composicaoVersao: 1,
      progressoVersao: 0,
    }),
  ]);
  check(
    competing.filter((x) => x.status === 200).length === 1 &&
      competing.filter((x) => x.status === 409).length === 1,
    `Concorrência entre abas: ${JSON.stringify(competing.map((x) => ({ status: x.status, error: x.body.error })))}`,
  );
  r = await http("/public/territorio", token);
  const progress = r.body;
  r = await http("/public/devolver", token, {
    composicaoVersao: 1,
    progressoVersao: progress.progressoVersao,
  });
  check(r.status === 200, "Devolução parcial");
  check(
    (await db.doc(`grupos_enderecos/${group}`).get()).data().ultimaConclusao ===
      undefined,
    "Parcial não conta cobertura",
  );
  r = await http("/admin/designacoes", a.token, {
    requestId: "emulator-r2",
    grupoId: group,
    contatoId: d.contatoId,
  });
  check(r.status === 200, "Retomada por contato");
  const second = r.body;
  const secondToken = (await http("/public/acessar-cartao", null, {cartaoId:second.cartaoId,codigo:second.codigoAcesso})).body.token;
  check(
    (await http("/public/territorio", secondToken)).body.herdados.length === 1,
    "Retomada identifica progresso herdado",
  );
  check(
    (await http("/public/territorio", token)).body.enderecos === undefined,
    "Sessão anterior encerrada sem endereços",
  );
  // Automatic return and manual completion race at the deadline: only expiry can win.
  now = new Date("2026-10-22T12:00:00Z");
  const race = await Promise.allSettled([
    service.expirar(),
    http("/public/concluir", secondToken, {
      modoConclusao: "declaracao",
      confirmarCobertura: true,
      dataCobertura: "2026-10-22",
      composicaoVersao: 1,
      progressoVersao: 0,
    }),
  ]);
  check(
    race[0].status === "fulfilled",
    `Rotina confirma vencimento: ${race[0].reason}`,
  );
  const result = race[1].value;
  check(
    result.status === 403 || result.status === 410 ||
      result.body.comprovante?.resultado === "prazo_expirado",
    "Conclusão não passa do prazo",
  );
  await service.expirar();
  const notifications = await db
    .collection("notificacoes")
    .where("designacaoId", "==", second.id)
    .get();
  check(notifications.size === 1, "Notificação de vencimento única");
  const notice = notifications.docs[0];
  await getDoc(doc(a.db, "notificacoes", notice.id));
  assertions++;
  await denied(() => getDoc(doc(c.db, "notificacoes", notice.id)));
  const segundoAdmin = await client("admin-b");
  await updateDoc(doc(a.db, "notificacoes", notice.id), {
    lidaPor: arrayUnion("designacoes-admin@example.test"),
  });
  const avisoSegundo = await getDoc(
    doc(segundoAdmin.db, "notificacoes", notice.id),
  );
  check(
    !avisoSegundo.data().lidaPor.includes("designacoes-admin-b@example.test"),
    "Leitura de um administrador não lê para o outro",
  );
  const waits = [];
  await handler.scheduled({ cron: "*/15 * * * *" }, env, {
    waitUntil: (promise) => waits.push(promise),
  });
  await Promise.all(waits);
  check(
    (
      await db
        .collection("notificacoes")
        .where("designacaoId", "==", second.id)
        .get()
    ).size === 1,
    "Handler agendado também é idempotente",
  );
  const g = (await db.doc(`grupos_enderecos/${group}`).get()).data();
  check(
    g.status === "ativo" &&
      g.enderecos_visitados.length === 1 &&
      !g.ultimaConclusao,
    "Vencimento libera preservando pendências sem cobertura",
  );
  // Two new creations for the same territory cannot overlap silently.
  const creations = await Promise.all([
    http("/admin/designacoes", a.token, {
      requestId: "race-1",
      grupoId: group,
      contatoId: d.contatoId,
    }),
    http("/admin/designacoes", a.token, {
      requestId: "race-2",
      grupoId: group,
      contatoId: d.contatoId,
    }),
  ]);
  check(
    creations.filter((x) => x.status === 200).length === 1 &&
      creations.filter((x) => x.status === 409).length === 1,
    `Concorrência designação: ${JSON.stringify(creations.map((x) => ({ status: x.status, error: x.body.error })))}`,
  );
  const telefonesConcorrentes = await Promise.all([
    http("/admin/contatos", a.token, {
      nome: "Pessoa A",
      telefone: "+5547999995678",
    }),
    http("/admin/contatos", a.token, {
      nome: "Pessoa B",
      telefone: "(47) 99999-5678",
    }),
  ]);
  check(
    telefonesConcorrentes.filter((r) => r.status === 200).length === 1 &&
      telefonesConcorrentes.filter((r) => r.status === 409).length === 1,
    "Unicidade transacional do celular entre duas pessoas",
  );
  await db
    .doc("usuarios/designacoes-admin@example.test")
    .update({ role: "comum" });
  check(
    (await http("/admin/configuracao", a.token)).status === 403,
    "Papel atual verificado após token emitido",
  );
  console.log(
    `Designações: ${assertions} verificações passaram (API REST, Auth, Rules, transações e relógio local).`,
  );
} finally {
  await Promise.all(
    clients.map(async (c) => {
      await terminate(c.db);
      await deleteApp(c.app);
    }),
  );
  await db.terminate();
}
