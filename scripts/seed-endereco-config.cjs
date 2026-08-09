#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { applicationDefault, cert, deleteApp, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const DEFAULT_CONFIG = Object.freeze({
  idiomaPadraoId: 'es',
  idiomaPadraoNome: 'Espanhol',
  prefixoEnderecoPadrao: 'ES-SBS-',
  prefixoTerritorioPadrao: 'ES-SBS-T',
  classeEnderecoPadrao: 'confirmado',
  quantidadeEstrangeirosPadrao: 1,
  cidadePadrao: 'Sao Bento do Sul',
  ufPadrao: 'SC',
  idiomas: [
    {
      id: 'es',
      nome: 'Espanhol',
      codigoPrefixoEndereco: 'ES-SBS-',
      codigoPrefixoTerritorio: 'ES-SBS-T',
      ativo: true,
      ordem: 1
    }
  ],
  tiposEndereco: [
    { id: 'confirmado', label: 'Confirmado', statusPadrao: 'ativo', ordem: 1, ativo: true },
    { id: 'verificar', label: 'Verificar', statusPadrao: 'ativo', ordem: 2, ativo: true },
    { id: 'estudo', label: 'Estudo', statusPadrao: 'ativo', ordem: 3, ativo: true },
    { id: 'excluido', label: 'Excluido', statusPadrao: 'arquivado', ordem: 4, ativo: true }
  ]
});

function parseArgs(argv) {
  const args = { apply: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Argumento inesperado: ${token}`);
    }

    const key = token.slice(2);
    if (key === 'apply' || key === 'dry-run') {
      args[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Informe um valor para --${key}.`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
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

function normalizeText(value, fallback, maxLength = 120) {
  const text = String(value ?? '').trim().slice(0, maxLength);
  return text || fallback;
}

function normalizeConfig(input = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    idiomaPadraoId: normalizeText(input.idiomaPadraoId, DEFAULT_CONFIG.idiomaPadraoId, 32).toLowerCase(),
    idiomaPadraoNome: normalizeText(input.idiomaPadraoNome, DEFAULT_CONFIG.idiomaPadraoNome, 80),
    prefixoEnderecoPadrao: normalizeText(input.prefixoEnderecoPadrao, DEFAULT_CONFIG.prefixoEnderecoPadrao, 40).toUpperCase(),
    prefixoTerritorioPadrao: normalizeText(input.prefixoTerritorioPadrao, DEFAULT_CONFIG.prefixoTerritorioPadrao, 40).toUpperCase(),
    classeEnderecoPadrao: normalizeText(input.classeEnderecoPadrao, DEFAULT_CONFIG.classeEnderecoPadrao, 32).toLowerCase(),
    quantidadeEstrangeirosPadrao: Math.max(0, Math.min(99, Math.trunc(Number(input.quantidadeEstrangeirosPadrao ?? DEFAULT_CONFIG.quantidadeEstrangeirosPadrao)) || 0)),
    cidadePadrao: normalizeText(input.cidadePadrao, DEFAULT_CONFIG.cidadePadrao, 120),
    ufPadrao: normalizeText(input.ufPadrao, DEFAULT_CONFIG.ufPadrao, 2).toUpperCase(),
    idiomas: Array.isArray(input.idiomas) && input.idiomas.length ? input.idiomas : DEFAULT_CONFIG.idiomas,
    tiposEndereco: Array.isArray(input.tiposEndereco) && input.tiposEndereco.length ? input.tiposEndereco : DEFAULT_CONFIG.tiposEndereco
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credentialConfig = loadCredential(args['service-account']);
  const projectId = args['project-id'] || credentialConfig.projectId;

  if (!projectId) {
    throw new Error('Informe --project-id ou use uma service account com project_id.');
  }

  const app = initializeApp({
    credential: credentialConfig.credential,
    projectId
  }, `seed-endereco-config-${Date.now()}`);
  const db = getFirestore(app);
  const ref = db.doc('configuracoes/cadastros_enderecos');

  try {
    const snapshot = await ref.get();
    const config = normalizeConfig(snapshot.exists ? snapshot.data() : DEFAULT_CONFIG);
    const payload = {
      ...config,
      atualizadaEm: FieldValue.serverTimestamp()
    };

    console.log(`Projeto Firebase: ${projectId}`);
    console.log(`Documento: ${ref.path}`);
    console.log(`Existe: ${snapshot.exists ? 'sim' : 'nao'}`);
    console.log(`Apply: ${args.apply ? 'sim' : 'nao'}`);
    console.log(`Endereco sugerido: ${payload.prefixoEnderecoPadrao}001`);
    console.log(`Territorio sugerido: ${payload.prefixoTerritorioPadrao}01`);

    if (args.apply) {
      await ref.set(payload, { merge: true });
      console.log('Configuracao gravada com merge.');
    } else {
      console.log('Dry-run concluido. Use --apply para gravar.');
    }
  } finally {
    await deleteApp(app);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
