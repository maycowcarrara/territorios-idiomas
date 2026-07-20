const { existsSync, readFileSync } = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const instancePropertiesPath = path.join(projectRoot, 'android', 'app', 'territorios-instance.properties');
const googleServicesPath = path.join(projectRoot, 'android', 'app', 'google-services.json');

function readProperties(filePath) {
  const props = {};
  if (!existsSync(filePath)) return props;

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    props[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return props;
}

function getActiveAppId() {
  const instanceProps = readProperties(instancePropertiesPath);
  if (instanceProps.applicationId) return instanceProps.applicationId;

  if (existsSync(googleServicesPath)) {
    const googleServices = JSON.parse(readFileSync(googleServicesPath, 'utf8'));
    const packageName = googleServices.client?.[0]?.client_info?.android_client_info?.package_name;
    if (packageName) return packageName;
  }

  return 'br.com.territoriospalmas.app';
}

function getActiveInstance() {
  const instance = readProperties(instancePropertiesPath).instance || 'palmas';
  return instance.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'palmas';
}

const appId = getActiveAppId();
const apkPath = path.join(projectRoot, `territorios-${getActiveInstance()}-debug.apk`);
const legacyApkPath = path.join(projectRoot, 'territorios-palmas-debug.apk');

const sdkRoots = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
  'C:\\Android\\Sdk'
].filter(Boolean);

function getSdkFromLocalProperties() {
  const localPropertiesPath = path.join(projectRoot, 'android', 'local.properties');
  if (!existsSync(localPropertiesPath)) return null;

  const content = readFileSync(localPropertiesPath, 'utf8');
  const match = content.match(/^sdk\.dir=(.+)$/m);
  if (!match) return null;

  return match[1]
    .trim()
    .replace(/\\\\/g, '\\')
    .replace(/\\:/g, ':');
}

function resolveAdbPath() {
  const allSdkRoots = [getSdkFromLocalProperties(), ...sdkRoots].filter(Boolean);

  for (const sdkRoot of allSdkRoots) {
    const adbPath = path.join(sdkRoot, 'platform-tools', 'adb.exe');
    if (existsSync(adbPath)) return adbPath;
  }

  throw new Error('ADB nao encontrado. Verifique o Android SDK ou o arquivo android/local.properties.');
}

function runAdb(args, options = {}) {
  return execFileSync(resolveAdbPath(), args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
}

function getConnectedDevices() {
  const output = runAdb(['devices'], { captureOutput: true });
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.endsWith('\tdevice'))
    .map((line) => line.split('\t')[0]);
}

function ensureApkExists() {
  if (!existsSync(apkPath)) {
    console.error(`APK nao encontrada em: ${apkPath}`);
    if (apkPath !== legacyApkPath && existsSync(legacyApkPath)) {
      console.error(`Existe uma APK antiga em: ${legacyApkPath}`);
    }
    console.error(`Rode primeiro: npm run android:debug:${getActiveInstance()}`);
    process.exit(1);
  }
}

function ensureDeviceConnected(devices) {
  if (!devices.length) {
    console.error('Nenhum dispositivo ou emulador Android conectado.');
    console.error('Use "npm run android:devices" para conferir quando conectar um aparelho.');
    process.exit(1);
  }
}

const args = new Set(process.argv.slice(2));
const devices = getConnectedDevices();

if (args.has('--devices')) {
  if (!devices.length) {
    console.log('Nenhum dispositivo conectado.');
    process.exit(0);
  }

  console.log('Dispositivos conectados:');
  devices.forEach((device) => console.log(`- ${device}`));
  process.exit(0);
}

ensureApkExists();
ensureDeviceConnected(devices);

console.log(`Instalando APK em ${devices[0]}...`);
runAdb(['install', '-r', apkPath]);

if (args.has('--launch')) {
  console.log('Abrindo o app...');
  runAdb([
    'shell',
    'monkey',
    '-p',
    appId,
    '-c',
    'android.intent.category.LAUNCHER',
    '1'
  ]);
}

console.log(`APK instalada com sucesso: ${apkPath}`);
