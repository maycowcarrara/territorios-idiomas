import { doc, getDoc, setDoc } from 'firebase/firestore';

export const USUARIOS_COLLECTION = 'usuarios';

export function normalizeUsuarioEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function isValidUsuarioEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeUsuarioEmail(value));
}

export function formatWhatsappDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

export function isValidWhatsappDigits(value) {
    const digits = formatWhatsappDigits(value);
    return digits.length === 0 || (digits.length >= 10 && digits.length <= 11);
}

export function buildUsuarioAprovadoData({ email, nome, whatsapp = '', criadoPor = null, origem = 'manual', existente = null, agora = new Date() }) {
    const emailFormatado = normalizeUsuarioEmail(email);

    if (!isValidUsuarioEmail(emailFormatado)) {
        throw new Error('Informe um e-mail válido.');
    }

    const whatsappLimpo = formatWhatsappDigits(whatsapp);
    if (!isValidWhatsappDigits(whatsappLimpo)) {
        throw new Error('O WhatsApp deve ter DDD + 8 ou 9 dígitos.');
    }

    const nomeSeguro = String(nome || existente?.nome || emailFormatado).trim() || emailFormatado;
    const dadosBase = {
        role: existente?.role === 'admin' ? 'admin' : 'comum',
        nome: nomeSeguro,
        whatsapp: whatsappLimpo || existente?.whatsapp || '',
        emailOriginal: existente?.emailOriginal || email,
        atualizadoEm: agora
    };

    if (!existente) {
        dadosBase.criadoEm = agora;
        dadosBase.criadoPor = criadoPor || null;
        dadosBase.origemCadastro = origem;
    }

    return {
        email: emailFormatado,
        id: emailFormatado,
        dados: dadosBase
    };
}

export async function ensureUsuarioAprovado(db, { email, nome, whatsapp = '', criadoPor = null, origem = 'manual' }) {
    const emailFormatado = normalizeUsuarioEmail(email);

    if (!isValidUsuarioEmail(emailFormatado)) {
        throw new Error('Informe um e-mail válido.');
    }

    const whatsappLimpo = formatWhatsappDigits(whatsapp);
    if (!isValidWhatsappDigits(whatsappLimpo)) {
        throw new Error('O WhatsApp deve ter DDD + 8 ou 9 dígitos.');
    }

    const usuarioRef = doc(db, USUARIOS_COLLECTION, emailFormatado);
    const snapshot = await getDoc(usuarioRef);
    const existente = snapshot.exists() ? snapshot.data() : null;
    const { dados: dadosBase } = buildUsuarioAprovadoData({
        email,
        nome,
        whatsapp: whatsappLimpo,
        criadoPor,
        origem,
        existente
    });

    await setDoc(usuarioRef, dadosBase, { merge: true });

    return {
        email: emailFormatado,
        id: emailFormatado,
        role: dadosBase.role,
        nome: dadosBase.nome,
        whatsapp: dadosBase.whatsapp
    };
}
