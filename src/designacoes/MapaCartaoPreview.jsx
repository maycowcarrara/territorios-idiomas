import React,{useEffect,useRef} from "react";
import L from "leaflet";
import { pontosCartao } from "./cartaoMapa";
import { capturarMapaVisivel,OSM_TILE_URL } from "./cartaoMapaCaptura";

export default function MapaCartaoPreview({dados,capturaRef,onEstado}) {
  const root=useRef(null);
  useEffect(()=>{
    const pontos=pontosCartao(dados);
    let failed=false;
    const map=L.map(root.current,{zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,scrollWheelZoom:false});
    const layer=L.tileLayer(OSM_TILE_URL,{maxZoom:19,minZoom:1,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,crossOrigin:"anonymous",referrerPolicy:"origin",attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'});
    const ready=()=>onEstado({pronto:!failed&&!layer.isLoading(),erro:failed?"Falha ao carregar o mapa. Feche a prévia e tente novamente quando a fonte estiver disponível.":""});
    layer.on("loading",()=>onEstado({pronto:false,erro:""}));
    layer.on("tileerror",()=>{failed=true;ready();});
    layer.on("load",ready);
    map.fitBounds(L.latLngBounds(pontos.map(p=>[p.lat,p.lng])),{padding:[30,30],maxZoom:16,animate:false});
    // The layer starts requesting tiles only after this visible preview is mounted.
    layer.addTo(map);
    for(const p of pontos) {
      L.circleMarker([p.lat,p.lng],{radius:4,color:"#164e82",fillOpacity:1}).addTo(map);
      const label=document.createElement("span");label.textContent=p.codigo;
      label.style.cssText="background:white;border:1px solid #164e82;color:#164e82;padding:1px 3px;font:12px Arial;white-space:nowrap";
      L.marker([p.lat,p.lng],{interactive:false,icon:L.divIcon({html:label,className:"",iconSize:[48,20],iconAnchor:[24,25]})}).addTo(map);
    }
    const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(root.current);
    const timer=setTimeout(()=>{if(layer.isLoading()) {failed=true;ready();}},15000);
    capturaRef.current=()=>{if(failed) throw new Error("Mapa incompleto. PDF não gerado.");return capturarMapaVisivel({container:root.current,map,layer,pontos});};
    return ()=>{clearTimeout(timer);observer.disconnect();capturaRef.current=null;map.remove();};
  },[dados,capturaRef,onEstado]);
  return <div ref={root} role="img" aria-label="Prévia cartográfica do cartão com os códigos dos endereços" style={{width:"100%",maxWidth:420,aspectRatio:"87 / 50.75",margin:"12px auto",border:"1px solid #cbd5e1"}} />;
}
