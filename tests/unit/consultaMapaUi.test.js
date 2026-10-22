import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MapaTerritorioPublico from "../../src/designacoes/MapaTerritorioPublico.jsx";
import { criarIdiomaPublico } from "../../src/designacoes/idiomaPublico.js";
const markerState = vi.hoisted(() => ({ attributes: {}, instance: null }));
vi.mock("leaflet", () => ({ default: { divIcon: v => v, latLngBounds: v => v } }));
vi.mock("react-leaflet", () => {
  const map = { getSize: () => ({ x: 400, y: 300 }), invalidateSize() {}, fitBounds() {}, getContainer() {}, on() {}, off() {}, closePopup() {} };
  const host = name => props => React.createElement(name, props, props.children);
  const Marker = props => {
    const instance = React.useRef(null);
    if (!instance.current) instance.current = { options: { title: props.title }, getElement: () => ({ setAttribute: (name, value) => { markerState.attributes[name] = value; } }) };
    markerState.instance = instance.current;
    React.useImperativeHandle(props.ref, () => instance.current, []);
    return React.createElement("marker", props, props.children);
  };
  return { MapContainer: host("map"), TileLayer: host("tiles"), Marker, Popup: host("popup"), ZoomControl: host("zoom"), useMap: () => map };
});
let renderer;
beforeEach(() => {
  markerState.attributes = {}; markerState.instance = null;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(console, "error").mockImplementation(message => { if (!String(message).includes("react-test-renderer is deprecated")) throw new Error(String(message)); });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(["pt", "en", "es"])("popup/marker consulta %s não contém marcação ou semântica de progresso", async lingua => {
  const onMarcar = vi.fn(); const idioma = criarIdiomaPublico(lingua);
  await act(async () => { renderer = create(React.createElement(MapaTerritorioPublico, { enderecos: [{ id: "e1", codigo: "E-1", endereco: "Rua", observacao: "<b>literal</b>", lat: -26, lng: -49 }], podeMarcar: false, onMarcar, idioma })); });
  expect(renderer.root.findByType("marker").props.title).toBe("E-1: Rua");
  expect(renderer.root.findAllByType("button")).toHaveLength(1); // only close popup
  expect(renderer.root.findAllByType("a").some(a => a.props.href?.includes("destination"))).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain("<b>literal</b>");
  expect(JSON.stringify(renderer.toJSON())).not.toContain(idioma.t("pending"));
  expect(onMarcar).not.toHaveBeenCalled();
});
it("capacidade explícita preserva marcação real no popup", async () => {
  const onMarcar = vi.fn();
  await act(async () => { renderer = create(React.createElement(MapaTerritorioPublico, { enderecos: [{ id: "e1", codigo: "E-1", endereco: "Rua", lat: -26, lng: -49 }], podeMarcar: true, feitos: ["e1"], onMarcar, idioma: criarIdiomaPublico("pt") })); });
  expect(renderer.root.findByType("marker").props.title).toContain("Feito");
  const button = renderer.root.findAllByType("button").find(b => b.props["aria-label"]?.includes("E-1"));
  await act(async () => button.props.onClick());
  expect(onMarcar).toHaveBeenCalledWith("e1", false);
});

it("sincroniza title do elemento Leaflet ao marcar, traduzir e voltar à consulta sem remontar", async () => {
  const enderecos = [{ id: "e1", codigo: "E-1", endereco: "Rua", lat: -26, lng: -49 }];
  const render = (feitos, podeMarcar, lingua = "pt") => React.createElement(MapaTerritorioPublico, { enderecos, podeMarcar, feitos, idioma: criarIdiomaPublico(lingua) });
  await act(async () => { renderer = create(render([], true)); });
  const instance = markerState.instance;
  expect(markerState.attributes.title).toBe("E-1: Rua — Pendente");
  await act(async () => renderer.update(render(["e1"], true)));
  expect(markerState.attributes.title).toBe("E-1: Rua — Feito");
  expect(instance.options.title).toBe("E-1: Rua — Feito");
  await act(async () => renderer.update(render(["e1"], true, "en")));
  expect(markerState.attributes.title).toBe("E-1: Rua — Done");
  await act(async () => renderer.update(render(undefined, false)));
  expect(markerState.attributes.title).toBe("E-1: Rua");
  expect(markerState.instance).toBe(instance);
});
