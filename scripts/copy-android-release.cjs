const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'android-release');
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
const artifacts = [
  {
    label: 'APK',
    source: path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    target: path.join(outputDir, `territorios-${artifactInstance}-release.apk`),
  },
  {
    label: 'AAB',
    source: path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
    target: path.join(outputDir, `territorios-${artifactInstance}-release.aab`),
  },
];

fs.mkdirSync(outputDir, { recursive: true });

for (const artifact of artifacts) {
  if (!fs.existsSync(artifact.source)) {
    console.error(`${artifact.label} nao encontrado em: ${artifact.source}`);
    process.exit(1);
  }

  fs.copyFileSync(artifact.source, artifact.target);
  const stats = fs.statSync(artifact.target);
  console.log(`${artifact.label} copiado para: ${artifact.target}`);
  console.log(`Tamanho: ${stats.size} bytes`);
}
