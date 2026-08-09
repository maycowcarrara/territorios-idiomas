import { initializeApp, deleteApp } from 'firebase/app';
import {
    connectAuthEmulator,
    getAuth,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    collection,
    connectFirestoreEmulator,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
    createEnderecoManual,
    createGrupoEnderecoManual,
    designarGrupoEndereco,
    finalizarGrupoEnderecoDesignado,
    getEnderecoRef,
    getGrupoEnderecoRef,
    setEnderecoArquivado,
    toggleEnderecoVisitadoGrupo,
    updateEnderecoBasico
} from '../src/enderecoModel.js';
import {
    DEFAULT_ENDERECO_CONFIG,
    getEnderecoCodigoPadraoFromConfig,
    getEnderecoConfigRef,
    getGrupoEnderecoCodigoPadraoFromConfig,
    normalizeEnderecoConfig
} from '../src/enderecoConfig.js';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'territorios-idiomas-smoke';
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const testPassword = 'Smoke12345!';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function splitHost(value) {
    const [host, port] = String(value).replace(/^https?:\/\//, '').split(':');
    return {
        host,
        port: Number(port)
    };
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

async function expectPermissionDenied(label, action) {
    try {
        await action();
    } catch (error) {
        if (String(error?.code || error?.message || '').includes('permission-denied')) {
            console.log(`ok - bloqueado: ${label}`);
            return;
        }

        throw error;
    }

    throw new Error(`Ação deveria ser bloqueada: ${label}`);
}

async function expectDomainBlocked(label, action, expectedMessage) {
    try {
        await action();
    } catch (error) {
        if (String(error?.message || error || '').includes(expectedMessage)) {
            console.log(`ok - bloqueado: ${label}`);
            return;
        }

        throw error;
    }

    throw new Error(`Ação deveria ser bloqueada: ${label}`);
}

async function seedUsuarios() {
    if (!getAdminApps().length) {
        initializeAdminApp({
            projectId
        });
    }

    const adminDb = getAdminFirestore();
    const adminAuth = getAdminAuth();
    const usuarios = [
        { email: 'admin@codex-smoke.local', nome: 'Admin Smoke', role: 'admin' },
        { email: 'publicador@codex-smoke.local', nome: 'Publicador Smoke', role: 'comum' },
        { email: 'outro@codex-smoke.local', nome: 'Outro Smoke', role: 'comum' }
    ];

    await Promise.all(usuarios.map(async (usuario) => {
        await adminDb.doc(`usuarios/${usuario.email}`).set({
            nome: usuario.nome,
            role: usuario.role,
            criadoEm: new Date()
        });

        await adminAuth.createUser({
            uid: usuario.email,
            email: usuario.email,
            password: testPassword,
            emailVerified: true
        });
    }));

    return usuarios;
}

async function signIn(client, email) {
    const credential = await signInWithEmailAndPassword(client.auth, email, testPassword);
    return credential.user;
}

async function main() {
    const usuarios = await seedUsuarios();
    const adminInfo = usuarios.find((usuario) => usuario.role === 'admin');
    const publicadorInfo = usuarios.find((usuario) => usuario.email.startsWith('publicador@'));
    const outroInfo = usuarios.find((usuario) => usuario.email.startsWith('outro@'));

    const adminClient = createClient('admin-smoke');
    const publicadorClient = createClient('publicador-smoke');
    const outroClient = createClient('outro-smoke');

    try {
        const adminUser = await signIn(adminClient, adminInfo.email);
        const publicadorUser = await signIn(publicadorClient, publicadorInfo.email);
        const outroUser = await signIn(outroClient, outroInfo.email);
        const configCadastros = normalizeEnderecoConfig({
            ...DEFAULT_ENDERECO_CONFIG,
            prefixoEnderecoPadrao: 'ES-SBS-',
            prefixoTerritorioPadrao: 'ES-SBS-T',
            classeEnderecoPadrao: 'confirmado',
            quantidadeEstrangeirosPadrao: 1
        });

        await setDoc(getEnderecoConfigRef(adminClient.db), {
            ...configCadastros,
            atualizadaEm: new Date()
        }, { merge: true });

        const configPublicadorDoc = await getDoc(getEnderecoConfigRef(publicadorClient.db));
        assert(configPublicadorDoc.exists(), 'Publicador aprovado deveria ler padrões de cadastro.');
        const configPublicador = normalizeEnderecoConfig(configPublicadorDoc.data());
        assert(getEnderecoCodigoPadraoFromConfig(configPublicador) === 'ES-SBS-001', 'Config deveria sugerir ES-SBS-001.');
        assert(getGrupoEnderecoCodigoPadraoFromConfig(configPublicador) === 'ES-SBS-T01', 'Config deveria sugerir ES-SBS-T01.');

        const enderecoA = await createEnderecoManual(adminClient.db, {
            user: adminUser,
            codigo: 'es-sbs-001',
            idiomaId: 'es',
            idiomaNome: 'Espanhol',
            bairro: 'Serra Alta',
            lat: -10.1841,
            lng: -48.3336,
            endereco: 'Rua Smoke A, 10',
            quantidadeEstrangeiros: 2,
            informacao: 'Criado pelo smoke local',
            classe: 'confirmado'
        });
        await expectDomainBlocked('codigo duplicado de endereço', () => (
            createEnderecoManual(adminClient.db, {
                user: adminUser,
                codigo: 'ES-SBS-001',
                lat: -10.1842,
                lng: -48.3337,
                endereco: 'Rua Smoke Duplicada, 10',
                quantidadeEstrangeiros: 1,
                informacao: '',
                classe: 'confirmado'
            })
        ), 'Já existe um endereço com o código ES-SBS-001');
        await expectDomainBlocked('codigo invalido de endereço', () => (
            createEnderecoManual(adminClient.db, {
                user: adminUser,
                codigo: 'ESSBS001',
                lat: -10.1843,
                lng: -48.3338,
                endereco: 'Rua Smoke Inválida, 10',
                quantidadeEstrangeiros: 1,
                informacao: '',
                classe: 'confirmado'
            })
        ), 'Código do endereço inválido');
        const enderecoB = await createEnderecoManual(adminClient.db, {
            user: adminUser,
            codigo: 'ES-SBS-002',
            idiomaId: 'es',
            idiomaNome: 'Espanhol',
            bairro: 'Serra Alta',
            lat: -10.1848,
            lng: -48.3342,
            endereco: 'Rua Smoke B, 20',
            quantidadeEstrangeiros: 1,
            informacao: '',
            classe: 'verificar'
        });
        const enderecoExcluido = await createEnderecoManual(adminClient.db, {
            user: adminUser,
            codigo: 'ES-SBS-003',
            idiomaId: 'es',
            idiomaNome: 'Espanhol',
            bairro: 'Centro',
            lat: -10.185,
            lng: -48.3344,
            endereco: 'Rua Smoke Excluída, 30',
            quantidadeEstrangeiros: 1,
            informacao: 'Classe excluido deve arquivar',
            classe: 'excluido'
        });
        assert(enderecoA.codigo === 'ES-SBS-001', 'Primeiro endereço deveria salvar ES-SBS-001 normalizado.');
        assert(enderecoB.codigo === 'ES-SBS-002', 'Segundo endereço deveria salvar ES-SBS-002.');

        await updateEnderecoBasico(adminClient.db, enderecoA.id, {
            lat: -10.1841,
            lng: -48.3336,
            idiomaId: 'es',
            idiomaNome: 'Espanhol',
            bairro: 'Serra Alta',
            endereco: 'Rua Smoke A atualizada, 10',
            quantidadeEstrangeiros: 3,
            informacao: 'Atualizado pelo smoke local',
            classe: 'estudo'
        }, adminUser);

        await setEnderecoArquivado(adminClient.db, enderecoB.id, true, adminUser);
        await setEnderecoArquivado(adminClient.db, enderecoB.id, false, adminUser);

        const enderecoADoc = await getDoc(getEnderecoRef(adminClient.db, enderecoA.id));
        const enderecoBDoc = await getDoc(getEnderecoRef(adminClient.db, enderecoB.id));
        const enderecoExcluidoDoc = await getDoc(getEnderecoRef(adminClient.db, enderecoExcluido.id));
        assert(enderecoADoc.data().codigo === 'ES-SBS-001', 'Endereço atualizado deveria preservar codigo manual.');
        assert(enderecoADoc.data().bairro === 'Serra Alta', 'Endereço atualizado deveria salvar bairro.');
        assert(enderecoADoc.data().informacao === 'Atualizado pelo smoke local', 'Endereço atualizado deveria salvar informação.');
        assert(enderecoADoc.data().classe === 'estudo', 'Endereço atualizado deveria salvar classe.');
        assert(enderecoExcluidoDoc.data().status === 'arquivado', 'Classe excluido deveria arquivar o endereço.');
        const grupo = await createGrupoEnderecoManual(adminClient.db, {
            user: adminUser,
            codigo: 'es-sbs-t01',
            nome: 'Grupo Smoke Local',
            enderecos: [
                { id: enderecoADoc.id, ...enderecoADoc.data() },
                { id: enderecoBDoc.id, ...enderecoBDoc.data() }
            ]
        });
        assert(grupo.codigo === 'ES-SBS-T01', 'Primeiro grupo deveria salvar ES-SBS-T01 normalizado.');
        await expectDomainBlocked('codigo duplicado de território', () => (
            createGrupoEnderecoManual(adminClient.db, {
                user: adminUser,
                codigo: 'ES-SBS-T01',
                nome: 'Grupo Smoke Duplicado',
                enderecos: [{ id: enderecoExcluidoDoc.id, ...enderecoExcluidoDoc.data() }]
            })
        ), 'Já existe um território com o código ES-SBS-T01');

        await designarGrupoEndereco(adminClient.db, {
            grupoId: grupo.id,
            usuario: publicadorInfo,
            user: adminUser
        });

        const meusGrupos = await getDocs(query(
            collection(publicadorClient.db, 'grupos_enderecos'),
            where('designadoPara', '==', publicadorInfo.email)
        ));
        assert(meusGrupos.size === 1, 'Publicador deveria encontrar o grupo designado.');

        await expectPermissionDenied('rule impede publicador designado marcar endereço fora do grupo', () => (
            updateDoc(getGrupoEnderecoRef(publicadorClient.db, grupo.id), {
                enderecos_visitados: [enderecoA.id, 'e_9999'],
                atualizadoEm: new Date(),
                atualizadoPor: publicadorInfo.email
            })
        ));

        await expectPermissionDenied('rule impede publicador designado duplicar endereço visitado', () => (
            updateDoc(getGrupoEnderecoRef(publicadorClient.db, grupo.id), {
                enderecos_visitados: [enderecoA.id, enderecoA.id],
                atualizadoEm: new Date(),
                atualizadoPor: publicadorInfo.email
            })
        ));

        await expectPermissionDenied('rule impede publicador designado finalizar antes de completar', () => (
            updateDoc(getGrupoEnderecoRef(publicadorClient.db, grupo.id), {
                status: 'finalizado',
                designadoPara: null,
                designadoNome: null,
                dataDesignacao: null,
                designacaoId: null,
                cicloAtual: null,
                enderecos_visitados: [],
                historico: [{
                    responsavelNome: publicadorInfo.nome,
                    finalizadoEm: new Date(),
                    totalEnderecos: 2,
                    totalVisitados: 0
                }],
                ultimaConclusao: new Date(),
                ultimaAlteracao: new Date(),
                atualizadoEm: new Date(),
                atualizadoPor: publicadorInfo.email
            })
        ));

        await toggleEnderecoVisitadoGrupo(publicadorClient.db, {
            grupoId: grupo.id,
            enderecoId: enderecoA.id,
            user: publicadorUser
        });
        await toggleEnderecoVisitadoGrupo(publicadorClient.db, {
            grupoId: grupo.id,
            enderecoId: enderecoB.id,
            user: publicadorUser
        });

        await getAdminFirestore()
            .collection('enderecos')
            .doc(enderecoA.id)
            .update({ grupoDesignadoPara: FieldValue.delete() });

        await expectPermissionDenied('publicador editar endereço básico', () => (
            updateEnderecoBasico(publicadorClient.db, enderecoA.id, {
                lat: -10.1841,
                lng: -48.3336,
                endereco: 'Tentativa bloqueada',
                quantidadeEstrangeiros: 0,
                observacao: ''
            }, publicadorUser)
        ));

        await expectPermissionDenied('rule impede usuário não designado ler grupo para marcar endereço', () => (
            toggleEnderecoVisitadoGrupo(outroClient.db, {
                grupoId: grupo.id,
                enderecoId: enderecoA.id,
                user: outroUser
            })
        ));

        await expectPermissionDenied('rule impede usuário não designado atualizar grupo', () => (
            updateDoc(getGrupoEnderecoRef(outroClient.db, grupo.id), {
                enderecos_visitados: [enderecoA.id],
                atualizadoEm: new Date(),
                atualizadoPor: outroInfo.email
            })
        ));

        await finalizarGrupoEnderecoDesignado(publicadorClient.db, {
            grupoId: grupo.id,
            user: publicadorUser
        });

        const grupoFinal = await getDoc(getGrupoEnderecoRef(adminClient.db, grupo.id));
        assert(grupoFinal.exists(), 'Grupo finalizado deveria existir.');
        assert(grupoFinal.data().status === 'finalizado', 'Grupo deveria ficar finalizado.');
        assert(grupoFinal.data().designadoPara === null, 'Grupo finalizado deveria limpar responsável.');
        assert(Array.isArray(grupoFinal.data().historico) && grupoFinal.data().historico.length === 1, 'Histórico deveria receber um ciclo.');

        const enderecoAFinal = await getDoc(getEnderecoRef(adminClient.db, enderecoA.id));
        const enderecoBFinal = await getDoc(getEnderecoRef(adminClient.db, enderecoB.id));
        assert(enderecoAFinal.data().grupoDesignadoPara === null, 'Finalização deveria limpar endereço legado sem grupoDesignadoPara.');
        assert(enderecoBFinal.data().grupoDesignadoPara === null, 'Finalização deveria limpar endereço com grupoDesignadoPara.');

        const enderecosAposFinalizacao = await getDocs(query(
            collection(publicadorClient.db, 'enderecos'),
            where('grupoDesignadoPara', '==', publicadorInfo.email)
        ));
        assert(enderecosAposFinalizacao.size === 0, 'Finalização deveria limpar a leitura de endereços do publicador.');

        console.log('ok - fluxo endereços/grupos validado no emulador');
    } finally {
        await Promise.all([
            deleteApp(adminClient.app),
            deleteApp(publicadorClient.app),
            deleteApp(outroClient.app)
        ]);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
