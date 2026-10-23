import { reservarPin, fingerprint } from "../../workers/designacoes/src/cartoes.js";
import { describe, it, expect, vi } from "vitest";
import {
  normalizarTelefone,
  temDesignacaoAtiva,
  coberturaConfirmadaGrupo,
  validarPrazo,
  validarDataCobertura,
  resumoDevolucao,
  comporMensagem,
} from "../../shared/designacoes.js";
import { createService } from "../../workers/designacoes/src/service.js";
import { createHandler } from "../../workers/designacoes/src/index.js";
import {
  cifrar,
  decifrar,
  gerarToken,
  hashToken,
} from "../../workers/designacoes/src/crypto.js";

const env = {
  CODIGOS_ENABLED: "true",
  TOKEN_KEYS_JSON: JSON.stringify({ v1: btoa("x".repeat(32)) }),
  TOKEN_KEY_VERSION: "v1",
  PIN_HMAC_KEY: btoa("h".repeat(32)).replace(/=+$/, ""),
  PUBLIC_APP_URL: "http://localhost:5173",
};
const inicio = new Date("2026-10-21T12:00:00Z");
function setup() {
  const docs = new Map(
    Object.entries({
      "usuarios/admin@example.test": { role: "admin" },
      "usuarios/comum@example.test": { role: "comum" },
      "configuracoes/designacoes": {
        prazoDevolucaoAutomaticaDias: 2,
        versao: 1,
      },
      "grupos_enderecos/g1": {
        codigo: "ES-SBS-T013",
        nome: "Centro",
        status: "ativo",
        enderecoIds: ["e1", "e2"],
        enderecos_visitados: [],
        totalEnderecos: 2,
      },
      "enderecos/e1": {
        codigo: "ES-SBS-021",
        endereco: "Rua Árvore, 1",
        grupoId: "g1",
        status: "ativo",
        lat: -26,
        lng: -49,
      },
      "enderecos/e2": {
        codigo: "ES-SBS-022",
        endereco: "Rua São João, 2",
        grupoId: "g1",
        status: "ativo",
        lat: -26.1,
        lng: -49.1,
      },
    }),
  );
  const store = {
    async transaction(fn) {
      const changes = new Map();
      const removed = new Set();
      const result = await fn({
        get: async (p) => structuredClone(docs.get(p) || null),
        set: (p, d) => changes.set(p, structuredClone(d)),
        create: (p, d) => {
          if (docs.has(p)) throw new Error("already exists");
          changes.set(p, structuredClone(d));
        },
        delete: (p) => removed.add(p),
      });
      changes.forEach((d, p) => docs.set(p, d));
      removed.forEach((p) => docs.delete(p));
      return result;
    },
    async query(collection, filters, limit) {
      return [...docs]
        .filter(
          ([p, d]) =>
            p.startsWith(`${collection}/`) &&
            filters.every(([k, op, v]) =>
              op === "EQUAL" ? d[k] === v : +d[k] <= +v,
            ),
        )
        .slice(0, limit)
        .map(([p, d]) => ({ ...d, id: p.split("/")[1] }));
    },
  };
  let now = inicio;
  const service = createService(store, env, () => now);
  const admin = (action, body = {}, id = null) =>
    service.adminAction(action, id, body, "admin@example.test");
  const criar = (body = {}) =>
    admin("criar", {
      requestId: "r1",
      grupoId: "g1",
      contato: { nome: "Ana", telefone: "(47) 99999-1234" },
      ...body,
    });
  const sessions = new Map();
  const token = (share) => share.codigoAcesso;
  const publico = async (action, share, body = {}) => {
    if (!sessions.has(share.link)) {
      const session = await service.cardAction("acessar-cartao", { cartaoId: share.cartaoId, codigo: share.codigoAcesso });
      sessions.set(share.link, session.token);
    }
    return service.publicAction(action, sessions.get(share.link), body);
  };
  return {
    docs,
    store,
    service,
    admin,
    criar,
    publico,
    token,
    setNow: (n) => {
      now = n;
    },
  };
}

describe("contratos de designação", () => {
  it("não conta marcações completas como cobertura no modo link ou após vencimento", () => {
    expect(
      coberturaConfirmadaGrupo(
        { designacaoTipo: "link", status: "ativo" },
        true,
      ),
    ).toBe(false);
    expect(
      coberturaConfirmadaGrupo(
        { ultimaDesignacaoLinkId: "anterior", status: "ativo" },
        true,
      ),
    ).toBe(false);
    expect(coberturaConfirmadaGrupo({ status: "finalizado" }, false)).toBe(
      true,
    );
    expect(coberturaConfirmadaGrupo({ status: "ativo" }, true)).toBe(true);
    expect(
      coberturaConfirmadaGrupo(
        {
          ultimaDesignacaoLinkId: "anterior",
          designadoPara: "dirigente@example.test",
          status: "ativo",
        },
        true,
      ),
    ).toBe(true);
  });
  it("normaliza máscaras e países sem duplicar DDI", () => {
    expect(normalizarTelefone("(47) 99999-1234")).toBe("+5547999991234");
    expect(normalizarTelefone("+5547999991234")).toBe("+5547999991234");
    expect(normalizarTelefone("+447911123456")).toBe("+447911123456");
    expect(() => normalizarTelefone("123")).toThrow();
  });
  it("reconhece legado e contato ocupado", () => {
    expect(temDesignacaoAtiva({ designadoPara: "a@b.c" })).toBe(true);
    expect(temDesignacaoAtiva({ designadoContatoId: "c1" })).toBe(true);
    expect(temDesignacaoAtiva({})).toBe(false);
  });
  it.each([0, -1, 1.5, "30", 3651])("rejeita prazo %s", (value) =>
    expect(() => validarPrazo(value)).toThrow(),
  );
  it("valida data real e fuso de São Paulo", () => {
    expect(
      validarDataCobertura(
        "2026-10-20",
        new Date("2026-10-20T12:00Z"),
        new Date("2026-10-21T01:00Z"),
      ),
    ).toBe("2026-10-20");
    expect(() =>
      validarDataCobertura("2026-10-21", inicio, new Date("2026-10-21T01:00Z")),
    ).toThrow();
    expect(() =>
      validarDataCobertura("2026-02-30", new Date("2026-02-01"), inicio),
    ).toThrow();
  });
  it("distingue zero, parte e todos", () => {
    expect(resumoDevolucao(0, 8).acao).toBe("Devolver sem cobertura");
    expect(resumoDevolucao(3, 8).acao).toBe("Devolver com 5 pendentes");
    expect(resumoDevolucao(8, 8).acao).toBe("Confirmar cobertura e devolver");
  });
  it("não trunca lista extensa ou acentos", () => {
    const enderecos = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      codigo: `E-${i}`,
      endereco: "Rua São João, 123 — Centro",
      mapsUrl: `https://maps.example/${i}`,
    }));
    const m = comporMensagem({
      nome: "Ana",
      codigo: "T-1",
      territorioNome: "Centro",
      enderecos,
      expiraEm: inicio,
      link: "https://consulta.example/#/c/cartao/0482",
      codigoAcesso: "0482",
      revisaoLink: "revisao",
    });
    for (const e of enderecos) expect(m.partes.join("\n")).toContain(e.mapsUrl);
    expect(m.partes.length).toBeGreaterThan(1);
    expect(m.partes[0]).toContain("consulta");
    expect(m.partes[0]).toContain("Código de acesso: 0482");
    expect(m.mensagem).not.toContain("revisao");
    expect(m.mensagem.match(/https:\/\/consulta\.example/g)).toHaveLength(1);
    expect(m.partes.join("\n").match(/https:\/\/consulta\.example/g)).toHaveLength(1);
    expect(m.mensagem).toContain(
      "marcar o que foi feito e devolver o território",
    );
  });
  it("cifra token com IV único e vínculo ao ciclo", async () => {
    const token = gerarToken();
    expect(token).toHaveLength(16);
    expect(await hashToken(token)).toHaveLength(64);
    const a = await cifrar(token, "c1", env);
    const b = await cifrar(token, "c1", env);
    expect(a.iv).not.toBe(b.iv);
    expect(await decifrar(a, "c1", env)).toBe(token);
    await expect(decifrar(a, "c2", env)).rejects.toThrow();
  });
});

describe("serviço de designações", () => {
  it("só divulga no comprovante o suporte configurado expressamente", async () => {
    const t = setup();
    await t.admin("configurar", {
      prazoDevolucaoAutomaticaDias: 2,
      whatsappSuportePublico: "(47) 99999-5678",
    });
    const s = await t.criar();
    const recibo = await t.publico("devolver", s, {
      composicaoVersao: 1,
      progressoVersao: 0,
    });
    expect(recibo.comprovante.whatsappSuportePublico).toBe("+5547999995678");
    expect(JSON.stringify(recibo)).not.toContain("+5547999991234");
  });
  it("cria sem usuário, reenvia idempotentemente e não armazena token aberto", async () => {
    const t = setup();
    const s = await t.criar();
    expect((await t.criar()).link).toBe(s.link);
    expect((await t.admin("compartilhar", {}, s.id)).link).toBe(s.link);
    expect(t.docs.get("grupos_enderecos/g1").designadoPara).toBe(null);
    expect(t.docs.get(`designacoes_links/${s.id}`).codigoAcesso).toBeUndefined();
    expect(t.docs.get(`designacoes_links/${s.id}`).pinCifrado.tokenCifrado).not.toBe(s.codigoAcesso);
    expect(
      [...t.docs.keys()].filter((p) => p.startsWith("usuarios/")),
    ).toHaveLength(2);
  });
  it("troca telefone preserva ID, vínculos, retrato e link", async () => {
    const t = setup();
    const s = await t.criar();
    const d = t.docs.get(`designacoes_links/${s.id}`);
    await t.admin("contato", {
      id: d.contatoId,
      nome: "Ana",
      telefone: "+5547999995678",
    });
    expect(t.docs.get(`designacoes_links/${s.id}`).responsavelTelefone).toBe(
      "+5547999991234",
    );
    const reenviado = await t.admin("compartilhar", {}, s.id);
    expect(reenviado.telefoneE164).toBe("+5547999995678");
    expect(reenviado.link).toBe(s.link);
    expect(t.docs.has("indice_contatos_telefone/5547999991234")).toBe(false);
  });
  it("não funde novo contato com celular existente", async () => {
    const t = setup();
    await t.criar();
    await expect(
      t.admin("contato", { nome: "Outra pessoa", telefone: "+5547999991234" }),
    ).rejects.toThrow("já está cadastrado");
  });
  it("nega contas comuns e administradores removidos", async () => {
    const t = setup();
    await expect(
      t.service.adminAction("configuracao", null, {}, "comum@example.test"),
    ).rejects.toMatchObject({ code: 403 });
    t.docs.delete("usuarios/admin@example.test");
    await expect(t.criar()).rejects.toMatchObject({ code: 403 });
  });
  it("consulta não muda nada e projeção não vaza contato nem histórico", async () => {
    const t = setup();
    const s = await t.criar();
    await t.publico("territorio", s);
    const before = JSON.stringify([...t.docs]);
    const p = await t.publico("territorio", s);
    expect(p.enderecos).toHaveLength(2);
    expect(JSON.stringify(p)).not.toMatch(
      /telefone|contatoId|responsavel|tokenCifrado/,
    );
    expect(JSON.stringify([...t.docs])).toBe(before);
  });
  it("token errado, ID do ciclo e endereço alheio não autorizam", async () => {
    const t = setup();
    const s = await t.criar();
    await expect(
      t.service.publicAction("territorio", s.id),
    ).rejects.toMatchObject({ code: 403 });
    await expect(
      t.service.publicAction("territorio", "abcdefghijklmnop"),
    ).rejects.toMatchObject({ code: 403 });
    await expect(
      t.publico("endereco", s, {
        enderecoId: "outro",
        pregado: true,
        composicaoVersao: 1,
        progressoVersao: 0,
      }),
    ).rejects.toThrow("Endereço inválido");
  });
  it("marcar todos não fecha; repetição de estado não inverte", async () => {
    const t = setup();
    const s = await t.criar();
    let p = await t.publico("endereco", s, {
      enderecoId: "e1",
      pregado: true,
      composicaoVersao: 1,
      progressoVersao: 0,
    });
    p = await t.publico("endereco", s, {
      enderecoId: "e1",
      pregado: true,
      composicaoVersao: 1,
      progressoVersao: p.progressoVersao,
    });
    expect(p.feitos).toEqual(["e1"]);
    p = await t.publico("marcacoes", s, {
      feitos: ["e1", "e2"],
      composicaoVersao: 1,
      progressoVersao: p.progressoVersao,
    });
    expect(p.feitos).toHaveLength(2);
    expect(t.docs.get("grupos_enderecos/g1").status).toBe("ativo");
    expect(t.docs.has(`eventos_designacoes/${s.id}`)).toBe(false);
  });
  it("exige revisão atualizada após outra aba salvar", async () => {
    const t = setup();
    const s = await t.criar();
    await t.publico("marcacoes", s, {
      feitos: ["e1"],
      composicaoVersao: 1,
      progressoVersao: 0,
    });
    await expect(
      t.publico("devolver", s, { composicaoVersao: 1, progressoVersao: 0 }),
    ).rejects.toMatchObject({ code: 409 });
  });
  it.each([{ feitos: [] }, { feitos: ["e1"] }, { feitos: ["e1", "e2"] }])(
    "declaração não fabrica visitas: %j",
    async ({ feitos }) => {
      const t = setup();
      const s = await t.criar();
      const p = await t.publico("marcacoes", s, {
        feitos,
        composicaoVersao: 1,
        progressoVersao: 0,
      });
      const result = await t.publico("concluir", s, {
        modoConclusao: "declaracao",
        confirmarCobertura: true,
        dataCobertura: "2026-10-21",
        composicaoVersao: 1,
        progressoVersao: p.progressoVersao,
      });
      expect(result.comprovante.feitos).toBe(feitos.length);
      expect(t.docs.get(`eventos_designacoes/${s.id}`).feitos).toEqual(feitos);
      expect(t.docs.get("grupos_enderecos/g1").status).toBe("finalizado");
      expect(await t.publico("territorio", s)).toEqual(result);
      expect(await t.publico("concluir", s, {})).toEqual(result);
      expect(t.docs.get("grupos_enderecos/g1").historico).toHaveLength(1);
    },
  );
  it("exige confirmação, marcações completas e data válida", async () => {
    const t = setup();
    const s = await t.criar();
    const v = {
      composicaoVersao: 1,
      progressoVersao: 0,
      modoConclusao: "marcacoes",
      confirmarCobertura: true,
      dataCobertura: "2026-10-21",
    };
    await expect(t.publico("concluir", s, v)).rejects.toThrow("pendentes");
    await expect(
      t.publico("concluir", s, {
        ...v,
        modoConclusao: "declaracao",
        dataCobertura: "2026-10-22",
      }),
    ).rejects.toThrow("data");
    await expect(
      t.publico("concluir", s, {
        ...v,
        modoConclusao: "declaracao",
        confirmarCobertura: false,
      }),
    ).rejects.toThrow("expressamente");
  });
  it("devolve parcialmente e retoma autoria herdada sem última conclusão", async () => {
    const t = setup();
    const s = await t.criar();
    await t.publico("marcacoes", s, {
      feitos: ["e1"],
      composicaoVersao: 1,
      progressoVersao: 0,
    });
    await t.publico("devolver", s, { composicaoVersao: 1, progressoVersao: 1 });
    expect(t.docs.get("grupos_enderecos/g1").ultimaConclusao).toBeUndefined();
    const d = t.docs.get(`designacoes_links/${s.id}`);
    const novo = await t.criar({ requestId: "r2", contatoId: d.contatoId });
    const p = await t.publico("territorio", novo);
    expect(p.herdados).toEqual(["e1"]);
    expect(t.docs.get(`designacoes_links/${novo.id}`).retomadaDe).toBe(s.id);
    await expect(t.publico("territorio", s)).rejects.toMatchObject({code:403});
  });
  it.each([{ feitos: [] }, { feitos: ["e1"] }, { feitos: ["e1", "e2"] }])(
    "vencimento com %j preserva progresso e notifica só uma vez",
    async ({ feitos }) => {
      const t = setup();
      const s = await t.criar();
      await t.publico("marcacoes", s, {
        feitos,
        composicaoVersao: 1,
        progressoVersao: 0,
      });
      t.setNow(new Date(+inicio + 2 * 86400000));
      await expect(t.publico("territorio", s)).rejects.toMatchObject({
        code: 403,
      });
      await expect(
        t.admin("prorrogar", { dias: 1 }, s.id),
      ).rejects.toMatchObject({ code: 410 });
      await t.service.expirar();
      await t.service.expirar();
      const g = t.docs.get("grupos_enderecos/g1");
      expect(g.status).toBe("ativo");
      expect(g.ultimaConclusao).toBeUndefined();
      expect(g.enderecos_visitados).toEqual(feitos);
      expect(g.historico).toHaveLength(1);
      expect(
        [...t.docs.keys()].filter((p) => p.startsWith("notificacoes/")),
      ).toHaveLength(1);
    },
  );
  it("configuração e renovação não mudam prazo atual; prorrogação é explícita", async () => {
    const t = setup();
    const s = await t.criar();
    const old = t.docs.get(`designacoes_links/${s.id}`).expiraEm;
    await t.admin("configurar", { prazoDevolucaoAutomaticaDias: 10 });
    await t.admin("renovar", {}, s.id);
    expect(+t.docs.get(`designacoes_links/${s.id}`).expiraEm).toBe(+old);
    await expect(t.publico("territorio", s)).rejects.toMatchObject({
      code: 403,
    });
    const n = await t.admin("compartilhar", {}, s.id);
    expect(n.link).not.toBe(s.link);
    await t.admin("prorrogar", { dias: 3 }, s.id);
    expect(+t.docs.get(`designacoes_links/${s.id}`).expiraEm).toBe(
      +old + 3 * 86400000,
    );
  });
  it("revogação bloqueia acesso mas conserva ocupação e vencimento", async () => {
    const t = setup();
    const s = await t.criar();
    await t.admin("revogar", {}, s.id);
    await expect(t.publico("territorio", s)).rejects.toMatchObject({
      code: 403,
    });
    expect(temDesignacaoAtiva(t.docs.get("grupos_enderecos/g1"))).toBe(true);
    t.setNow(new Date(+inicio + 3 * 86400000));
    await t.service.expirar();
    expect(t.docs.get("grupos_enderecos/g1").designacaoId).toBe(null);
  });
  it("valida associação e composição em toda chamada", async () => {
    const t = setup();
    const s = await t.criar();
    t.docs.get("enderecos/e1").status = "arquivado";
    await expect(t.publico("territorio", s)).rejects.toMatchObject({
      code: 409,
    });
    t.docs.get("enderecos/e1").status = "ativo";
    t.docs.get("grupos_enderecos/g1").enderecoIds = ["e2", "e1"];
    await expect(t.publico("territorio", s)).rejects.toMatchObject({
      code: 409,
    });
  });
  it("corrige sem apagar evento e reabre com novo acesso; protege trabalho posterior", async () => {
    const t = setup();
    const s = await t.criar();
    await t.publico("devolver", s, { composicaoVersao: 1, progressoVersao: 0 });
    await t.admin("corrigir", { motivo: "Devolveu por engano" }, s.id);
    const reopened = await t.admin(
      "reabrir",
      { motivo: "Devolveu por engano", requestId: "r2" },
      s.id,
    );
    expect(reopened.link).not.toBe(s.link);
    expect(t.docs.get(`eventos_designacoes/${s.id}`)).toBeTruthy();
    await expect(
      t.admin("reabrir", { motivo: "Outra correção", requestId: "r3" }, s.id),
    ).rejects.toMatchObject({ code: 409 });
  });
  it("conversão de email exige escolha explícita e limpa email replicado", async () => {
    const t = setup();
    t.docs.get("grupos_enderecos/g1").designadoPara = "antigo@example.test";
    t.docs.get("enderecos/e1").grupoDesignadoPara = "antigo@example.test";
    await expect(t.criar()).rejects.toMatchObject({ code: 409 });
    await t.criar({ converterEmail: true });
    expect(t.docs.get("enderecos/e1").grupoDesignadoPara).toBe(null);
  });
  it("retry com outros dados não devolve uma designação inesperada", async () => {
    const t = setup();
    await t.criar();
    await expect(t.criar({ reiniciar: true })).rejects.toMatchObject({
      code: 409,
    });
  });
  it("aplicação do novo prazo às ativas exige prévia, versão e confirmação", async () => {
    const t = setup();
    const s = await t.criar();
    const d = t.docs.get(`designacoes_links/${s.id}`);
    await t.admin("configurar", { prazoDevolucaoAutomaticaDias: 5 });
    const body = {
      confirmar: true,
      politicaVersao: 2,
      expiraEmAnterior: d.expiraEm,
    };
    await expect(
      t.admin("aplicar_prazo", { ...body, confirmar: false }, s.id),
    ).rejects.toThrow("Confirme");
    await expect(
      t.admin("aplicar_prazo", { ...body, politicaVersao: 1 }, s.id),
    ).rejects.toMatchObject({ code: 409 });
    await t.admin("aplicar_prazo", body, s.id);
    await t.admin("aplicar_prazo", body, s.id);
    expect(+t.docs.get(`designacoes_links/${s.id}`).expiraEm).toBe(
      +inicio + 5 * 86400000,
    );
    expect(
      [...t.docs.keys()].filter((p) => p.startsWith("aplicacoes_prazo/")),
    ).toHaveLength(1);
  });
  it("rotina registra falha recuperável sem encerrar o vínculo posterior", async () => {
    const t = setup();
    const s = await t.criar();
    t.setNow(new Date(+inicio + 3 * 86400000));
    t.docs.get("grupos_enderecos/g1").designacaoId = "posterior";
    const result = await t.service.expirar();
    expect(result.falhas).toEqual([s.id]);
    expect(t.docs.get("grupos_enderecos/g1").designacaoId).toBe("posterior");
    expect(t.docs.get("operacao_designacoes/vencimentos").falhas).toEqual([
      s.id,
    ]);
    t.docs.get("grupos_enderecos/g1").designacaoId = s.id;
    await t.service.expirar();
    expect(t.docs.get(`eventos_designacoes/${s.id}`).motivo).toBe(
      "prazo_expirado",
    );
  });
  it("reinício explícito arquiva o progresso, sem atribuí-lo ao novo ciclo", async () => {
    const t = setup();
    const s = await t.criar();
    await t.publico("marcacoes", s, {
      feitos: ["e1"],
      composicaoVersao: 1,
      progressoVersao: 0,
    });
    await t.publico("devolver", s, { composicaoVersao: 1, progressoVersao: 1 });
    const d = t.docs.get(`designacoes_links/${s.id}`);
    const n = await t.criar({
      requestId: "novo",
      contatoId: d.contatoId,
      reiniciar: true,
    });
    expect((await t.publico("territorio", n)).herdados).toEqual([]);
    expect(t.docs.get(`eventos_designacoes/${s.id}`).feitos).toEqual(["e1"]);
  });
  it("ignora endereços arquivados do território ao criar designação e encurta outros prefixos de idioma", async () => {
    const t = setup();
    t.docs.get("grupos_enderecos/g1").codigo = "EN-SBS-T007";
    t.docs.get("grupos_enderecos/g1").enderecoIds = ["e1", "e2", "e3"];
    t.docs.get("enderecos/e1").codigo = "EN-SBS-0015";
    t.docs.set("enderecos/e3", {
      codigo: "EN-SBS-0099",
      endereco: "Rua Arquivada, 99",
      grupoId: "g1",
      status: "arquivado",
      lat: -26.2,
      lng: -49.2,
    });
    const s = await t.criar();
    const p = await t.publico("territorio", s);
    expect(p.codigo).toBe("T-7");
    expect(p.enderecos).toHaveLength(2);
    expect(p.enderecos[0].codigo).toBe("E-15");
    const concluido = await t.publico("concluir", s, {
      modoConclusao: "declaracao",
      confirmarCobertura: true,
      composicaoVersao: 1,
      progressoVersao: 0,
    });
    expect(concluido.comprovante.dataCobertura).toBe("2026-10-21");
  });
});

describe("fronteira HTTP", () => {
  const handler = createHandler();
  it.each(["GET", "HEAD"])(
    "prévia %s não executa operações",
    async (method) => {
      const r = await handler.fetch(
        new Request("https://local/public/territorio", { method }),
        env,
      );
      expect(r.status).toBe(405);
      expect(r.headers.get("Cache-Control")).toBe("no-store");
    },
  );
  it("nega sem token e CORS não autoriza", async () => {
    const r = await handler.fetch(
      new Request("https://local/public/territorio", {
        method: "POST",
        headers: { Origin: "https://intruso.test" },
      }),
      { ...env, ENABLED: "true" },
    );
    expect(r.status).toBe(403);
    const s = await handler.fetch(
      new Request("https://local/public/territorio", { method: "POST" }),
      { ...env, ENABLED: "true" },
    );
    expect(s.status).toBe(401);
  });
  it("produção sem limitação de abuso falha fechada", async () => {
    const r = await handler.fetch(
      new Request("https://local/public/territorio", {
        method: "POST",
        headers: { Authorization: "Bearer abc" },
      }),
      { ...env, ENABLED: "true" },
    );
    expect(r.status).toBe(503);
  });
});


describe("cartão e PIN", () => {
  it.each([
    ["+55 (47) 99999-1234", "+5547999991234"],
    ["+55 47 9999-1234", "+5547999991234"],
    ["554799991234", "+5547999991234"],
    ["+55 47 8888-1234", "+5547988881234"],
    ["+55 47 98888-1234", "+5547988881234"],
    ["+55 47 3222-1234", "+554732221234"],
    ["+44 7911 123456", "+447911123456"],
    ["(55) 99999-1234", "+5555999991234"],
    ["+55\u00a047\u00a09999-1234", "+5547999991234"],
  ])("normaliza %s sem destruir colagem", (input, output) => expect(normalizarTelefone(input)).toBe(output));
  it.each(["+55 00 99999-1234", "telefone +5547999991234", "+554732221234 ramal 2", "123", "++5547999991234", "447911123456"])("recusa %s", n => expect(()=>normalizarTelefone(n)).toThrow());
  it("reserva cartão estável sem designar nem renovar; bootstrap mínimo", async () => {
    const t=setup();
    const a=await t.admin("cartao", {grupoId:"g1"});
    const b=await t.admin("cartao", {grupoId:"g1"});
    expect(a.cartaoId).toBe(b.cartaoId);
    expect(t.docs.get("grupos_enderecos/g1").designacaoId).toBeUndefined();
    expect(a.url).not.toContain("/t/");
    const boot=await t.service.cardAction("cartao", {cartaoId:a.cartaoId});
    expect(boot).toEqual({codigo:"T-13",disponivel:false});
    const share=await t.criar();
    const before=t.docs.get(`designacoes_links/${share.id}`).tokenVersao;
    expect((await t.admin("cartao",{grupoId:"g1"})).cartaoId).toBe(a.cartaoId);
    expect(t.docs.get(`designacoes_links/${share.id}`).tokenVersao).toBe(before);
    expect(share.mensagem).toContain(`Código de acesso: ${share.codigoAcesso}`);
  });
  it.each([false,true])("usa classe atual e omite cancelados no cartão, com snapshot=%s", async snapshot => {
    const t=setup();
    if(snapshot) await t.criar();
    for (const classe of ["confirmado","verificar","estudo"]) {
      t.docs.get("enderecos/e1").classe=classe;
      expect((await t.admin("cartao",{grupoId:"g1"})).enderecos[0].classe).toBe(classe);
    }
    for (const classe of ["excluido","cancelado"]) {
      Object.assign(t.docs.get("enderecos/e1"),{classe,lat:null,lng:null});
      const card=await t.admin("cartao",{grupoId:"g1"});
      expect(card.enderecos.map(e=>e.id)).toEqual(["e2"]);
      expect(card.cancelados).toBe(1);
      expect(card.enderecos[0].classe).toBe("confirmado");
    }
    t.docs.get("enderecos/e2").classe="excluido";
    await expect(t.admin("cartao",{grupoId:"g1"})).rejects.toThrow("Revise a lista");
  });
  it("aceita 0000, preserva cifra e troca por sessão aleatória escopada", async () => {
    const original=crypto.getRandomValues.bind(crypto);
    const spy=vi.spyOn(crypto,"getRandomValues").mockImplementation(a=>a instanceof Uint16Array ? (a.fill(0),a) : original(a));
    try {
      const t=setup();const share=await t.criar();
      expect(share.codigoAcesso).toBe("0000");
      const sess=await t.service.cardAction("acessar-cartao",{cartaoId:share.cartaoId,codigo:"0000"});
      expect(sess.token).toHaveLength(32);
      expect((await t.service.publicAction("territorio",sess.token)).enderecos).toHaveLength(2);
      const d=t.docs.get(`designacoes_links/${share.id}`);
      expect(await decifrar(d.pinCifrado,share.id,env)).toBe("0000");
      await t.admin("prorrogar",{dias:1},share.id);
      expect((await t.admin("compartilhar",{},share.id)).codigoAcesso).toBe("0000");
      await t.admin("renovar",{},share.id);
      const next=await t.admin("compartilhar",{},share.id);
      expect(next.codigoAcesso).not.toBe("0000");
      expect(next.cartaoId).toBe(share.cartaoId);
      await expect(t.service.publicAction("territorio",sess.token)).rejects.toMatchObject({code:403});
      await expect(t.service.cardAction("acessar-cartao",{cartaoId:share.cartaoId,codigo:"0000"})).rejects.toMatchObject({code:403});
    } finally {spy.mockRestore();}
  });
  it("não repete código ativo em outro território; reserva ignora colisão", async () => {
    const original=crypto.getRandomValues.bind(crypto);
    const spy=vi.spyOn(crypto,"getRandomValues").mockImplementation(a=>a instanceof Uint16Array ? (a.fill(0),a) : original(a));
    try {
      const t=setup();const s=await t.criar();
      const r=await t.store.transaction(tx=>reservarPin(tx,{id:"d2",grupoId:"g2",cartaoId:"c2",versao:1,agora:inicio},env));
      expect(await decifrar(r.pinCifrado,"d2",env)).toBe("0001");
      expect(r.pinHash).not.toBe(t.docs.get(`designacoes_links/${s.id}`).pinHash);
    } finally {spy.mockRestore();}
  });
  it("esgotamento e chave alterada preservam acesso anterior", async () => {
    const t=setup();const s=await t.criar();
    const old=t.docs.get(`designacoes_links/${s.id}`);
    t.docs.set("historico_codigos/g1",{usados:Array(10000).fill("ocupado")});
    await expect(t.admin("renovar",{},s.id)).rejects.toThrow("esgotados");
    expect(t.docs.get(`designacoes_links/${s.id}`)).toEqual(old);
    const outra=createService(t.store,{...env,PIN_HMAC_KEY:btoa("j".repeat(32)).replace(/=+$/,"")},()=>inicio);
    await expect(outra.adminAction("renovar",s.id,{},"admin@example.test")).rejects.toMatchObject({code:503});
  });
  it("projeção de observações atuais não altera snapshot e valida vínculo", async () => {
    const t=setup();const s=await t.criar();
    t.docs.get("enderecos/e1").informacao="Portão azul\n<script>texto</script>";
    t.docs.get("enderecos/e2").observacao="Informação legada";
    const p=await t.publico("territorio",s);
    expect(p.enderecos[0].observacao).toBe("Portão azul\n<script>texto</script>");
    expect(p.enderecos[1].observacao).toBe("Informação legada");
    expect(t.docs.get(`designacoes_links/${s.id}`).enderecos[0].observacao).toBeUndefined();
    expect(JSON.stringify(await t.service.cardAction("cartao",{cartaoId:s.cartaoId}))).not.toContain("Portão");
    const impresso = await t.admin("cartao",{grupoId:"g1"});
    expect(impresso.enderecos[0].observacao).toBe("Portão azul\n<script>texto</script>");
    expect(impresso.enderecos[1].observacao).toBe("Informação legada");
    t.docs.get("enderecos/e1").informacao = "Observação corrigida";
    expect((await t.admin("cartao",{grupoId:"g1"})).enderecos[0].observacao).toBe("Observação corrigida");
    t.docs.get("enderecos/e1").grupoId="outro";
    await expect(t.publico("territorio",s)).rejects.toMatchObject({code:409});
  });
  it("conflito entre aliases legados nunca funde históricos", async () => {
    const t=setup();
    t.docs.set("indice_contatos_telefone/554799991234",{contatoId:"antigo"});
    await expect(t.admin("contato",{nome:"Ana",telefone:"+5547999991234"})).rejects.toMatchObject({code:409});
    expect(t.docs.get("indice_contatos_telefone/554799991234")).toEqual({contatoId:"antigo"});
  });
  it("preserva token legado até renovação explícita; cartão sozinho não converte", async () => {
    const t=setup();
    const legacy=createService(t.store,{...env,CODIGOS_ENABLED:"false"},()=>inicio);
    const share=await legacy.adminAction("criar",null,{grupoId:"g1",requestId:"legacy",contato:{nome:"Legado",telefone:"+5547999991234"}},"admin@example.test");
    const d=t.docs.get(`designacoes_links/${share.id}`);
    const token=await decifrar(d,share.id,env);
    await t.admin("cartao",{grupoId:"g1"});
    expect((await t.admin("compartilhar",{},share.id)).link).toContain(`/t/${token}`);
    expect((await t.service.publicAction("territorio",token)).enderecos).toHaveLength(2);
    await legacy.adminAction("renovar",share.id,{},"admin@example.test");
    expect((await legacy.adminAction("compartilhar",share.id,{},"admin@example.test")).link).toContain("/#/t/");
    await t.admin("renovar",{},share.id);
    await expect(t.service.publicAction("territorio",token)).rejects.toMatchObject({code:403});
    expect((await t.admin("compartilhar",{},share.id)).codigoAcesso).toMatch(/^\d{4}$/);
  });
  it("após devolução permite só comprovante na sessão existente, sem novo acesso pelo PIN", async () => {
    const t=setup();const s=await t.criar();
    for(const codigo of [1234,"123","abcd","12345"])
      await expect(t.service.cardAction("acessar-cartao",{cartaoId:s.cartaoId,codigo})).rejects.toMatchObject({code:403});
    await expect(t.service.cardAction("acessar-cartao",{cartaoId:"outro",codigo:s.codigoAcesso})).rejects.toMatchObject({code:404});
    const session=await t.service.cardAction("acessar-cartao",{cartaoId:s.cartaoId,codigo:s.codigoAcesso});
    const receipt=await t.service.publicAction("devolver",session.token,{composicaoVersao:1,progressoVersao:0});
    expect(await t.service.publicAction("territorio",session.token)).toEqual(receipt);
    expect(Object.keys(receipt)).toEqual(["comprovante"]);
    await expect(t.service.publicAction("endereco",session.token,{})).rejects.toMatchObject({code:409});
    await expect(t.service.cardAction("acessar-cartao",{cartaoId:s.cartaoId,codigo:s.codigoAcesso})).rejects.toMatchObject({code:403});
    t.setNow(new Date(+inicio+13*60*60*1000));
    await expect(t.service.publicAction("territorio",session.token)).rejects.toMatchObject({code:403});
  });
  it("gera cartão vencido sem liberar acesso público nem alterar o prazo",async()=>{
    const t=setup();const share=await t.criar();
    t.setNow(new Date(+inicio+3*24*60*60*1000));
    const before=structuredClone(t.docs.get(`designacoes_links/${share.id}`));
    const card=await t.admin("cartao",{grupoId:"g1"});
    expect(card.enderecos).toHaveLength(2);
    expect(t.docs.get(`designacoes_links/${share.id}`)).toEqual(before);
    await expect(t.service.cardAction("acessar-cartao",{cartaoId:card.cartaoId,codigo:share.codigoAcesso})).rejects.toMatchObject({code:403});
  });
  it("despacha bootstrap antes de Bearer e limita tentativas sem chavear pelo PIN", async () => {
    const t=setup();const s=await t.criar();
    const seen=[];
    const limiter={limit:async ({key})=>{seen.push(key);return {success:true};}};
    const handler=createHandler({storeFactory:()=>t.store,clock:()=>inicio});
    const http=(path,body)=>handler.fetch(new Request(`https://local/public/${path}`,{method:"POST",headers:{"CF-Connecting-IP":"192.0.2.1"},body:JSON.stringify(body)}),{...env,ENABLED:"true",LOCAL_EMULATORS:"true",PIN_IP_LIMITER:limiter,PIN_CARD_IP_LIMITER:limiter});
    expect((await http("cartao",{cartaoId:s.cartaoId})).status).toBe(200);
    seen.length=0;
    expect((await http("acessar-cartao",{cartaoId:s.cartaoId,codigo:"xxxx"})).status).toBe(403);
    expect((await http("acessar-cartao",{cartaoId:s.cartaoId,codigo:"yyyy"})).status).toBe(403);
    expect(seen.slice(0,2)).toEqual(seen.slice(2,4));
    expect(await fingerprint("0000",env)).not.toBe(await hashToken("0000"));
  });
});


describe("limites da reserva e legado terminal",()=>{
  it("reserva saturada para após 128 candidatos e preserva o estado",async()=>{
    const t=setup();
    t.docs.set("designacoes_links/ocupado",{operacionalAtiva:true,status:"ativa",tokenVersao:1,expiraEm:new Date(+inicio+86400000)});
    for(let i=0;i<128;i++) t.docs.set(`codigos_ativos/${await fingerprint(String(i).padStart(4,"0"),env)}`,{designacaoId:"ocupado",versao:1});
    const before=JSON.stringify([...t.docs]);
    const original=crypto.getRandomValues.bind(crypto);
    const spy=vi.spyOn(crypto,"getRandomValues").mockImplementation(a=>a instanceof Uint16Array?(a.fill(0),a):original(a));
    try {
      await expect(t.store.transaction(tx=>reservarPin(tx,{id:"novo",grupoId:"g1",cartaoId:"c1",versao:1,agora:inicio},env))).rejects.toMatchObject({code:409});
      expect(JSON.stringify([...t.docs])).toBe(before);
    } finally {spy.mockRestore();}
  });
  it("legado devolvido continua apenas com comprovante idempotente",async()=>{
    const t=setup();const legacy=createService(t.store,{...env,CODIGOS_ENABLED:"false"},()=>inicio);
    const s=await legacy.adminAction("criar",null,{grupoId:"g1",requestId:"old",contato:{nome:"Legado",telefone:"+5547999991234"}},"admin@example.test");
    const token=s.link.split("/").pop();
    const recibo=await legacy.publicAction("devolver",token,{composicaoVersao:1,progressoVersao:0});
    expect(await legacy.publicAction("devolver",token,{})).toEqual(recibo);
    expect((await legacy.publicAction("territorio",token)).enderecos).toBeUndefined();
    expect(t.docs.get("grupos_enderecos/g1").historico).toHaveLength(1);
  });
});


describe("consulta QR independente e sem efeitos", () => {
  async function fixture() {
    const t = setup();
    const card = await t.admin("cartao", { grupoId: "g1" });
    return { ...t, cartaoId: card.cartaoId, consulta: () => t.service.cardAction("consulta-cartao", { cartaoId: card.cartaoId }) };
  }
  it("projeta allowlist atual sem sessão, progresso, PIN ou efeitos", async () => {
    const t = await fixture();
    Object.assign(t.docs.get("enderecos/e1"), { bairro: "Centro", informacao: "<script>literal</script>", telefone: "SEGREDO", token: "SEGREDO", responsavel: "SEGREDO", mapsUrl: "javascript:alert(1)" });
    Object.assign(t.docs.get("grupos_enderecos/g1"), { enderecos_visitados: ["e1"], responsavel: "SEGREDO" });
    const before = structuredClone([...t.docs]);
    const result = await t.consulta();
    expect(Object.keys(result).sort()).toEqual(["modo", "podeMarcar", "codigo", "nome", "habilitacaoDisponivel", "enderecos"].sort());
    expect(Object.keys(result.enderecos[0]).sort()).toEqual(["id", "codigo", "endereco", "lat", "lng", "mapsUrl", "observacao"].sort());
    expect(result).toMatchObject({ modo: "consulta", podeMarcar: false, habilitacaoDisponivel: false });
    expect(result.enderecos[0]).toMatchObject({ endereco: "Rua Árvore, 1 — Centro", observacao: "<script>literal</script>", codigo: "E-21" });
    expect(JSON.stringify(result)).not.toContain("SEGREDO");
    expect(JSON.stringify(result)).not.toContain("javascript:");
    expect([...t.docs]).toEqual(before);
    expect((await t.service.cardAction("cartao", { cartaoId: t.cartaoId }))).toEqual({ codigo: "T-13", disponivel: false });
  });
  it.each(["ativa", "vencida", "devolvida", "concluida", "email", "legado", "revogada", "divergente", "snapshot-invalido"])("consulta %s sem alterar ciclo", async estado => {
    const t = await fixture();
    const s = await t.criar();
    const g = t.docs.get("grupos_enderecos/g1");
    const d = t.docs.get(`designacoes_links/${s.id}`);
    if (estado === "vencida") t.setNow(new Date(+inicio + 3 * 86400000));
    if (estado === "devolvida") await t.admin("devolver", {}, s.id);
    if (estado === "concluida") await t.publico("concluir", s, { composicaoVersao: 1, progressoVersao: 0, confirmarCobertura: true, modoConclusao: "declaracao" });
    if (estado === "email") Object.assign(g, { designacaoTipo: "email", designadoPara: "private@example.test" });
    if (estado === "legado") d.acessoModo = "token16";
    if (estado === "revogada") await t.admin("revogar", {}, s.id);
    if (estado === "divergente") g.designadoContatoId = "outro";
    if (estado === "snapshot-invalido") d.enderecos = {};
    const before = structuredClone([...t.docs]);
    const result = await t.consulta();
    expect(result.enderecos).toHaveLength(2);
    expect(result.habilitacaoDisponivel).toBe(estado === "ativa");
    expect([...t.docs]).toEqual(before);
    if (estado !== "ativa" && estado !== "snapshot-invalido") await expect(t.service.cardAction("acessar-cartao", { cartaoId: t.cartaoId, codigo: s.codigoAcesso })).rejects.toHaveProperty("code");
  });
  it.each(["ausente", "duplicado", "invalido", "reatribuido", "excesso", "inverso"])("recusa composição %s sem vazamento parcial", async estado => {
    const t = await fixture();
    const g = t.docs.get("grupos_enderecos/g1");
    if (estado === "ausente") t.docs.delete("enderecos/e2");
    if (estado === "duplicado") g.enderecoIds = ["e1", "e1"];
    if (estado === "invalido") g.enderecoIds = ["e1", "../e2"];
    if (estado === "reatribuido") t.docs.get("enderecos/e2").grupoId = "outro";
    if (estado === "excesso") g.enderecoIds = Array(501).fill("e1");
    if (estado === "inverso") t.docs.set("cartoes_por_grupo/g1", { cartaoId: "outro" });
    const before = structuredClone([...t.docs]);
    await expect(t.consulta()).rejects.toMatchObject({ code: 409 });
    expect([...t.docs]).toEqual(before);
  });
  it("arquivados, reativação, observação legada limitada e navegação sem coordenadas", async () => {
    const t = await fixture();
    t.docs.get("enderecos/e1").status = "arquivado";
    Object.assign(t.docs.get("enderecos/e2"), { informacao: "  ", observacao: "x".repeat(20001), lat: Infinity, lng: null });
    let r = await t.consulta();
    expect(r.enderecos).toHaveLength(1);
    expect(r.enderecos[0]).toMatchObject({ lat: null, lng: null, observacao: "x".repeat(20000) });
    expect(r.enderecos[0].mapsUrl).toContain(encodeURIComponent("Rua São João, 2"));
    t.docs.get("grupos_enderecos/g1").status = "arquivado";
    await expect(t.consulta()).rejects.toMatchObject({ code: 404 });
    t.docs.get("grupos_enderecos/g1").status = "ativo";
    expect((await t.consulta()).enderecos).toHaveLength(1);
    t.docs.get("enderecos/e2").status = "arquivado";
    await expect(t.consulta()).rejects.toMatchObject({ code: 404 });
    await expect(t.service.cardAction("consulta-cartao", { cartaoId: "inexistente" })).rejects.toMatchObject({ code: 404 });
  });
  it("composição atual diverge do snapshot sem habilitar nem reconciliar", async () => {
    const t = await fixture(); const s = await t.criar();
    t.docs.get("grupos_enderecos/g1").enderecoIds = ["e2"];
    const result = await t.consulta();
    expect(result.enderecos.map(e => e.id)).toEqual(["e2"]);
    expect(result.habilitacaoDisponivel).toBe(false);
    await expect(t.service.cardAction("acessar-cartao", { cartaoId: t.cartaoId, codigo: s.codigoAcesso })).rejects.toMatchObject({ code: 409 });
  });
  it("consulta HTTP só consome REQUEST; mutações e território exigem credencial forte", async () => {
    const t = await fixture(); const s = await t.criar();
    const handler = createHandler({ storeFactory: () => t.store, clock: () => inicio });
    const request = { limit: vi.fn(async () => ({ success: true })) };
    const deny = { limit: vi.fn(async () => ({ success: false })) };
    const config = { ...env, ENABLED: "true", ALLOWED_ORIGINS: "https://allowed.test", REQUEST_LIMITER: request, WRITE_LIMITER: deny, PIN_IP_LIMITER: deny, PIN_CARD_LIMITER: deny, PIN_CARD_IP_LIMITER: deny };
    const http = (path, body = {}, token, extra = {}) => handler.fetch(new Request(`https://local/public/${path}`, { method: "POST", headers: { Origin: "https://allowed.test", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }), { ...config, ...extra });
    const response = await http("consulta-cartao", { cartaoId: t.cartaoId });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://allowed.test");
    expect(request.limit).toHaveBeenCalledTimes(1); expect(deny.limit).not.toHaveBeenCalled();
    for (const route of ["territorio", "endereco", "marcacoes", "concluir", "devolver"]) {
      expect((await http(route, { cartaoId: t.cartaoId, codigo: s.codigoAcesso, podeMarcar: true })).status).toBe(401);
      for (const token of [t.cartaoId, s.codigoAcesso, "x".repeat(32)]) {
        const r = await http(route, {}, token, { WRITE_LIMITER: { limit: async () => ({ success: true }) } });
        expect(r.status).toBe(403);
      }
    }
    expect((await http("consulta-cartao", { cartaoId: t.cartaoId }, null, { REQUEST_LIMITER: deny })).status).toBe(429);
    expect((await http("consulta-cartao", {}, null, { ENABLED: "false" })).status).toBe(503);
    expect((await http("consulta-cartao", { cartaoId: "x".repeat(33000) })).status).toBe(413);
    expect((await http("acessar-cartao", { cartaoId: t.cartaoId, codigo: s.codigoAcesso })).status).toBe(429);
    const session = await t.service.cardAction("acessar-cartao", { cartaoId: t.cartaoId, codigo: s.codigoAcesso });
    await expect(t.service.publicAction("territorio", session.token, { cartaoId: "outro" })).rejects.toMatchObject({ code: 403 });
    expect((await t.service.publicAction("territorio", session.token, { cartaoId: t.cartaoId })).enderecos).toHaveLength(2);
  });
});
