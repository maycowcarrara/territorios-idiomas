import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(()=>{
  vi.resetModules();
  vi.stubEnv("VITE_DESIGNACOES_API_URL","https://api.example.test");
  vi.stubGlobal("navigator",{onLine:true});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("resposta do gateway de designações",()=>{
  it.each([502,504,200])("trata resposta HTML com status %s sem exibir erro do parser",async status=>{
    vi.stubGlobal("fetch",async()=>new Response("<html>Gateway error</html>",{status}));
    const {designacoesRequest}=await import("../../src/designacoesApi.js");
    await expect(designacoesRequest("/public/territorio")).rejects.toMatchObject({code:status===200?502:status,message:expect.stringContaining("temporariamente indisponível")});
  });
  it("preserva código e mensagem de erro JSON para tratar revogação e conflitos",async()=>{
    vi.stubGlobal("fetch",async()=>Response.json({error:"Acesso revogado"},{status:403}));
    const {designacoesRequest}=await import("../../src/designacoesApi.js");
    await expect(designacoesRequest("/public/territorio")).rejects.toMatchObject({code:403,message:"Acesso revogado"});
  });
});
