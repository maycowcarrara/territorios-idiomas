export class ValidacaoDesignacaoError extends Error {
  constructor(message) {
    super(message);
    this.code = 400;
  }
}
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const MAX_ENDERECOS_DESIGNACAO = 100;
export const temDesignacaoAtiva = (grupo) =>
  Boolean(
    grupo?.designadoPara ||
    grupo?.designadoContatoId ||
    grupo?.designacaoTipo === "link",
  );

export const coberturaConfirmadaGrupo = (grupo, completoLegado = false) =>
  grupo?.status === "finalizado" ||
  (Boolean(grupo?.designadoPara || !grupo?.ultimaDesignacaoLinkId) &&
    grupo?.designacaoTipo !== "link" &&
    completoLegado);

export function normalizarTelefone(entrada, pais = "BR") {
  // WhatsApp/contact apps may surround pasted numbers with bidi formatting.
  const raw = String(entrada || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  const erro = () => new ValidacaoDesignacaoError("Informe um telefone válido com DDI, DDD e número.");
  if (!/^\+?[0-9\s().-]+$/.test(raw)) throw erro();
  const digits = raw.replace(/\D/g, "");
  // 10/11 digits are national BR (including DDD 55); longer input carries DDI.
  if (!raw.startsWith("+") && pais !== "BR") {
    const legado = pais !== "INT" && pais !== "OUTRO" ? parsePhoneNumberFromString(raw, { defaultCountry: pais, extract: false }) : null;
    if (!legado?.isValid()) throw erro();
    return legado.number;
  }
  if (!raw.startsWith("+") && digits.length > 11 && !/^55\d{10,11}$/.test(digits)) throw erro();
  const internacional = raw.startsWith("+") || digits.length > 11;
  let numero = internacional ? `+${digits}` : `+55${digits}`;
  if (numero.startsWith("+55")) {
    const nacional = numero.slice(3);
    if (nacional.length === 10 && /^[6-9]/.test(nacional.slice(2))) {
      const candidato = `+55${nacional.slice(0, 2)}9${nacional.slice(2)}`;
      const mobile = parsePhoneNumberFromString(candidato, { extract: false });
      if (mobile?.isValid() && mobile.getType() === "MOBILE") numero = candidato;
    }
  }
  const telefone = parsePhoneNumberFromString(numero, { extract: false });
  if (!telefone?.isValid()) throw erro();
  return telefone.number;
}

export function aliasesTelefone(numero) {
  const canonico = normalizarTelefone(numero);
  const aliases = [canonico];
  const parsed = parsePhoneNumberFromString(canonico);
  if (parsed.country === "BR" && parsed.getType() === "MOBILE")
    aliases.push(`+55${parsed.nationalNumber.slice(0, 2)}${parsed.nationalNumber.slice(3)}`);
  return aliases;
}

export function contatoCorrespondeBusca(contato, busca) {
  const texto = String(busca || "").trim().toLowerCase();
  if (!texto || String(contato.nome || "").toLowerCase().includes(texto)) return true;
  const telefone = contato.telefoneE164 || contato.whatsapp || "";
  try { if (normalizarTelefone(texto) === normalizarTelefone(telefone)) return true; } catch { /* partial query */ }
  const digits = texto.replace(/\D/g, "");
  return digits.length > 2 && /^[+0-9\s().-]+$/.test(texto) && telefone.replace(/\D/g, "").includes(digits);
}

export function validarPrazo(dias) {
  if (!Number.isInteger(dias) || dias < 1 || dias > 3650)
    throw new ValidacaoDesignacaoError(
      "Informe um prazo inteiro entre 1 e 3650 dias.",
    );
  return dias;
}

export const diaLocal = (valor) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
    new Date(valor),
  );

export function validarDataCobertura(data, inicio, agora) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data || "") ||
    !Number.isFinite(Date.parse(`${data}T12:00:00Z`)) ||
    new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data ||
    data < diaLocal(inicio) ||
    data > diaLocal(agora)
  ) {
    throw new ValidacaoDesignacaoError(
      "Escolha uma data entre o início deste trabalho e hoje.",
    );
  }
  return data;
}

export function resumoDevolucao(feitos, total) {
  const pendentes = total - feitos;
  if (feitos === total)
    return {
      texto: `Você está devolvendo este território com todos os ${total} endereços marcados como feitos. Confirma que ele foi totalmente coberto?`,
      acao: "Confirmar cobertura e devolver",
    };
  if (!feitos)
    return {
      texto: `Nenhum dos ${total} endereços foi marcado como feito. O território será devolvido sem confirmação de cobertura.`,
      acao: "Devolver sem cobertura",
    };
  return {
    texto: `Você marcou ${feitos} de ${total} endereços como feitos. Os outros ${pendentes} ficarão pendentes. Deseja devolver assim?`,
    acao: `Devolver com ${pendentes} pendentes`,
  };
}

export function comporMensagem({
  nome,
  codigo,
  territorioNome,
  enderecos,
  expiraEm,
  link,
  herdados = [],
  codigoAcesso,
}) {
  const cabecalho = `Olá, ${nome}!\nTerritório ${codigo} — ${territorioNome}\n${enderecos.length} endereços\nDevolver até ${diaLocal(expiraEm).split("-").reverse().join("/")}`;
  const locais = enderecos.map(
    (e) =>
      `${e.codigo} — ${e.endereco}${herdados.length ? ` — ${herdados.includes(e.id) ? "Feito anteriormente" : "Pendente"}` : ""}\n${e.mapsUrl}`,
  );
  const rodape = `${codigoAcesso ? `Código de acesso: ${codigoAcesso}\nO QR do cartão permite consultar os endereços. Este código libera marcações e devolução.\n` : ""}Abra para ver os endereços, marcar o que foi feito e devolver o território:\n${link}`;
  const abertura = [cabecalho, rodape].join("\n\n");
  const mensagem = [abertura, ...locais].join("\n\n");
  // Partes por endereço inteiro; nunca cortar a lista enviada.
  const partes = [];
  let atual = abertura;
  for (const local of locais) {
    if (atual.length + local.length > 1800) {
      partes.push(atual);
      atual = "";
    }
    atual += `${atual ? "\n\n" : ""}${local}`;
  }
  if (atual) partes.push(atual);
  return {
    mensagem,
    partes: partes.map((p, i) =>
      partes.length > 1 ? `Parte ${i + 1}/${partes.length}\n${p}` : p,
    ),
  };
}
