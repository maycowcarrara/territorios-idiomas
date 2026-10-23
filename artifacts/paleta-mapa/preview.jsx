import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, Marker, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../src/index.css';
import '../../src/designacoes/territorioPublico.css';
import { cssTooltip } from '../../src/mapa/mapStyles';
import { getGrupoMapaAppearance } from '../../src/mapLegend';
import { BairroSbsLayer } from '../../src/mapa/layers/BairroSbsLayer';
import { LegendaModal } from '../../src/app/components/LegendaModal';
const states = [
  { code: 'T01', lat: -26.249, lng: -49.385 },
  { code: 'T02', lat: -26.249, lng: -49.379, designado: true },
  { code: 'T03', lat: -26.253, lng: -49.385, designado: true, completo: true },
  { code: 'T04', lat: -26.253, lng: -49.379, finalizado: true },
  { code: 'T05', lat: -26.257, lng: -49.382, arquivado: true },
];
const bairros = { features: [{ type: 'Feature', properties: { bairroId: 'fixture', bairroNome: 'Bairro fictício' }, geometry: { type: 'Polygon', coordinates: [[[-49.389, -26.246], [-49.375, -26.246], [-49.375, -26.260], [-49.389, -26.260], [-49.389, -26.246]]] } }] };
export default function Preview() {
  const [selected, setSelected] = useState(false);
  const [legend, setLegend] = useState(false);
  return <main style={{ maxWidth: 960, margin: '24px auto', padding: 16, fontFamily: 'Arial, sans-serif', color: '#334155' }}>
    <style>{cssTooltip}{`.fixture-map { background: repeating-linear-gradient(0deg, transparent 0 54px, #fff 55px 63px), repeating-linear-gradient(90deg, #edf0ed 0 74px, #fff 75px 84px); } .preview-card { display:flex; gap:12px; align-items:center; margin:10px 0; }`}</style>
    <h1 style={{ fontSize: 24, fontWeight: 700 }}>Mapa com menos cores</h1>
    <p style={{ margin: '8px 0 16px' }}>Prévia local com dados fictícios e sem banco. Contorno do bairro neutro; cor reservada à situação.</p>
    <MapContainer className="fixture-map" center={[-26.252, -49.382]} zoom={15} style={{ height: 460, borderRadius: 12 }} zoomControl={false} attributionControl={false}>
      <BairroSbsLayer bairrosGeoJson={bairros} resumoPorBairro={new Map()} />
      {states.map(item => {
        const a = getGrupoMapaAppearance(item);
        const html = `<div class="map-group-marker-stack"><div class="map-group-marker ${a.className}">${item.code}${a.symbol ? `<span class="map-group-state-symbol">${a.symbol}</span>` : ''}<span class="map-group-address-badge">6</span></div><div class="map-group-marker-time">${a.label}</div></div>`;
        return <React.Fragment key={item.code}>
          <Polygon positions={[[item.lat-.001,item.lng-.0018],[item.lat-.001,item.lng+.0018],[item.lat+.001,item.lng+.0018],[item.lat+.001,item.lng-.0018]]} pathOptions={{ color: a.colors.border, fillColor: a.colors.fill, weight: 1, opacity: .75, fillOpacity: .08, dashArray: item.arquivado ? '4 5' : undefined }} />
          <Marker position={[item.lat, item.lng]} title={`${item.code}: ${a.label}`} icon={L.divIcon({className:'',html,iconSize:[54,44],iconAnchor:[27,15]})}><Popup>{item.code} — {a.symbol} {a.label}</Popup></Marker>
        </React.Fragment>;
      })}
    </MapContainer>
    <div style={{ display:'flex', flexWrap:'wrap', gap:28, marginTop:20 }}>
      <section style={{ flex:1, minWidth:230 }}><h2 style={{fontWeight:700}}>Endereços</h2>
        <div className="preview-card"><div className="map-address-marker">E01</div> Pendente</div>
        <div className="preview-card"><div className={`map-address-marker focus-done ${selected ? 'selected' : ''}`}>E02</div> Visitado {selected ? 'e selecionado' : ''}</div>
        <div className="preview-card"><div className="map-address-marker archived">E03</div> ▤ Arquivado</div>
        <button style={{background:'#2563eb',color:'#fff',padding:'10px 14px',borderRadius:8}} onClick={() => setSelected(!selected)}>{selected ? 'Desmarcar seleção' : 'Selecionar visitado'}</button>
      </section>
      <section style={{ flex:1, minWidth:230 }}><h2 style={{fontWeight:700}}>Mapa por link / QR</h2>
        <div className="preview-card"><div style={{width:60}}><span className="tp-map-pin">E01</span></div> Pendente</div>
        <div className="preview-card"><div className="tp-map-marker-done" style={{width:60}}><span className="tp-map-pin">E02 ✓</span></div> Feito</div>
        <button style={{color:'#2563eb',padding:'10px 0'}} onClick={() => setLegend(true)}>Abrir legenda</button>
      </section>
    </div>
    <LegendaModal isOpen={legend} onClose={() => setLegend(false)} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
