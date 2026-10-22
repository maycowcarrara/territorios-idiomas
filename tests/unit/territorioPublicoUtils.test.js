import { describe, expect, it } from "vitest";
import {
  getCoordenadasEndereco,
  getNavegacaoEndereco,
} from "../../src/designacoes/territorioPublicoUtils.js";

const endereco = {
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=-26.250000%2C-49.380000",
};

describe("localização na tela pública", () => {
  it("usa o ponto do snapshot já enviado sem consultar outros endereços", () => {
    expect(getCoordenadasEndereco(endereco)).toEqual([-26.25, -49.38]);
  });
  it("também aceita coordenadas explícitas quando presentes", () => {
    expect(getCoordenadasEndereco({ lat: -26, lng: -49 })).toEqual([-26, -49]);
  });
  it.each([
    {},
    { mapsUrl: "https://www.google.com/maps/search/?query=Rua+Exemplo" },
    { mapsUrl: "https://intruso.test/?query=-26,-49" },
    { mapsUrl: "https://www.google.com/maps/search/?query=91,181" },
    { lat: Infinity, lng: 20 },
  ])("não inventa um ponto para dados ausentes ou inválidos: %j", (value) => {
    expect(getCoordenadasEndereco(value)).toBeNull();
  });
  it("abre navegação para o ponto exato, sem expor o link da designação", () => {
    const url = new URL(getNavegacaoEndereco(endereco));
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("destination")).toBe("-26.25,-49.38");
    expect(url.searchParams.has("origin")).toBe(false);
  });
  it("mantém a pesquisa Maps original quando não há coordenadas", () => {
    const value = {
      mapsUrl: "https://www.google.com/maps/search/?query=Rua+Exemplo",
    };
    expect(getNavegacaoEndereco(value)).toBe(value.mapsUrl);
  });
});
