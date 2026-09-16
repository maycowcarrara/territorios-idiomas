import { Buffer } from 'node:buffer';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import worker, {
    verifyFirebaseIdToken,
    podeUsuarioNotificarAdmins,
    getTokensDestinatarios,
    mapWithConcurrencyLimit,
    corsHeaders,
    isValidAuthEmail,
    normalizeRedirectPath,
    buildContinueUrl
} from '../src/index.js';

describe('Worker Notifications Relay', () => {
    let testJwksKey;
    let testPrivateKey;
    let saPrivateKeyPem;
    let originalFetch;
    let fetchMock;
    let fakeEnv;

    beforeAll(async () => {
        // Gera par de chaves RSA para simular o Firebase JWKS e assinar ID tokens sintéticos
        const firebaseKeyPair = await crypto.subtle.generateKey(
            {
                name: 'RSASSA-PKCS1-v1_5',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['sign', 'verify']
        );
        testPrivateKey = firebaseKeyPair.privateKey;
        const exportedJwk = await crypto.subtle.exportKey('jwk', firebaseKeyPair.publicKey);
        exportedJwk.kid = 'fake-kid-123';
        testJwksKey = exportedJwk;

        // Gera par de chaves RSA para o Service Account do Google
        const saKeyPair = await crypto.subtle.generateKey(
            {
                name: 'RSASSA-PKCS1-v1_5',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['sign']
        );
        const exportedPkcs8 = await crypto.subtle.exportKey('pkcs8', saKeyPair.privateKey);
        saPrivateKeyPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(exportedPkcs8).toString('base64')}\n-----END PRIVATE KEY-----`;
    });

    const createSyntheticIdToken = async ({
        kid = 'fake-kid-123',
        sub = 'user_123',
        email = 'admin@example.com',
        aud = 'test-project',
        iss = 'https://securetoken.google.com/test-project',
        exp = Math.floor(Date.now() / 1000) + 3600,
        iat = Math.floor(Date.now() / 1000) - 10
    } = {}, privateKey = testPrivateKey) => {
        const header = { alg: 'RS256', kid, typ: 'JWT' };
        const payload = { sub, user_id: sub, email, aud, iss, exp, iat, email_verified: true };
        const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
        const unsigned = `${encode(header)}.${encode(payload)}`;
        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            privateKey,
            new TextEncoder().encode(unsigned)
        );
        return `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
    };

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        fakeEnv = {
            FIREBASE_PROJECT_ID: 'test-project',
            GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@test-project.iam.gserviceaccount.com',
            GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: saPrivateKeyPem,
            PUBLIC_APP_URL: 'https://territ-es-sbs.web.app',
            EMAILJS_SERVICE_ID: 'service_test',
            EMAILJS_PUBLIC_KEY: 'public_key_test',
            EMAILJS_TEMPLATE_ID: 'template_test',
            ONESIGNAL_APP_ID: 'onesignal-test-app-id',
            ONESIGNAL_REST_API_KEY: 'onesignal-test-rest-key'
        };

        fetchMock = vi.fn(async (url, options = {}) => {
            const urlStr = String(url);

            // JWKS Firebase
            if (urlStr.includes('securetoken@system.gserviceaccount.com')) {
                return new Response(JSON.stringify({ keys: [testJwksKey] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' }
                });
            }

            // Google OAuth token
            if (urlStr.includes('oauth2.googleapis.com/token')) {
                return new Response(JSON.stringify({ access_token: 'fake-google-token', expires_in: 3600 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Firestore runQuery (por role)
            if (urlStr.includes(':runQuery')) {
                const body = JSON.parse(options.body || '{}');
                const roleValue = body.structuredQuery?.where?.fieldFilter?.value?.stringValue;
                const adminDocs = [
                    {
                        document: {
                            name: 'projects/test-project/databases/(default)/documents/usuarios/admin%40example.com',
                            fields: {
                                role: { stringValue: 'admin' },
                                fcmTokens: { arrayValue: { values: [{ stringValue: 'fcm_admin_1' }] } }
                            }
                        }
                    }
                ];
                return new Response(JSON.stringify(roleValue === 'admin' ? adminDocs : []), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Firestore listUsuarios
            if (urlStr.includes('/databases/(default)/documents/usuarios') && !urlStr.includes('/usuarios/')) {
                return new Response(JSON.stringify({
                    documents: [
                        {
                            name: 'projects/test-project/databases/(default)/documents/usuarios/admin%40example.com',
                            fields: {
                                role: { stringValue: 'admin' },
                                fcmTokens: { arrayValue: { values: [{ stringValue: 'fcm_admin_1' }] } }
                            }
                        },
                        {
                            name: 'projects/test-project/databases/(default)/documents/usuarios/publicador%40example.com',
                            fields: {
                                role: { stringValue: 'comum' },
                                fcmTokens: { arrayValue: { values: [{ stringValue: 'fcm_pub_1' }, { stringValue: 'fcm_pub_1' }] } } // repetido intencional
                            }
                        }
                    ]
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Firestore get document específico por email
            if (urlStr.includes('/databases/(default)/documents/usuarios/')) {
                const docPath = decodeURIComponent(urlStr.split('/usuarios/')[1].split('?')[0]);
                if (docPath === 'admin@example.com') {
                    return new Response(JSON.stringify({
                        name: 'projects/test-project/databases/(default)/documents/usuarios/admin%40example.com',
                        fields: {
                            role: { stringValue: 'admin' },
                            fcmTokens: { arrayValue: { values: [{ stringValue: 'fcm_admin_1' }] } }
                        }
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                if (docPath === 'comum@example.com' || docPath === 'publicador@example.com') {
                    return new Response(JSON.stringify({
                        name: `projects/test-project/databases/(default)/documents/usuarios/${encodeURIComponent(docPath)}`,
                        fields: {
                            role: { stringValue: 'comum' },
                            fcmTokens: { arrayValue: { values: [{ stringValue: 'fcm_pub_1' }] } }
                        }
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                if (docPath === 'aguardando@example.com') {
                    return new Response(JSON.stringify({
                        name: 'projects/test-project/databases/(default)/documents/usuarios/aguardando%40example.com',
                        fields: {
                            role: { stringValue: 'aguardando' }
                        }
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
            }

            // Firestore commit (escrever notificações)
            if (urlStr.includes(':commit')) {
                return new Response(JSON.stringify({ writeResults: [] }), { status: 200 });
            }

            // OneSignal push
            if (urlStr.includes('api.onesignal.com')) {
                return new Response(JSON.stringify({ id: 'os-msg-123', recipients: 1 }), { status: 200 });
            }

            // FCM push
            if (urlStr.includes('fcm.googleapis.com')) {
                return new Response(JSON.stringify({ name: 'projects/test/messages/msg-123' }), { status: 200 });
            }

            // IdentityToolkit magic link
            if (urlStr.includes('accounts:sendOobCode')) {
                return new Response(JSON.stringify({ oobLink: 'https://territ-es-sbs.web.app/#/app?apiKey=test' }), { status: 200 });
            }

            // EmailJS
            if (urlStr.includes('api.emailjs.com')) {
                return new Response('OK', { status: 200 });
            }

            return new Response(JSON.stringify({ error: 'Unhandled mock URL' }), { status: 500 });
        });

        globalThis.fetch = fetchMock;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
    });

    describe('P4a: Validações de Autenticação e ID Token', () => {
        it('1. deve rejeitar token ausente', async () => {
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'broadcast' })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error).toContain('Sessão ausente');
        });

        it('1b. deve rejeitar token inválido estruturalmente', async () => {
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'broadcast', idToken: 'token.invalido' })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toContain('Sessão Firebase');
        });

        it('1c. deve rejeitar token expirado', async () => {
            const expiredToken = await createSyntheticIdToken({
                exp: Math.floor(Date.now() / 1000) - 60
            });
            await expect(verifyFirebaseIdToken(expiredToken, fakeEnv)).rejects.toThrow('validar a sessão Firebase');
        });

        it('2. deve rejeitar issuer ou audience incorretos', async () => {
            const badAudToken = await createSyntheticIdToken({ aud: 'outro-projeto' });
            await expect(verifyFirebaseIdToken(badAudToken, fakeEnv)).rejects.toThrow('validar a sessão Firebase');

            const badIssToken = await createSyntheticIdToken({ iss: 'https://outro-issuer.com' });
            await expect(verifyFirebaseIdToken(badIssToken, fakeEnv)).rejects.toThrow('validar a sessão Firebase');
        });
    });

    describe('P4a / P4b: Autorização e Destinatários', () => {
        it('3 e 5. usuário não admin não pode enviar broadcast (403)', async () => {
            const token = await createSyntheticIdToken({ email: 'comum@example.com' });
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: token,
                    action: 'broadcast',
                    mensagem: 'Comunicado de teste',
                    destino: 'todos'
                })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toContain('Somente administradores');
        });

        it('4. deve rejeitar ação inválida ou destino inválido de broadcast', async () => {
            const token = await createSyntheticIdToken({ email: 'admin@example.com' });

            // Ação inválida
            const reqAcao = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: token, action: 'acao_inexistente' })
            });
            const resAcao = await worker.fetch(reqAcao, fakeEnv);
            expect(resAcao.status).toBe(400);

            // Destino inválido em broadcast
            const reqDestino = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: token,
                    action: 'broadcast',
                    mensagem: 'Olá',
                    destino: 'destino_fantasma'
                })
            });
            const resDestino = await worker.fetch(reqDestino, fakeEnv);
            expect(resDestino.status).toBe(400);
            const dataDestino = await resDestino.json();
            expect(dataDestino.error).toContain('Destino inválido');
        });

        it('5. admin pode enviar broadcast para admins com sucesso', async () => {
            const token = await createSyntheticIdToken({ email: 'admin@example.com' });
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: token,
                    action: 'broadcast',
                    mensagem: 'Alerta para admins',
                    destino: 'admins'
                })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.ok).toBe(true);
            expect(data.action).toBe('broadcast');
            expect(data.destino).toBe('admins');
        });

        it('6. notify direto para destinatário individual por admin', async () => {
            const token = await createSyntheticIdToken({ email: 'admin@example.com' });
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: token,
                    action: 'notify',
                    notificacao: {
                        para: 'publicador@example.com',
                        texto: 'Seu território foi designado',
                        tipo: 'designacao'
                    }
                })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.ok).toBe(true);
            expect(data.destinatarios).toBe(1);
        });

        it('7. notify para ADMINS com tipos permitidos e bloqueio de tipos não permitidos', async () => {
            // Publicador comum notificando conclusão (permitido)
            const tokenComum = await createSyntheticIdToken({ email: 'comum@example.com' });
            const reqConclusao = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: tokenComum,
                    action: 'notify',
                    notificacao: {
                        para: 'ADMINS',
                        texto: 'Território concluído',
                        tipo: 'conclusao',
                        origem: 'sistema'
                    }
                })
            });
            const resConclusao = await worker.fetch(reqConclusao, fakeEnv);
            expect(resConclusao.status).toBe(200);

            // Publicador comum tentando enviar 'cadastro' para ADMINS (negado, somente 'aguardando' pode)
            const reqCadastroNegado = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: tokenComum,
                    action: 'notify',
                    notificacao: {
                        para: 'ADMINS',
                        texto: 'Tentativa de cadastro',
                        tipo: 'cadastro',
                        origem: 'sistema'
                    }
                })
            });
            const resCadastroNegado = await worker.fetch(reqCadastroNegado, fakeEnv);
            expect(resCadastroNegado.status).toBe(403);

            // Usuário aguardando notificando 'cadastro' para ADMINS (permitido)
            const tokenAguardando = await createSyntheticIdToken({ email: 'aguardando@example.com' });
            const reqCadastroOk = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: tokenAguardando,
                    action: 'notify',
                    notificacao: {
                        para: 'ADMINS',
                        texto: 'Novo publicador aguardando aprovação',
                        tipo: 'cadastro',
                        origem: 'sistema'
                    }
                })
            });
            const resCadastroOk = await worker.fetch(reqCadastroOk, fakeEnv);
            expect(resCadastroOk.status).toBe(200);
        });

        it('8. destinatário inexistente retorna 0 destinatários sem crashar', async () => {
            const token = await createSyntheticIdToken({ email: 'admin@example.com' });
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: token,
                    action: 'notify',
                    notificacao: {
                        para: 'inexistente@example.com',
                        texto: 'Mensagem'
                    }
                })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.destinatarios).toBe(0);
            expect(data.tokens).toBe(0);
        });

        it('9. deve deduplicar tokens repetidos de um usuário', () => {
            const destinatarios = [
                { id: 'u1', fcmTokens: ['token_a', 'token_b', 'token_a'] },
                { id: 'u2', fcmTokens: ['token_b', 'token_c'] }
            ];
            const tokens = getTokensDestinatarios(destinatarios);
            expect(tokens).toEqual(['token_a', 'token_b', 'token_c']);
        });
    });

    describe('P4c: Push OneSignal, Fallback e Concorrência FCM', () => {
        it('10. deve executar fallback para FCM quando OneSignal falhar com 0 entregas', async () => {
            // Mock OneSignal retornando falha
            fetchMock = vi.fn(async (url) => {
                const urlStr = String(url);
                if (urlStr.includes('api.onesignal.com')) {
                    return new Response(JSON.stringify({ ok: false, error: 'OneSignal down', recipients: 0 }), { status: 500 });
                }
                if (urlStr.includes('fcm.googleapis.com')) {
                    return new Response(JSON.stringify({ name: 'fcm-msg-fallback' }), { status: 200 });
                }
                // Repassa para os mocks padrão
                if (urlStr.includes('securetoken@system.gserviceaccount.com')) {
                    return new Response(JSON.stringify({ keys: [testJwksKey] }), { status: 200, headers: { 'Cache-Control': 'max-age=3600' } });
                }
                if (urlStr.includes('oauth2.googleapis.com/token')) {
                    return new Response(JSON.stringify({ access_token: 'fake-google-token', expires_in: 3600 }), { status: 200 });
                }
                if (urlStr.includes('/databases/(default)/documents/usuarios/')) {
                    return new Response(JSON.stringify({
                        name: 'projects/test/databases/(default)/documents/usuarios/admin%40example.com',
                        fields: { role: { stringValue: 'admin' }, fcmTokens: { arrayValue: { values: [{ stringValue: 'fcm_tok' }] } } }
                    }), { status: 200 });
                }
                if (urlStr.includes(':commit')) return new Response(JSON.stringify({}), { status: 200 });
                return new Response(JSON.stringify({}), { status: 200 });
            });
            globalThis.fetch = fetchMock;

            const token = await createSyntheticIdToken({ email: 'admin@example.com' });
            const req = new Request('https://worker.test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: token,
                    action: 'notify',
                    notificacao: { para: 'admin@example.com', texto: 'Teste fallback' }
                })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.canal).toBe('onesignal+fcm');
            expect(data.pushesEnviados).toBe(1);
        });

        it('11. concorrência limitada mapWithConcurrencyLimit processa todos os itens e lida com falhas parciais', async () => {
            const tokens = Array.from({ length: 12 }, (_, i) => `token_${i}`);
            let active = 0;
            let maxActive = 0;

            const resultados = await mapWithConcurrencyLimit(tokens, 3, async (t, idx) => {
                active++;
                maxActive = Math.max(maxActive, active);
                // Simula delay assíncrono
                await new Promise((resolve) => setTimeout(resolve, 5));
                active--;
                if (idx === 2) throw new Error('Falha no token 2');
                return { ok: true, token: t };
            });

            expect(maxActive).toBeLessThanOrEqual(3);
            expect(resultados).toHaveLength(12);
            expect(resultados[0].ok).toBe(true);
            expect(resultados[2].ok).toBe(false);
            expect(resultados[2].error).toContain('Falha no token 2');
            expect(resultados[5].ok).toBe(true);
        });
    });

    describe('P4a: Magic Link e CORS', () => {
        it('12. magic link deve rejeitar e-mail inválido (400)', async () => {
            const req = new Request('https://worker.test/auth/magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'email_invalido' })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toContain('e-mail válido');
        });

        it('12b. magic link com e-mail válido processa envio', async () => {
            const req = new Request('https://worker.test/auth/magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'publicador@example.com', redirectPath: '/app' })
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.ok).toBe(true);
            expect(data.channel).toBe('emailjs');
        });

        it('13. CORS preflight (OPTIONS) deve retornar 204 com headers apropriados', async () => {
            const req = new Request('https://worker.test/send', {
                method: 'OPTIONS',
                headers: { Origin: 'https://territ-es-sbs.web.app' }
            });
            const res = await worker.fetch(req, fakeEnv);
            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://territ-es-sbs.web.app');
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
            expect(res.headers.get('Vary')).toBe('Origin');
        });

        it('13b. CORS sem Origin reflete "*"', () => {
            const req = new Request('https://worker.test/send', { method: 'POST' });
            const headers = corsHeaders(req);
            expect(headers['Access-Control-Allow-Origin']).toBe('*');
            expect(headers['Vary']).toBe('Origin');
        });
    });

    describe('Utilitários puros do Worker', () => {
        it('podeUsuarioNotificarAdmins valida papéis e origens', () => {
            expect(podeUsuarioNotificarAdmins({ usuarioRemetente: { role: 'aguardando' }, tipo: 'cadastro', origem: 'sistema' })).toBe(true);
            expect(podeUsuarioNotificarAdmins({ usuarioRemetente: { role: 'comum' }, tipo: 'conclusao', origem: 'sistema' })).toBe(true);
            expect(podeUsuarioNotificarAdmins({ usuarioRemetente: { role: 'comum' }, tipo: 'devolucao', origem: 'sistema' })).toBe(true);
            expect(podeUsuarioNotificarAdmins({ usuarioRemetente: { role: 'comum' }, tipo: 'cadastro', origem: 'sistema' })).toBe(false);
            expect(podeUsuarioNotificarAdmins({ usuarioRemetente: { role: 'comum' }, tipo: 'conclusao', origem: 'usuario' })).toBe(false);
        });

        it('valida e-mails de autenticação e redirecionamento', () => {
            expect(isValidAuthEmail('test@domain.com')).toBe(true);
            expect(isValidAuthEmail('not-an-email')).toBe(false);
            expect(normalizeRedirectPath('/app/dashboard')).toBe('/app/dashboard');
            expect(normalizeRedirectPath('//malicious.com')).toBe('');
            expect(normalizeRedirectPath('invalid')).toBe('');
        });

        it('buildContinueUrl constrói redirect URL preservando hash', () => {
            const env = { PUBLIC_APP_URL: 'https://app.test/#/home' };
            const url = buildContinueUrl(env, '/admin');
            expect(url).toContain('redirect=%2Fadmin');
            expect(url).toContain('#/home');
        });
    });
});
