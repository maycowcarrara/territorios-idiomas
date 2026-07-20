#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const packagePath = path.join(projectRoot, 'package.json');
const action = process.argv[2];
const forwardedArgs = process.argv.slice(3);

if (!action) {
  console.error('Informe o comando base. Ex.: node scripts/select-npm-instance.cjs dev');
  process.exit(1);
}

const allowedActions = new Set(['dev', 'deploy']);

if (!allowedActions.has(action)) {
  console.error(`Comando base nao suportado: ${action}`);
  process.exit(1);
}

let packageJson;

try {
  packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
} catch (error) {
  console.error(`Nao foi possivel ler package.json: ${error.message}`);
  process.exit(1);
}

const scripts = packageJson.scripts || {};

function hasEnvFile(instance) {
  return fs.existsSync(path.join(projectRoot, `.env.${instance}`));
}

function getInstances() {
  return Object.keys(scripts)
    .filter((scriptName) => scriptName.startsWith(`${action}:`))
    .map((scriptName) => scriptName.slice(action.length + 1))
    .filter((instance) => instance && !instance.includes(':'))
    .filter((instance) => scripts[`build:${instance}`] || hasEnvFile(instance));
}

function formatInstanceLabel(instance) {
  return instance
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getNpmRunCommand(targetScript) {
  const npmArgs = ['run', targetScript];

  if (forwardedArgs.length) {
    npmArgs.push('--', ...forwardedArgs);
  }

  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath && fs.existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      args: [npmExecPath, ...npmArgs],
      options: {}
    };
  }

  return {
    command: 'npm',
    args: npmArgs,
    options: process.platform === 'win32' ? { shell: true } : {}
  };
}

async function selectInstance(instances) {
  console.log('');
  console.log(`Escolha a congregacao para rodar "npm run ${action}":`);
  instances.forEach((instance, index) => {
    console.log(`  ${index + 1}. ${formatInstanceLabel(instance)} (${instance})`);
  });
  console.log('');

  while (true) {
    const answer = await ask('Digite o numero ou o nome da instancia: ');
    const selectedIndex = Number(answer);

    if (Number.isInteger(selectedIndex) && selectedIndex >= 1 && selectedIndex <= instances.length) {
      return instances[selectedIndex - 1];
    }

    const selectedByName = instances.find((instance) => instance.toLowerCase() === answer.toLowerCase());

    if (selectedByName) {
      return selectedByName;
    }

    console.log('Opcao invalida. Tente novamente.');
  }
}

async function main() {
  const instances = getInstances();

  if (!instances.length) {
    console.error(`Nenhuma instancia encontrada para "npm run ${action}".`);
    console.error(`Crie scripts como "${action}:idiomas" e "build:idiomas" no package.json.`);
    process.exit(1);
  }

  if (!process.stdin.isTTY) {
    console.error(`Escolha uma instancia explicitamente: npm run ${action}:<instancia>`);
    console.error(`Disponiveis: ${instances.join(', ')}`);
    process.exit(1);
  }

  const instance = await selectInstance(instances);
  const targetScript = `${action}:${instance}`;
  const npmRun = getNpmRunCommand(targetScript);

  console.log('');
  console.log(`Rodando: npm run ${targetScript}${forwardedArgs.length ? ` -- ${forwardedArgs.join(' ')}` : ''}`);
  console.log('');

  const result = spawnSync(npmRun.command, npmRun.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...npmRun.options
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
