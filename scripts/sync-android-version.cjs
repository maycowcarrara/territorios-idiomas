const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packagePath = path.join(projectRoot, 'package.json');
const gradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const versionName = packageJson.version;
const versionParts = versionName.split('.');
const patchVersion = Number.parseInt(versionParts[versionParts.length - 1], 10);

if (!versionName || Number.isNaN(patchVersion)) {
  console.error(`Versao invalida no package.json: ${versionName}`);
  process.exit(1);
}

const gradleContent = fs.readFileSync(gradlePath, 'utf8');
const nextContent = gradleContent
  .replace(/versionCode\s+\d+/, `versionCode ${patchVersion}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (nextContent === gradleContent) {
  console.error('Nao foi possivel encontrar versionCode/versionName no build.gradle.');
  process.exit(1);
}

fs.writeFileSync(gradlePath, nextContent);

console.log(`Android versionCode atualizado para ${patchVersion}`);
console.log(`Android versionName atualizado para ${versionName}`);
