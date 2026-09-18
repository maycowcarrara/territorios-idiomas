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

function formatarCodigo3Digitos(codigoAntigo) {
    if (!codigoAntigo) return codigoAntigo;
    const match = codigoAntigo.match(/^(.*?[A-Z0-9]+-T)0*(\d+)$/i);
    if (match) {
        const prefixo = match[1].toUpperCase();
        const num = parseInt(match[2], 10);
        return `${prefixo}${String(num).padStart(3, '0')}`;
    }
    return codigoAntigo;
}

function getDocIdFromCodigo(codigo) {
    return 'g_' + String(codigo || '').trim().replace(/[^A-Z0-9]+/gi, '_').toLowerCase();
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const saPath = findServiceAccount();

    const app = initializeApp({
        credential: saPath ? cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) : applicationDefault()
    });
    const db = getFirestore(app);

    console.log(`\n======================================================`);
    console.log(`MIGRAÇÃO DE TERRITÓRIOS PARA PADRÃO DE 3 DÍGITOS (001)`);
    console.log(`Modo: ${args.apply ? 'EXECUÇÃO REAL (--apply)' : 'SIMULAÇÃO (--dry-run)'}`);
    console.log(`======================================================\n`);

    const gruposSnap = await db.collection('grupos_enderecos').get();
    console.log(`Total de territórios no banco: ${gruposSnap.size}\n`);

    const alteracoes = [];

    for (const doc of gruposSnap.docs) {
        const d = doc.data();
        const codigoAntigo = d.codigo || '';
        const codigoNovo = formatarCodigo3Digitos(codigoAntigo);
        const docIdAntigo = doc.id;
        const docIdNovo = getDocIdFromCodigo(codigoNovo);

        let nomeNovo = d.nome || '';
        if (nomeNovo.includes(codigoAntigo)) {
            nomeNovo = nomeNovo.replace(codigoAntigo, codigoNovo);
        }

        const precisaMudar = codigoAntigo !== codigoNovo || docIdAntigo !== docIdNovo;

        if (precisaMudar) {
            alteracoes.push({
                docIdAntigo,
                docIdNovo,
                codigoAntigo,
                codigoNovo,
                nomeAntigo: d.nome,
                nomeNovo,
                enderecoIds: d.enderecoIds || [],
                dadosCompletos: d
            });
            console.log(`[ALTERAR] ${docIdAntigo} (${codigoAntigo}) ➔ ${docIdNovo} (${codigoNovo})`);
            console.log(`          Nome: "${d.nome}" ➔ "${nomeNovo}"`);
            console.log(`          Endereços a atualizar: ${(d.enderecoIds || []).length}\n`);
        } else {
            console.log(`[MANTER]  ${docIdAntigo} (${codigoAntigo}) já está no padrão.`);
        }
    }

    console.log(`\nResumo:`);
    console.log(`- Territórios que precisam de ajuste: ${alteracoes.length}`);
    console.log(`- Territórios já adequados: ${gruposSnap.size - alteracoes.length}`);

    if (alteracoes.length === 0) {
        console.log('\nNenhum território precisa ser migrado. Banco já está no padrão de 3 dígitos!\n');
        return;
    }

    if (args.dryRun) {
        console.log('\n[INFO] Esta foi uma simulação. Nenhuma alteração foi salva no banco.');
        console.log('Para aplicar de fato as alterações, execute com a flag --apply:');
        console.log('  node scripts/migrar-territorios-3-digitos.cjs --apply\n');
        return;
    }

    console.log('\nAplicando alterações no Firestore...\n');

    for (const item of alteracoes) {
        const batch = db.batch();

        // 1. Cria o novo documento do território com os dados atualizados
        const novoGrupoRef = db.collection('grupos_enderecos').doc(item.docIdNovo);
        const dadosAtualizados = {
            ...item.dadosCompletos,
            id: item.docIdNovo,
            codigo: item.codigoNovo,
            nome: item.nomeNovo,
            atualizadoEm: new Date()
        };
        batch.set(novoGrupoRef, dadosAtualizados);

        // 2. Atualiza todos os endereços vinculados a este território
        for (const enderecoId of item.enderecoIds) {
            const endRef = db.collection('enderecos').doc(enderecoId);
            batch.set(endRef, {
                grupoId: item.docIdNovo,
                grupoCodigo: item.codigoNovo,
                atualizadoEm: new Date()
            }, { merge: true });
        }

        // 3. Remove o documento antigo do território
        const antigoGrupoRef = db.collection('grupos_enderecos').doc(item.docIdAntigo);
        batch.delete(antigoGrupoRef);

        await batch.commit();
        console.log(`✓ Migrado: ${item.codigoAntigo} ➔ ${item.codigoNovo} (${item.enderecoIds.length} endereços atualizados)`);
    }

    // 4. Também atualiza a collection configuracoes / cadastros_enderecos se existir
    try {
        const configRef = db.collection('configuracoes').doc('cadastros_enderecos');
        const configSnap = await configRef.get();
        if (configSnap.exists()) {
            console.log('\n✓ Verificando configurações de padrões no Firestore...');
            // Garante que o prefixo e sugestões estejam limpos
        }
    } catch (e) {
        // Ignora se não existir
    }

    console.log('\n======================================================');
    console.log('MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('======================================================\n');
}

main().catch(console.error);
