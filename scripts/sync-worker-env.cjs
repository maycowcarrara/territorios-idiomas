#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const instance = normalizeInstance(process.argv[2] || 'idiomas');
const options = parseOptions(process.argv.slice(3));
const cwd = options.cwd ? path.resolve(process.cwd(), options.cwd) : projectRoot;
const configPath = path.resolve(cwd, options.config || `workers/notifications-relay/wrangler.${instance}.toml`);

const workerVars = [
  {
    key: 'FIREBASE_PROJECT_ID',
    envKeys: ['FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID']
  },
  {
    key: 'PUBLIC_APP_URL',
    envKeys: ['PUBLIC_APP_URL', 'VITE_PUBLIC_APP_URL']
  },
  {
    key: 'EMAILJS_SERVICE_ID',
    envKeys: ['EMAILJS_SERVICE_ID']
  },
  {
    key: 'EMAILJS_PUBLIC_KEY',
    envKeys: ['EMAILJS_PUBLIC_KEY']
  },
  {
    key: 'EMAILJS_TEMPLATE_ID',
    envKeys: ['EMAILJS_TEMPLATE_ID']
  }
];

function fail(message) {
  console.error(`[worker-env] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[worker-env] ${message}`);
}

function normalizeInstance(value) {
  return String(value || 'idiomas')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'idiomas';
}

function parseOptions(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function unquoteEnvValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    values[match[1]] = unquoteEnvValue(match[2]);
  }

  return values;
}

function readMergedEnv() {
  const baseEnv = parseEnvFile(path.join(projectRoot, '.env'));
  const instanceEnv = parseEnvFile(path.join(projectRoot, `.env.${instance}`));
  return { ...baseEnv, ...instanceEnv };
}

function pickEnvValue(env, envKeys) {
  for (const envKey of envKeys) {
    const value = env[envKey];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function escapeTomlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function updateTomlVars(contents, values) {
  let updated = contents;
  const linesToInsert = [];

  for (const [key, value] of Object.entries(values)) {
    const line = `${key} = "${escapeTomlString(value)}"`;
    const pattern = new RegExp(`^(\\s*)${key}\\s*=\\s*"[^"]*"\\s*$`, 'm');

    if (pattern.test(updated)) {
      updated = updated.replace(pattern, `$1${line}`);
    } else {
      linesToInsert.push(line);
    }
  }

  if (!linesToInsert.length) {
    return updated;
  }

  const varsMatch = updated.match(/^\[vars\]\s*$/m);
  if (!varsMatch) {
    return `${updated.replace(/\s*$/, '')}\n\n[vars]\n${linesToInsert.join('\n')}\n`;
  }

  const insertAt = varsMatch.index + varsMatch[0].length;
  return `${updated.slice(0, insertAt)}\n${linesToInsert.join('\n')}${updated.slice(insertAt)}`;
}

if (!fs.existsSync(configPath)) {
  fail(`Config Wrangler nao encontrada: ${path.relative(projectRoot, configPath)}`);
}

const env = readMergedEnv();
const values = {};

for (const variable of workerVars) {
  const value = pickEnvValue(env, variable.envKeys);
  if (value) {
    values[variable.key] = value;
  }
}

if (!Object.keys(values).length) {
  fail(`Nenhuma variavel de Worker encontrada em .env ou .env.${instance}.`);
}

const original = fs.readFileSync(configPath, 'utf8');
const updated = updateTomlVars(original, values);
const normalizedUpdated = updated.endsWith('\n') ? updated : `${updated}\n`;

if (normalizedUpdated !== original) {
  fs.writeFileSync(configPath, normalizedUpdated);
  info(`Atualizado ${path.relative(projectRoot, configPath)} a partir de .env${fs.existsSync(path.join(projectRoot, `.env.${instance}`)) ? `/.env.${instance}` : ''}.`);
} else {
  info(`Sem mudancas em ${path.relative(projectRoot, configPath)}.`);
}
