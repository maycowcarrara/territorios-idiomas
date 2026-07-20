const { existsSync, readFileSync, readdirSync } = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const userProfile = process.env.USERPROFILE || '';
const avdDir = path.join(userProfile, '.android', 'avd');

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

function resolveSdkRoot() {
  const sdkRoots = [
    getSdkFromLocalProperties(),
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
    'C:\\Android\\Sdk'
  ].filter(Boolean);

  for (const sdkRoot of sdkRoots) {
    if (existsSync(sdkRoot)) return sdkRoot;
  }

  throw new Error('Android SDK nao encontrado.');
}

function resolveAdbPath() {
  const adbPath = path.join(resolveSdkRoot(), 'platform-tools', 'adb.exe');
  if (!existsSync(adbPath)) {
    throw new Error(`ADB nao encontrado em: ${adbPath}`);
  }
  return adbPath;
}

function resolveEmulatorPath() {
  const emulatorPath = path.join(resolveSdkRoot(), 'emulator', 'emulator.exe');
  if (!existsSync(emulatorPath)) {
    throw new Error(`Emulator nao encontrado em: ${emulatorPath}`);
  }
  return emulatorPath;
}

function listAvds() {
  if (!existsSync(avdDir)) return [];
  return readdirSync(avdDir)
    .filter((name) => name.endsWith('.ini'))
    .map((name) => path.basename(name, '.ini'))
    .sort();
}

function runAdb(args, captureOutput = false) {
  return execFileSync(resolveAdbPath(), args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
}

function getConnectedDevices() {
  const output = runAdb(['devices'], true);
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.endsWith('\tdevice'))
    .map((line) => line.split('\t')[0]);
}

function getBootedEmulators() {
  return getConnectedDevices().filter((device) => device.startsWith('emulator-'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEmulatorBoot(timeoutMs = 180000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const emulators = getBootedEmulators();
    if (emulators.length) {
      try {
        const bootState = runAdb(['-s', emulators[0], 'shell', 'getprop', 'sys.boot_completed'], true).trim();
        if (bootState === '1') {
          return emulators[0];
        }
      } catch {
        // Ignora enquanto o emulador termina de subir.
      }
    }

    await sleep(3000);
  }

  throw new Error('Tempo esgotado esperando o emulador iniciar.');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const avds = listAvds();

  if (args.has('--list')) {
    if (!avds.length) {
      console.log('Nenhum AVD encontrado.');
      return;
    }

    console.log('AVDs disponiveis:');
    avds.forEach((avd) => console.log(`- ${avd}`));
    return;
  }

  if (!avds.length) {
    throw new Error('Nenhum AVD encontrado. Crie um emulador no Android Studio primeiro.');
  }

  const targetAvd = process.env.ANDROID_AVD || avds[0];
  if (!avds.includes(targetAvd)) {
    throw new Error(`AVD nao encontrado: ${targetAvd}`);
  }

  if (!getBootedEmulators().length) {
    console.log(`Abrindo emulador: ${targetAvd}`);
    const child = spawn(resolveEmulatorPath(), ['-avd', targetAvd], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } else {
    console.log('Ja existe um emulador em execucao.');
  }

  if (args.has('--wait')) {
    const deviceId = await waitForEmulatorBoot();
    console.log(`Emulador pronto: ${deviceId}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
