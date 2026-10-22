import {afterEach,describe,it,expect,vi} from "vitest";
import {capturarMapaVisivel,tilesCobremArea,OSM_CREDITOS} from "../../src/designacoes/cartaoMapaCaptura.js";
import {posicionarRotulos} from "../../src/designacoes/cartaoMapaRotulos.js";
import {enderecoParaCartao} from "../../src/designacoes/enderecoCartao.js";
afterEach(()=>vi.unstubAllGlobals());
function fixture({incomplete=false,outside=false,tainted=false}={}) {
 const ctx={fillRect:vi.fn(),drawImage:vi.fn(),measureText:()=>({width:50}),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),arc:vi.fn(),fill:vi.fn(),strokeRect:vi.fn(),fillText:vi.fn()};
 const image={complete:!incomplete,naturalWidth:256,crossOrigin:"anonymous",getBoundingClientRect:()=>({left:0,top:0,width:300,height:175})};
 const canvas={getContext:()=>ctx,toDataURL:()=>{if(tainted)throw new Error("CORS");return "data:image/png;base64,fixture";}};
 const createElement=vi.fn(()=>canvas);
 vi.stubGlobal("document",{visibilityState:"visible",createElement});
 vi.stubGlobal("window",{innerHeight:1000,innerWidth:1000});
 const container={clientWidth:300,clientHeight:175,parentElement:null,getBoundingClientRect:()=>({left:0,top:0})};
 const options={container,layer:{isLoading:()=>false,getContainer:()=>({querySelectorAll:()=>[image]})},map:{latLngToContainerPoint:()=>({x:outside?-10:150,y:80})},pontos:[{codigo:"E-1",lat:-26,lng:-49}]};
 return {options,ctx,createElement};
}
describe("captura do viewport OSM",()=>{
 it("usa somente imagens já carregadas, sem qualquer fetch ou pan/zoom",async()=>{
   const {options,ctx}=fixture();const network=vi.fn(()=>{throw new Error("Não deve baixar tiles");});vi.stubGlobal("fetch",network);
   const result=await capturarMapaVisivel(options);
   expect(result.creditos).toBe(OSM_CREDITOS);
   expect(result.resolucaoOriginal).toEqual({width:300,height:175});
   expect(ctx.drawImage).toHaveBeenCalledTimes(1);expect(network).not.toHaveBeenCalled();
   expect(ctx.fillText).toHaveBeenCalledWith("E-1",expect.any(Number),expect.any(Number));
 });
 it("recusa tile incompleto, ponto fora do enquadramento e CORS",async()=>{
   for(const opt of [{incomplete:true},{outside:true},{tainted:true}]) {
     const {options}=fixture(opt);await expect(capturarMapaVisivel(options)).rejects.toThrow();
   }
 });
 it("recusa captura de mapa oculto ou fora da área que o usuário vê",async()=>{
   const {options,createElement}=fixture();document.visibilityState="hidden";
   await expect(capturarMapaVisivel(options)).rejects.toThrow("visível");expect(createElement).not.toHaveBeenCalled();
 });
 it("detecta falhas de cobertura em vez de exportar áreas brancas",()=>{
   expect(tilesCobremArea([{x:0,y:0,w:150,h:100},{x:150,y:0,w:150,h:100}],300,100)).toBe(true);
   expect(tilesCobremArea([{x:0,y:0,w:149,h:100},{x:151,y:0,w:149,h:100}],300,100)).toBe(false);
   expect(tilesCobremArea([{x:0,y:0,w:300,h:50}],300,100)).toBe(false);
   expect(tilesCobremArea([],300,100)).toBe(false);
   // Fractional transforms in both axes, while real gaps remain forbidden.
   const tiles=[0,150.7].flatMap(x=>[0,50.7].map(y=>({x,y,w:150,h:50})));
   expect(tilesCobremArea(tiles,300,100)).toBe(true);
   expect(tilesCobremArea([{x:0,y:0,w:150,h:100},{x:151,y:0,w:149,h:100}],300,100)).toBe(false);
 });
 it("separa códigos de pontos coincidentes sem omitir pontos",()=>{
   const p=posicionarRotulos(Array.from({length:30},(_,i)=>({codigo:`E-${i+1}`,x:550,y:300})),1100,642,()=>55);
   expect(p).toHaveLength(30);
   expect(new Set(p.map(p=>`${p.box.x},${p.box.y}`)).size).toBe(30);
   for(const a of p) for(const b of p) if(a!==b) expect(a.box.x<b.box.x+b.box.w && a.box.x+a.box.w>b.box.x && a.box.y<b.box.y+b.box.h && a.box.y+a.box.h>b.box.y).toBe(false);
 });
});
describe("endereço somente para impressão",()=>{
 it.each([
   ["Rua São João, 1, Centro, São Bento do Sul - SC","Rua São João, 1, Centro"],
   ["Rua São Bento do Sul, 1","Rua São Bento do Sul, 1"],
   ["Rua A, 2, São Bento do Sul - SC — Centro","Rua A, 2 — Centro"],
   ["Rua A, 2, São Bento do Sul - SC, 89280-000","Rua A, 2"],
   ["Rua A, 2 — Centro","Rua A, 2 — Centro"],
 ])("%s",(source,result)=>{expect(enderecoParaCartao(source)).toBe(result);});
});
