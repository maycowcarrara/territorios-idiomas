// Real REST transactions against demo emulators, including deterministic PIN collision.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createStore } from "../workers/designacoes/src/store.js";
import { createHandler } from "../workers/designacoes/src/index.js";
import { createService } from "../workers/designacoes/src/service.js";
assert(process.env.GCLOUD_PROJECT?.startsWith("demo-"));
for(const name of ["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST"]) assert(/^127\.0\.0\.1:\d+$/.test(process.env[name]||""));
const projectId=`${process.env.GCLOUD_PROJECT}-cartao`;
const db=getFirestore(initializeApp({projectId},"cartao-smoke"));
const env={
  CODIGOS_ENABLED: "true",LOCAL_EMULATORS:"true",FIREBASE_PROJECT_ID:projectId,FIRESTORE_EMULATOR_HOST:process.env.FIRESTORE_EMULATOR_HOST,TOKEN_KEY_VERSION:"test",TOKEN_KEYS_JSON:JSON.stringify({test:btoa("t".repeat(32))}),PIN_HMAC_KEY:btoa("p".repeat(32)).replace(/=+$/,""),PUBLIC_APP_URL:"http://localhost:5186"};
let now=new Date("2026-10-22T12:00Z");
const service=createService(createStore(env),env,()=>now);
const autor="cartao-smoke@example.test";
const admin=(action,body={},id=null)=>service.adminAction(action,id,body,autor);
const open=s=>service.cardAction("acessar-cartao",{cartaoId:s.cartaoId,codigo:s.codigoAcesso});
const checks=[];
const check=(value,label)=>{assert(value,label);checks.push(label);};
const originalRandom=crypto.getRandomValues.bind(crypto);
try {
 await db.doc(`usuarios/${autor}`).set({role:"admin"});
 await admin("configurar",{prazoDevolucaoAutomaticaDias:2});
 for(let i=1;i<=4;i++) {
  await db.doc(`grupos_enderecos/pin-g${i}`).set({codigo:`T-${i}`,nome:"Fixture",status:"ativo",enderecoIds:[`pin-e${i}`],enderecos_visitados:[]});
  await db.doc(`enderecos/pin-e${i}`).set({codigo:`E-${i}`,endereco:`Rua Teste, ${i}`,grupoId:`pin-g${i}`,lat:-26+i*.001,lng:-49,status:"ativo",informacao:"Observação atual"});
 }
 const cards=await Promise.all([admin("cartao",{grupoId:"pin-g1"}),admin("cartao",{grupoId:"pin-g1"})]);
 check(cards[0].cartaoId===cards[1].cartaoId,"Cartão concorrente idempotente");
 const consulta=cartaoId=>service.cardAction("consulta-cartao",{cartaoId});
 const dump=async()=>{
  const result=[];
  for(const collection of await db.listCollections()) {
   for(const doc of (await collection.get()).docs) result.push([doc.ref.path,doc.data()]);
  }
  return JSON.stringify(result.sort((a,b)=>a[0].localeCompare(b[0])));
 };
 const before=await dump();
 const qr=await consulta(cards[0].cartaoId);
 check(qr.modo==="consulta" && !qr.podeMarcar && !qr.habilitacaoDisponivel && qr.enderecos.length===1,"QR sem designação mostra composição atual");
 check(await dump()===before,"Consulta sem efeitos em todas as coleções demo");
 const handler=createHandler({storeFactory:()=>createStore(env),clock:()=>now});
 const http=await handler.fetch(new Request("https://local/public/consulta-cartao",{method:"POST",body:JSON.stringify({cartaoId:cards[0].cartaoId})}),{...env,ENABLED:"true"});
 check(http.status===200 && http.headers.get("Cache-Control")==="no-store","Consulta HTTP real sem Bearer/no-store");
 const c=await admin("contato",{nome:"Contato de teste",telefone:"+5547999999012"});
 // Only the PIN's Uint16 RNG is forced; card IDs, session tokens and AES IVs remain random.
 crypto.getRandomValues=a=>a instanceof Uint16Array ? (a.fill(0),a) : originalRandom(a);
 const shares=await Promise.all([1,2].map(i=>admin("criar",{requestId:`pin-r${i}`,grupoId:`pin-g${i}`,contatoId:c.id})));
 check(new Set(shares.map(s=>s.codigoAcesso)).size===2,"Colisão real resolvida sem PIN ativo repetido");
 check(shares.every(s=>/^\d{4}$/.test(s.codigoAcesso)),"Zeros e formato ASCII preservados");
 const s=shares[0]; const session=await open(s);
 check((await consulta(s.cartaoId)).habilitacaoDisponivel,"Designação válida oferece habilitação sem liberar escrita");
 const current=await service.publicAction("territorio",session.token);
 check(current.enderecos[0].observacao==="Observação atual","Observação mínima e atual");
 const boot=await service.cardAction("cartao",{cartaoId:s.cartaoId});
 check(Object.keys(boot).sort().join(",")==="codigo,disponivel","Bootstrap sem endereço nem designação");
 await db.doc("enderecos/pin-e1").update({informacao:"Nova observação"});
 check((await service.publicAction("territorio",session.token)).enderecos[0].observacao==="Nova observação","Atualização sem renovar código");
 check((await consulta(s.cartaoId)).enderecos[0].observacao==="Nova observação","QR usa observação atual, nunca snapshot");
 const race=await Promise.allSettled([open(s),admin("renovar",{},s.id)]);
 check(race[1].status==="fulfilled","Renovação em corrida com entrada concluiu");
 await assert.rejects(()=>service.publicAction("territorio",session.token),e=>e.code===403);checks.push("Sessão anterior invalidada");
 if(race[0].status==="fulfilled") {await assert.rejects(()=>service.publicAction("territorio",race[0].value.token),e=>e.code===403);checks.push("Sessão emitida durante renovação não sobrevive");}
 await assert.rejects(()=>open(s),e=>e.code===403);checks.push("Mensagem anterior bloqueada");
 const renewed=await admin("compartilhar",{},s.id);
 check(renewed.cartaoId===s.cartaoId && renewed.codigoAcesso!==s.codigoAcesso,"QR permanente, código novo");
 const concurrent=await Promise.allSettled([admin("renovar",{},s.id),admin("renovar",{},s.id)]);
 check(concurrent.every(r=>r.status==="fulfilled"),`Duas renovações concorrentes serializadas: ${JSON.stringify(concurrent.map(r=>({status:r.status,error:r.reason?.message,code:r.reason?.code,storeStatus:r.reason?.status})))}`);
 const finalShare=await admin("compartilhar",{},s.id);
 const hist=(await db.doc("historico_codigos/pin-g1").get()).data().usados;
 check(hist.length===new Set(hist).size && hist.length===4,"Histórico nunca reutilizado");
 const finalSession=await open(finalShare);
 const revokeRace=await Promise.allSettled([open(finalShare),admin("revogar",{},s.id)]);
 check(revokeRace[1].status==="fulfilled","Revogação em corrida com entrada");
 await assert.rejects(()=>service.publicAction("territorio",finalSession.token),e=>e.code===403);checks.push("Revogação invalida sessão");
 if(revokeRace[0].status==="fulfilled") {await assert.rejects(()=>service.publicAction("territorio",revokeRace[0].value.token),e=>e.code===403);checks.push("Sessão emitida na corrida revogada");}
 const phoneRace=await Promise.allSettled([admin("contato",{nome:"A",telefone:"+55 47 8888-1234"}),admin("contato",{nome:"B",telefone:"+55 47 98888-1234"})]);
 check(phoneRace.filter(r=>r.status==="fulfilled").length===1,`Celulares equivalentes concorrem pelo mesmo índice: ${JSON.stringify(phoneRace.map(r=>({status:r.status,error:r.reason?.message,code:r.reason?.code,storeStatus:r.reason?.status})))}`);
 const e=shares[1];const oldSession=await open(e);
 now=new Date("2026-10-24T12:00Z");
 await assert.rejects(()=>open(e),err=>err.code===403);checks.push("Expiração bloqueia PIN antes do cron");
 await assert.rejects(()=>service.publicAction("territorio",oldSession.token),err=>err.code===403);checks.push("Expiração bloqueia sessão antes do cron");
 const expiredBefore=await dump();
 check(!(await consulta(e.cartaoId)).habilitacaoDisponivel && (await consulta(e.cartaoId)).enderecos.length===1,"Consulta vencida antes do cron continua sem habilitação");
 check(await dump()===expiredBefore,"Consulta vencida não reconcilia nem altera prazo/progresso");
 const freed=await admin("criar",{requestId:"reuse-other",grupoId:"pin-g3",contatoId:c.id});
 check(freed.codigoAcesso==="0000","Reserva revogada pode ser reaproveitada em outro território");
 await service.expirar();
 const old=await db.doc(`designacoes_links/${e.id}`).get();
 check(old.data().operacionalAtiva===false,"Cron reconciliou encerramento");
 const reclaimed=await admin("criar",{requestId:"new-g2",grupoId:"pin-g2",contatoId:c.id});
 check(reclaimed.codigoAcesso!==e.codigoAcesso,"Território não reusa seu PIN histórico após expirar");
 const returnedSession=await open(reclaimed);
 const returnedState=await service.publicAction("territorio",returnedSession.token);
 await service.publicAction("devolver",returnedSession.token,{composicaoVersao:returnedState.composicaoVersao,progressoVersao:returnedState.progressoVersao});
 check(!(await consulta(reclaimed.cartaoId)).habilitacaoDisponivel,"QR devolvido consulta sem habilitar");
 const fourth=await admin("cartao",{grupoId:"pin-g4"});
 await db.doc("grupos_enderecos/pin-g4").update({designacaoTipo:"email",designadoPara:"fixture@example.test"});
 check((await consulta(fourth.cartaoId)).enderecos.length===1,"Consulta de território por email");
 await db.doc("enderecos/pin-e4").update({grupoId:"pin-g3"});
 await assert.rejects(()=>consulta(fourth.cartaoId),err=>err.code===409);checks.push("Vínculo divergente falha fechado");
 await db.doc("enderecos/pin-e4").update({grupoId:"pin-g4",status:"arquivado"});
 await assert.rejects(()=>consulta(fourth.cartaoId),err=>err.code===404);checks.push("Nenhum endereço consultável fica indisponível");
 await db.doc("enderecos/pin-e4").update({status:"ativo"});
 await db.doc("grupos_enderecos/pin-g4").update({status:"arquivado"});
 await assert.rejects(()=>consulta(fourth.cartaoId),err=>err.code===404);checks.push("Arquivamento suspende consulta");
 await db.doc("grupos_enderecos/pin-g4").update({status:"ativo"});
 check((await consulta(fourth.cartaoId)).enderecos.length===1,"Reativação permite nova consulta");
 console.log(`Cartão/PIN: ${checks.length} verificações passaram (colisão, concorrência, sessão, histórico, telefone, expiração).`);
} finally { crypto.getRandomValues=originalRandom;await db.terminate(); }

