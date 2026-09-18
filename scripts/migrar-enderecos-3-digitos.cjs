#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function findServiceAccount() {
    const root = path.resolve(__dirname, '..');
    const files = fs.readdirSync(root);
    const saFile = files.find(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));
    if (saFile) {
        return path.join(root, saFile);
    }
    return null;
}

function parseArgs(argv) {
    const args = { apply: false, dryRun: true };
    for (const arg of argv) {
        if (arg === '--apply') {
            args.apply = true;
            args.dryRun = false;
        }
        if (arg === '--dry-run') {
            args.dryRun = true;
            args.apply = false;
        }
    }
    return args;
}

function formatarCodigoEndereco3Digitos(codigoAntigo) {
    if (!codigoAntigo) return codigoAntigo;
    const match = codigoAntigo.match(/^(.*?[A-Z0-9]+-)0*(\d+)$/i);
    if (match) {
        const prefixo = match[1].toUpperCase();
        const digitsStr = match[2];
        const num = parseInt(digitsStr, 10);
        // Se já tiver 3 ou mais dígitos originais no código, não encurta
        const largura = Math.max(3, digitsStr.length);
        return `${prefixo}${String(num).padStart(largura, '0')}`;
    }
    return codigoAntigo;
}

function getEnderecoDocIdFromCodigo(codigo) {
    return 'e_' + String(codigo || '').trim().replace(/[^A-Z0-9]+/gi, '_').toLowerCase();
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const saPath = findServiceAccount();

    const app = initializeApp({
        credential: saPath ? cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) : applicationDefault()
    });
    const db = getFirestore(app);

    console.log(`\n======================================================`);
    console.log(`MIGRAÇÃO DE ENDEREÇOS PARA PADRÃO DE 3 DÍGITOS (001)`);
    console.log(`Modo: ${args.apply ? 'EXECUÇÃO REAL (--apply)' : 'SIMULAÇÃO (--dry-run)'}`);
    console.log(`======================================================\n`);

    const enderecosSnap = await db.collection('enderecos').get();
    console.log(`Total de endereços no banco: ${enderecosSnap.size}\n`);

    const alteracoes = [];

    for (const doc of enderecosSnap.docs) {
        const d = doc.data();
        const codigoAntigo = d.codigo || '';
        const codigoNovo = formatarCodigoEndereco3Digitos(codigoAntigo);
        const docIdAntigo = doc.id;
        const docIdNovo = getEnderecoDocIdFromCodigo(codigoNovo);

        const precisaMudar = codigoAntigo !== codigoNovo || docIdAntigo !== docIdNovo;

        if (precisaMudar) {
            alteracoes.push({
                docIdAntigo,
                docIdNovo,
                codigoAntigo,
                codigoNovo,
                grupoId: d.grupoId,
                grupoCodigo: d.grupoCodigo,
                dadosCompletos: d
            });
            console.log(`[ALTERAR] ${docIdAntigo} (${codigoAntigo}) ➔ ${docIdNovo} (${codigoNovo})`);
        } else {
            console.log(`[MANTER]  ${docIdAntigo} (${codigoAntigo}) já está no padrão.`);
        }
    }

    console.log(`\nResumo:`);
    console.log(`- Endereços que precisam de ajuste: ${alteracoes.length}`);
    console.log(`- Endereços já adequados: ${enderecosSnap.size - alteracoes.length}`);

    if (alteracoes.length === 0) {
        console.log('\nNenhum endereço precisa ser migrado. Todos os endereços no banco já estão no padrão de 3 dígitos!\n');
        return;
    }

    if (args.dryRun) {
        console.log('\n[INFO] Esta foi uma simulação. Nenhuma alteração foi salva no banco.');
        console.log('Para aplicar de fato as alterações, execute com a flag --apply:');
        console.log('  node scripts/migrar-enderecos-3-digitos.cjs --apply\n');
        return;
    }

    console.log('\nAplicando alterações no Firestore...\n');

    // Carrega grupos para poder atualizar referências enderecoIds se algum docId mudou
    const gruposSnap = await db.collection('grupos_enderecos').get();
    const gruposMap = new Map();
    gruposSnap.forEach(gDoc => {
        gruposMap.set(gDoc.id, gDoc.data());
    });

    for (const item of alteracoes) {
        const batch = db.batch();

        // 1. Cria o novo documento do endereço com os dados atualizados
        const novoEndRef = db.collection('enderecos').doc(item.docIdNovo);
        const dadosAtualizados = {
            ...item.dadosCompletos,
            id: item.docIdNovo,
            codigo: item.codigoNovo,
            atualizadoEm: new Date()
        };
        batch.set(novoEndRef, dadosAtualizados);

        // 2. Se docId mudou, remove o documento antigo do endereço
        if (item.docIdAntigo !== item.docIdNovo) {
            const antigoEndRef = db.collection('enderecos').doc(item.docIdAntigo);
            batch.delete(antigoEndRef);
        }

        // 3. Atualiza referências no território vinculado, se o docId tiver mudado
        if (item.docIdAntigo !== item.docIdNovo && item.grupoId && gruposMap.has(item.grupoId)) {
            const grupoData = gruposMap.get(item.grupoId);
            const enderecoIds = (grupoData.enderecoIds || []).map(id => id === item.docIdAntigo ? item.docIdNovo : id);
            grupoData.enderecoIds = enderecoIds;
            const grupoRef = db.collection('grupos_enderecos').doc(item.grupoId);
            batch.set(grupoRef, { enderecoIds, atualizadoEm: new Date() }, { merge: true });
        }

        await batch.commit();
        console.log(`✓ Migrado: ${item.codigoAntigo} ➔ ${item.codigoNovo}`);
    }

    console.log('\n======================================================');
    console.log('MIGRAÇÃO DE ENDEREÇOS CONCLUÍDA COM SUCESSO!');
    console.log('======================================================\n');
}

main().catch(console.error);
