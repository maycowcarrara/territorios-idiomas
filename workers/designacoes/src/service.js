import { obterCartao, reservarPin, fingerprint } from "./cartoes.js";
import {
  MAX_ENDERECOS_DESIGNACAO,
  temDesignacaoAtiva,
  normalizarTelefone,
  aliasesTelefone,
  validarPrazo,
  validarDataCobertura,
  diaLocal,
  comporMensagem,
} from "../../../shared/designacoes.js";
import { gerarToken, hashToken, cifrar, decifrar, digestsIguais } from "./crypto.js";

import { ServiceError } from "./errors.js";
export { ServiceError } from "./errors.js";
const exigir = (condition, message, code) => {
  if (!condition) throw new ServiceError(message, code);
};
const pathGrupo = (id) => `grupos_enderecos/${id}`;
const pathDesignacao = (id) => `designacoes_links/${id}`;
const pathContato = (id) => `contatos_publicadores/${id}`;
const idValido = (id) => typeof id === "string" && /^[\w-]{1,128}$/.test(id);
const curto = (codigo) => {
  const texto = String(codigo || "").trim();
  if (/^(?:[A-Z0-9]+-)*T-?0*(\d+)$/i.test(texto))
    return texto.replace(/^(?:[A-Z0-9]+-)*T-?0*(\d+)$/i, "T-$1");
  if (/^(?:[A-Z0-9]+-)+0*(\d+)$/i.test(texto))
    return texto.replace(/^(?:[A-Z0-9]+-)+0*(\d+)$/i, "E-$1");
  return texto;
};
const invalidLink = () =>
  new ServiceError(
    "Este acesso não está disponível. Peça um novo link ao responsável.",
    403,
  );

function projetar(d) {
  if (!d.operacionalAtiva) return { comprovante: d.comprovante };
  return {
    codigo: d.codigo,
    nome: d.nome,
    expiraEm: d.expiraEm,
    composicaoVersao: d.composicaoVersao,
    progressoVersao: d.progressoVersao,
    enderecos: d.enderecosAtuais || d.enderecos,
    feitos: d.feitos,
    herdados: d.herdados,
    inicioCobertura: d.inicioCobertura,
  };
}

async function validarVinculo(tx, id, d, agora, permitirRevogado = false, ignorarPrazo = false) {
  const g = await tx.get(pathGrupo(d.grupoId));
  exigir(
    g &&
      g.designacaoTipo === "link" &&
      g.designacaoId === id &&
      g.designadoContatoId === d.contatoId,
    "A designação foi alterada. Atualize a tela.",
    409,
  );
  exigir(
    d.operacionalAtiva &&
      (d.status === "ativa" || (permitirRevogado && d.status === "revogada")),
    "Esta designação já foi encerrada.",
    409,
  );
  exigir(g.status === "ativo", "Território indisponível.", 409);
  exigir(
    ignorarPrazo || new Date(d.expiraEm) > agora,
    "O prazo terminou. Peça uma nova designação ao responsável.",
    410,
  );
  const ids = d.enderecos.map((e) => e.id);
  const idsGrupo = d.enderecoIdsGrupo || ids;
  exigir(
    JSON.stringify(idsGrupo) === JSON.stringify(g.enderecoIds) &&
      (g.composicaoVersao || 1) === d.composicaoVersao,
    "A lista do território mudou. Avise o responsável.",
    409,
  );
  const observacoes = new Map();
  for (const idEndereco of ids) {
    const e = await tx.get(`enderecos/${idEndereco}`);
    exigir(
      e && e.grupoId === d.grupoId && e.status !== "arquivado",
      "Um endereço deixou de estar disponível. Avise o responsável.",
      409,
    );
    const texto = typeof e.informacao === "string" && e.informacao.trim() ? e.informacao : e.observacao;
    observacoes.set(idEndereco, typeof texto === "string" ? texto.slice(0, 20000) : "");
  }
  Object.defineProperty(d, "enderecosAtuais", { value: d.enderecos.map(e => ({ ...e, observacao: observacoes.get(e.id) || "" })), configurable: true });
  return g;
}

export function createService(store, env, clock = () => new Date()) {
  async function novoAcesso(tx) {
    for (let i = 0; i < 3; i++) {
      const token = gerarToken();
      const tokenHash = await hashToken(token);
      if (!(await tx.get(`acessos_designacao/${tokenHash}`)))
        return { token, tokenHash };
    }
    throw new ServiceError(
      "Não foi possível criar o acesso. Tente novamente.",
      409,
    );
  }
  async function salvarContato(tx, input, autor, agora) {
    const telefoneE164 = normalizarTelefone(
      input.telefoneE164 || input.telefone,
      input.pais || "BR",
    );
    const nome = String(input.nome || "").trim();
    exigir(nome.length > 0 && nome.length <= 120, "Informe o nome do contato.");
    exigir(!input.id || idValido(input.id), "Contato inválido.");
    const id = input.id || crypto.randomUUID();
    const anterior = await tx.get(pathContato(id));
    exigir(!input.id || anterior, "Contato não encontrado.", 404);
    const aliases = aliasesTelefone(telefoneE164).map(n => `indice_contatos_telefone/${n.slice(1)}`);
    const donos = [];
    for (const alias of aliases) donos.push(await tx.get(alias));
    const dono = donos.find(d => d && d.contatoId !== id);
    exigir(
      !dono || dono.contatoId === id,
      "Este celular já está cadastrado. Selecione o contato existente; não juntamos históricos automaticamente.",
      409,
    );

    const antigos = anterior ? aliasesTelefone(anterior.telefoneE164).map(n => `indice_contatos_telefone/${n.slice(1)}`) : [];
    const antigosDonos = [];
    for (const antigo of antigos) antigosDonos.push(await tx.get(antigo));
    exigir(antigosDonos.every(d => !d || d.contatoId === id), "Há contatos legados conflitantes. Revise os cadastros sem fundir históricos.", 409);
    const data = {
      ...anterior,
      nome,
      telefoneE164,
      ativo: input.ativo !== false,
      criadoEm: anterior?.criadoEm || agora,
      criadoPor: anterior?.criadoPor || autor,
      atualizadoEm: agora,
      atualizadoPor: autor,
    };
    tx.set(pathContato(id), data);
    for (const alias of aliases) tx.set(alias, { contatoId: id });
    for (const antigo of antigos) if (!aliases.includes(antigo)) tx.delete(antigo);
    tx.create(`auditoria_designacoes/${crypto.randomUUID()}`, {
      tipo: "contato",
      contatoId: id,
      antes: anterior,
      depois: data,
      autor,
      data: agora,
    });
    return { ...data, id };
  }

  async function compartilhar(tx, id, d, agora) {
    await validarVinculo(tx, id, d, agora);
    const c = await tx.get(pathContato(d.contatoId));
    const codigoAcesso = d.acessoModo === "codigo4" ? await decifrar(d.pinCifrado, id, env) : null;
    const token = codigoAcesso ? null : await decifrar(d, id, env);
    const link = codigoAcesso
      ? `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/#/c/${d.cartaoId}/${codigoAcesso}`
      : `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/#/t/${token}`;
    return {
      id,
      cartaoId: d.cartaoId || null,
      codigoAcesso,
      telefoneE164: c.telefoneE164,
      link,
      revisaoLink: `${link}/fechar`,
      ...comporMensagem({
        codigoAcesso,
        nome: c.nome,
        codigo: d.codigo,
        territorioNome: d.nome,
        enderecos: d.enderecos,
        expiraEm: d.expiraEm,
        link,
        revisaoLink: `${link}/fechar`,
        herdados: d.herdados,
      }),
    };
  }

  function encerrar(
    tx,
    id,
    d,
    g,
    agora,
    {
      motivo,
      modoConclusao = null,
      dataCobertura = null,
      autor = `link:${id}`,
    },
  ) {
    const concluida = Boolean(modoConclusao);
    const comprovante = {
      whatsappSuportePublico: d.whatsappSuportePublico || null,
      codigo: d.codigo,
      resultado: concluida ? "concluida" : motivo,
      dataCobertura,
      registradoEm: agora,
      feitos: d.feitos.length,
      pendentes: d.enderecos.length - d.feitos.length,
      total: d.enderecos.length,
    };
    const evento = {
      designacaoId: id,
      dataInicio: d.inicioCobertura,
      dataTermino: agora,
      responsaveis: [d.responsavelNome],
      responsavelTipo: "link",
      contatoId: d.contatoId,
      motivo,
      modoConclusao,
      dataCobertura,
      feitos: d.feitos,
      herdados: d.herdados,
      pendentes: d.enderecos
        .filter((e) => !d.feitos.includes(e.id))
        .map((e) => e.id),
      composicaoVersao: d.composicaoVersao,
      autor,
    };
    tx.set(pathDesignacao(id), {
      ...d,
      operacionalAtiva: false,
      status: concluida ? "concluida" : "devolvida",
      motivo,
      modoConclusao,
      comprovante,
      encerradoEm: agora,
      pinCifrado: null,
      tokenCifrado: null,
      iv: null,
    });
    tx.create(`eventos_designacoes/${id}`, evento);
    tx.set(pathGrupo(d.grupoId), {
      ...g,
      designacaoTipo: null,
      designadoContatoId: null,
      designadoPara: null,
      designadoNome: null,
      designacaoId: null,
      dataDesignacao: null,
      cicloAtual: null,
      status: concluida ? "finalizado" : "ativo",
      enderecos_visitados: concluida ? [] : d.feitos,
      ultimaDesignacaoLinkId: id,
      inicioCobertura: concluida ? null : d.inicioCobertura,
      historico: [...(g.historico || []), evento],
      ...(concluida
        ? { ultimaConclusao: new Date(`${dataCobertura}T12:00:00-03:00`) }
        : {}),
      atualizadoEm: agora,
      atualizadoPor: autor,
      ultimaAlteracao: agora,
    });
    if (motivo === "prazo_expirado")
      tx.create(`notificacoes/designacao-expirada-${id}`, {
        para: "ADMINS",
        texto: `${d.codigo}, designado a ${d.responsavelNome}, foi devolvido automaticamente após ${d.prazoAplicadoDias} dias. Havia ${d.feitos.length} de ${d.enderecos.length} endereços marcados como feitos.`,
        tipo: "devolucao",
        origem: "designacoes",
        designacaoId: id,
        data: agora,
        lida: false,
        lidaPor: [],
      });
    return { comprovante };
  }

  async function criar(tx, body, autor, agora, reabertura = null) {
    exigir(
      idValido(body.requestId) && idValido(body.grupoId),
      "Identifique a solicitação e o território.",
    );
    const requestPath = `requisicoes_designacoes/${autor.replace(/[^\w-]/g, "_")}-${body.requestId}`;
    const assinaturaPedido = await hashToken(
      JSON.stringify({
        grupoId: body.grupoId,
        contatoId: body.contatoId || null,
        contato: body.contato || null,
        reiniciar: body.reiniciar === true,
        converterEmail: body.converterEmail === true,
        correcaoDe: reabertura?.id || null,
      }),
    );
    const req = await tx.get(requestPath);
    if (req) {
      exigir(
        req.grupoId === body.grupoId &&
          req.assinaturaPedido === assinaturaPedido,
        "Esta solicitação já foi salva com outros dados. Atualize a tela antes de designar novamente.",
        409,
      );
      const d = await tx.get(pathDesignacao(req.designacaoId));
      return compartilhar(tx, req.designacaoId, d, agora);
    }
    const original = await tx.get(pathGrupo(body.grupoId));
    let g = original;
    if (reabertura) {
      const idsReabertura =
        reabertura.d.enderecoIdsGrupo ||
        reabertura.d.enderecos.map((e) => e.id);
      exigir(
        g &&
          !temDesignacaoAtiva(g) &&
          g.ultimaDesignacaoLinkId === reabertura.id &&
          JSON.stringify(g.enderecoIds) === JSON.stringify(idsReabertura) &&
          (g.composicaoVersao || 1) === reabertura.d.composicaoVersao,
        "Há trabalho posterior ou a composição mudou. Registre apenas um ajuste histórico.",
        409,
      );
      g = {
        ...g,
        status: "ativo",
        enderecos_visitados: reabertura.d.feitos,
        inicioCobertura: reabertura.d.inicioCobertura,
        ultimaConclusao: reabertura.d.ultimaConclusaoAnterior || null,
      };
    }
    exigir(
      g && g.status !== "arquivado" && g.status !== "finalizado",
      "Disponibilize este território antes de designar.",
      409,
    );
    const converter =
      body.converterEmail === true &&
      g.designadoPara &&
      g.designacaoTipo !== "link";
    exigir(
      !temDesignacaoAtiva(g) || converter,
      "Devolva a designação atual antes de designar novamente.",
      409,
    );
    const config = await tx.get("configuracoes/designacoes");
    exigir(
      config,
      "Configure o prazo de devolução automática antes de designar.",
      409,
    );
    const dias = validarPrazo(config.prazoDevolucaoAutomaticaDias);
    let c;
    if (body.contatoId) {
      exigir(idValido(body.contatoId), "Contato inválido.");
      c = await tx.get(pathContato(body.contatoId));
      c = c && { ...c, id: body.contatoId };
    } else c = await salvarContato(tx, body.contato || {}, autor, agora);
    exigir(c?.ativo, "Selecione um contato ativo.");
    const ids = g.enderecoIds || [];
    exigir(
      ids.length > 0 && new Set(ids).size === ids.length,
      `Use de 1 a ${MAX_ENDERECOS_DESIGNACAO} endereços por território.`,
    );
    const enderecos = [];
    for (const enderecoId of ids) {
      const e = await tx.get(`enderecos/${enderecoId}`);
      exigir(
        e && e.grupoId === body.grupoId,
        "Revise os endereços vinculados antes de designar.",
      );
      if (e.status === "arquivado") continue;
      exigir(
        e.endereco && e.codigo,
        "Revise os endereços vinculados antes de designar.",
      );
      const coords =
        typeof e.lat === "number" &&
        typeof e.lng === "number" &&
        Math.abs(e.lat) <= 90 &&
        Math.abs(e.lng) <= 180 &&
        (e.lat !== 0 || e.lng !== 0);
      const escrito = [e.endereco, e.bairro]
        .filter(Boolean)
        .join(" — ");
      exigir(
        coords,
        `Complete a localização de ${e.codigo} antes de designar.`,
      );
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.lat.toFixed(6)},${e.lng.toFixed(6)}`)}`;
      enderecos.push({
        id: enderecoId,
        codigo: curto(e.codigo),
        endereco: escrito,
        mapsUrl,
      });
    }
    exigir(
      enderecos.length > 0 && enderecos.length <= MAX_ENDERECOS_DESIGNACAO,
      `Use de 1 a ${MAX_ENDERECOS_DESIGNACAO} endereços por território.`,
    );
    const idsAtivos = enderecos.map((e) => e.id);
    const id = crypto.randomUUID();
    const { token, tokenHash } = await novoAcesso(tx);
    const usarCodigo = env.CODIGOS_ENABLED === "true";
    const cartaoId = usarCodigo ? await obterCartao(tx, body.grupoId, agora) : null;
    const pin = usarCodigo ? await reservarPin(tx, { id, grupoId: body.grupoId, cartaoId, versao: 1, agora }, env) : {};
    const herdados =
      body.reiniciar === true
        ? []
        : (g.enderecos_visitados || []).filter((id) => idsAtivos.includes(id));
    const d = {
      grupoId: body.grupoId,
      contatoId: c.id,
      responsavelNome: c.nome,
      responsavelTelefone: c.telefoneE164,
      codigo: curto(g.codigo),
      nome: g.nome || curto(g.codigo),
      enderecoIdsGrupo: ids,
      enderecos,
      herdados,
      feitos: herdados,
      retomadaDe: body.reiniciar ? null : g.ultimaDesignacaoLinkId || null,
      correcaoDe: reabertura?.id || null,
      inicioCobertura:
        (!body.reiniciar &&
          (g.inicioCobertura ||
            g.cicloAtual?.dataInicio ||
            g.dataDesignacao)) ||
        agora,
      status: "ativa",
      operacionalAtiva: true,
      criadoEm: agora,
      criadoPor: autor,
      prazoAplicadoDias: dias,
      politicaPrazoVersao: config.versao,
      expiraEm: new Date(+agora + dias * 86400000),
      tokenHash,
      tokenVersao: 1,
      composicaoVersao: g.composicaoVersao || 1,
      progressoVersao: 0,
      ...(await cifrar(token, id, env)),
      ...pin,
    };
    d.ultimaConclusaoAnterior = g.ultimaConclusao || null;
    d.whatsappSuportePublico = config.whatsappSuportePublico || null;
    tx.create(pathDesignacao(id), d);
    if (!usarCodigo) tx.create(`acessos_designacao/${tokenHash}`, { designacaoId: id, tokenVersao: 1 });

    tx.create(requestPath, {
      designacaoId: id,
      grupoId: body.grupoId,
      assinaturaPedido,
    });
    if (converter || body.reiniciar || reabertura)
      tx.create(`auditoria_designacoes/${crypto.randomUUID()}`, {
        tipo: reabertura
          ? "reabertura"
          : converter
            ? "conversao_email"
            : "reinicio_cobertura",
        designacaoId: id,
        correcaoDe: reabertura?.id || null,
        motivo: body.motivo || null,
        autor,
        data: agora,
        progressoAnterior: original.enderecos_visitados || [],
        responsavelAnterior: original.designadoPara || null,
      });
    tx.set(pathGrupo(body.grupoId), {
      ...g,
      designacaoTipo: "link",
      designadoContatoId: c.id,
      designadoPara: null,
      designadoNome: c.nome,
      designacaoId: id,
      dataDesignacao: agora,
      composicaoVersao: d.composicaoVersao,
      enderecos_visitados: herdados,
      inicioCobertura: d.inicioCobertura,
      cicloAtual: {
        designacaoId: id,
        dataInicio: d.inicioCobertura,
        responsaveis: [c.nome],
        tipo: "link",
        contatoId: c.id,
      },
      atualizadoEm: agora,
      atualizadoPor: autor,
    });
    for (const enderecoId of ids) {
      const e = await tx.get(`enderecos/${enderecoId}`);
      tx.set(`enderecos/${enderecoId}`, { ...e, grupoDesignadoPara: null });
    }
    const codigoAcesso = usarCodigo ? await decifrar(d.pinCifrado, id, env) : null;
    const link = usarCodigo
      ? `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/#/c/${cartaoId}/${codigoAcesso}`
      : `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/#/t/${token}`;
    return { id, cartaoId, codigoAcesso, telefoneE164: c.telefoneE164, link, revisaoLink: `${link}/fechar`,
      ...comporMensagem({ nome: c.nome, codigo: d.codigo, territorioNome: d.nome, enderecos,
        expiraEm: d.expiraEm, link, herdados, codigoAcesso }) };
  }

  async function publicAction(action, token, body = {}) {
    if (!/^(?:[\w-]{16}|[\w-]{32})$/.test(token || "")) throw invalidLink();
    const hash = await hashToken(token);
    return store.transaction(async (tx) => {
      const agora = clock();
      const indice = await tx.get(`acessos_designacao/${hash}`);
      if (!indice) throw invalidLink();
      const id = indice.designacaoId;
      const d = await tx.get(pathDesignacao(id));
      if (
        !d ||
        (body.cartaoId !== undefined && (!indice.sessao || d.cartaoId !== body.cartaoId)) ||
        (indice.sessao ? (d.acessoModo !== "codigo4" || new Date(indice.expiraEm) <= agora) : (d.acessoModo === "codigo4" || d.tokenHash !== hash)) ||
        d.tokenVersao !== indice.tokenVersao ||
        d.status === "revogada"
      )
        throw invalidLink();
      if (!d.operacionalAtiva) {
        if (indice.sessao) {
          // A closed session can read only its receipt, until expiry/reassignment.
          const grupo = await tx.get(pathGrupo(d.grupoId));
          if (!d.comprovante || grupo?.ultimaDesignacaoLinkId !== id || temDesignacaoAtiva(grupo)) throw invalidLink();
        }
        exigir(
          ["territorio", "concluir", "devolver"].includes(action),
          "Este território já foi devolvido.",
          409,
        );
        return projetar(d);
      }
      const g = await validarVinculo(tx, id, d, agora);
      if (action === "territorio") return projetar(d);
      exigir(
        body.composicaoVersao === d.composicaoVersao &&
          body.progressoVersao === d.progressoVersao,
        "As marcações mudaram em outra tela. Atualize e revise antes de confirmar.",
        409,
      );
      if (action === "endereco" || action === "marcacoes") {
        let feitos;
        if (action === "endereco") {
          exigir(
            d.enderecos.some((e) => e.id === body.enderecoId) &&
              typeof body.pregado === "boolean",
            "Endereço inválido.",
          );
          feitos = body.pregado
            ? [...new Set([...d.feitos, body.enderecoId])]
            : d.feitos.filter((x) => x !== body.enderecoId);
        } else {
          exigir(
            Array.isArray(body.feitos) &&
              body.feitos.every((id) => d.enderecos.some((e) => e.id === id)),
            "Marcações inválidas.",
          );
          feitos = [...new Set(body.feitos)];
        }
        const updated = {
          ...d,
          feitos,
          progressoVersao: d.progressoVersao + 1,
        };
        tx.set(pathDesignacao(id), updated);
        tx.set(pathGrupo(d.grupoId), {
          ...g,
          enderecos_visitados: feitos,
          atualizadoEm: agora,
          atualizadoPor: `link:${id}`,
        });
        return { ...projetar(updated), enderecos: d.enderecosAtuais || updated.enderecos };
      }
      if (action === "concluir") {
        exigir(
          ["marcacoes", "declaracao"].includes(body.modoConclusao) &&
            body.confirmarCobertura === true,
          "Confirme expressamente a cobertura de todo o território.",
        );
        exigir(
          body.modoConclusao === "declaracao" ||
            d.feitos.length === d.enderecos.length,
          "Ainda há endereços pendentes.",
        );
        const dataCobertura = validarDataCobertura(
          body.dataCobertura || diaLocal(agora),
          d.inicioCobertura,
          agora,
        );
        return encerrar(tx, id, d, g, agora, {
          motivo: "cobertura_confirmada",
          modoConclusao: body.modoConclusao,
          dataCobertura,
        });
      }
      exigir(action === "devolver", "Ação não encontrada.", 404);
      return encerrar(tx, id, d, g, agora, {
        motivo: d.feitos.length ? "manual_parcial" : "manual_sem_cobertura",
      });
    });
  }

  async function adminAction(action, id, body, autor) {
    return store.transaction(async (tx) => {
      const agora = clock();
      // The role is checked inside the same transaction as every administrative write.
      const user = await tx.get(`usuarios/${autor}`);
      exigir(
        user?.role === "admin",
        "Acesso restrito aos administradores atuais.",
        403,
      );
      if (action === "autorizar") return { ok: true };
      if (action === "operacao")
        return (
          (await tx.get("operacao_designacoes/vencimentos")) || {
            processadas: 0,
            falhas: [],
          }
        );
      if (action === "contato") return salvarContato(tx, body, autor, agora);
      if (action === "configurar") {
        const anterior = await tx.get("configuracoes/designacoes");
        const config = {
          whatsappSuportePublico: body.whatsappSuportePublico
            ? normalizarTelefone(body.whatsappSuportePublico)
            : null,
          prazoDevolucaoAutomaticaDias: validarPrazo(
            body.prazoDevolucaoAutomaticaDias,
          ),
          versao: (anterior?.versao || 0) + 1,
          atualizadoEm: agora,
          atualizadoPor: autor,
        };
        tx.set("configuracoes/designacoes", config);
        return config;
      }
      if (action === "configuracao")
        return (
          (await tx.get("configuracoes/designacoes")) || {
            prazoDevolucaoAutomaticaDias: 90,
            versao: 0,
          }
        );
      if (action === "cartao") {
        exigir(idValido(body.grupoId), "Território inválido.");
        const g = await tx.get(pathGrupo(body.grupoId));
        exigir(g && g.status !== "arquivado", "Território indisponível.", 404);
        let snapshot = null;
        if (g.designacaoTipo === "link") {
          snapshot = await tx.get(pathDesignacao(g.designacaoId));
          exigir(snapshot, "Designação indisponível.", 409);
          // Printing a permanent card does not authorize digital operations.
          await validarVinculo(tx, g.designacaoId, snapshot, agora, true, true);
        }
        const enderecos = [];
        let cancelados = 0;
        let arquivados = snapshot ? (g.enderecoIds || []).filter(id => !snapshot.enderecos.some(e => e.id === id)).length : 0;
        for (const enderecoId of (snapshot ? snapshot.enderecos.map(e => e.id) : g.enderecoIds || [])) {
          const e = await tx.get(`enderecos/${enderecoId}`);
          exigir(e && e.grupoId === body.grupoId, "Revise os endereços vinculados.", 409);
          if (e.status === "arquivado") { arquivados++; continue; }
          const classe = String(e.classe || "").trim().toLowerCase();
          if (["excluido", "cancelado"].includes(classe)) { cancelados++; continue; }
          const frozen = snapshot?.enderecos.find(e => e.id === enderecoId);
          const texto = typeof e.informacao === "string" && e.informacao.trim() ? e.informacao : e.observacao;
          enderecos.push({ id: enderecoId, codigo: frozen?.codigo || curto(e.codigo), endereco: frozen?.endereco || [e.endereco,e.bairro].filter(Boolean).join(" — "), lat: e.lat ?? null, lng: e.lng ?? null, mapsUrl: frozen?.mapsUrl || null, classe: ["confirmado", "verificar", "estudo"].includes(classe) ? classe : "confirmado", observacao: typeof texto === "string" ? texto.slice(0, 20000) : "" });
        }
        exigir(enderecos.length > 0 && enderecos.length <= MAX_ENDERECOS_DESIGNACAO, "Revise a lista de endereços.");
        const cartaoId = await obterCartao(tx, body.grupoId, agora);
        return { cartaoId, codigo: curto(g.codigo), nome: g.nome || curto(g.codigo), idioma: g.idioma || "", bairro: g.bairro || "", enderecos, arquivados, cancelados, url: `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/#/c/${cartaoId}` };
      }
      if (action === "criar") return criar(tx, body, autor, agora);
      exigir(idValido(id), "Designação inválida.");
      const d = await tx.get(pathDesignacao(id));
      exigir(d, "Designação não encontrada.", 404);
      if (action === "reabrir") {
        exigir(
          !d.operacionalAtiva && String(body.motivo || "").trim().length >= 5,
          "Informe o motivo da reabertura de uma designação encerrada.",
        );
        return criar(
          tx,
          {
            ...body,
            grupoId: d.grupoId,
            contatoId: d.contatoId,
            reiniciar: false,
          },
          autor,
          agora,
          { id, d },
        );
      }
      if (action === "aplicar_prazo") {
        exigir(
          body.confirmar === true,
          "Confirme a aplicação do prazo às designações selecionadas.",
        );
        const config = await tx.get("configuracoes/designacoes");
        exigir(
          config?.versao === body.politicaVersao,
          "O padrão mudou. Gere uma nova prévia.",
          409,
        );
        const aplicadoPath = `aplicacoes_prazo/${id}-${config.versao}`;
        if (await tx.get(aplicadoPath)) return { ok: true };
        await validarVinculo(tx, id, d, agora, true);
        exigir(
          +new Date(d.expiraEm) === +new Date(body.expiraEmAnterior),
          "O prazo desta designação mudou. Gere outra prévia.",
          409,
        );
        const dias = validarPrazo(config.prazoDevolucaoAutomaticaDias);
        const expiraEm = new Date(+new Date(d.criadoEm) + dias * 86400000);
        tx.set(pathDesignacao(id), {
          ...d,
          expiraEm,
          prazoAplicadoDias: dias,
          politicaPrazoVersao: config.versao,
        });
        tx.create(aplicadoPath, {
          designacaoId: id,
          autor,
          data: agora,
          expiraEmAnterior: d.expiraEm,
          expiraEm,
        });
        return { ok: true, expiraEm };
      }
      if (action === "corrigir") {
        const motivo = String(body.motivo || "").trim();
        exigir(
          motivo.length >= 5 && motivo.length <= 1000,
          "Explique o motivo da correção.",
        );
        exigir(
          !d.operacionalAtiva,
          "Devolva o território antes de corrigir seu histórico.",
          409,
        );
        tx.create(`auditoria_designacoes/${crypto.randomUUID()}`, {
          tipo: "correcao_historica",
          designacaoId: id,
          motivo,
          autor,
          data: agora,
        });
        return {
          ok: true,
          mensagem: "Ajuste registrado. O evento original foi preservado.",
        };
      }
      if (action === "compartilhar") return compartilhar(tx, id, d, agora);
      if (!d.operacionalAtiva && action === "devolver") return projetar(d);
      const g = await validarVinculo(tx, id, d, agora, true);
      if (action === "devolver")
        return encerrar(tx, id, d, g, agora, {
          motivo: d.feitos.length ? "manual_parcial" : "manual_sem_cobertura",
          autor,
        });
      const updated = { ...d };
      if (action === "renovar") {
        const { token, tokenHash } = await novoAcesso(tx);
        Object.assign(
          updated,
          { tokenHash, tokenVersao: d.tokenVersao + 1, status: "ativa" },
          await cifrar(token, id, env),
        );
        if (d.acessoModo === "codigo4" || env.CODIGOS_ENABLED === "true") {
          const cartaoId = d.cartaoId || await obterCartao(tx, d.grupoId, agora);
          Object.assign(updated, await reservarPin(tx, { id, grupoId: d.grupoId, cartaoId, versao: updated.tokenVersao, agora }, env));
        } else tx.create(`acessos_designacao/${tokenHash}`, { designacaoId: id, tokenVersao: updated.tokenVersao });
      } else if (action === "prorrogar") {
        const dias = validarPrazo(body.dias);
        updated.expiraEm = new Date(+new Date(d.expiraEm) + dias * 86400000);
      } else if (action === "revogar") {
        updated.status = "revogada";
        updated.tokenCifrado = null;
        updated.iv = null;
        updated.pinCifrado = null;
      } else throw new ServiceError("Ação não encontrada.", 404);
      tx.create(`auditoria_designacoes/${crypto.randomUUID()}`, {
        tipo: action,
        designacaoId: id,
        autor,
        data: agora,
        vencimentoAnterior: d.expiraEm,
        vencimentoAtual: updated.expiraEm,
      });
      tx.set(pathDesignacao(id), updated);
      return { ok: true, expiraEm: updated.expiraEm };
    });
  }

  async function expirar() {
    let processadas = 0;
    let cursor = null;
    const falhas = [];
    for (let page = 0; page < 20; page++) {
      const vencidas = await store.query(
        "designacoes_links",
        [
          ["operacionalAtiva", "EQUAL", true],
          ["expiraEm", "LESS_THAN_OR_EQUAL", clock()],
        ],
        100,
        cursor,
      );
      if (!vencidas.length) break;
      for (const item of vencidas)
        try {
          const processada = await store.transaction(async (tx) => {
            const agora = clock();
            const d = await tx.get(pathDesignacao(item.id));
            if (!d?.operacionalAtiva || new Date(d.expiraEm) > agora) return;
            const g = await tx.get(pathGrupo(d.grupoId));
            exigir(
              g?.designacaoId === item.id,
              "Vínculo inconsistente durante vencimento.",
              409,
            );
            encerrar(tx, item.id, d, g, agora, {
              motivo: "prazo_expirado",
              autor: "sistema:agendamento",
            });
            return true;
          });
          if (processada) processadas++;
        } catch {
          falhas.push(item.id);
        }
      cursor = vencidas.at(-1);
      if (vencidas.length < 100) break;
    }
    await store.transaction(async (tx) => {
      tx.set("operacao_designacoes/vencimentos", {
        processadas,
        falhas,
        atualizadoEm: clock(),
      });
    });
    return { processadas, falhas };
  }
  async function cardAction(action, body) {
    exigir(idValido(body.cartaoId), "Cartão indisponível.", 404);
    if (action === "acessar-cartao") exigir(typeof body.codigo === "string" && /^\d{4}$/.test(body.codigo), "Código inválido ou encerrado.", 403);
    return store.transaction(async tx => {
      const agora = clock();
      const card = await tx.get(`cartoes_territorios/${body.cartaoId}`);
      exigir(!card || idValido(card.grupoId), "Cartão indisponível.", 404);
      const g = card && await tx.get(pathGrupo(card.grupoId));
      exigir(g && g.status !== "arquivado", "Cartão indisponível.", 404);
      if (action === "consulta-cartao") {
        // Independent current-data projection. No PIN reads, reconciliation or writes.
        const inverse = await tx.get(`cartoes_por_grupo/${card.grupoId}`);
        exigir(inverse?.cartaoId === body.cartaoId, "Composição indisponível.", 409);
        const ids = g.enderecoIds;
        exigir(Array.isArray(ids), "Composição indisponível.", 409);
        exigir(ids.length <= MAX_ENDERECOS_DESIGNACAO && ids.every(idValido) && new Set(ids).size === ids.length, "Composição indisponível.", 409);
        const enderecos = [];
        for (const id of ids) {
          const e = await tx.get(`enderecos/${id}`);
          exigir(e && e.grupoId === card.grupoId, "Composição indisponível.", 409);
          if (e.status === "arquivado") continue;
          exigir(typeof e.endereco === "string" && e.endereco.trim() && typeof e.codigo === "string" && e.codigo.trim(), "Composição indisponível.", 409);
          const coords = Number.isFinite(e.lat) && Number.isFinite(e.lng) && Math.abs(e.lat) <= 90 && Math.abs(e.lng) <= 180 && (e.lat !== 0 || e.lng !== 0);
          const endereco = [e.endereco, typeof e.bairro === "string" ? e.bairro : ""].filter(Boolean).join(" — ");
          const texto = typeof e.informacao === "string" && e.informacao.trim() ? e.informacao : e.observacao;
          enderecos.push({ id, codigo: curto(e.codigo), endereco,
            lat: coords ? e.lat : null, lng: coords ? e.lng : null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords ? `${e.lat.toFixed(6)},${e.lng.toFixed(6)}` : endereco)}`,
            observacao: typeof texto === "string" ? texto.slice(0, 20000) : "" });
        }
        exigir(enderecos.length, "Cartão indisponível.", 404);
        const d = g.designacaoTipo === "link" && idValido(g.designacaoId) ? await tx.get(pathDesignacao(g.designacaoId)) : null;
        const habilitacaoDisponivel = Boolean(
          d && g.status === "ativo" && d.operacionalAtiva &&
          d.status === "ativa" && new Date(d.expiraEm) > agora &&
          d.acessoModo === "codigo4" && d.cartaoId === body.cartaoId &&
          d.grupoId === card.grupoId && d.contatoId === g.designadoContatoId &&
          Array.isArray(d.enderecos) && d.enderecos.every(e => e && idValido(e.id)) &&
          (g.composicaoVersao || 1) === d.composicaoVersao &&
          JSON.stringify(d.enderecoIdsGrupo || d.enderecos.map(e => e.id)) === JSON.stringify(ids) &&
          JSON.stringify(d.enderecos.map(e => e.id)) === JSON.stringify(enderecos.map(e => e.id))
        );
        return { modo: "consulta", podeMarcar: false, codigo: curto(g.codigo), nome: typeof g.nome === "string" && g.nome.trim() ? g.nome : curto(g.codigo), habilitacaoDisponivel, enderecos };
      }
      const d = g.designacaoTipo === "link" && await tx.get(pathDesignacao(g.designacaoId));
      const ativo = d?.operacionalAtiva && d.status === "ativa" && new Date(d.expiraEm) > agora && d.acessoModo === "codigo4" && d.cartaoId === body.cartaoId;
      if (action === "cartao") return { codigo: curto(g.codigo), disponivel: Boolean(ativo) };
      exigir(ativo, "Código inválido ou encerrado.", 403);
      const hash = await fingerprint(body.codigo, env);
      const reservation = await tx.get(`codigos_ativos/${hash}`);
      exigir(digestsIguais(hash, d.pinHash) && reservation?.designacaoId === g.designacaoId && reservation?.versao === d.tokenVersao, "Código inválido ou encerrado.", 403);
      await validarVinculo(tx, g.designacaoId, d, agora);
      const token = gerarToken() + gerarToken();
      const sessionHash = await hashToken(token);
      exigir(!(await tx.get(`acessos_designacao/${sessionHash}`)), "Tente novamente.", 409);
      const expiraEm = new Date(Math.min(+new Date(d.expiraEm), +agora + 12 * 3600000));
      tx.create(`acessos_designacao/${sessionHash}`, { sessao: true, designacaoId: g.designacaoId, tokenVersao: d.tokenVersao, expiraEm });
      return { token, expiraEm };
    });
  }
  return { publicAction, adminAction, expirar, cardAction };
}
