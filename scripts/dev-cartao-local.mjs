// Isolated local demo; never targets real Firebase. Does not replace running demo servers.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir,writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHandler } from "../workers/designacoes/src/index.js";
import { createStore } from "../workers/designacoes/src/store.js";
import { createService } from "../workers/designacoes/src/service.js";
process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8285";
process.env.FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9295";
async function exigirPortaLivre(port) {
  await new Promise((resolve,reject)=>{
    const probe=createServer();
    probe.once("error",()=>reject(new Error(`A porta ${port} está ocupada. Preserve o servidor existente.`)));
    probe.listen(port,"127.0.0.1",()=>probe.close(resolve));
  });
}
await Promise.all([exigirPortaLivre(8789),exigirPortaLivre(5186)]);
const projectId=`demo-cartao-${randomBytes(4).toString("hex")}`;
const env={CODIGOS_ENABLED:"true",ENABLED:"true",LOCAL_EMULATORS:"true",FIREBASE_PROJECT_ID:projectId,FIRESTORE_EMULATOR_HOST:process.env.FIRESTORE_EMULATOR_HOST,FIREBASE_AUTH_EMULATOR_HOST:process.env.FIREBASE_AUTH_EMULATOR_HOST,PUBLIC_APP_URL:"http://127.0.0.1:5186",ALLOWED_ORIGINS:"http://127.0.0.1:5186",TOKEN_KEY_VERSION:"qa",TOKEN_KEYS_JSON:JSON.stringify({qa:randomBytes(32).toString("base64url")}),PIN_HMAC_KEY:randomBytes(32).toString("base64url")};
const db=getFirestore(initializeApp({projectId},"cartao-qa"));
const autor="cartao-admin@example.test";
await db.doc(`usuarios/${autor}`).set({role:"admin"});
await db.doc("grupos_enderecos/cartao-qa").set({codigo:"T-12",nome:"Centro - teste local",status:"ativo",enderecoIds:["cartao-e1","cartao-e2"],enderecos_visitados:[]});
for(let i=1;i<=2;i++) await db.doc(`enderecos/cartao-e${i}`).set({codigo:`E-${i}`,endereco:`Rua São João, ${i}`,bairro:"Centro",grupoId:"cartao-qa",status:"ativo",lat:-26.25+i*.001,lng:-49.38,informacao:i===1?"Portão azul.\\nObservação atual da demonstração.":""});
const service=createService(createStore(env),env);
await service.adminAction("configurar",null,{prazoDevolucaoAutomaticaDias:90},autor);
const share=await service.adminAction("criar",null,{grupoId:"cartao-qa",requestId:crypto.randomUUID(),contato:{nome:"Contato fictício",telefone:"+5547999991234"}},autor);
await mkdir("tmp/cartao-local",{recursive:true});
await writeFile("tmp/cartao-local/acesso.json",JSON.stringify(share));
const handler=createHandler();
const server=createServer(async(req,res)=>{
 try {
  const response=await handler.fetch(new Request(`http://127.0.0.1:8789${req.url}`,{method:req.method,headers:req.headers,...(!["GET","HEAD"].includes(req.method)?{body:req,duplex:"half"}:{})}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(500);res.end('{}');}
});
server.listen(8789,"127.0.0.1");
const child=spawn(process.execPath,["node_modules/vite/bin/vite.js","--mode","designacoes","--host","127.0.0.1","--port","5186","--strictPort"],{stdio:"inherit",env:{...process.env,VITE_DESIGNACOES_API_URL:"http://127.0.0.1:8789",VITE_PUBLIC_APP_URL:"http://127.0.0.1:5186",VITE_LOCAL_EMULATORS:"true",VITE_FIREBASE_PROJECT_ID:projectId,VITE_FIREBASE_API_KEY:"demo-api-key",VITE_NOTIFICATIONS_RELAY_URL:"",VITE_LIVE_UPDATE_MANIFEST_URL:"",VITE_ONESIGNAL_APP_ID:""}});
console.log(`Demonstração local pronta em http://127.0.0.1:5186/#/c/${share.cartaoId} (código somente em tmp/cartao-local/acesso.json).`);
process.on("SIGINT",()=>{child.kill();server.close();process.exit(0);});
