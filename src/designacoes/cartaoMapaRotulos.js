// Place code labels near exact anchors without overlap, including coincident coordinates.
export function posicionarRotulos(pontos, width, height, medir, { top = 24, fontSize = 30 } = {}) {
  const placements=[];
  const h=fontSize+12;
  const overlaps=(a,b)=>a.x<b.x+b.w+6 && a.x+a.w+6>b.x && a.y<b.y+b.h+6 && a.y+a.h+6>b.y;
  for (const p of pontos) {
    const w=Math.max(58,medir(p.codigo)+18);
    let box=null,distance=Infinity;
    for(let cy=top+h/2;cy<height-h/2-10;cy+=h+8) for(let cx=w/2+10;cx<width-w/2-10;cx+=w+10) {
      const candidate={x:cx-w/2,y:cy-h/2,w,h};
      const d=(cx-p.x)**2+(cy-p.y)**2;
      if(d<distance && !placements.some(q=>overlaps(candidate,q.box))) {box=candidate;distance=d;}
    }
    if(!box) throw new Error("Não há espaço legível para todos os códigos no mapa. Revise o enquadramento.");
    placements.push({...p,box});
  }
  return placements;
}
export function desenharRotulos(ctx, placements, fontSize = 30) {
  ctx.font=`bold ${fontSize}px Arial`;ctx.lineWidth=2;ctx.strokeStyle="#164e82";
  for(const p of placements) {
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.box.x+p.box.w/2,p.box.y+p.box.h/2);ctx.stroke();
    ctx.fillStyle="#164e82";ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();
  }
  for(const p of placements) {
    ctx.fillStyle="#fff";ctx.fillRect(p.box.x,p.box.y,p.box.w,p.box.h);
    ctx.strokeRect(p.box.x,p.box.y,p.box.w,p.box.h);
    ctx.fillStyle="#164e82";ctx.textAlign="center";ctx.fillText(p.codigo,p.box.x+p.box.w/2,p.box.y+fontSize+5);
  }
}
