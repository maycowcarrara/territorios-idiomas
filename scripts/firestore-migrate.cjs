#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  applicationDefault,
  cert,
  deleteApp,
  getApps,
  initializeApp
} = require('firebase-admin/app');
const {
  DocumentReference,
  GeoPoint,
  Timestamp,
  getFirestore
} = require('firebase-admin/firestore');

const WRITE_BATCH_LIMIT = 450;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command, collections: [] };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith('--')) {
      throw new Error(`Argumento inesperado: ${token}`);
    }

    const key = token.slice(2);
    const next = rest[index + 1];

    if (['merge', 'dry-run'].includes(key)) {
      args[key] = true;
      continue;
    }

    if (!next || next.startsWith('--')) {
      throw new Error(`Informe um valor para --${key}.`);
    }

    args[key] = next;
    index += 1;
  }

  if (args.collections && typeof args.collections === 'string') {
    args.collections = args.collections
      .split(',')
      .map((collection) => collection.trim())
      .filter(Boolean);
  }

  return args;
}

function printHelp() {
  console.log(`
Uso:
  npm run firestore:export -- --service-account ./service-account-old.json --out ./firestore-backups/firestore-export.json
  npm run firestore:import -- --service-account ./service-account-new.json --in ./firestore-backups/firestore-export.json
  node scripts/firestore-migrate.cjs count --service-account ./service-account-new.json

Opcoes:
  --service-account <arquivo>   JSON da service account do projeto Firebase.
  --project-id <id>             Opcional. Sobrescreve o project_id do JSON.
  --out <arquivo>               Arquivo de saida no modo export.
  --in <arquivo>                Arquivo de entrada no modo import.
  --collections <lista>         Opcional. Ex.: usuarios,territorios,campanhas
  --merge                       No import, mescla campos em documentos existentes.
  --dry-run                     No import, valida e mostra contagem sem gravar.

Tambem funciona com GOOGLE_APPLICATION_CREDENTIALS se --service-account nao for informado.
`);
}

function loadCredential(serviceAccountPath) {
  if (!serviceAccountPath) {
    return {
      credential: applicationDefault(),
      projectId: null
    };
  }

  const resolvedPath = path.resolve(serviceAccountPath);
  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  return {
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || null
  };
}

function initializeFirestore({ serviceAccount, projectId }) {
  const credentialConfig = loadCredential(serviceAccount);
  const app = initializeApp({
    credential: credentialConfig.credential,
    projectId: projectId || credentialConfig.projectId || undefined
  }, `migration-${Date.now()}`);

  return {
    app,
    db: getFirestore(app)
  };
}

function serializeValue(value) {
  if (value === null) return null;
  if (value === undefined) return { __firestoreType: 'undefined' };

  if (value instanceof Timestamp) {
    return {
      __firestoreType: 'timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds
    };
  }

  if (value instanceof GeoPoint) {
    return {
      __firestoreType: 'geoPoint',
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  if (value instanceof DocumentReference) {
    return {
      __firestoreType: 'documentReference',
      path: value.path
    };
  }

  if (value && typeof value.toBase64 === 'function') {
    return {
      __firestoreType: 'bytes',
      base64: value.toBase64()
    };
  }

  if (value instanceof Date) {
    return {
      __firestoreType: 'timestamp',
      seconds: Math.floor(value.getTime() / 1000),
      nanoseconds: (value.getTime() % 1000) * 1000000
    };
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {
      __firestoreType: 'bytes',
      base64: Buffer.from(value).toString('base64')
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, serializeValue(nestedValue)])
    );
  }

  return value;
}

function deserializeValue(value, db) {
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item, db));
  }

  switch (value.__firestoreType) {
    case 'timestamp':
      return new Timestamp(value.seconds, value.nanoseconds || 0);
    case 'geoPoint':
      return new GeoPoint(value.latitude, value.longitude);
    case 'documentReference':
      return db.doc(value.path);
    case 'bytes':
      return Buffer.from(value.base64, 'base64');
    case 'undefined':
      return undefined;
    default:
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== '__firestoreType')
          .map(([key, nestedValue]) => [key, deserializeValue(nestedValue, db)])
          .filter(([, nestedValue]) => nestedValue !== undefined)
      );
  }
}

async function exportDocument(documentSnapshot, output) {
  output.documents.push({
    path: documentSnapshot.ref.path,
    data: serializeValue(documentSnapshot.data() || {})
  });

  const subcollections = await documentSnapshot.ref.listCollections();
  for (const subcollection of subcollections) {
    await exportCollection(subcollection, output);
  }
}

async function exportCollection(collectionRef, output) {
  const snapshot = await collectionRef.get();

  for (const documentSnapshot of snapshot.docs) {
    await exportDocument(documentSnapshot, output);
  }
}

async function exportFirestore(args) {
  if (!args.out) {
    throw new Error('Informe --out no modo export.');
  }

  const { app, db } = initializeFirestore({
    serviceAccount: args['service-account'],
    projectId: args['project-id']
  });

  try {
    const collections = args.collections.length
      ? args.collections.map((collectionId) => db.collection(collectionId))
      : await db.listCollections();

    const output = {
      exportedAt: new Date().toISOString(),
      projectId: app.options.projectId || null,
      documentCount: 0,
      rootCollections: collections.map((collectionRef) => collectionRef.id),
      documents: []
    };

    for (const collectionRef of collections) {
      console.log(`Exportando colecao ${collectionRef.id}...`);
      await exportCollection(collectionRef, output);
    }

    output.documentCount = output.documents.length;

    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

    console.log(`Export concluido: ${output.documentCount} documentos em ${outPath}`);
  } finally {
    await deleteApp(app);
  }
}

async function commitBatch(batch, dryRun, pendingCount) {
  if (pendingCount === 0) return;

  if (dryRun) {
    return;
  }

  await batch.commit();
}

async function importFirestore(args) {
  if (!args.in) {
    throw new Error('Informe --in no modo import.');
  }

  const inputPath = path.resolve(args.in);
  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  if (!Array.isArray(payload.documents)) {
    throw new Error('Arquivo invalido: campo "documents" nao encontrado.');
  }

  const selectedCollections = new Set(args.collections || []);
  const documents = selectedCollections.size
    ? payload.documents.filter((document) => selectedCollections.has(document.path.split('/')[0]))
    : payload.documents;

  const { app, db } = initializeFirestore({
    serviceAccount: args['service-account'],
    projectId: args['project-id']
  });

  try {
    let batch = db.batch();
    let pendingCount = 0;
    let writtenCount = 0;

    for (const document of documents) {
      const ref = db.doc(document.path);
      const data = deserializeValue(document.data || {}, db);

      if (!args['dry-run']) {
        batch.set(ref, data, { merge: Boolean(args.merge) });
      }

      pendingCount += 1;
      writtenCount += 1;

      if (pendingCount >= WRITE_BATCH_LIMIT) {
        await commitBatch(batch, args['dry-run'], pendingCount);
        console.log(`${args['dry-run'] ? 'Validado' : 'Importado'} ${writtenCount}/${documents.length}...`);
        batch = db.batch();
        pendingCount = 0;
      }
    }

    await commitBatch(batch, args['dry-run'], pendingCount);

    const action = args['dry-run'] ? 'validaria' : 'importou';
    console.log(`Import ${args['dry-run'] ? 'dry-run' : 'concluido'}: ${action} ${writtenCount} documentos em ${app.options.projectId || 'projeto informado'}.`);
  } finally {
    await deleteApp(app);
  }
}

async function countFirestore(args) {
  const { app, db } = initializeFirestore({
    serviceAccount: args['service-account'],
    projectId: args['project-id']
  });

  try {
    const collections = args.collections.length
      ? args.collections.map((collectionId) => db.collection(collectionId))
      : await db.listCollections();

    let total = 0;

    for (const collectionRef of collections) {
      const snapshot = await collectionRef.get();
      total += snapshot.size;
      console.log(`${collectionRef.id}: ${snapshot.size}`);
    }

    console.log(`Total em ${app.options.projectId || 'projeto informado'}: ${total} documentos nas colecoes raiz.`);
  } finally {
    await deleteApp(app);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command || ['help', '--help', '-h'].includes(args.command)) {
    printHelp();
    return;
  }

  if (!['export', 'import', 'count'].includes(args.command)) {
    throw new Error(`Comando invalido: ${args.command}`);
  }

  if (getApps().length > 0) {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  }

  if (args.command === 'export') {
    await exportFirestore(args);
    return;
  }

  if (args.command === 'import') {
    await importFirestore(args);
    return;
  }

  await countFirestore(args);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
