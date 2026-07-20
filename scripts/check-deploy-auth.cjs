#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const service = process.argv[2];
const instance = process.argv[3];
const rawArgs = process.argv.slice(4);

function fail(message, details = []) {
  console.error('');
  console.error(`[deploy-guard] ${message}`);
  details.filter(Boolean).forEach((detail) => console.error(detail));
  console.error('');
  process.exit(1);
}

function info(message) {
  console.log(`[deploy-guard] ${message}`);
}

function parseOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function run(command, args, cwd = projectRoot) {
  if (process.platform === 'win32') {
    const quote = (value) => {
      const text = String(value);
      if (/^[A-Za-z0-9_./:=\\-]+$/.test(text)) {
        return text;
      }

      return `"${text.replace(/"/g, '\\"')}"`;
    };

    return spawnSync([command, ...args].map(quote).join(' '), {
      cwd,
      encoding: 'utf8',
      shell: true
    });
  }

  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Nao foi possivel ler ${filePath}: ${error.message}`);
  }
}

function getFirebaserc() {
  return readJson(path.join(projectRoot, '.firebaserc'));
}

function getFirebaseProjectId(selectedInstance) {
  const firebaserc = getFirebaserc();
  const projectId = firebaserc.projects?.[selectedInstance];

  if (!projectId) {
    fail(`Instancia Firebase desconhecida: ${selectedInstance}`, [
      'Confira o bloco "projects" em .firebaserc.'
    ]);
  }

  return projectId;
}

function collectProjectIds(value, ids = new Set()) {
  if (!value || typeof value !== 'object') {
    return ids;
  }

  if (typeof value.projectId === 'string') {
    ids.add(value.projectId);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectProjectIds(item, ids));
    return ids;
  }

  Object.values(value).forEach((item) => collectProjectIds(item, ids));
  return ids;
}

function getFirebaseLoginSummary() {
  const result = run('firebase', ['login:list']);
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return output ? output.split(/\r?\n/).slice(0, 8).join('\n') : '';
}

function checkFirebase(selectedInstance) {
  const expectedProjectId = getFirebaseProjectId(selectedInstance);

  info(`Verificando Firebase para "${selectedInstance}" (${expectedProjectId})...`);

  const result = run('firebase', ['projects:list', '--json']);
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();

  if (result.error || result.status !== 0) {
    fail('Nao foi possivel validar a conta ativa do Firebase antes do deploy.', [
      result.error?.message,
      output,
      'Entre na conta correta e tente novamente:',
      '  firebase logout',
      '  firebase login'
    ]);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail('A resposta do Firebase CLI nao veio em JSON valido.', [
      error.message,
      output
    ]);
  }

  const projectIds = collectProjectIds(parsed);

  if (!projectIds.has(expectedProjectId)) {
    const loginSummary = getFirebaseLoginSummary();
    fail(`A conta ativa do Firebase nao tem acesso ao projeto esperado: ${expectedProjectId}`, [
      loginSummary ? `Login atual:\n${loginSummary}` : null,
      'Provavelmente voce esta logado na conta errada.',
      'Troque a conta e rode o deploy de novo:',
      '  firebase logout',
      '  firebase login'
    ]);
  }

  info(`Firebase OK: projeto ${expectedProjectId} acessivel pela conta atual.`);
}

function parseTomlString(contents, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm');
  return contents.match(pattern)?.[1] || '';
}

function getEnvKey(prefix, selectedInstance) {
  return `${prefix}_${selectedInstance.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

function getExpectedCloudflareAccountId(selectedInstance, configPath) {
  const envKeys = [
    getEnvKey('DEPLOY_GUARD_CF_ACCOUNT_ID', selectedInstance),
    getEnvKey('DEPLOY_GUARD_CLOUDFLARE_ACCOUNT_ID', selectedInstance)
  ];
  const fromEnv = envKeys.map((key) => process.env[key]).find(Boolean);

  if (fromEnv) {
    return fromEnv.trim();
  }

  const contents = fs.readFileSync(configPath, 'utf8');
  return parseTomlString(contents, 'account_id').trim();
}

function checkWrangler(selectedInstance, options) {
  const cwd = options.cwd
    ? path.resolve(process.cwd(), options.cwd)
    : path.join(projectRoot, 'workers/notifications-relay');
  const configPath = path.resolve(cwd, options.config || `wrangler.${selectedInstance}.toml`);

  if (!fs.existsSync(configPath)) {
    fail(`Config Wrangler nao encontrada: ${configPath}`);
  }

  const expectedAccountId = getExpectedCloudflareAccountId(selectedInstance, configPath);

  if (!expectedAccountId) {
    fail(`Nao ha account_id esperado para o Worker "${selectedInstance}".`, [
      'Sem account_id, o Wrangler pode publicar na conta Cloudflare que estiver logada.',
      `Adicione account_id no arquivo ${path.relative(projectRoot, configPath)} ou defina ${getEnvKey('DEPLOY_GUARD_CF_ACCOUNT_ID', selectedInstance)}.`,
      'Para descobrir o ID correto, entre na conta certa e rode:',
      '  npx wrangler whoami'
    ]);
  }

  info(`Verificando Wrangler para "${selectedInstance}" (${expectedAccountId})...`);

  const result = run('npx', ['wrangler', 'whoami'], cwd);
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();

  if (result.error || result.status !== 0) {
    fail('Nao foi possivel validar a conta ativa do Wrangler antes do deploy.', [
      result.error?.message,
      output,
      'Entre na conta correta e tente novamente:',
      '  npx wrangler logout',
      '  npx wrangler login'
    ]);
  }

  if (!output.includes(expectedAccountId)) {
    fail(`A conta ativa do Wrangler nao contem o account_id esperado: ${expectedAccountId}`, [
      output,
      'Provavelmente voce esta logado na conta Cloudflare errada.',
      'Troque a conta e rode o deploy de novo:',
      '  npx wrangler logout',
      '  npx wrangler login'
    ]);
  }

  info(`Wrangler OK: account_id ${expectedAccountId} encontrado na conta atual.`);
}

if (!service || !instance) {
  fail('Uso: node scripts/check-deploy-auth.cjs <firebase|wrangler> <instancia> [--config arquivo] [--cwd pasta]');
}

const options = parseOptions(rawArgs);

if (service === 'firebase') {
  checkFirebase(instance);
} else if (service === 'wrangler') {
  checkWrangler(instance, options);
} else {
  fail(`Servico nao suportado: ${service}`);
}
