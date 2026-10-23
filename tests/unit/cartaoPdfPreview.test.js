import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import CartaoPdfPreview from "../../src/designacoes/CartaoPdfPreview.jsx";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function mount(bytes) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  const host = { appendChild: vi.fn(), replaceChildren: vi.fn() };
  vi.stubGlobal("document", { createElement: () => ({ style: {}, setAttribute: vi.fn(), getContext: () => ({}) }) });
  await act(async () => { renderer = create(React.createElement(CartaoPdfPreview, { bytes }), { createNodeMock: () => host }); });
  return host;
}
it("renderiza as páginas dos bytes reais sem plugin de PDF e libera os recursos ao fechar", async () => {
  const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
  const getPage = vi.fn(async () => ({ getViewport: () => ({ width: 790, height: 1233 }), render }));
  const destroy = vi.fn();
  getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage }), destroy });
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const host = await mount(bytes);
  expect(getDocument.mock.calls.at(-1)[0].data).toEqual(new Uint8Array(bytes));
  expect(getDocument.mock.calls.at(-1)[0].data.buffer).not.toBe(bytes);
  expect(host.appendChild).toHaveBeenCalledTimes(2);
  expect(render).toHaveBeenCalledTimes(2);
  expect(renderer.root.findAllByType("object")).toHaveLength(0);
  await act(async () => renderer.unmount()); renderer = null;
  expect(destroy).toHaveBeenCalledOnce();
  expect(host.replaceChildren).toHaveBeenCalledOnce();
});
it("orienta a abrir o arquivo se a renderização da prévia falhar", async () => {
  getDocument.mockReturnValue({ promise: Promise.reject(new Error("PDF error")), destroy: vi.fn() });
  await mount(new ArrayBuffer(1));
  expect(JSON.stringify(renderer.toJSON())).toContain("Use Baixar / compartilhar PDF");
});
