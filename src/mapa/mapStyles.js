import { MAP_COLORS } from '../mapLegend';

export const cssTooltip = `
  @keyframes gps-pulse {
    0% { transform: scale(0.72); opacity: 0.75; }
    70% { transform: scale(1.15); opacity: 0; }
    100% { transform: scale(1.2); opacity: 0; }
  }

  .label-territorio { background: transparent; border: none; box-shadow: none; font-family: 'Bahnschrift', sans-serif-condensed, sans-serif; text-align: center; line-height: 1.1; pointer-events: none; }
  .label-nome { font-weight: 700; font-size: 14px; color: #334155; text-shadow: 2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff, 1px 1px #fff, -1px -1px #fff; display: block; font-stretch: condensed; letter-spacing: -0.5px; margin-bottom: 2px; white-space: normal; max-width: 140px; margin-left: auto; margin-right: auto; }
  .label-status { font-size: 11px; font-weight: 700; color: #444; text-shadow: 1px 1px 0px rgba(255,255,255,0.9); background-color: rgba(255,255,255,0.7); padding: 1px 6px; border-radius: 8px; display: inline-block; }
  .label-tempo { display: block; font-size: 10px; font-weight: 800; color: #475569; margin-top: 2px; text-shadow: 1px 1px 0px rgba(255,255,255,0.8); text-transform: uppercase; }
  .label-tempo-compacto { display: inline-block; font-size: 9px; font-weight: 800; color: #475569; margin-top: 1px; padding: 1px 5px; border-radius: 999px; background: rgba(255,255,255,0.72); border: none; text-shadow: 1px 1px 0px rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.2px; }
  .sem-fundo { background: transparent; border: none; box-shadow: none; }
  .map-poi-marker { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #64748b; box-shadow: 0 1px 4px #0f172a26; font-size: 18px; line-height: 1; cursor: help; }
  .map-address-marker, .map-group-marker, .map-click-marker, .map-cluster-marker { position: relative; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: ${MAP_COLORS.endereco.ativo}; color: #fff; border: 1.5px solid #fff; box-shadow: 0 1px 4px #0f172a33; font-weight: 800; line-height: 1; white-space: nowrap; }
  .map-address-marker { width: 34px; max-width: 34px; height: 30px; font-size: 11px; padding: 0 3px; }
  .map-address-marker.archived, .map-group-marker.archived { background: ${MAP_COLORS.endereco.arquivado}; border-style: dashed; }
  .map-address-marker.archived { opacity: 0.8; }
  .map-address-marker.focus-pending { background: ${MAP_COLORS.endereco.pendente}; }
  .map-address-marker.focus-done { background: ${MAP_COLORS.endereco.visitado}; }
  .map-address-marker.archived { background: ${MAP_COLORS.endereco.arquivado}; }
  .map-address-marker.selected, .map-address-marker.import-highlight { outline: 2px solid #1e293b; outline-offset: 2px; }
  .map-address-badge, .map-group-address-badge { position: absolute; top: -6px; right: -6px; display: flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 999px; background: #fff; color: #334155; border: 1px solid #cbd5e1; font-size: 8px; line-height: 1; font-weight: 800; box-sizing: border-box; white-space: nowrap; pointer-events: none; z-index: 2; }
  .map-address-marker.focus-done::after, .map-cluster-badge { content: "✓"; position: absolute; top: -6px; right: -6px; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 999px; background: #fff; color: #15803d; border: 1px solid #cbd5e1; font-size: 10px; line-height: 1; font-weight: 800; }
  .map-group-marker-stack { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .map-group-marker { min-width: 44px; height: 30px; font-size: 12px; padding: 0 7px; gap: 4px; }
  .map-group-marker.assigned { background: ${MAP_COLORS.grupoEndereco.designado.marker}; }
  .map-group-marker.finished { background: ${MAP_COLORS.grupoEndereco.finalizado.marker}; }
  .map-group-marker.waiting { background: ${MAP_COLORS.grupoEndereco.aguardandoFinalizacao.marker}; }
  .map-group-state-symbol { font-size: 12px; }
  .map-group-owner { position: absolute; bottom: -3px; left: 2px; width: 9px; height: 9px; background: #fff; color: #1e293b; border-radius: 50%; font-size: 11px; line-height: 8px; text-align: center; }
  .map-group-marker-time { padding: 1px 4px; border-radius: 4px; background: #fffffff0; color: #475569; font-size: 9px; line-height: 1.2; font-weight: 700; white-space: nowrap; }
  .map-click-marker { width: 28px; height: 28px; background: ${MAP_COLORS.apoio.clique}; font-size: 16px; }
  .map-click-marker.search { background: ${MAP_COLORS.apoio.clique}; }
  .map-cluster-marker { width: 38px; height: 38px; cursor: pointer; }
  .map-cluster-marker:hover { outline: 2px solid #1e293b; outline-offset: 2px; }
  .map-cluster-marker.large { width: 44px; height: 44px; }
  .map-cluster-count { font-size: 12px; }
  .map-cluster-marker.large .map-cluster-count { font-size: 14px; }
  .map-cluster-marker.all-visited { background: ${MAP_COLORS.endereco.visitado}; }
  .map-cluster-sub { position: absolute; bottom: -6px; background: #fff; color: #334155; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 999px; border: 1px solid #cbd5e1; line-height: 1; }
  .leaflet-popup.cluster-enderecos-popup .leaflet-popup-content-wrapper { padding: 8px 10px; border-radius: 14px; box-shadow: 0 3px 12px #0f172a26; }
  .leaflet-popup.cluster-enderecos-popup .leaflet-popup-content { margin: 0; width: auto !important; }
  .leaflet-popup.bairro-sbs-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 12px rgba(15,23,42,0.15); }
  .leaflet-popup.bairro-sbs-popup .leaflet-popup-content { margin: 0; width: auto !important; }
  .leaflet-popup.bairro-sbs-popup .leaflet-popup-close-button { top: 7px; right: 7px; width: 22px; height: 22px; border-radius: 999px; color: #64748b; font-size: 16px; line-height: 21px; transition: background-color 0.2s, color 0.2s; }
  .leaflet-popup.bairro-sbs-popup .leaflet-popup-close-button:hover { background: rgba(15,23,42,0.08); color: #0f172a; }
  .leaflet-popup.bairro-sbs-popup .leaflet-popup-tip { box-shadow: 0 8px 18px rgba(15,23,42,0.16); }
  .leaflet-popup.territorio-popup .leaflet-popup-content-wrapper { padding: 6px 8px; border-radius: 14px; box-shadow: 0 3px 12px rgba(15,23,42,0.15); }
  .leaflet-popup.territorio-popup .leaflet-popup-content { margin: 0; width: auto !important; }
  .leaflet-popup.address-popup .leaflet-popup-content-wrapper { padding: 6px 8px; border-radius: 14px; }
  .leaflet-popup.address-popup .leaflet-popup-content { margin: 0; width: auto !important; }
  .map-compact-popup { position: relative; width: min(280px, calc(100vw - 56px)); }
  .map-compact-popup p { margin: 0; }
  .map-popup-options { position: absolute; top: 44px; right: 4px; left: 4px; z-index: 10; }
  .map-popup-options:not(.open) { display: none; }
  .map-popup-options .address-admin-actions-inner { overflow: visible; }
  .leaflet-popup-pane { z-index: 1002 !important; }
  @media (max-width: 639px) {
    .leaflet-container.has-popup .map-popup-aware-control {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
  }
  .address-admin-actions { display: grid; grid-template-rows: 0fr; opacity: 0; transform: translateY(-4px); transition: grid-template-rows 180ms ease, opacity 160ms ease, transform 180ms ease; }
  .address-admin-actions.open { grid-template-rows: 1fr; opacity: 1; transform: translateY(0); }
  .address-admin-actions-inner { min-height: 0; overflow: hidden; }
  .control-hint { position: absolute; z-index: 20; top: 50%; transform: translateY(-50%); white-space: nowrap; border-radius: 999px; background: rgba(15,23,42,0.72); color: white; font-size: 11px; font-weight: 700; line-height: 1; padding: 7px 10px; box-shadow: 0 6px 16px rgba(15,23,42,0.18); pointer-events: none; animation: control-hint-fade 4s ease-in-out forwards; }
  .control-hint.left-side { left: 58px; }
  .control-hint.right-side { right: 58px; }
  @keyframes control-hint-fade {
    0% { opacity: 0; transform: translateY(-50%) translateY(4px); }
    15% { opacity: 1; transform: translateY(-50%) translateY(0); }
    78% { opacity: 1; transform: translateY(-50%) translateY(0); }
    100% { opacity: 0; transform: translateY(-50%) translateY(-4px); }
  }

  .map-layer-btn { width: 44px; height: 44px; border-radius: 1rem; border: 1px solid white; box-shadow: 0 1px 4px #0f172a33; cursor: pointer; transition: transform 0.1s, border-color 0.2s; overflow: hidden; position: relative; background-size: cover; }
  @media (min-width: 640px) {
    .map-layer-btn { width: 48px; height: 48px; }
  }
  .map-layer-btn:active { transform: scale(0.95); }
  .map-layer-btn.active { border-color: ${MAP_COLORS.apoio.clique}; transform: scale(1.05); z-index: 10; }

  .thumb-rua { background: #e5e7eb; }
  .thumb-rua::after { content: '🗺️'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; }

  .thumb-google { background: #fce7b2; }
  .thumb-google::after { content: '📍'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; }

  .thumb-satelite {
    background-color: #172554;
    background-image:
      radial-gradient(circle at 15% 25%, white 1px, transparent 1.5px),
      radial-gradient(circle at 75% 15%, rgba(255,255,255,0.8) 1px, transparent 1.5px),
      radial-gradient(circle at 60% 85%, rgba(255,255,255,0.9) 1px, transparent 1.5px),
      radial-gradient(circle at 25% 80%, rgba(255,255,255,0.6) 1px, transparent 1.5px),
      radial-gradient(circle at 85% 65%, rgba(255,255,255,0.7) 1px, transparent 1.5px);
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .thumb-satelite::after {
    content: '🛰️';
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 22px;
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.5));
  }
  @media (min-width: 640px) {
    .thumb-satelite::after {
      font-size: 24px;
    }
  }

  .leaflet-tooltip.sem-fundo {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .popup-btn-action { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 12px; transition: background-color 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.1); cursor: pointer; }
  .popup-btn-action:disabled { opacity: 0.7; cursor: not-allowed; }
`;
