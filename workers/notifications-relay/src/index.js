const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ONESIGNAL_NOTIFICATIONS_URL = 'https://api.onesignal.com/notifications';
const IDENTITY_TOOLKIT_SEND_OOB_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';
const MAGIC_LINK_EMAIL_COOLDOWN_MS = 60 * 1000;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;
let cachedFirebaseJwks = null;
let cachedFirebaseJwksExpiry = 0;

const json = (data, status = 200, extraHeaders = {}) =>
    new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...extraHeaders
        }
    });

const corsHeaders = (request) => ({
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
});

const parseJsonBody = async (request) => {
    try {
        return await request.json();
    } catch {
        throw new Error('Corpo JSON inválido.');
    }
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (value) => emailRegex.test(normalizeEmail(value));

const parseDateValue = (value) => {
    if (!value) return null;
    const timestamp = Date.parse(String(value));
    return Number.isNaN(timestamp) ? null : timestamp;
};

const getRequestIp = (request) =>
    String(
        request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')
        || ''
    )
        .split(',')[0]
        .trim();

const encodeBase64Url = (input) =>
    btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const decodeBase64UrlString = (input) => {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
};

const decodeBase64UrlBytes = (input) => {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

const pemToArrayBuffer = (pem) => {
    const normalized = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');

    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
};

const importPrivateKey = async (privateKeyPem) =>
    crypto.subtle.importKey(
        'pkcs8',
        pemToArrayBuffer(privateKeyPem),
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        },
        false,
        ['sign']
    );

const signJwt = async (claims, privateKeyPem) => {
    const header = { alg: 'RS256', typ: 'JWT' };
    const encoder = new TextEncoder();
    const encodedHeader = encodeBase64Url(encoder.encode(JSON.stringify(header)));
    const encodedClaims = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
    const data = `${encodedHeader}.${encodedClaims}`;
    const key = await importPrivateKey(privateKeyPem);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        encoder.encode(data)
    );

    return `${data}.${encodeBase64Url(signature)}`;
};

const getServiceAccountPrivateKey = (env) =>
    String(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const getGoogleAccessToken = async (env) => {
    const now = Math.floor(Date.now() / 1000);
    if (cachedAccessToken && cachedAccessTokenExpiry - 60 > now) {
        return cachedAccessToken;
    }

    const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = getServiceAccountPrivateKey(env);

    if (!clientEmail || !privateKey) {
        throw new Error('Secrets do service account não configurados no Worker.');
    }

    const jwt = await signJwt({
        iss: clientEmail,
        sub: clientEmail,
        aud: GOOGLE_OAUTH_TOKEN_URL,
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/cloud-platform'
    }, privateKey);

    const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(`Falha ao obter access token Google: ${JSON.stringify(tokenData)}`);
    }

    cachedAccessToken = tokenData.access_token;
    cachedAccessTokenExpiry = now + Number(tokenData.expires_in || 3600);
    return cachedAccessToken;
};

const parseMaxAgeSeconds = (cacheControl) => {
    const match = String(cacheControl || '').match(/max-age=(\d+)/i);
    return match ? Number(match[1]) : 3600;
};

const getFirebaseJwks = async () => {
    const now = Math.floor(Date.now() / 1000);
    if (cachedFirebaseJwks && cachedFirebaseJwksExpiry - 60 > now) {
        return cachedFirebaseJwks;
    }

    const response = await fetch(FIREBASE_JWKS_URL);
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.keys)) {
        throw new Error('Não foi possível carregar as chaves públicas do Firebase.');
    }

    cachedFirebaseJwks = data.keys;
    cachedFirebaseJwksExpiry = now + parseMaxAgeSeconds(response.headers.get('Cache-Control'));
    return cachedFirebaseJwks;
};

const importFirebasePublicKey = async (jwk) =>
    crypto.subtle.importKey(
        'jwk',
        jwk,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        },
        false,
        ['verify']
    );

const verifyFirebaseIdToken = async (idToken, env) => {
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) {
        throw new Error('Sessão Firebase inválida.');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(decodeBase64UrlString(encodedHeader));
    const payload = JSON.parse(decodeBase64UrlString(encodedPayload));
    if (header.alg !== 'RS256' || !header.kid) {
        throw new Error('Sessão Firebase com assinatura inválida.');
    }

    const jwks = await getFirebaseJwks();
    const jwk = jwks.find((key) => key.kid === header.kid);
    if (!jwk) {
        cachedFirebaseJwks = null;
        throw new Error('Chave pública Firebase não encontrada para validar a sessão.');
    }

    const publicKey = await importFirebasePublicKey(jwk);
    const encoder = new TextEncoder();
    const validSignature = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        decodeBase64UrlBytes(encodedSignature),
        encoder.encode(`${encodedHeader}.${encodedPayload}`)
    );

    const now = Math.floor(Date.now() / 1000);
    const issuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
    if (
        !validSignature
        || payload.aud !== env.FIREBASE_PROJECT_ID
        || payload.iss !== issuer
        || !payload.sub
        || String(payload.sub).length > 128
        || Number(payload.exp || 0) <= now
        || Number(payload.iat || 0) > now + 300
    ) {
        throw new Error('Não foi possível validar a sessão Firebase no Worker.');
    }

    return {
        localId: payload.user_id || payload.sub,
        email: payload.email || '',
        emailVerified: Boolean(payload.email_verified),
        raw: payload
    };
};

const parseFirestoreValue = (value) => {
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return Number(value.doubleValue);
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map(parseFirestoreValue);
    }
    if (value.mapValue !== undefined) {
        return parseFirestoreFields(value.mapValue.fields || {});
    }
    if (value.nullValue !== undefined) return null;
    return null;
};

const parseFirestoreFields = (fields) =>
    Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, parseFirestoreValue(value)]));

const toFirestoreValue = (value) => {
    if (value === null || value === undefined) return { nullValue: null };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(toFirestoreValue) } };
    }
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    if (typeof value === 'object') {
        return {
            mapValue: {
                fields: Object.fromEntries(
                    Object.entries(value).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)])
                )
            }
        };
    }
    return { stringValue: String(value) };
};

const firestoreDocumentUrl = (env, path) =>
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

const firestoreDocumentName = (env, path) =>
    `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

const firestoreCommitUrl = (env) =>
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;

const getPublicAppUrl = (env) => String(env.PUBLIC_APP_URL || 'https://territorios-15891-palmas-pr.web.app').replace(/\/$/, '');
const getAppDisplayName = (env) => String(env.APP_DISPLAY_NAME || 'Territórios').trim() || 'Territórios';
const getAppSubtitle = (env) => String(env.APP_SUBTITLE || '').trim();
const getAppIconPath = (env) => String(env.APP_ICON_PATH || '/icon-192.png').trim() || '/icon-192.png';
const getMagicLinkEmailSubject = (env) => String(env.MAGIC_LINK_EMAIL_SUBJECT || '').trim();
const getMagicLinkEmailIntro = (env) => String(env.MAGIC_LINK_EMAIL_INTRO || '').trim();
const getMagicLinkEmailButtonLabel = (env) => String(env.MAGIC_LINK_EMAIL_BUTTON_LABEL || '').trim();
const getMagicLinkEmailHint = (env) => String(env.MAGIC_LINK_EMAIL_HINT || '').trim();
const getMagicLinkEmailFooter = (env) => String(env.MAGIC_LINK_EMAIL_FOOTER || '').trim();
const getAppIconUrl = (env) => {
    const iconPath = getAppIconPath(env);
    if (/^https?:\/\//i.test(iconPath)) return iconPath;
    const normalizedPath = iconPath.startsWith('/') ? iconPath : `/${iconPath}`;
    return `${getPublicAppUrl(env)}${normalizedPath}`;
};

const stripFirestoreMetadata = (document) => {
    if (!document) return {};
    const { name: _DOCUMENT_NAME, id: _DOCUMENT_ID, ...fields } = document;
    return fields;
};

const writeFirestoreDocument = async (env, accessToken, path, data) => {
    const response = await fetch(firestoreCommitUrl(env), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            writes: [
                {
                    update: {
                        name: firestoreDocumentName(env, path),
                        fields: Object.fromEntries(
                            Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])
                        )
                    }
                }
            ]
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Erro ao gravar documento Firestore ${path}: ${JSON.stringify(payload)}`);
    }
};

const getFirestoreDocument = async (env, accessToken, path) => {
    const response = await fetch(firestoreDocumentUrl(env, path), {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (response.status === 404) return null;

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Erro ao buscar documento Firestore ${path}: ${JSON.stringify(data)}`);
    }

    return {
        name: data.name,
        id: data.name.split('/').pop(),
        ...parseFirestoreFields(data.fields || {})
    };
};

const listUsuarios = async (env, accessToken) => {
    let pageToken = '';
    const usuarios = [];

    do {
        const url = new URL(firestoreDocumentUrl(env, 'usuarios'));
        url.searchParams.set('pageSize', '1000');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Erro ao listar usuários do Firestore: ${JSON.stringify(data)}`);
        }

        for (const doc of data.documents || []) {
            usuarios.push({
                name: doc.name,
                id: doc.name.split('/').pop(),
                ...parseFirestoreFields(doc.fields || {})
            });
        }

        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return usuarios;
};

const escreverNotificacoes = async (env, accessToken, notificacoes) => {
    if (!notificacoes.length) return;

    const batchSize = 400;
    for (let index = 0; index < notificacoes.length; index += batchSize) {
        const writes = notificacoes.slice(index, index + batchSize).map((notificacao) => ({
            update: {
                name: firestoreDocumentName(env, `notificacoes/${crypto.randomUUID()}`),
                fields: Object.fromEntries(
                    Object.entries(notificacao).map(([key, value]) => [key, toFirestoreValue(value)])
                )
            }
        }));

        const response = await fetch(firestoreCommitUrl(env), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ writes })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Erro ao gravar notificações no Firestore: ${JSON.stringify(data)}`);
        }
    }
};

const criarSolicitacaoPendenteSeNecessario = async (env, accessToken, email) => {
    const normalized = normalizeEmail(email);
    const userPath = `usuarios/${encodeURIComponent(normalized)}`;
    const existente = await getFirestoreDocument(env, accessToken, userPath);
    const agora = new Date();

    if (!existente) {
        await writeFirestoreDocument(env, accessToken, userPath, {
            role: 'aguardando',
            nome: 'Sem nome',
            emailOriginal: normalized,
            whatsapp: '',
            criadoEm: agora,
            ultimoEnvioLinkMagicoEm: agora
        });

        return {
            created: true,
            user: {
                role: 'aguardando',
                nome: 'Sem nome',
                emailOriginal: normalized,
                whatsapp: '',
                criadoEm: agora.toISOString(),
                ultimoEnvioLinkMagicoEm: agora.toISOString()
            }
        };
    }

    const dadosUsuario = stripFirestoreMetadata(existente);
    const ultimoEnvio = parseDateValue(dadosUsuario.ultimoEnvioLinkMagicoEm);
    if (ultimoEnvio && (Date.now() - ultimoEnvio) < MAGIC_LINK_EMAIL_COOLDOWN_MS) {
        throw new Error('Aguarde 1 minuto antes de pedir outro link para este e-mail.');
    }

    await writeFirestoreDocument(env, accessToken, userPath, {
        ...dadosUsuario,
        emailOriginal: dadosUsuario.emailOriginal || normalized,
        ultimoEnvioLinkMagicoEm: agora
    });

    return {
        created: false,
        user: {
            ...dadosUsuario,
            emailOriginal: dadosUsuario.emailOriginal || normalized,
            ultimoEnvioLinkMagicoEm: agora.toISOString()
        }
    };
};

const avisarAdminsNovoCadastroPendente = async (env, accessToken, usuarios, email) => {
    const admins = usuarios.filter((usuario) => usuario.role === 'admin');
    if (!admins.length) return;

    const texto = `Novo cadastro pendente: ${email}`;
    const agora = new Date();
    await escreverNotificacoes(
        env,
        accessToken,
        admins.map((admin) => ({
            para: admin.id,
            texto,
            data: agora,
            lida: false,
            tipo: 'cadastro',
            origem: 'sistema'
        }))
    );

    await enviarPushes(env, accessToken, {
        titulo: 'Novo cadastro pendente',
        mensagem: texto,
        tipo: 'cadastro',
        tokens: getTokensDestinatarios(admins),
        externalIds: getExternalIdsDestinatarios(admins),
        targetRoute: '/app'
    });
};

const gerarLinkMagicoFirebase = async (env, accessToken, { email, settings, userIp }) => {
    const response = await fetch(IDENTITY_TOOLKIT_SEND_OOB_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requestType: 'EMAIL_SIGNIN',
            email,
            continueUrl: String(settings?.url || getPublicAppUrl(env)).trim(),
            canHandleCodeInApp: Boolean(settings?.handleCodeInApp),
            androidPackageName: settings?.android?.packageName || undefined,
            androidInstallApp: Boolean(settings?.android?.installApp),
            userIp: userIp || undefined,
            targetProjectId: env.FIREBASE_PROJECT_ID,
            returnOobLink: true
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.oobLink) {
        throw new Error(`Falha ao gerar link mágico no Firebase: ${JSON.stringify(payload)}`);
    }

    return payload.oobLink;
};

const buildMagicLinkEmailPayload = (env, { email, magicLink }) => {
    const appName = getAppDisplayName(env);
    const appSubtitle = getAppSubtitle(env);
    const appIconUrl = getAppIconUrl(env);
    const publicUrl = getPublicAppUrl(env);
    const subject = getMagicLinkEmailSubject(env) || `Seu link de acesso ao ${appName}`;
    const introText = getMagicLinkEmailIntro(env) || `Recebemos um pedido de acesso ao ${appName}.`;
    const buttonLabel = getMagicLinkEmailButtonLabel(env) || 'Entrar com link mágico';
    const hintText = getMagicLinkEmailHint(env) || 'Use o botão abaixo para concluir o login com segurança no mesmo dispositivo em que possível.';
    const footerText = getMagicLinkEmailFooter(env) || 'O acesso continua sujeito à aprovação do administrador para o e-mail informado.';
    return {
        toEmail: email,
        appName,
        appSubtitle,
        appIconUrl,
        publicUrl,
        subject,
        introText,
        buttonLabel,
        hintText,
        footerText,
        magicLink
    };
};

const enviarMensagemFcm = async (env, accessToken, { token, titulo, mensagem, tipo = 'sistema', targetRoute = '/app' }) => {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: {
                token,
                notification: {
                    title: titulo,
                    body: mensagem
                },
                android: {
                    priority: 'high',
                    notification: {
                        channel_id: 'territorios-alertas'
                    }
                },
                data: {
                    tipo,
                    targetRoute
                }
            }
        })
    });

    if (response.ok) {
        return { ok: true };
    }

    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data };
};

const oneSignalDisponivel = (env) => Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY);

const enviarMensagemOneSignal = async (env, { externalIds, titulo, mensagem, tipo = 'sistema', targetRoute = '/app' }) => {
    const aliases = [...new Set(externalIds.filter(Boolean))];
    if (!aliases.length) {
        return { ok: true, enviados: 0 };
    }

    const response = await fetch(ONESIGNAL_NOTIFICATIONS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Key ${env.ONESIGNAL_REST_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            app_id: env.ONESIGNAL_APP_ID,
            target_channel: 'push',
            include_aliases: {
                external_id: aliases
            },
            headings: {
                en: titulo,
                pt: titulo
            },
            contents: {
                en: mensagem,
                pt: mensagem
            },
            data: {
                tipo,
                targetRoute
            },
            web_url: `${getPublicAppUrl(env)}/#${targetRoute.startsWith('/') ? targetRoute : `/${targetRoute}`}`
        })
    });

    const data = await response.json().catch(() => ({}));
    const errors = Array.isArray(data.errors) ? data.errors : (data.errors ? [data.errors] : []);
    const enviados = Number(data.recipients || 0);

    if (!response.ok || errors.length) {
        console.error('Falha ao enviar push OneSignal:', {
            status: response.status,
            externalIds: aliases.length,
            error: data
        });
        return {
            ok: false,
            enviados,
            error: data,
            id: data.id || null
        };
    }

    console.log('Push OneSignal enviado:', {
        id: data.id || null,
        recipients: enviados,
        externalIds: aliases.length
    });

    return {
        ok: true,
        enviados,
        id: data.id || null
    };
};

const getDestinatariosBroadcast = (usuarios, destino) => {
    if (destino === 'admins') {
        return usuarios.filter((user) => user.role === 'admin');
    }

    if (destino === 'todos') {
        return usuarios.filter((user) => user.role === 'admin' || user.role === 'comum');
    }

    throw new Error('Destino inválido para o comunicado.');
};

const getDestinatariosNotificacao = ({ usuarios, para }) => {
    if (para === 'ADMINS') {
        return usuarios.filter((user) => user.role === 'admin');
    }

    return usuarios.filter((user) => user.id === para);
};

const getTokensDestinatarios = (destinatarios) => [...new Set(
    destinatarios.flatMap((user) => {
        const lista = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
        return lista.length ? lista : (user.ultimoFcmToken ? [user.ultimoFcmToken] : []);
    }).filter(Boolean)
)];

const getExternalIdsDestinatarios = (destinatarios) => [...new Set(
    destinatarios.map((user) => user.id).filter(Boolean)
)];

const podeUsuarioNotificarAdmins = ({ usuarioRemetente, tipo, origem }) => {
    if (origem !== 'sistema') return false;

    if (tipo === 'cadastro') {
        return usuarioRemetente?.role === 'aguardando';
    }

    if (tipo === 'conclusao' || tipo === 'devolucao') {
        return usuarioRemetente?.role === 'admin' || usuarioRemetente?.role === 'comum';
    }

    return false;
};

const buildNotificacoesBroadcast = (destino, mensagem, agora, destinatarios) => {
    return destinatarios.map((user) => ({
        para: user.id,
        texto: mensagem,
        data: agora,
        lida: false,
        tipo: 'comunicado',
        origem: 'admin'
    }));
};

const buildNotificacaoAvulsa = (notificacao, agora, destinatarios) => destinatarios.map((user) => ({
    para: user.id,
    texto: notificacao.texto,
    data: agora,
    lida: false,
    tipo: notificacao.tipo || 'sistema',
    origem: notificacao.origem || 'sistema'
}));

const getPushConfigBroadcast = (destino) => ({
    titulo: destino === 'admins' ? 'Comunicado para administradores' : 'Comunicado do Territórios',
    targetRoute: destino === 'admins' ? '/admin' : '/app',
    tipo: 'comunicado'
});

const getPushConfigNotificacao = ({ para, tipo, tituloPush }) => {
    const tipoNormalizado = String(tipo || 'sistema');

    if (tituloPush) {
        return {
            titulo: tituloPush,
            targetRoute: para === 'ADMINS' ? '/admin' : '/app',
            tipo: tipoNormalizado
        };
    }

    const configPorTipo = {
        cadastro: {
            titulo: 'Novo cadastro pendente',
            targetRoute: '/admin'
        },
        conclusao: {
            titulo: 'Território finalizado',
            targetRoute: '/app'
        },
        devolucao: {
            titulo: 'Território devolvido',
            targetRoute: '/app'
        },
        comunicado: {
            titulo: para === 'ADMINS' ? 'Comunicado para administradores' : 'Comunicado do Territórios',
            targetRoute: para === 'ADMINS' ? '/admin' : '/app'
        },
        sistema: {
            titulo: 'Aviso do Territórios',
            targetRoute: para === 'ADMINS' ? '/admin' : '/app'
        }
    };

    const config = configPorTipo[tipoNormalizado] || configPorTipo.sistema;
    return {
        titulo: config.titulo,
        targetRoute: config.targetRoute,
        tipo: tipoNormalizado
    };
};

const enviarPushesFcm = async (env, accessToken, { titulo, mensagem, tipo, tokens, targetRoute }) => {
    const resultados = await Promise.all(tokens.map((token) => enviarMensagemFcm(env, accessToken, {
        token,
        titulo,
        mensagem,
        tipo,
        targetRoute
    })));

    return {
        pushesEnviados: resultados.filter((item) => item.ok).length,
        pushesFalharam: resultados.filter((item) => !item.ok).length
    };
};

const enviarPushes = async (env, accessToken, { titulo, mensagem, tipo, tokens, externalIds, targetRoute }) => {
    if (oneSignalDisponivel(env)) {
        const resultado = await enviarMensagemOneSignal(env, {
            externalIds,
            titulo,
            mensagem,
            tipo,
            targetRoute
        });

        if (!resultado.ok && resultado.enviados === 0 && tokens.length) {
            const fallbackFcm = await enviarPushesFcm(env, accessToken, {
                titulo,
                mensagem,
                tipo,
                tokens,
                targetRoute
            });

            return {
                canal: 'onesignal+fcm',
                pushesEnviados: fallbackFcm.pushesEnviados,
                pushesFalharam: fallbackFcm.pushesFalharam,
                erroPush: resultado.error,
                mensagemId: resultado.id || null
            };
        }

        return {
            canal: 'onesignal',
            pushesEnviados: resultado.ok ? resultado.enviados : 0,
            pushesFalharam: resultado.ok ? 0 : externalIds.length,
            erroPush: resultado.ok ? null : resultado.error,
            mensagemId: resultado.id || null
        };
    }

    const resultadoFcm = await enviarPushesFcm(env, accessToken, {
        titulo,
        mensagem,
        tipo,
        tokens,
        targetRoute
    });

    return {
        canal: 'fcm',
        pushesEnviados: resultadoFcm.pushesEnviados,
        pushesFalharam: resultadoFcm.pushesFalharam,
        erroPush: null,
        mensagemId: null
    };
};

const handleMagicLinkRequest = async (request, env, headers) => {
    const body = await parseJsonBody(request);
    const email = normalizeEmail(body?.email);
    const settings = body?.settings || {};

    if (!isValidEmail(email)) {
        return json({ error: 'Informe um e-mail válido para receber o link mágico.' }, 400, headers);
    }

    const accessToken = await getGoogleAccessToken(env);
    const { created } = await criarSolicitacaoPendenteSeNecessario(env, accessToken, email);
    const magicLink = await gerarLinkMagicoFirebase(env, accessToken, {
        email,
        settings,
        userIp: getRequestIp(request)
    });
    const emailTemplate = buildMagicLinkEmailPayload(env, {
        email,
        magicLink
    });

    if (created) {
        try {
            const usuarios = await listUsuarios(env, accessToken);
            await avisarAdminsNovoCadastroPendente(env, accessToken, usuarios, email);
        } catch (error) {
            console.error('Falha ao avisar admins sobre cadastro pendente:', error);
        }
    }

    return json({
        ok: true,
        action: 'magic-link',
        email,
        created,
        provider: 'emailjs',
        magicLink,
        emailTemplate
    }, 200, headers);
};

const handleNotificationRelayRequest = async (request, env, headers) => {
    const body = await parseJsonBody(request);
    const action = String(body?.action || 'broadcast').trim();
    const idToken = String(body?.idToken || '').trim();

    if (!idToken) {
        return json({ error: 'Sessão ausente para enviar notificação.' }, 401, headers);
    }

    const authUser = await verifyFirebaseIdToken(idToken, env);
    const email = String(authUser.email || '').toLowerCase();
    if (!email) {
        return json({ error: 'E-mail do usuário autenticado não encontrado.' }, 401, headers);
    }

    const accessToken = await getGoogleAccessToken(env);
    const usuarioRemetente = await getFirestoreDocument(env, accessToken, `usuarios/${encodeURIComponent(email)}`);
    const isAdmin = usuarioRemetente?.role === 'admin';
    const usuarios = await listUsuarios(env, accessToken);

    if (action === 'broadcast') {
        const mensagem = String(body?.mensagem || '').trim();
        const destino = String(body?.destino || '').trim();

        if (!mensagem) {
            return json({ error: 'Mensagem obrigatória.' }, 400, headers);
        }

        if (!isAdmin) {
            return json({ error: 'Somente administradores podem enviar comunicado com push.' }, 403, headers);
        }

        const destinatarios = getDestinatariosBroadcast(usuarios, destino);
        const tokens = getTokensDestinatarios(destinatarios);
        const externalIds = getExternalIdsDestinatarios(destinatarios);
        const agora = new Date();
        const notificacoesInternas = buildNotificacoesBroadcast(destino, mensagem, agora, destinatarios);
        await escreverNotificacoes(env, accessToken, notificacoesInternas);

        const pushConfig = getPushConfigBroadcast(destino);
        const { canal, pushesEnviados, pushesFalharam, mensagemId } = await enviarPushes(env, accessToken, {
            titulo: pushConfig.titulo,
            mensagem,
            tipo: pushConfig.tipo,
            tokens,
            externalIds,
            targetRoute: pushConfig.targetRoute
        });

        return json({
            ok: true,
            action,
            destino,
            destinatarios: destinatarios.length,
            tokens: tokens.length,
            externalIds: externalIds.length,
            canal,
            pushesEnviados,
            pushesFalharam,
            mensagemId
        }, 200, headers);
    }

    if (action === 'notify') {
        const notificacao = body?.notificacao || {};
        const para = String(notificacao?.para || '').trim();
        const texto = String(notificacao?.texto || '').trim();
        const tipo = String(notificacao?.tipo || 'sistema').trim();
        const origem = String(notificacao?.origem || 'sistema').trim();
        const tituloPush = String(notificacao?.tituloPush || 'Territórios').trim();

        if (!para || !texto) {
            return json({ error: 'Notificação inválida: informe destinatário e texto.' }, 400, headers);
        }

        if (para !== 'ADMINS' && !isAdmin) {
            return json({ error: 'Somente administradores podem enviar notificações para outros usuários.' }, 403, headers);
        }

        if (para === 'ADMINS' && !isAdmin && !podeUsuarioNotificarAdmins({ usuarioRemetente, tipo, origem })) {
            return json({ error: 'Este tipo de notificação para administradores não é permitido.' }, 403, headers);
        }

        const destinatarios = getDestinatariosNotificacao({ usuarios, para });
        const tokens = getTokensDestinatarios(destinatarios);
        const externalIds = getExternalIdsDestinatarios(destinatarios);
        const agora = new Date();
        const notificacoesInternas = buildNotificacaoAvulsa({
            para,
            texto,
            tipo,
            origem
        }, agora, destinatarios);
        await escreverNotificacoes(env, accessToken, notificacoesInternas);

        const pushConfig = getPushConfigNotificacao({ para, tipo, tituloPush });
        const { canal, pushesEnviados, pushesFalharam, mensagemId } = await enviarPushes(env, accessToken, {
            titulo: pushConfig.titulo,
            mensagem: texto,
            tipo: pushConfig.tipo,
            tokens,
            externalIds,
            targetRoute: pushConfig.targetRoute
        });

        return json({
            ok: true,
            action,
            para,
            destinatarios: destinatarios.length,
            tokens: tokens.length,
            externalIds: externalIds.length,
            canal,
            pushesEnviados,
            pushesFalharam,
            mensagemId
        }, 200, headers);
    }

    return json({ error: 'Ação de relay inválida.' }, 400, headers);
};

export default {
    async fetch(request, env) {
        const headers = corsHeaders(request);
        const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }

        if (request.method !== 'POST') {
            return json({ error: 'Método não permitido.' }, 405, headers);
        }

        try {
            if (!env.FIREBASE_PROJECT_ID) {
                throw new Error('FIREBASE_PROJECT_ID não configurado no Worker.');
            }

            if (pathname === '/auth/magic-link') {
                return await handleMagicLinkRequest(request, env, headers);
            }

            if (pathname === '/send') {
                return await handleNotificationRelayRequest(request, env, headers);
            }

            return json({ error: 'Rota do relay inválida.' }, 404, headers);
        } catch (error) {
            console.error('Erro no notifications relay:', error);
            return json({
                error: error instanceof Error ? error.message : 'Falha inesperada no relay.'
            }, 500, headers);
        }
    }
};
