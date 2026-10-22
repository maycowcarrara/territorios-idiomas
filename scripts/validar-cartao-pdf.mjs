import { enderecoParaCartao } from "../src/designacoes/enderecoCartao.js";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { criarCartaoPdf } from "../src/designacoes/cartaoPdf.js";
import { carregarMapaCartao, mapaFixture } from "../src/designacoes/cartaoMapa.js";
// Optional bundled runtime path, or a locally installed @napi-rs/canvas.
const runtime = process.env.CARTAO_NODE_MODULES;
const require = createRequire(runtime ? `${runtime}/package.json` : import.meta.url);
const { createCanvas } = require("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(1100,530) };
await mkdir("artifacts/cartao-pdf", { recursive: true });
const base = { codigo:"T-12", nome:"Centro - demonstração", idioma:"Espanhol", bairro:"Jardim", url:"https://territ-es-sbs.web.app/#/c/cartao-ficticio" };
for (const [name,count] of [["curto",4],["paginado",30]]) {
  const dados = { ...base, enderecos:Array.from({length:count},(_,i)=>({id:`e${i}`,codigo:`E-${i+1}`, endereco: i===9 ? `Rua da Constituição, 125, Edifício São João, bloco B, fundos, apartamento 204, próximo à Praça das Árvores - Jardim dos Ipês, São Bento do Sul - SC, 89280-000` : `Rua São João, ${i+1}, Centro, São Bento do Sul - SC`,lat:-26.25+i*.001,lng:-49.38+i*.001})) };
  const mapa=await carregarMapaCartao(dados,mapaFixture);
  const doc=await criarCartaoPdf(dados,mapa,new Date("2026-10-22T15:00Z"));
  await writeFile(`artifacts/cartao-pdf/${name}.pdf`,new Uint8Array(doc.output("arraybuffer")));
  await writeFile(`artifacts/cartao-pdf/${name}.json`,JSON.stringify({dados,enderecosImpressos:dados.enderecos.map(e=>enderecoParaCartao(e.endereco)),pages:doc.getNumberOfPages()},null,2));
  console.log(`${name}: ${doc.getNumberOfPages()} página(s), 93 x 145 mm`);
}
