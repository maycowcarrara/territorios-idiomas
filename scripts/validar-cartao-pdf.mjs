import { enderecoParaCartao } from "../src/designacoes/enderecoCartao.js";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { criarCartaoPdf } from "../src/designacoes/cartaoPdf.js";
import { carregarMapaCartao, mapaFixture } from "../src/designacoes/cartaoMapa.js";
// Optional bundled runtime path, or a locally installed @napi-rs/canvas.
const runtime = process.env.CARTAO_NODE_MODULES;
const require = createRequire(runtime ? `${runtime}/package.json` : import.meta.url);
const { createCanvas } = require("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(1100,530) };
const output = process.env.CARTAO_OUTPUT_DIR || "artifacts/cartao-pdf";
await mkdir(output, { recursive: true });
const base = { codigo:"T-12", nome:"Centro - demonstração", idioma:"Espanhol", cidade:"São Bento do Sul", bairro:"Jardim", url:"https://territ-es-sbs.web.app/#/c/cartao-ficticio" };
for (const [name,count] of [["curto",4],["seis",6],["longo",6],["paginado",30],["unicode",7]]) {
  const dados = { ...base, enderecos:Array.from({length:count},(_,i)=>({id:`e${i}`,codigo:`E-${i+1}`, endereco: i===9 ? `Rua da Constituição, 125, Edifício São João, bloco B, fundos, apartamento 204, próximo à Praça das Árvores - Jardim dos Ipês, São Bento do Sul - SC, 89280-000` : `Rua São João, ${i+1}, Centro, São Bento do Sul - SC`,lat:-26.25+i*.001,lng:-49.38+i*.001})) };
  if(name==="seis" || name==="longo") dados.enderecos.forEach((e,i)=>{e.endereco=`Rua da Constituição, ${i+1}, bloco B, apartamento 204, Centro${name==="longo" ? ", entrada pelos fundos, portão azul, próximo à praça central e ao mercado, segundo andar" : ""}`;});
  if(name==="unicode") {
    dados.nome="Idiomas — № 1";
    const textos=["Rua № 1, Centro","Русский — улица Пушкина, 2","Українська — вулиця Київська, 3","中文 — 中山路 4","日本語 — 桜通り 5","한국어 — 서울로 6","العربية — شارع النور 7"];
    dados.enderecos.forEach((e,i)=>{e.endereco=textos[i];});
  }
  dados.enderecos.forEach((e,i) => { e.classe = ["confirmado", "verificar", "estudo"][i % 3]; });
  dados.enderecos[0].observacao = name === "unicode" ? "中文 日本語 - Entrada lateral" : "Portão azul\nEntrada pela lateral; tocar a campainha.";
  if(name === "longo") dados.enderecos.forEach(e => {e.observacao = "Entrada pela lateral. Visitar no período da tarde. Confirmar o bloco e o apartamento antes de entrar.";});
  const mapa=await carregarMapaCartao(dados,mapaFixture);
  const doc=await criarCartaoPdf(dados,mapa,new Date("2026-10-22T15:00Z"),{carregarFonte:async()=>readFileSync("src/designacoes/fonts/unifont.ttf").toString("base64")});
  if(doc.getNumberOfPages()!==1) throw new Error(`${name}: cartão deve ter uma página`);
  await writeFile(`${output}/${name}.pdf`,new Uint8Array(doc.output("arraybuffer")));
  await writeFile(`${output}/${name}.json`,JSON.stringify({dados,enderecosImpressos:dados.enderecos.map(e=>enderecoParaCartao(e.endereco)),pages:doc.getNumberOfPages()},null,2));
  console.log(`${name}: ${doc.getNumberOfPages()} página(s), 93 x 145 mm`);
}
