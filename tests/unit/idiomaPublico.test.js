import process from "node:process";
import { describe, expect, it } from "vitest";
import {
  criarIdiomaPublico,
  detectarIdiomaPublico,
  mensagensPublicas,
} from "../../src/designacoes/idiomaPublico.js";
import { validarDataCobertura } from "../../shared/designacoes.js";

describe("idioma automático da tela pública", () => {
  it.each([
    ["en-US", "en"],
    ["en-GB", "en"],
    ["es-MX", "es"],
    ["es-ES", "es"],
    ["pt-PT", "pt"],
    ["pt-BR", "pt"],
    ["EN_us", "en"],
    ["fr-FR", "pt"],
  ])("detecta %s como %s", (input, expected) => {
    expect(detectarIdiomaPublico([input])).toBe(expected);
  });
  it("usa a primeira preferência do navegador e o idioma alternativo quando a lista está vazia", () => {
    expect(detectarIdiomaPublico(["es-MX", "en-US"])).toBe("es");
    expect(detectarIdiomaPublico([], "en-US")).toBe("en");
    expect(detectarIdiomaPublico()).toBe("pt");
    expect(detectarIdiomaPublico(["fr-FR", "en-US"])).toBe("pt");
  });
  it("inclui traduções e os mesmos parâmetros em todas as mensagens", () => {
    for (const [key, translations] of Object.entries(mensagensPublicas)) {
      expect(translations, key).toHaveLength(3);
      const placeholders = (text) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const text of translations) {
        expect(text.length, key).toBeGreaterThan(0);
        expect(placeholders(text), key).toEqual(placeholders(translations[0]));
      }
    }
  });
  it.each(["pt", "en", "es"])(
    "preserva as três situações de devolução em %s",
    (language) => {
      const { resumo, t } = criarIdiomaPublico(language);
      expect(resumo(0, 3)).toEqual({
        texto: t("summaryNone", { total: 3 }),
        acao: t("returnNone"),
      });
      expect(resumo(1, 3)).toEqual({
        texto: t("summaryPartial", { done: 1, total: 3, pending: 2 }),
        acao: t("returnPartial", { pending: 2 }),
      });
      expect(resumo(3, 3)).toEqual({
        texto: t("summaryAll", { total: 3 }),
        acao: t("confirmReturn"),
      });
      expect(resumo(0, 3).texto).not.toMatch(/\{/);
    },
  );
  it("traduz singular/plural sem abreviações ambíguas", () => {
    expect(criarIdiomaPublico("pt").t("pendingCount", { count: 1 })).toBe(
      "1 pendente",
    );
    expect(criarIdiomaPublico("pt").t("pendingCount", { count: 2 })).toBe(
      "2 pendentes",
    );
    expect(criarIdiomaPublico("es").t("missingPoints", { count: 1 })).toContain(
      "1 dirección sin",
    );
    expect(criarIdiomaPublico("en").t("inherited", { count: 1 })).toContain(
      "1 address was",
    );
  });
  it("traduz erros públicos e usa mensagem local para falhas desconhecidas", () => {
    const en = criarIdiomaPublico("en");
    expect(en.erro(new Error(mensagensPublicas.errorDate[0]))).toBe(
      en.t("errorDate"),
    );
    expect(en.erro({ code: 410 })).toBe(en.t("errorExpired"));
    expect(en.erro({ code: 429 })).toBe(en.t("errorRate"));
    expect(en.erro(new TypeError("Failed to fetch"))).toBe(
      en.t("errorGeneric"),
    );
    expect(
      criarIdiomaPublico("es").erro(
        new Error(mensagensPublicas.errorOffline[0]),
      ),
    ).toBe(mensagensPublicas.errorOffline[2]);
  });
});

describe("datas locais sem alterar o valor da cobertura", () => {
  it.each([
    ["pt", "05/11/2026"],
    ["en", "11/05/2026"],
    ["es", "05/11/2026"],
  ])("exibe data de calendário em %s", (language, expected) => {
    const value = "2026-11-05";
    expect(criarIdiomaPublico(language).formatarDia(value)).toBe(expected);
    expect(
      validarDataCobertura(
        value,
        "2026-01-01T12:00:00Z",
        new Date("2026-11-06T12:00:00Z"),
      ),
    ).toBe(value);
  });
  it("não permite interpretar a data exibida como valor ISO enviado ao servidor", () => {
    expect(() =>
      validarDataCobertura(
        "11/05/2026",
        "2026-01-01T12:00:00Z",
        new Date("2026-11-06T12:00:00Z"),
      ),
    ).toThrow();
    expect(() =>
      validarDataCobertura("", "2026-01-01T12:00:00Z", new Date()),
    ).toThrow();
  });
  it.each(["", "invalid", "2026-02-30", "2026-13-01"])(
    "tolera valor incompleto/inválido na apresentação: %s",
    (value) => {
      expect(criarIdiomaPublico("en").formatarDia(value)).toBe("");
    },
  );
  it("aceita dia bissexto sem normalizar para outro dia", () => {
    expect(criarIdiomaPublico("en").formatarDia("2028-02-29")).toBe(
      "02/29/2028",
    );
  });
  it("mantém o dia comercial de São Paulo na virada UTC", () => {
    expect(criarIdiomaPublico("en").formatarData("2026-11-06T01:30:00Z")).toBe(
      "11/05/2026",
    );
    expect(criarIdiomaPublico("pt").formatarData("2026-11-06T01:30:00Z")).toBe(
      "05/11/2026",
    );
    expect(criarIdiomaPublico("es").formatarData("2026-11-06T03:30:00Z")).toBe(
      "06/11/2026",
    );
  });
  it("não muda a data conforme o fuso do aparelho", () => {
    const original = process.env.TZ;
    try {
      for (const timezone of [
        "Pacific/Kiritimati",
        "America/Los_Angeles",
        "UTC",
      ]) {
        process.env.TZ = timezone;
        expect(criarIdiomaPublico("en").formatarDia("2026-11-05")).toBe(
          "11/05/2026",
        );
        expect(
          criarIdiomaPublico("en").formatarData("2026-11-06T01:30:00Z"),
        ).toBe("11/05/2026");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
