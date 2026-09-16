import { initializeApp, deleteApp } from 'firebase/app';
import {
    connectAuthEmulator,
    getAuth,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    collection,
    connectFirestoreEmulator,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'territorios-idiomas-rules';
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const testPassword = 'RulesPassword123!';

function splitHost(value) {
    const [host, port] = String(value).replace(/^https?:\/\//, '').split(':');
    return { host, port: Number(port) };
}

function createClient(label) {
    const app = initializeApp({
        apiKey: 'demo-api-key',
        authDomain: `${projectId}.firebaseapp.com`,
        projectId
    }, label);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const firestoreHost = splitHost(firestoreEmulatorHost);

    connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
    connectFirestoreEmulator(db, firestoreHost.host, firestoreHost.port);

    return { app, auth, db };
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
    totalAssertions++;
    if (!condition) {
        throw new Error(`[FALHA] ${message}`);
    }
    passedAssertions++;
}

async function expectPermissionDenied(label, action) {
    totalAssertions++;
    try {
        await action();
    } catch (error) {
        const errorMsg = String(error?.code || error?.message || '');
        if (errorMsg.includes('permission-denied') || errorMsg.includes('PERMISSION_DENIED')) {
            passedAssertions++;
            console.log(`  [OK - NEGAÇÃO ESPERADA] ${label}`);
            return;
        }
        throw new Error(`[ERRO INESPERADO] ${label} falhou com erro diferente de permission-denied: ${error?.message}`);
    }
    throw new Error(`[VIOLAÇÃO DE SEGURANÇA] ${label} deveria ter sido bloqueado por Rules, mas teve sucesso!`);
}

async function expectAllowed(label, action) {
    totalAssertions++;
    try {
        await action();
        passedAssertions++;
        console.log(`  [OK - PERMISSÃO VÁLIDA] ${label}`);
    } catch (error) {
        throw new Error(`[FALHA DE PERMISSÃO] ${label} deveria ser permitido pelas Rules, mas falhou: ${error?.message}`);
    }
}

async function seedTestData() {
    if (!getAdminApps().length) {
        initializeAdminApp({ projectId });
    }
    const adminDb = getAdminFirestore();
    const adminAuth = getAdminAuth();

    const usuarios = [
        { email: 'admin@rules.local', nome: 'Admin Rules', role: 'admin' },
        { email: 'designado@rules.local', nome: 'Publicador Designado', role: 'comum' },
        { email: 'outro@rules.local', nome: 'Publicador Não Designado', role: 'comum' },
        { email: 'aguardando@rules.local', nome: 'Aguardando Aprovação', role: 'aguardando' }
    ];

    for (const u of usuarios) {
        await adminDb.doc(`usuarios/${u.email}`).set({
            nome: u.nome,
            role: u.role,
            criadoEm: new Date()
        });

        try {
            await adminAuth.createUser({
                uid: u.email,
                email: u.email,
                password: testPassword,
                emailVerified: true
            });
        } catch {
            // Se já existir no emulador, prossegue
        }
    }

    // Fixtures de dados no Firestore privilegiado
    await adminDb.doc('configuracoes/geral').set({ versao: 1, ativo: true });
    await adminDb.doc('campanhas/campanha-2026').set({ titulo: 'Campanha 2026', ativa: true });
    await adminDb.doc('contadores/codigos').set({ proximoEndereco: 10, proximoGrupoEndereco: 5, atualizadoEm: new Date() });

    // Grupo de território com endereços vinculados
    await adminDb.doc('grupos_enderecos/g_rules_t01').set({
        codigo: 'T-01',
        nome: 'Território T-01',
        status: 'ativo',
        idiomaId: 'es',
        designadoPara: 'designado@rules.local',
        designadoNome: 'Publicador Designado',
        dataDesignacao: new Date(),
        designacaoId: 'desig_01',
        cicloAtual: 1,
        totalEnderecos: 2,
        totalEstrangeiros: 3,
        enderecoIds: ['e_rules_001', 'e_rules_002'],
        enderecos_visitados: ['e_rules_001'],
        historico: [],
        criadoEm: new Date()
    });

    await adminDb.doc('enderecos/e_rules_001').set({
        codigo: 'E-001',
        status: 'ativo',
        grupoId: 'g_rules_t01',
        grupoCodigo: 'T-01',
        grupoDesignadoPara: 'designado@rules.local',
        lat: -26.25,
        lng: -49.38,
        idiomaId: 'es',
        bairro: 'Centro',
        endereco: 'Rua das Flores, 100',
        criadoEm: new Date()
    });

    await adminDb.doc('enderecos/e_rules_002').set({
        codigo: 'E-002',
        status: 'ativo',
        grupoId: 'g_rules_t01',
        grupoCodigo: 'T-01',
        grupoDesignadoPara: 'designado@rules.local',
        lat: -26.251,
        lng: -49.381,
        idiomaId: 'es',
        bairro: 'Centro',
        endereco: 'Rua das Flores, 102',
        criadoEm: new Date()
    });

    // Notificações
    await adminDb.doc('notificacoes/notif_designado').set({
        para: 'designado@rules.local',
        texto: 'Você recebeu um território',
        data: new Date(),
        lida: false,
        tipo: 'designacao',
        origem: 'sistema'
    });

    await adminDb.doc('notificacoes/notif_admin').set({
        para: 'ADMINS',
        texto: 'Aviso aos administradores',
        data: new Date(),
        lida: false,
        tipo: 'comunicado',
        origem: 'admin'
    });
}

async function main() {
    console.log('--- Iniciando Testes da Matriz de Autorização do Firestore Rules ---');
    await seedTestData();

    const adminClient = createClient('admin-rules-client');
    const designadoClient = createClient('designado-rules-client');
    const outroClient = createClient('outro-rules-client');
    const aguardandoClient = createClient('aguardando-rules-client');
    const anonimoClient = createClient('anonimo-rules-client');

    const clientsToClean = [adminClient, designadoClient, outroClient, aguardandoClient, anonimoClient];

    try {
        await signInWithEmailAndPassword(adminClient.auth, 'admin@rules.local', testPassword);
        await signInWithEmailAndPassword(designadoClient.auth, 'designado@rules.local', testPassword);
        await signInWithEmailAndPassword(outroClient.auth, 'outro@rules.local', testPassword);
        await signInWithEmailAndPassword(aguardandoClient.auth, 'aguardando@rules.local', testPassword);

        // -------------------------------------------------------------
        // 1. Coleção: usuarios
        // -------------------------------------------------------------
        console.log('\n[1. Matriz de Autorização: usuarios]');

        await expectPermissionDenied('Anônimo lendo dados de usuário', async () => {
            await getDoc(doc(anonimoClient.db, 'usuarios/admin@rules.local'));
        });

        await expectPermissionDenied('Usuário comum lendo documento de outro usuário', async () => {
            await getDoc(doc(outroClient.db, 'usuarios/admin@rules.local'));
        });

        await expectAllowed('Usuário aguardando lendo seu próprio documento', async () => {
            const snap = await getDoc(doc(aguardandoClient.db, 'usuarios/aguardando@rules.local'));
            assert(snap.exists(), 'Doc aguardando deve existir');
        });

        await expectAllowed('Usuário comum lendo seu próprio documento', async () => {
            const snap = await getDoc(doc(designadoClient.db, 'usuarios/designado@rules.local'));
            assert(snap.exists(), 'Doc designado deve existir');
        });

        await expectAllowed('Admin lendo qualquer documento de usuário', async () => {
            const snap = await getDoc(doc(adminClient.db, 'usuarios/designado@rules.local'));
            assert(snap.exists(), 'Admin pode ler');
        });

        await expectPermissionDenied('Usuário comum tentando se auto-promover para admin', async () => {
            await updateDoc(doc(designadoClient.db, 'usuarios/designado@rules.local'), { role: 'admin' });
        });

        await expectPermissionDenied('Usuário comum tentando excluir usuário', async () => {
            await deleteDoc(doc(outroClient.db, 'usuarios/aguardando@rules.local'));
        });

        await expectAllowed('Usuário comum atualizando dados permitidos do próprio perfil sem alterar role', async () => {
            await updateDoc(doc(designadoClient.db, 'usuarios/designado@rules.local'), {
                nome: 'Designado Atualizado',
                role: 'comum'
            });
        });

        // -------------------------------------------------------------
        // 2. Coleção: configuracoes e campanhas
        // -------------------------------------------------------------
        console.log('\n[2. Matriz de Autorização: configuracoes e campanhas]');

        await expectPermissionDenied('Anônimo lendo configuracoes', async () => {
            await getDoc(doc(anonimoClient.db, 'configuracoes/geral'));
        });

        await expectPermissionDenied('Usuário aguardando lendo configuracoes', async () => {
            await getDoc(doc(aguardandoClient.db, 'configuracoes/geral'));
        });

        await expectAllowed('Usuário aprovado lendo configuracoes', async () => {
            const snap = await getDoc(doc(designadoClient.db, 'configuracoes/geral'));
            assert(snap.exists(), 'Configuracao geral lida');
        });

        await expectPermissionDenied('Usuário comum tentando editar configuracoes', async () => {
            await updateDoc(doc(designadoClient.db, 'configuracoes/geral'), { versao: 2 });
        });

        await expectAllowed('Admin atualizando configuracoes', async () => {
            await updateDoc(doc(adminClient.db, 'configuracoes/geral'), { versao: 2 });
        });

        await expectPermissionDenied('Usuário comum tentando ler campanhas', async () => {
            await getDoc(doc(outroClient.db, 'campanhas/campanha-2026'));
        });

        await expectAllowed('Admin lendo e atualizando campanhas', async () => {
            const snap = await getDoc(doc(adminClient.db, 'campanhas/campanha-2026'));
            assert(snap.exists(), 'Campanha lida');
            await updateDoc(doc(adminClient.db, 'campanhas/campanha-2026'), { ativa: false });
        });

        // -------------------------------------------------------------
        // 3. Coleção: contadores
        // -------------------------------------------------------------
        console.log('\n[3. Matriz de Autorização: contadores]');

        await expectPermissionDenied('Usuário comum lendo contadores', async () => {
            await getDoc(doc(designadoClient.db, 'contadores/codigos'));
        });

        await expectAllowed('Admin lendo e atualizando contadores com formato estrito', async () => {
            await updateDoc(doc(adminClient.db, 'contadores/codigos'), {
                proximoEndereco: 11,
                proximoGrupoEndereco: 6,
                atualizadoEm: new Date()
            });
        });

        await expectPermissionDenied('Admin tentando exclusão física de contadores (proibida para todos)', async () => {
            await deleteDoc(doc(adminClient.db, 'contadores/codigos'));
        });

        // -------------------------------------------------------------
        // 4. Coleção: enderecos
        // -------------------------------------------------------------
        console.log('\n[4. Matriz de Autorização: enderecos]');

        await expectPermissionDenied('Anônimo lendo endereços', async () => {
            await getDoc(doc(anonimoClient.db, 'enderecos/e_rules_001'));
        });

        await expectPermissionDenied('Usuário comum não designado lendo endereço de outro território', async () => {
            await getDoc(doc(outroClient.db, 'enderecos/e_rules_001'));
        });

        await expectAllowed('Publicador designado lendo endereço de seu grupo designado', async () => {
            const snap = await getDoc(doc(designadoClient.db, 'enderecos/e_rules_001'));
            assert(snap.exists(), 'Endereço 001 lido por designado');
        });

        await expectAllowed('Admin lendo qualquer endereço', async () => {
            const snap = await getDoc(doc(adminClient.db, 'enderecos/e_rules_001'));
            assert(snap.exists(), 'Endereço lido por admin');
        });

        await expectPermissionDenied('Publicador comum tentando criar novo endereço', async () => {
            await setDoc(doc(designadoClient.db, 'enderecos/e_rules_novo'), {
                codigo: 'E-999',
                status: 'ativo',
                lat: -26.25,
                lng: -49.38
            });
        });

        await expectPermissionDenied('Publicador comum tentando alterar dados cadastrais de endereço (coordenadas/texto)', async () => {
            await updateDoc(doc(designadoClient.db, 'enderecos/e_rules_001'), {
                endereco: 'Endereço adulterado',
                lat: -20.0
            });
        });

        await expectPermissionDenied('Publicador tentando exclusão física de endereço (proibida)', async () => {
            await deleteDoc(doc(designadoClient.db, 'enderecos/e_rules_001'));
        });

        await expectPermissionDenied('Admin tentando exclusão física de endereço (proibida para todos)', async () => {
            await deleteDoc(doc(adminClient.db, 'enderecos/e_rules_001'));
        });

        // -------------------------------------------------------------
        // 5. Coleção: grupos_enderecos
        // -------------------------------------------------------------
        console.log('\n[5. Matriz de Autorização: grupos_enderecos]');

        await expectPermissionDenied('Anônimo lendo grupos de endereços', async () => {
            await getDoc(doc(anonimoClient.db, 'grupos_enderecos/g_rules_t01'));
        });

        await expectPermissionDenied('Publicador não designado lendo grupo alheio', async () => {
            await getDoc(doc(outroClient.db, 'grupos_enderecos/g_rules_t01'));
        });

        await expectAllowed('Publicador designado lendo seu território', async () => {
            const snap = await getDoc(doc(designadoClient.db, 'grupos_enderecos/g_rules_t01'));
            assert(snap.exists(), 'Território lido por designado');
        });

        await expectPermissionDenied('Publicador não designado tentando se auto-atribuir território', async () => {
            await updateDoc(doc(outroClient.db, 'grupos_enderecos/g_rules_t01'), {
                designadoPara: 'outro@rules.local'
            });
        });

        await expectAllowed('Publicador designado marcando endereço visitado no seu grupo', async () => {
            await updateDoc(doc(designadoClient.db, 'grupos_enderecos/g_rules_t01'), {
                enderecos_visitados: ['e_rules_001', 'e_rules_002'],
                status: 'ativo',
                ultimaAlteracao: new Date(),
                atualizadoEm: new Date(),
                atualizadoPor: 'designado@rules.local'
            });
        });

        await expectPermissionDenied('Publicador tentando excluir fisicamente grupo de endereços (proibida)', async () => {
            await deleteDoc(doc(designadoClient.db, 'grupos_enderecos/g_rules_t01'));
        });

        await expectPermissionDenied('Admin tentando excluir fisicamente grupo de endereços (proibida para todos)', async () => {
            await deleteDoc(doc(adminClient.db, 'grupos_enderecos/g_rules_t01'));
        });

        // -------------------------------------------------------------
        // 6. Coleção: notificacoes
        // -------------------------------------------------------------
        console.log('\n[6. Matriz de Autorização: notificacoes]');

        await expectPermissionDenied('Anônimo lendo notificações', async () => {
            await getDoc(doc(anonimoClient.db, 'notificacoes/notif_designado'));
        });

        await expectPermissionDenied('Publicador tentando ler notificação de outro usuário', async () => {
            await getDoc(doc(outroClient.db, 'notificacoes/notif_designado'));
        });

        await expectAllowed('Publicador lendo sua própria notificação', async () => {
            const snap = await getDoc(doc(designadoClient.db, 'notificacoes/notif_designado'));
            assert(snap.exists(), 'Notificação própria lida');
        });

        await expectAllowed('Publicador marcando sua própria notificação como lida', async () => {
            await updateDoc(doc(designadoClient.db, 'notificacoes/notif_designado'), { lida: true });
        });

        await expectPermissionDenied('Publicador tentando adulterar texto de notificação', async () => {
            await updateDoc(doc(designadoClient.db, 'notificacoes/notif_designado'), { texto: 'Texto alterado' });
        });

        await expectAllowed('Publicador comum enviando notificação de conclusão para ADMINS', async () => {
            await setDoc(doc(designadoClient.db, 'notificacoes/notif_conclusao_teste'), {
                para: 'ADMINS',
                texto: 'Território concluído pelo publicador',
                data: new Date(),
                lida: false,
                tipo: 'conclusao',
                origem: 'sistema'
            });
        });

        await expectPermissionDenied('Publicador comum tentando enviar notificação de cadastro para ADMINS', async () => {
            await setDoc(doc(designadoClient.db, 'notificacoes/notif_cadastro_invalida'), {
                para: 'ADMINS',
                texto: 'Tentativa indevida',
                data: new Date(),
                lida: false,
                tipo: 'cadastro',
                origem: 'sistema'
            });
        });

        await expectAllowed('Usuário aguardando enviando notificação de cadastro para ADMINS', async () => {
            await setDoc(doc(aguardandoClient.db, 'notificacoes/notif_cadastro_ok'), {
                para: 'ADMINS',
                texto: 'Novo cadastro de publicador',
                data: new Date(),
                lida: false,
                tipo: 'cadastro',
                origem: 'sistema'
            });
        });

        await expectAllowed('Publicador excluindo sua própria notificação', async () => {
            await deleteDoc(doc(designadoClient.db, 'notificacoes/notif_designado'));
        });

        await expectPermissionDenied('Publicador tentando excluir notificação alheia', async () => {
            await deleteDoc(doc(outroClient.db, 'notificacoes/notif_admin'));
        });

        console.log('\n--- Resultado Final da Suite de Rules ---');
        console.log(`Total de asserções executadas: ${totalAssertions}`);
        console.log(`Total de asserções aprovadas:  ${passedAssertions}`);
        console.log('Status: MATRIZ DE AUTORIZAÇÃO 100% VALIDADA NO EMULADOR LOCAL');
    } finally {
        for (const client of clientsToClean) {
            await deleteApp(client.app).catch(() => {});
        }
    }
}

main().catch((error) => {
    console.error('\n❌ ERRO NA SUITE DE RULES:', error);
    process.exit(1);
});
