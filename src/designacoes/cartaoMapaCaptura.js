import { posicionarRotulos,desenharRotulos } from "./cartaoMapaRotulos.js";
export const OSM_CREDITOS = "© OpenStreetMap contributors - ODbL - openstreetmap.org/copyright";
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function tilesCobremArea(rects,width,height) {
  if(!rects.length || width<=0 || height<=0) return false;
  // Leaflet transforms may round neighboring tile edges independently. Allow
  // less than one CSS pixel in either axis; a missing tile still fails closed.
  const epsilon=0.9;
  rects=rects.map(r=>({x:r.x-epsilon/2,y:r.y-epsilon/2,w:r.w+epsilon,h:r.h+epsilon}));
  const xs=[...new Set([0,width,...rects.flatMap(r=>[Math.max(0,r.x),Math.min(width,r.x+r.w)])])].filter(x=>x>=0&&x<=width).sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++) {
    const x=(xs[i-1]+xs[i])/2;
    const spans=rects.filter(r=>r.x<=x && r.x+r.w>=x).map(r=>[Math.max(0,r.y),Math.min(height,r.y+r.h)]).sort((a,b)=>a[0]-b[0]);
    let end=0;
    for(const [start,stop] of spans) { if(start>end) return false;end=Math.max(end,stop); }
    if(end<height) return false;
  }
  return true;
}

// Read-only capture of already decoded visible tiles. No fetch, tile URL expansion,
// hidden viewport, pan/zoom, screenshot of the app, or requests at print resolution.
export async function capturarMapaVisivel({container,map,layer,pontos}) {
  const outer=container.getBoundingClientRect();
  const area={left:outer.left+(container.clientLeft||0),top:outer.top+(container.clientTop||0),width:container.clientWidth,height:container.clientHeight};
  area.right=area.left+area.width;area.bottom=area.top+area.height;
  if(document.visibilityState!=="visible" || area.width<200 || area.height<100 || area.top<0 || area.left<0 || area.bottom>window.innerHeight || area.right>window.innerWidth)
    throw new Error("Deixe o mapa inteiro visível na prévia antes de capturar.");
  for(let parent=container.parentElement;parent;parent=parent.parentElement) {
    const style=window.getComputedStyle(parent),r=parent.getBoundingClientRect();
    if ((/(?:auto|scroll|hidden|clip)/.test(style.overflowY) && (area.top<r.top || area.bottom>r.bottom)) ||
        (/(?:auto|scroll|hidden|clip)/.test(style.overflowX) && (area.left<r.left || area.right>r.right)))
      throw new Error("Deixe o mapa inteiro visível na prévia antes de capturar.");
  }
  if(layer.isLoading()) throw new Error("Aguarde o carregamento completo do mapa.");
  const tiles=[...layer.getContainer().querySelectorAll("img.leaflet-tile")].map(img=>{
    const r=img.getBoundingClientRect();
    return {img,x:r.left-area.left,y:r.top-area.top,w:r.width,h:r.height};
  }).filter(r=>r.x<area.width && r.x+r.w>0 && r.y<area.height && r.y+r.h>0);
  if(tiles.some(r=>!r.img.complete || !r.img.naturalWidth || r.img.crossOrigin!=="anonymous") || !tilesCobremArea(tiles,area.width,area.height))
    throw new Error("O mapa não carregou por inteiro. PDF não gerado.");
  const width=1100,height=Math.round(width*area.height/area.width),scale=width/area.width;
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
  for(const tile of tiles) ctx.drawImage(tile.img,tile.x*scale,tile.y*scale,tile.w*scale,tile.h*scale);
  const anchors=pontos.map(p=>{
    const at=map.latLngToContainerPoint([p.lat,p.lng]);
    if(at.x<6||at.y<6||at.x>area.width-6||at.y>area.height-6) throw new Error("Há pontos fora do mapa. Enquadre todos os endereços antes de capturar.");
    return {codigo:p.codigo,x:at.x*scale,y:at.y*scale};
  });
  ctx.font="bold 30px Arial";
  desenharRotulos(ctx,posicionarRotulos(anchors,width,height,c=>ctx.measureText(c).width));
  try {
    return {dataUrl:canvas.toDataURL("image/png"),width,height,creditos:OSM_CREDITOS,fonte:"osm-viewport",resolucaoOriginal:{width:area.width,height:area.height}};
  } catch {throw new Error("A fonte do mapa bloqueou a captura por CORS. PDF não gerado.");}
}
