const fs = require('node:fs');
const path = require('node:path');
const { cert, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const projectRoot = path.resolve(__dirname, '..');
const defaultServiceAccount = path.join(projectRoot, 'territ-es-sul-sbs-firebase-adminsdk-fbsvc-a0713f9437.json');
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultServiceAccount;

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account não encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = getFirestore();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const getGrupoDesignadoPara = (grupo) => {
  const status = grupo.status || 'ativo';
  if (status !== 'ativo') return null;
  return normalizeEmail(grupo.designadoPara) || null;
};

const commitBatches = async (updates) => {
  let batch = db.batch();
  let count = 0;
  let committed = 0;

  for (const update of updates) {
    batch.set(update.ref, update.data, { merge: true });
    count += 1;

    if (count >= 400) {
      await batch.commit();
      committed += count;
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    committed += count;
  }

  return committed;
};

const main = async () => {
  const gruposSnapshot = await db.collection('grupos_enderecos').get();
  const enderecosSnapshot = await db.collection('enderecos').get();
  const valorPorEndereco = new Map();

  gruposSnapshot.forEach((grupoDoc) => {
    const grupo = grupoDoc.data();
    const grupoDesignadoPara = getGrupoDesignadoPara(grupo);
    const enderecoIds = Array.isArray(grupo.enderecoIds) ? grupo.enderecoIds : [];
    enderecoIds.filter(Boolean).forEach((enderecoId) => {
      valorPorEndereco.set(enderecoId, grupoDesignadoPara);
    });
  });

  const updates = [];
  enderecosSnapshot.forEach((enderecoDoc) => {
    const endereco = enderecoDoc.data();
    const esperado = valorPorEndereco.has(enderecoDoc.id) ? valorPorEndereco.get(enderecoDoc.id) : null;
    const atual = endereco.grupoDesignadoPara === undefined ? null : endereco.grupoDesignadoPara;
    if (atual === esperado) return;

    updates.push({
      ref: enderecoDoc.ref,
      data: {
        grupoDesignadoPara: esperado,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: 'backfill-grupo-designado-para'
      }
    });
  });

  console.log(JSON.stringify({
    projectId: serviceAccount.project_id,
    apply,
    grupos: gruposSnapshot.size,
    enderecos: enderecosSnapshot.size,
    updates: updates.length
  }, null, 2));

  if (!apply || updates.length === 0) return;

  const committed = await commitBatches(updates);
  console.log(`Backfill aplicado em ${committed} endereços.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
