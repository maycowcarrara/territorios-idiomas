import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packagePath = path.join(__dirname, 'package.json');

// 1. Lê o package.json atual
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const versaoAtual = packageJson.version; // Ex: "1.8.116"

// 2. Incrementa o último número (Patch)
const partes = versaoAtual.split('.');
partes[2] = parseInt(partes[2]) + 1;
const novaVersao = partes.join('.'); // Ex: "1.8.117"

console.log(`🆙 Atualizando versão: ${versaoAtual} -> ${novaVersao}`);

// 3. Salva a NOVA versão de volta no package.json (para ficar salvo para a próxima)
packageJson.version = novaVersao;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// 4. Prepara os dados para o app (version.json)
const dadosVersao = {
    version: novaVersao,
    buildDate: new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
};

const conteudoJson = JSON.stringify(dadosVersao, null, 2);

// 5. Salva nos arquivos do projeto
const caminhos = [
    path.join(__dirname, 'src', 'version.json'),
    path.join(__dirname, 'public', 'version.json')
];

caminhos.forEach(caminho => {
    try {
        const dir = path.dirname(caminho);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(caminho, conteudoJson);
        console.log(`✅ Atualizado: ${caminho}`);
    } catch (erro) {
        console.error(`❌ Erro ao salvar em ${caminho}:`, erro);
    }
});

console.log(`🚀 Versão ${novaVersao} definida com sucesso!`);