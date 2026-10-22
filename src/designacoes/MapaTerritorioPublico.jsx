import IconeNavegacao from "./IconeNavegacao";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import {
  getCoordenadasEndereco,
  getNavegacaoEndereco,
} from "./territorioPublicoUtils";

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

function EnquadrarEnderecos({ pontos }) {
  const map = useMap();
  useEffect(() => {
    const ajustar = () => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(pontos.map((ponto) => ponto.posicao)), {
        padding: [42, 42],
        maxZoom: 16,
        animate: false,
      });
    };
    ajustar();
    // Only frame when the map opens or its container changes, never after saving a mark.
    const observer = new ResizeObserver(ajustar);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, pontos]);
  return null;
}

function PontoEndereco({
  endereco,
  posicao,
  feito,
  podeMarcar,
  salvando,
  onMarcar,
  limitesPopup,
  marcando,
  idioma,
}) {
  const map = useMap();
  const { t } = idioma;
  const markerRef = useRef(null);
  const tituloMarcador = `${endereco.codigo}: ${endereco.endereco}${podeMarcar ? ` — ${t(feito ? "done" : "pending")}` : ""}`;
  const icon = useMemo(
    () =>
      L.divIcon({
        className: `tp-map-marker${feito ? " tp-map-marker-done" : ""}`,
        html: `<span class="tp-map-pin"><span>${escapeHtml(endereco.codigo)}</span>${feito ? '<span aria-hidden="true">✓</span>' : ""}</span>`,
        iconSize: [60, 30],
        iconAnchor: [30, 35],
        popupAnchor: [0, -38],
      }),
    [endereco.codigo, feito],
  );
  useEffect(() => {
    // React-Leaflet updates the icon but does not update Marker title options.
    // Keep the existing marker/popup and synchronize its actual accessible tooltip.
    const marker = markerRef.current;
    if (!marker) return;
    marker.options.title = tituloMarcador;
    marker.getElement()?.setAttribute("title", tituloMarcador);
  }, [icon, tituloMarcador]);
  return (
    <Marker
      ref={markerRef}
      position={posicao}
      icon={icon}
      title={tituloMarcador}
      alt={`${endereco.codigo}: ${endereco.endereco}`}
    >
      <Popup
        className="tp-map-popup"
        closeButton={false}
        minWidth={Math.min(180, limitesPopup.largura)}
        maxWidth={limitesPopup.largura}
        maxHeight={limitesPopup.altura}
        autoPanPadding={[10, 10]}
        keepInView={true}
      >
        <button
          type="button"
          className="tp-popup-close"
          aria-label={t("closePopup")}
          onClick={() => map.closePopup()}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="tp-map-popup-content">
          <div className="tp-map-popup-header">
            <strong>{endereco.codigo}</strong>
            {podeMarcar && <span className={`tp-state ${feito ? "tp-state-done" : ""}`}>
              {t(feito ? "done" : "pending")}
            </span>}
          </div>
          <p>{endereco.endereco}</p>
          {endereco.observacao && <p className="tp-popup-observation">{endereco.observacao}</p>}
          <div className="tp-map-popup-actions">
            <a
              className="tp-button tp-button-secondary"
              href={getNavegacaoEndereco(endereco)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconeNavegacao /> {t("navigate")}
            </a>
            {podeMarcar && <button
              type="button"
              className={`tp-button ${feito ? "tp-button-secondary" : "tp-button-primary"}`}
              disabled={salvando}
              aria-busy={marcando}
              aria-label={`${t(feito ? "unmark" : "markDone")}: ${endereco.codigo}`}
              onClick={() => podeMarcar && onMarcar?.(endereco.id, !feito)}
            >
              {marcando && <span className="tp-spinner" aria-hidden="true" />}
              {t(marcando ? "saving" : feito ? "unmark" : "done")}
            </button>}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function PontosMapa({ pontos, podeMarcar, feitos, salvando, operacao, onMarcar, idioma }) {
  const map = useMap();
  const [tamanho, setTamanho] = useState(() => map.getSize());
  useEffect(() => {
    const atualizar = () => setTamanho(map.getSize());
    atualizar();
    map.on("resize", atualizar);
    return () => {
      map.off("resize", atualizar);
    };
  }, [map]);
  const limitesPopup = {
    largura: Math.max(160, Math.min(260, tamanho.x - 64)),
    altura: Math.max(80, tamanho.y - 80),
  };
  return pontos.map(({ endereco, posicao }) => (
    <PontoEndereco
      key={endereco.id}
      endereco={endereco}
      idioma={idioma}
      posicao={posicao}
      podeMarcar={podeMarcar}
      feito={podeMarcar && feitos.includes(endereco.id)}
      salvando={salvando}
      onMarcar={onMarcar}
      limitesPopup={limitesPopup}
      marcando={salvando && operacao?.enderecoId === endereco.id}
    />
  ));
}

export default function MapaTerritorioPublico({
  enderecos,
  podeMarcar = false,
  feitos,
  salvando,
  operacao,
  onMarcar,
  idioma,
}) {
  const { t } = idioma;
  const [falhaMapa, setFalhaMapa] = useState(false);
  const pontos = useMemo(
    () =>
      enderecos
        .map((endereco) => ({
          endereco,
          posicao: getCoordenadasEndereco(endereco),
        }))
        .filter((ponto) => ponto.posicao),
    [enderecos],
  );
  // The server may return a new array after a save; keep the framing dependency stable.
  const chavePosicoes = JSON.stringify(pontos.map((ponto) => ponto.posicao));
  const posicoesEstaveis = useMemo(
    () => JSON.parse(chavePosicoes).map((posicao) => ({ posicao })),
    [chavePosicoes],
  );
  if (!pontos.length)
    return (
      <div className="tp-map-empty">
        <span aria-hidden="true">⌖</span>
        <p>{t("mapEmpty")}</p>
        <p>{t("mapEmptyHint")}</p>
      </div>
    );
  return (
    <>
      <MapContainer
        key="public-map-localized-controls"
        className="tp-map"
        center={pontos[0].posicao}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={true}
        aria-label={t("mapLabel")}
      >
        <ZoomControl
          key={idioma.lingua}
          position="topleft"
          zoomInTitle={t("zoomIn")}
          zoomOutTitle={t("zoomOut")}
        />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          // OSM requires a Referer. Send only the site origin, never the assignment fragment.
          referrerPolicy="origin"
          eventHandlers={{ tileerror: () => setFalhaMapa(true) }}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        />
        <EnquadrarEnderecos pontos={posicoesEstaveis} />
        <PontosMapa
          pontos={pontos}
          podeMarcar={podeMarcar}
          feitos={feitos}
          salvando={salvando}
          operacao={operacao}
          idioma={idioma}
          onMarcar={onMarcar}
        />
      </MapContainer>
      {falhaMapa && (
        <p className="tp-map-note" role="status">
          {t("mapError")}
        </p>
      )}
      {pontos.length !== enderecos.length && (
        <p className="tp-map-note">
          {t("missingPoints", { count: enderecos.length - pontos.length })}
        </p>
      )}
    </>
  );
}
