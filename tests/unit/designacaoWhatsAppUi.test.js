import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesignacaoWhatsApp } from "../../src/designacoes/DesignacaoWhatsApp.jsx";
import { adminDesignacoesRequest } from "../../src/designacoesAdminApi";

vi.mock("../../src/designacoesApi", () => ({ designacoesHabilitadas: true }));
vi.mock("../../src/designacoesAdminApi", () => ({ adminDesignacoesRequest: vi.fn() }));

let renderer;
const grupo = { id: "g1", status: "ativo" };
const contato = { id: "c1", nome: "Ana", telefoneE164: "+5547999991234", ativo: true };
const select = value => act(async () => renderer.root.findByType("select").props.onChange({ target: { value } }));
const action = () => renderer.root.findAllByType("button").find(b => b.children.includes("Designar e abrir WhatsApp"));
async function mount() {
  await act(async () => { renderer = create(React.createElement(DesignacaoWhatsApp, { grupo, compact: true })); });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  adminDesignacoesRequest.mockReset();
  vi.stubGlobal("window", { open: vi.fn() });
  vi.spyOn(console, "error").mockImplementation(message => {
    if (!String(message).includes("react-test-renderer is deprecated")) throw new Error(String(message));
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("lista publicadores ativos e mostra o cadastro somente quando solicitado", async () => {
  adminDesignacoesRequest.mockResolvedValue([contato, { ...contato, id: "inativo", ativo: false }]);
  await mount();
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  expect(renderer.root.findAllByType("option").map(o => o.props.value)).toEqual(["", "c1", "__novo__"]);
  expect(action()).toBeUndefined();
  await select("__novo__");
  expect(renderer.root.findAllByType("input")).toHaveLength(2);
  expect(action().props.disabled).toBe(true);
  await select("c1");
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  expect(action().props.disabled).toBe(false);
});

it("lista vazia mantém a escolha explícita de cadastrar novo", async () => {
  adminDesignacoesRequest.mockResolvedValue([]);
  await mount();
  expect(renderer.root.findByType("select").props.value).toBe("");
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  await select("__novo__");
  expect(renderer.root.findAllByType("input")).toHaveLength(2);
});

it("exibe falha de listagem e permite recuperar os contatos", async () => {
  adminDesignacoesRequest.mockRejectedValueOnce(new Error("Falha na conexão")).mockResolvedValueOnce([contato]);
  await mount();
  expect(renderer.root.findByProps({ role: "alert" }).children).toContain("Falha na conexão");
  expect(renderer.root.findByType("select").props.disabled).toBe(true);
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  await act(async () => renderer.root.findByType("button").props.onClick());
  expect(renderer.root.findByType("select").props.disabled).toBe(false);
  expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
});

it("designa contato existente pelo id antes de abrir o WhatsApp", async () => {
  adminDesignacoesRequest.mockResolvedValueOnce([contato]).mockResolvedValueOnce({ partes: ["Mensagem"], telefoneE164: contato.telefoneE164 });
  await mount();
  await select("c1");
  expect(window.open).not.toHaveBeenCalled();
  await act(async () => action().props.onClick());
  expect(adminDesignacoesRequest).toHaveBeenLastCalledWith("/admin/designacoes", expect.objectContaining({ grupoId: "g1", contatoId: "c1", contato: undefined }));
  expect(window.open).toHaveBeenCalledOnce();
});

it("novo cadastro envia nome e telefone normalizado junto da designação", async () => {
  adminDesignacoesRequest.mockResolvedValueOnce([]).mockResolvedValueOnce({ partes: [] });
  await mount();
  await select("__novo__");
  await act(async () => {
    renderer.root.findByProps({ "aria-label": "Nome do publicador" }).props.onChange({ target: { value: " Ana " } });
    renderer.root.findByProps({ type: "tel" }).props.onChange({ target: { value: "+55 (47) 99999-1234" } });
  });
  expect(action().props.disabled).toBe(false);
  await act(async () => action().props.onClick());
  expect(adminDesignacoesRequest).toHaveBeenLastCalledWith("/admin/designacoes", expect.objectContaining({ contatoId: undefined, contato: { nome: "Ana", telefone: contato.telefoneE164 } }));
});
