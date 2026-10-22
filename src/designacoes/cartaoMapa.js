import { posicionarRotulos, desenharRotulos } from "./cartaoMapaRotulos.js";
import { getCoordenadasEndereco } from "./territorioPublicoUtils.js";

export function pontosCartao(dados) {
  return dados.enderecos.map(e => {
    const coords = getCoordenadasEndereco(e);
    if (!coords || coords.every(n => n === 0)) throw new Error(`Complete a localização de ${e.codigo}.`);
    return { codigo: e.codigo, lat: coords[0], lng: coords[1] };
  });
}
// Explicit provider boundary. No fallback to community tiles or an empty map.
// Provider receives only coordinates/codes and dimensions, never notes, phone or PIN.
export async function carregarMapaCartao(dados, provider) {
  const pontos = pontosCartao(dados);
  if (!provider) throw new Error("Fonte cartográfica para impressão ainda não configurada. A integração real aguarda uma fonte com permissão de exportação.");
  const controller = new AbortController();
  let timer;
  try {
    const result = await Promise.race([
      provider({ pontos, width: 1100, height: 642, signal: controller.signal }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Tempo esgotado ao carregar o mapa.")); },15000); }),
    ]);
    if (!result?.dataUrl?.startsWith("data:image/png;base64,") || !result.creditos || result.width < 900 || result.height < 400)
      throw new Error("Mapa incompleto ou inválido. PDF não gerado.");
    return result;
  } finally { clearTimeout(timer); }
}

// Synthetic schematic, exclusively for local development and PDF QA. Not cartography.
export async function mapaFixture({ pontos, width, height }) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#eff3ef"; ctx.fillRect(0,0,width,height);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 18;
  for (let x=60;x<width;x+=140) { ctx.beginPath(); ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke(); }
  for (let y=50;y<height;y+=120) { ctx.beginPath(); ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke(); }
  const lats=pontos.map(p=>p.lat), lngs=pontos.map(p=>p.lng);
  const minLat=Math.min(...lats), minLng=Math.min(...lngs);
  const dy=Math.max(...lats)-minLat || 0.002, dx=Math.max(...lngs)-minLng || 0.002;
  ctx.font="bold 30px Arial";
  const anchors=pontos.map(p=>({...p,x:65+(p.lng-minLng)/dx*(width-130),y:height-65-(p.lat-minLat)/dy*(height-130)}));
  const placements=posicionarRotulos(anchors,width,height,c=>ctx.measureText(c).width,{top:52});
  desenharRotulos(ctx,placements);
  ctx.fillStyle="#78350f";ctx.font="bold 24px Arial";ctx.textAlign="center";ctx.fillText("FIXTURE - SEM VALOR CARTOGRÁFICO",width/2,30);
  return { dataUrl:canvas.toDataURL("image/png"), width,height, creditos:"Esquema sintético local - sem fonte cartográfica" };
}
