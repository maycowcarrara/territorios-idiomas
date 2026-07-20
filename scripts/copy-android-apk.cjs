const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceApk = path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
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

function getArtifactInstance() {
  const instance = readProperties(instancePropertiesPath).instance || 'palmas';
  return instance.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'palmas';
}

const artifactInstance = getArtifactInstance();
const targetApk = path.join(projectRoot, `territorios-${artifactInstance}-debug.apk`);

if (!fs.existsSync(sourceApk)) {
  console.error(`APK nao encontrada em: ${sourceApk}`);
  process.exit(1);
}

fs.copyFileSync(sourceApk, targetApk);
const stats = fs.statSync(targetApk);

console.log(`APK copiada para: ${targetApk}`);
console.log(`Tamanho: ${stats.size} bytes`);
