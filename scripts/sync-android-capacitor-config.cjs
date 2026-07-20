#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const rootConfigPath = path.join(projectRoot, 'capacitor.config.json');
const nativeConfigPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
const instancePropertiesPath = path.join(projectRoot, 'android', 'app', 'territorios-instance.properties');

function readProperties(filePath) {
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
}

const instanceProps = readProperties(instancePropertiesPath);
const appId = instanceProps.applicationId || 'br.com.territoriospalmas.app';
const appName = instanceProps.appName || 'Territórios Palmas';
const instance = instanceProps.instance || 'palmas';

if (!fs.existsSync(rootConfigPath)) {
  console.error(`Config Capacitor nao encontrada em: ${rootConfigPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
config.appId = appId;
config.appName = appName;

fs.mkdirSync(path.dirname(nativeConfigPath), { recursive: true });
fs.writeFileSync(nativeConfigPath, `${JSON.stringify(config, null, '\t')}\n`);

console.log(`Capacitor Android config sincronizada: ${instance}`);
console.log(`App ID: ${appId}`);
console.log(`App name: ${appName}`);
