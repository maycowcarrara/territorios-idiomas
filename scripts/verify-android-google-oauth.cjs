const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const androidAppDir = path.join(projectRoot, 'android', 'app');
const googleServicesPath = path.join(androidAppDir, 'google-services.json');
const keyPropertiesPath = path.join(projectRoot, 'android', 'key.properties');
const instancePropertiesPath = path.join(androidAppDir, 'territorios-instance.properties');

const normalizeSha = (value) => String(value || '').replace(/:/g, '').trim().toLowerCase();

const readProperties = (filePath) => {
  const props = {};
  if (!fs.existsSync(filePath)) return props;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    props[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return props;
};

const extractFingerprints = ({ keystore, alias, storepass, keypass }) => {
  const args = ['-list', '-v', '-keystore', keystore, '-alias', alias, '-storepass', storepass];
  if (keypass) args.push('-keypass', keypass);

  const output = execFileSync('keytool', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const sha1 = output.match(/SHA1:\s*([A-Fa-f0-9:]+)/)?.[1];
  const sha256 = output.match(/SHA256:\s*([A-Fa-f0-9:]+)/)?.[1];

  if (!sha1 || !sha256) {
    throw new Error(`Nao foi possivel encontrar SHA1/SHA256 para ${keystore} (${alias}).`);
  }

  return { sha1, sha256 };
};

const loadRegisteredAndroidSha1 = () => {
  if (!fs.existsSync(googleServicesPath)) {
    throw new Error(`Arquivo ausente: ${path.relative(projectRoot, googleServicesPath)}`);
  }

  const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
  const clients = Array.isArray(googleServices.client) ? googleServices.client : [];
  const hashes = [];
  const packageNames = new Set();

  for (const client of clients) {
    const packageName = client.client_info?.android_client_info?.package_name;
    if (packageName) packageNames.add(packageName);

    const oauthClients = Array.isArray(client.oauth_client) ? client.oauth_client : [];

    for (const oauthClient of oauthClients) {
      if (oauthClient.client_type !== 1) continue;

      const hash = oauthClient.android_info?.certificate_hash;
      if (hash) hashes.push(hash);
    }
  }

  return {
    hasAndroidOauthClients: hashes.length > 0,
    hashes,
    packageName: [...packageNames][0] || 'desconhecido'
  };
};

const loadEnvFile = (mode) => {
  const envPath = path.join(projectRoot, `.env.${mode}`);
  return readProperties(envPath);
};

const expected = [
  {
    label: 'debug',
    ...extractFingerprints({
      keystore: path.join(androidAppDir, 'debug-territorios.keystore'),
      alias: 'territoriosdebug',
      storepass: 'territoriosdebug',
      keypass: 'territoriosdebug'
    })
  }
];

const releaseProps = readProperties(keyPropertiesPath);

if (releaseProps.storeFile && releaseProps.keyAlias && releaseProps.storePassword) {
  expected.push({
    label: 'release',
    ...extractFingerprints({
      keystore: path.resolve(androidAppDir, releaseProps.storeFile),
      alias: releaseProps.keyAlias,
      storepass: releaseProps.storePassword,
      keypass: releaseProps.keyPassword
    })
  });
}

const registered = loadRegisteredAndroidSha1();
const registeredNormalized = new Set(registered.hashes.map(normalizeSha));
const missing = expected.filter((item) => !registeredNormalized.has(normalizeSha(item.sha1)));
const activeInstance = readProperties(instancePropertiesPath).instance || null;
const env = activeInstance ? loadEnvFile(activeInstance) : {};
const googleWebClientId = env.VITE_GOOGLE_WEB_CLIENT_ID || env.VITE_GOOGLE_ANDROID_WEB_CLIENT_ID || '';

if (!googleWebClientId) {
  console.error('Google Sign-In nativo Android ainda nao tem Web Client ID configurado.');
  console.error('');
  if (activeInstance) {
    console.error(`Preencha VITE_GOOGLE_WEB_CLIENT_ID em .env.${activeInstance}.`);
  } else {
    console.error('Preencha VITE_GOOGLE_WEB_CLIENT_ID no arquivo .env da instancia ativa.');
  }
  console.error('');
  console.error('Use o Client ID de OAuth 2.0 do tipo "Web application" do mesmo projeto Firebase/Google Cloud.');
  console.error(`Package name Android ativo: ${registered.packageName}`);
  process.exit(1);
}

if (registered.hasAndroidOauthClients && missing.length > 0) {
  console.error('Google Sign-In Android nao esta configurado para todas as assinaturas deste projeto.');
  console.error('');
  console.error('Cadastre estes SHA-1 no app Android do Firebase/Google Cloud e baixe um novo android/app/google-services.json:');

  for (const item of missing) {
    console.error(`- ${item.label}: ${item.sha1}`);
  }

  console.error('');
  console.error(`Package name esperado: ${registered.packageName}`);
  process.exit(1);
}

console.log('Google Sign-In Android: Web Client ID configurado.');
console.log(`Package name Android ativo: ${registered.packageName}`);

if (registered.hasAndroidOauthClients) {
  console.log('SHA-1 de debug/release encontrados no google-services.json.');
} else {
  console.log('');
  console.log('Aviso: o google-services.json nao trouxe oauth_client Android.');
  console.log('Como o Firebase Console mostra as SHA cadastradas, isso pode ser apenas formato do arquivo baixado.');
  console.log('Confira manualmente no Firebase Console se estas SHA-1/SHA-256 estao cadastradas no app Android ativo:');
}

console.log('');
for (const item of expected) {
  console.log(`- ${item.label} SHA-1: ${item.sha1}`);
  console.log(`- ${item.label} SHA-256: ${item.sha256}`);
}
