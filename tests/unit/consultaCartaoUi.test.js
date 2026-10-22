import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartaoPublico from "../../src/designacoes/CartaoPublico.jsx";
import TerritorioPublico from "../../src/designacoes/TerritorioPublico.jsx";
import { designacoesRequest } from "../../src/designacoesApi.js";

const state = vi.hoisted(() => ({ params: { cartaoId: "card-a" } }));
vi.mock("react-router-dom", () => ({ useParams: () => state.params }));
vi.mock("../../src/designacoesApi.js", () => ({ designacoesRequest: vi.fn() }));
vi.mock("../../src/designacoes/MapaTerritorioPublico.jsx", () => ({ default: props => React.createElement("map-fixture", props) }));
vi.mock("../../src/designacoes/ModalConfirmacaoPublica.jsx", () => ({ default: props => React.createElement("dialog", { open: true }, props.children) }));
const consulta = { modo: "consulta", podeMarcar: false, codigo: "T-1", nome: "Centro", habilitacaoDisponivel: true, enderecos: [{ id: "e1", codigo: "E-1", endereco: "Rua Atual", observacao: "<b>Literal</b>", lat: -26, lng: -49 }] };
const operacional = { codigo: "T-1", nome: "Centro", expiraEm: "2099-01-01", inicioCobertura: "2026-10-22", composicaoVersao: 3, progressoVersao: 7, feitos: [], herdados: [], enderecos: [{ ...consulta.enderecos[0], id: "snapshot", endereco: "Rua Autorizada" }] };
const session = { token: "x".repeat(32), expiraEm: new Date(Date.now() + 3600000).toISOString() };
const fail = code => Object.assign(new Error("Falha de teste"), { code });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
let renderer, focus, stored;
const buttons = () => renderer.root.findAllByType("button");
const text = node => (node.children || []).map(v => typeof v === "string" ? v : text(v)).join("");
const button = label => buttons().find(b => b.props["aria-label"] === label || text(b) === label);
const click = async label => act(async () => { button(label).props.onClick(); });
const settle = async () => act(async () => { await Promise.resolve(); });
const mount = async element => act(async () => { renderer = create(element || React.createElement(CartaoPublico), { createNodeMock: e => ({ focus: () => focus(e.type), isConnected: true }) }); });
const submit = async code => {
  await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: code } }));
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
};
function assertConsulta() {
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  expect(renderer.root.findAllByType("footer")).toHaveLength(0);
  expect(renderer.root.findAllByProps({ role: "progressbar" })).toHaveLength(0);
  expect(renderer.root.findByType("map-fixture").props.podeMarcar).toBe(false);
  expect(renderer.root.findByType("map-fixture").props.feitos).toBeUndefined();
  expect(JSON.stringify(renderer.toJSON())).not.toContain("Pendente");
  expect(JSON.stringify(renderer.toJSON())).toContain("Rua Atual");
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.params = { cartaoId: "card-a" }; focus = vi.fn(); stored = new Map();
  const win = new EventTarget(); win.location = { pathname: "/", search: "" }; win.history = { replaceState: vi.fn() };
  const doc = new EventTarget(); doc.visibilityState = "visible"; doc.documentElement = { lang: "pt" }; doc.head = { append: vi.fn() }; doc.createElement = () => ({ remove() {} });
  vi.stubGlobal("window", win); vi.stubGlobal("document", doc); vi.stubGlobal("location", { origin: "https://fixture.test" });
  vi.stubGlobal("navigator", { languages: ["pt-BR"], language: "pt-BR" });
  vi.stubGlobal("requestAnimationFrame", cb => cb());
  vi.stubGlobal("sessionStorage", { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) });
  designacoesRequest.mockReset().mockImplementation(async path => {
    if (path === "/public/consulta-cartao") return consulta;
    if (path === "/public/acessar-cartao") return session;
    if (path === "/public/territorio") return operacional;
    throw new Error(`Unexpected ${path}`);
  });
  vi.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated")) throw new Error(String(message) + args.join(" "));
  });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("consulta e habilitação montadas sem navegador", () => {
  it("QR não restaura edição, não foca PIN e não monta controles", async () => {
    stored.set("cartao:https://fixture.test:card-a", JSON.stringify(session));
    await mount(); await settle(); assertConsulta();
    expect(focus).not.toHaveBeenCalled();
    expect(designacoesRequest.mock.calls.map(c => c[0])).toEqual(["/public/consulta-cartao"]);
    expect(renderer.root.findAllByType("a").some(a => text(a).includes("Navegar"))).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("<b>Literal</b>");
    await click("Habilitar marcações"); await settle();
    expect(renderer.root.findAllByProps({ type: "checkbox" })).toHaveLength(1);
    expect(renderer.root.findByType("map-fixture").props.enderecos[0].id).toBe("snapshot");
    expect(designacoesRequest).toHaveBeenCalledWith("/public/territorio", { cartaoId: "card-a" }, session.token);
  });
  it.each([403, 410, 429, 503])("erro %s preserva consulta; cancelar devolve foco", async code => {
    designacoesRequest.mockImplementation(async path => {
      if (path === "/public/consulta-cartao") return consulta;
      throw fail(code);
    });
    await mount(); await settle(); await click("Habilitar marcações");
    expect(renderer.root.findByType("input").props.inputMode).toBe("numeric");
    await submit("0000");
    expect(JSON.stringify(renderer.toJSON())).toContain("Rua Atual");
    expect(renderer.root.findAllByType("footer")).toHaveLength(0);
    await click("Cancelar"); assertConsulta(); expect(focus).toHaveBeenLastCalledWith("button");
  });
  it("PIN precisa carregar snapshot autenticado antes de montar ações", async () => {
    const pending = deferred();
    designacoesRequest.mockImplementation(async path => path === "/public/consulta-cartao" ? consulta : path === "/public/acessar-cartao" ? session : pending.promise);
    await mount(); await settle(); await click("Habilitar marcações");
    await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "0000" } }));
    let submitting;
    await act(async () => { submitting = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(renderer.root.findAllByType("footer")).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Rua Atual");
    await act(async () => { pending.resolve(operacional); await submitting; }); await settle();
    expect(renderer.root.findByType("map-fixture").props.enderecos[0].id).toBe("snapshot");
    expect(designacoesRequest).toHaveBeenCalledWith("/public/acessar-cartao", { cartaoId: "card-a", codigo: "0000" });
  });
  it("link automático independe de erro da consulta e limpa fragmento em erro", async () => {
    state.params = { cartaoId: "card-a", codigo: "0000", revisao: "fechar" };
    designacoesRequest.mockImplementation(async path => {
      if (path === "/public/consulta-cartao") throw fail(503);
      return path === "/public/acessar-cartao" ? session : operacional;
    });
    await mount(); await settle();
    expect(window.history.replaceState).toHaveBeenCalledWith(undefined, "", "/#/c/card-a");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    expect(renderer.root.findAllByType("footer")).toHaveLength(1);
  });
  it("PIN automático inválido não apaga consulta nem conserva fragmento", async () => {
    state.params = { cartaoId: "card-a", codigo: "9999", revisao: "fechar" };
    designacoesRequest.mockImplementation(async path => { if (path === "/public/consulta-cartao") return consulta; throw fail(403); });
    await mount(); await settle();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain("Rua Atual");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });
  it("troca rápida ignora consulta atrasada do cartão anterior", async () => {
    const pending = deferred();
    designacoesRequest.mockImplementation(async (_path, body) => body.cartaoId === "card-a" ? pending.promise : { ...consulta, nome: "Outro", enderecos: [{ ...consulta.enderecos[0], endereco: "Rua B" }] });
    await mount(); state.params = { cartaoId: "card-b" };
    await act(async () => renderer.update(React.createElement(CartaoPublico)));
    await act(async () => pending.resolve(consulta)); await settle();
    expect(JSON.stringify(renderer.toJSON())).toContain("Rua B");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Rua Atual");
  });
  it("cancelar ignora resposta atrasada de PIN sem salvar sessão", async () => {
    const pending = deferred();
    designacoesRequest.mockImplementation(async path => path === "/public/consulta-cartao" ? consulta : pending.promise);
    await mount(); await settle(); await click("Habilitar marcações");
    await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "0000" } }));
    let submitting; await act(async () => { submitting = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    await click("Cancelar"); await act(async () => { pending.resolve(session); await submitting; });
    assertConsulta(); expect(stored.size).toBe(0);
  });
  it("retorno à aba revalida consulta e remove conteúdo arquivado", async () => {
    await mount(); await settle(); assertConsulta();
    designacoesRequest.mockRejectedValue(fail(404));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Rua Atual");
  });
  it("perda de sessão em escrita fecha revisão e retorna à consulta sem repetir", async () => {
    await mount(); await settle(); await click("Habilitar marcações"); await submit("0000"); await settle();
    designacoesRequest.mockImplementation(async path => { if (path === "/public/endereco") throw fail(403); return consulta; });
    await act(async () => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } })); await settle();
    assertConsulta(); expect(stored.size).toBe(0);
    expect(designacoesRequest.mock.calls.filter(c => c[0] === "/public/endereco")).toHaveLength(1);
  });
  it("409 de progresso relê snapshot e pede revisão; vínculo inválido perde capacidade", async () => {
    const lost = vi.fn();
    await mount(React.createElement(TerritorioPublico, { credencial: session.token, onPerdaAutorizacao: lost })); await settle();
    designacoesRequest.mockImplementation(async path => { if (path === "/public/endereco") throw fail(409); return { ...operacional, progressoVersao: 8 }; });
    await act(async () => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    expect(lost).not.toHaveBeenCalled(); expect(renderer.root.findAllByType("footer")).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain("Revise a lista");
    designacoesRequest.mockRejectedValue(fail(409));
    await act(async () => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    expect(lost).toHaveBeenCalled(); expect(renderer.root.findAllByType("footer")).toHaveLength(0);
  });
  it("falha de rede bloqueia ações até releitura, sem repetir escrita", async () => {
    await mount(React.createElement(TerritorioPublico, { credencial: session.token })); await settle();
    designacoesRequest.mockRejectedValue(new Error("Rede indisponível"));
    await act(async () => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    expect(renderer.root.findAllByType("footer")).toHaveLength(0);
    expect(renderer.root.findAllByProps({ type: "checkbox" })).toHaveLength(0);
    designacoesRequest.mockResolvedValue(operacional);
    await click("Atualizar e tentar novamente");
    expect(renderer.root.findAllByType("footer")).toHaveLength(1);
    expect(designacoesRequest.mock.calls.filter(c => c[0] === "/public/endereco")).toHaveLength(1);
  });
  it("sessão encerrada apresenta comprovante sem edição", async () => {
    stored.set("cartao:https://fixture.test:card-a", JSON.stringify(session));
    designacoesRequest.mockImplementation(async path => path === "/public/consulta-cartao" ? consulta : { comprovante: { codigo: "T-1", resultado: "manual_parcial", feitos: 1, pendentes: 1, registradoEm: "2026-10-22" } });
    await mount(); await settle(); assertConsulta(); await click("Habilitar marcações"); await settle();
    expect(renderer.root.findAllByType("footer")).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Comprovante");
  });
});


it("sessão salva de outro cartão é removida e abre PIN mantendo consulta", async () => {
  stored.set("cartao:https://fixture.test:card-a", JSON.stringify(session));
  designacoesRequest.mockImplementation(async path => { if (path === "/public/consulta-cartao") return consulta; throw fail(403); });
  await mount(); await settle(); await click("Habilitar marcações");
  expect(stored.size).toBe(0); expect(renderer.root.findAllByType("form")).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).toContain("Rua Atual");
});
it("navegar do link habilitado para QR simples retorna à consulta", async () => {
  state.params = { cartaoId: "card-a", codigo: "0000" };
  await mount(); await settle(); expect(renderer.root.findAllByType("footer")).toHaveLength(1);
  state.params = { cartaoId: "card-a" };
  await act(async () => renderer.update(React.createElement(CartaoPublico))); await settle();
  assertConsulta(); expect(stored.size).toBe(1);
});
it("resposta de PIN do cartão anterior nunca salva sessão nem substitui novo cartão", async () => {
  const pending = deferred(); state.params = { cartaoId: "card-a", codigo: "0000" };
  designacoesRequest.mockImplementation(async path => path === "/public/consulta-cartao" ? consulta : pending.promise);
  await mount(); state.params = { cartaoId: "card-b" };
  await act(async () => renderer.update(React.createElement(CartaoPublico)));
  await act(async () => pending.resolve(session)); await settle();
  assertConsulta(); expect(stored.size).toBe(0);
  expect(designacoesRequest.mock.calls.filter(c => c[0] === "/public/territorio")).toHaveLength(0);
});
it("expiração local fecha controles e retorna à consulta, sem conceder novo acesso", async () => {
  vi.useFakeTimers();
  designacoesRequest.mockImplementation(async path => path === "/public/consulta-cartao" ? consulta : path === "/public/acessar-cartao" ? { ...session, expiraEm: new Date(Date.now() + 1000).toISOString() } : operacional);
  await mount(); await settle(); await click("Habilitar marcações"); await submit("0000"); await settle();
  expect(renderer.root.findAllByType("footer")).toHaveLength(1);
  await act(async () => vi.advanceTimersByTime(1001)); await settle();
  assertConsulta(); expect(stored.size).toBe(0);
});
it("retorno da aba durante escrita aguarda confirmação e revalida sem repetir", async () => {
  const pending = deferred();
  await mount(); await settle(); await click("Habilitar marcações"); await submit("0000"); await settle();
  designacoesRequest.mockImplementation(async path => path === "/public/endereco" ? pending.promise : path === "/public/consulta-cartao" ? consulta : operacional);
  let saving; const change = renderer.root.findByProps({ type: "checkbox" }).props.onChange;
  await act(async () => {
    saving = change({ target: { checked: true } });
    change({ target: { checked: true } });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await act(async () => { pending.resolve(operacional); await saving; }); await settle();
  expect(renderer.root.findAllByType("footer")).toHaveLength(1);
  const writes = designacoesRequest.mock.calls.filter(c => c[0] === "/public/endereco");
  expect(writes).toHaveLength(1);
  expect(writes[0][1]).toEqual({ cartaoId: "card-a", enderecoId: "snapshot", pregado: true, composicaoVersao: 3, progressoVersao: 7 });
});
it.each([["en-US", "Enable marking", "Four-digit code"], ["es-ES", "Habilitar marcas", "Código de cuatro dígitos"]])("formulário %s mantém rótulos e capacidade", async (locale, enable, label) => {
  navigator.languages = [locale]; navigator.language = locale;
  await mount(); await settle(); await click(enable);
  expect(JSON.stringify(renderer.toJSON())).toContain(label);
  expect(renderer.root.findAllByProps({ type: "checkbox" })).toHaveLength(0);
});
it("StrictMode troca PIN uma vez e preserva /fechar autorizado", async () => {
  state.params = { cartaoId: "card-a", codigo: "0000", revisao: "fechar" };
  await mount(React.createElement(React.StrictMode, null, React.createElement(CartaoPublico))); await settle();
  expect(designacoesRequest.mock.calls.filter(c => c[0] === "/public/acessar-cartao")).toHaveLength(1);
  expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
});

it("retorno à aba fecha capacidade durante leitura e volta à consulta em 403", async () => {
  vi.useFakeTimers();
  await mount(); await settle(); await click("Habilitar marcações"); await submit("0000"); await settle();
  designacoesRequest.mockImplementation(async path => { if (path === "/public/consulta-cartao") return consulta; throw fail(403); });
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(renderer.root.findAllByType("footer")).toHaveLength(0);
  await act(async () => vi.advanceTimersByTime(81)); await settle();
  assertConsulta(); expect(stored.size).toBe(0);
});
