#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { cert, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      throw new Error(`Argumento inesperado: ${token}`);
    }

    const key = token.slice(2);

    if (['seed-territories', 'normalize-names', 'dry-run'].includes(key)) {
      args[key] = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Informe um valor para --${key}.`);
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/bootstrap-firestore-instance.cjs --service-account ./territ-gc-firebase-adminsdk-xxx.json
  node scripts/bootstrap-firestore-instance.cjs --service-account ./territ-gc-firebase-adminsdk-xxx.json --admin-email email@gmail.com --admin-name "Nome"
  node scripts/bootstrap-firestore-instance.cjs --service-account ./territ-gc-firebase-adminsdk-xxx.json --map ./public/mapa.general.json --seed-territories
  node scripts/bootstrap-firestore-instance.cjs --service-account ./territ-gc-firebase-adminsdk-xxx.json --map ./public/mapa.general.json --normalize-names

Opcoes:
  --service-account <arquivo>   JSON da service account do Firebase.
  --admin-email <email>         Opcional. Cria/atualiza usuario admin inicial.
  --admin-name <nome>           Opcional. Nome do admin inicial.
  --map <arquivo>               Opcional. GeoJSON do mapa da instancia.
  --seed-territories            Opcional. Cria documentos em territorios a partir do mapa.
  --normalize-names             Opcional. Alinha o campo nome em territorios e territorios_contexto com o mapa.
  --dry-run                     Mostra o que faria sem gravar.
`);
}

function resolvePath(projectRoot, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(projectRoot, value);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitizeTerritorioNome(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTerritorioNome(value, fallback = '') {
  const nome = sanitizeTerritorioNome(value);
  if (!nome) return sanitizeTerritorioNome(fallback);

  let match = nome.match(/^([A-Za-z]+\d+[A-Za-z]?)\s*-\s*(.+)$/u);
  if (!match) {
    match = nome.match(/^([A-Za-z]+\d+[A-Za-z]?)\s+(.+)$/u);
  }

  if (match) {
    const codigo = sanitizeTerritorioNome(match[1]);
    const descricao = sanitizeTerritorioNome(match[2]);
    return descricao ? `${codigo} - ${descricao}` : codigo;
  }

  return nome;
}

function getTerritorioNumeroFromDocId(docId) {
  const match = String(docId || '').match(/t_(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getDefaultSistemaConfig() {
  return {
    contextoAtivoId: 'normal',
    contextoAtivoTipo: 'normal',
    contextoAtivoTitulo: 'Pregação normal',
    contextoAtivoCor: 'blue',
    campanhaAtiva: false
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function batchSet(db, writes, dryRun) {
  if (dryRun) return;

  for (let start = 0; start < writes.length; start += 450) {
    const batch = db.batch();
    for (const write of writes.slice(start, start + 450)) {
      batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
  }
}

function buildMapNameIndex(mapData) {
  const map = new Map();
  const features = Array.isArray(mapData?.features) ? mapData.features : [];

  for (const feature of features) {
    const id = Number(feature?.properties?.id);
    if (!Number.isFinite(id)) continue;
    map.set(id, normalizeTerritorioNome(feature?.properties?.nome, `Território ${id}`));
  }

  return map;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args['service-account']) {
    printHelp();
    throw new Error('Informe --service-account.');
  }

  const serviceAccountPath = resolvePath(projectRoot, args['service-account']);
  const serviceAccount = loadJson(serviceAccountPath);
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  const db = getFirestore(app);
  const dryRun = Boolean(args['dry-run']);
  const writes = [];
  const mapPath = resolvePath(projectRoot, args.map || './public/mapa.general.json');
  const needsMapData = Boolean(args['seed-territories'] || args['normalize-names']);
  const mapData = needsMapData ? loadJson(mapPath) : null;
  const mapNameIndex = needsMapData ? buildMapNameIndex(mapData) : new Map();

  writes.push({
    ref: db.doc('configuracoes/sistema'),
    data: {
      ...getDefaultSistemaConfig(),
      atualizadoEm: FieldValue.serverTimestamp()
    }
  });

  const adminEmail = normalizeEmail(args['admin-email']);
  if (adminEmail) {
    writes.push({
      ref: db.doc(`usuarios/${adminEmail}`),
      data: {
        role: 'admin',
        nome: args['admin-name'] || adminEmail.split('@')[0],
        emailOriginal: args['admin-email'],
        whatsapp: '',
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp()
      }
    });
  }

  if (args['seed-territories']) {
    const features = Array.isArray(mapData.features) ? mapData.features : [];

    for (const feature of features) {
      const id = feature.properties?.id;
      if (id === undefined || id === null || id === '') continue;

      const nome = normalizeTerritorioNome(feature.properties?.nome, `Território ${id}`);
      writes.push({
        ref: db.doc(`territorios/t_${id}`),
        data: {
          nome,
          status: 'aberto',
          quadras_feitas: [],
          notas_quadras: {},
          criadoEm: FieldValue.serverTimestamp(),
          atualizadoEm: FieldValue.serverTimestamp()
        }
      });
    }
  }

  if (args['normalize-names']) {
    const territoriosSnapshot = await db.collection('territorios').get();
    territoriosSnapshot.forEach((docSnapshot) => {
      const numeroId = getTerritorioNumeroFromDocId(docSnapshot.id);
      if (!numeroId) return;

      const nomeAtual = docSnapshot.data()?.nome;
      const nomeNormalizado = mapNameIndex.get(numeroId) || normalizeTerritorioNome(nomeAtual, `Território ${numeroId}`);
      if (!nomeNormalizado || nomeAtual === nomeNormalizado) return;

      writes.push({
        ref: docSnapshot.ref,
        data: {
          nome: nomeNormalizado,
          atualizadoEm: FieldValue.serverTimestamp()
        }
      });
    });

    const territoriosContextoSnapshot = await db.collection('territorios_contexto').get();
    territoriosContextoSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() || {};
      const numeroId = Number(data.territorioNumero) || getTerritorioNumeroFromDocId(data.territorioBaseId || docSnapshot.id);
      if (!numeroId) return;

      const nomeAtual = data.nome;
      const nomeNormalizado = mapNameIndex.get(numeroId) || normalizeTerritorioNome(nomeAtual, `Território ${numeroId}`);
      if (!nomeNormalizado || nomeAtual === nomeNormalizado) return;

      writes.push({
        ref: docSnapshot.ref,
        data: {
          nome: nomeNormalizado,
          atualizadoEm: FieldValue.serverTimestamp()
        }
      });
    });
  }

  console.log(`Projeto Firebase: ${serviceAccount.project_id}`);
  console.log(`Dry run: ${dryRun ? 'sim' : 'nao'}`);
  console.log(`Config sistema: 1`);
  console.log(`Admin inicial: ${adminEmail || 'nao informado'}`);
  console.log(`Mapa carregado: ${needsMapData ? mapPath : 'nao'}`);
  console.log(`Escritas planejadas: ${writes.length}`);

  await batchSet(db, writes, dryRun);

  console.log('Bootstrap concluido.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
