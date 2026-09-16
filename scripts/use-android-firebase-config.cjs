#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const instance = process.argv[2];

if (!instance) {
  console.error('Informe a instancia. Ex.: node scripts/use-android-firebase-config.cjs idiomas');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/i.test(instance)) {
  console.error(`Nome de instancia invalido: ${instance}`);
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const androidAppDir = path.join(projectRoot, 'android', 'app');
const sourceCandidates = [
  path.join(androidAppDir, `google-services.${instance}.json`),
  path.join(androidAppDir, `google-services-${instance}.json`)
];
const sourcePath = sourceCandidates.find((candidate) => fs.existsSync(candidate));
const targetPath = path.join(androidAppDir, 'google-services.json');
const instancePropertiesPath = path.join(androidAppDir, 'territorios-instance.properties');
const instanceEnvPath = path.join(projectRoot, `.env.${instance}`);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const result = {};

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    result[key] = value;
  }

  return result;
}

let sourceConfig;

if (sourcePath) {
  try {
    sourceConfig = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (error) {
    console.error(`JSON invalido em ${path.relative(projectRoot, sourcePath)}: ${error.message}`);
    process.exit(1);
  }

  fs.copyFileSync(sourcePath, targetPath);
} else {
  fs.rmSync(targetPath, { force: true });
}

const instanceLabel = instance
  .split('-')
  .filter(Boolean)
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join(' ');

const appName = instance === 'idiomas'
  ? 'Territórios Idiomas'
  : `Territórios ${instanceLabel}`;
const baseEnv = readEnvFile(path.join(projectRoot, '.env'));
const instanceEnv = { ...baseEnv, ...readEnvFile(instanceEnvPath) };
const projectId = sourceConfig?.project_info?.project_id || instanceEnv.VITE_FIREBASE_PROJECT_ID || 'projeto desconhecido';
const packageName = sourceConfig?.client?.[0]?.client_info?.android_client_info?.package_name || 'br.com.territoriosidiomas.app';
const publicAppUrl = instanceEnv.VITE_PUBLIC_APP_URL || '';
const authDomain = instanceEnv.VITE_FIREBASE_AUTH_DOMAIN || '';

if (sourceConfig && !sourceConfig.client?.[0]?.client_info?.android_client_info?.package_name) {
  console.error(`Nao foi possivel encontrar client[0].client_info.android_client_info.package_name em ${path.relative(projectRoot, sourcePath)}`);
  process.exit(1);
}

fs.writeFileSync(
  instancePropertiesPath,
  [
    `instance=${instance}`,
    `applicationId=${packageName}`,
    `appName=${appName}`,
    `firebaseProjectId=${projectId}`,
    `publicAppUrl=${publicAppUrl}`,
    `authDomain=${authDomain}`,
    ''
  ].join('\n')
);

console.log(`Android Firebase selecionado: ${instance}`);
console.log(`Projeto Firebase: ${projectId}`);
console.log(`Application ID: ${packageName}`);
if (sourcePath) {
  console.log(`Arquivo ativo: ${path.relative(projectRoot, targetPath)}`);
} else {
  console.log('google-services.json nao encontrado; build Android seguira sem aplicar o plugin Google Services.');
  console.log(`Para ativar Firebase/FCM nativo, salve o arquivo oficial como android/app/google-services.${instance}.json`);
}
