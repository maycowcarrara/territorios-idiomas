import { criarCartaoPdf } from "../../src/designacoes/cartaoPdf.js";
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
   expect(()=>normalizarTelefone("12345","INT")).toThrow("telefone válido");
 });
});

describe("limites do PDF",()=>{
 const mapa={dataUrl:"data:image/png;base64,fixture",creditos:"Fixture",width:1100,height:530};
 it("recusa QR com PIN e fonte incapaz de representar o endereço",async()=>{
   await expect(criarCartaoPdf({url:"https://local/#/c/c1/0482",enderecos:[{codigo:"E-1",endereco:"Rua"}]},mapa)).rejects.toThrow("Cartão permanente");
   await expect(criarCartaoPdf({url:"https://local/#/c/c1",enderecos:[{codigo:"E-1",endereco:"Rua 漢字"}]},mapa)).rejects.toThrow("sem suporte");
 });
});
