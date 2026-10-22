import { criarCartaoPdf, ajustarListaCartao } from "../../src/designacoes/cartaoPdf.js";
import { jsPDF } from "jspdf";
import { cidadeParaCartao } from "../../src/designacoes/enderecoCartao.js";
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { describe,it,expect,vi } from "vitest";
import { carregarMapaCartao,pontosCartao } from "../../src/designacoes/cartaoMapa.js";
import { contatoCorrespondeBusca,normalizarTelefone } from "../../shared/designacoes.js";
const dados={enderecos:[{codigo:"E-1",lat:-26,lng:-49,observacao:"nunca enviar",telefone:"privado"}]};
describe("mapa estático e busca",()=>{
 it("falha sem fornecedor e sem localização, sem produzir mapa vazio",async()=>{
   await expect(carregarMapaCartao(dados)).rejects.toThrow("não configurada");
   const provider=vi.fn();
   await expect(carregarMapaCartao({enderecos:[{codigo:"E-2"}]},provider)).rejects.toThrow("E-2");
   expect(provider).not.toHaveBeenCalled();
   expect(()=>pontosCartao({enderecos:[{codigo:"E-3",lat:0,lng:0}]})).toThrow("E-3");
 });
 it("fornecedor recebe só coordenadas/códigos e dimensões",async()=>{
   const provider=vi.fn(async()=>({dataUrl:"data:image/png;base64,fixture",creditos:"Fixture local",width:1100,height:530}));
   await carregarMapaCartao(dados,provider);
   expect(provider.mock.calls[0][0].pontos).toEqual([{codigo:"E-1",lat:-26,lng:-49}]);
   expect(JSON.stringify(provider.mock.calls)).not.toMatch(/observacao|telefone|nunca enviar/);
 });
 it("recusa imagem ou créditos ausentes e timeout",async()=>{
   await expect(carregarMapaCartao(dados,async()=>({}))).rejects.toThrow("inválido");
   vi.useFakeTimers();
   const promise=carregarMapaCartao(dados,()=>new Promise(()=>{}));
   const result=expect(promise).rejects.toThrow("Tempo esgotado");
   await vi.advanceTimersByTimeAsync(15000);await result;vi.useRealTimers();
 });
 it("busca equivalência brasileira sem alterar contato nem presumir conta WhatsApp",()=>{
   const c={nome:"Ana",telefoneE164:"+5547999991234"};
   expect(contatoCorrespondeBusca(c,"+55 (47) 9999-1234")).toBe(true);
   expect(contatoCorrespondeBusca(c,"Ana")).toBe(true);
   expect(contatoCorrespondeBusca(c,"999991234")).toBe(true);
   expect(contatoCorrespondeBusca(c,"Outro")).toBe(false);
   expect(c.telefoneE164).toBe("+5547999991234");
   expect(normalizarTelefone("+447911123456","BR")).toBe("+447911123456");
   expect(normalizarTelefone("\u200e+55 (47) 99999-1234\u200f")).toBe("+5547999991234");
   expect(()=>normalizarTelefone("\u200e+55 telefone 47999991234")).toThrow("telefone válido");
   expect(()=>normalizarTelefone("12345","INT")).toThrow("telefone válido");
 });
});

describe("limites do PDF",()=>{
 it("usa a cidade dos endereços e recorre ao padrão apenas na ausência dela",()=>{
   expect(cidadeParaCartao({enderecos:[{endereco:"Rua Um, 12, Joinville - SC, 89200-000 — Centro"}]},"São Bento do Sul")).toBe("Joinville");
   expect(cidadeParaCartao({enderecos:[{endereco:"Rua Um, 12, São Bento do Sul - SC"},{endereco:"Rua Dois, 20, Joinville - SC"}]})).toBe("São Bento do Sul / Joinville");
   expect(cidadeParaCartao({enderecos:[{endereco:"Rua Um, 12"}]},"São Bento do Sul")).toBe("São Bento do Sul");
   expect(cidadeParaCartao({cidade:"Curitiba",enderecos:[]},"São Bento do Sul")).toBe("Curitiba");
 });
 const mapa={dataUrl:"data:image/png;base64,fixture",creditos:"Fixture",width:1100,height:530};
 it("reserva seis endereços de duas linhas em 10 pt e reduz todos juntos para textos maiores",()=>{
   const doc=new jsPDF({unit:"mm"});
   const textos=Array.from({length:6},(_,i)=>`E-${i+1} - Rua da Constituição, 125, bloco B, apartamento 204, Centro`);
   const normal=ajustarListaCartao(doc,textos,87,59);
   expect(normal.fontSize).toBe(10);
   expect(normal.linhas.every(ls=>ls.length===2)).toBe(true);
   const longo=ajustarListaCartao(doc,textos.map(t=>`${t}, entrada pelos fundos, portão azul, próximo à praça central e ao mercado, segundo andar`),87,59);
   expect(longo.fontSize).toBeLessThan(10);
   expect(longo.height).toBeLessThanOrEqual(59);
   expect(longo.linhas).toHaveLength(6);
 });
 it("mantém listas extensas em uma página, sem instruções ou campo de PIN",async()=>{
   const validMap={...mapa,dataUrl:await QRCode.toDataURL("fixture")};
   const source={codigo:"T-1",nome:"Centro",url:"https://local/#/c/c1",enderecos:Array.from({length:30},(_,i)=>({codigo:`E-${i+1}`,endereco:"Rua da Constituição, 125, bloco B, apartamento 204, Centro"}))};
   const doc=await criarCartaoPdf(source,validMap);
   expect(doc.getNumberOfPages()).toBe(1);
   const content=doc.internal.pages[1].join("\n");
   expect(content).toContain("E-30");
   expect(content).not.toContain("Leia o QR");
   expect(content).not.toContain("digo de acesso");
 });
 it("recusa QR com PIN",async()=>{
   await expect(criarCartaoPdf({url:"https://local/#/c/c1/0482",enderecos:[{codigo:"E-1",endereco:"Rua"}]},mapa)).rejects.toThrow("Cartão permanente");
 });
 it("incorpora glifos para os idiomas e №, sem depender das fontes do aparelho",async()=>{
   const carregarFonte=async()=>readFileSync(new URL("../../src/designacoes/fonts/unifont.ttf",import.meta.url)).toString("base64");
   const validMap={...mapa,dataUrl:await QRCode.toDataURL("fixture")};
   const source={codigo:"T-1",nome:"Русский Українська",url:"https://local/#/c/c1",enderecos:[{codigo:"E-1",endereco:"Rua № 1 — 中文 日本語 한국어 العربية"}]};
   const doc=await criarCartaoPdf(source,validMap,new Date(),{carregarFonte});
   expect(doc.getFontList()).toHaveProperty("cartao");
   expect(doc.getNumberOfPages()).toBe(1);
   expect(doc.output()).toContain("/FontFile2");
   await expect(criarCartaoPdf({...source,nome:"Emoji 😀"},validMap,new Date(),{carregarFonte})).rejects.toThrow("não contém o caractere");
 });
});
