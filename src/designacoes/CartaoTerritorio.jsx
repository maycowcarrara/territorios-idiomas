import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from "react";
import { createPortal } from "react-dom";
import { adminDesignacoesRequest } from "../designacoesAdminApi";
import { exportarPdfParaDispositivo } from "../pdfExport";
const MapaCartaoPreview=lazy(()=>import("./MapaCartaoPreview"));

export default function CartaoTerritorio({grupo}) {
  const [busy,setBusy]=useState(false),[erro,setErro]=useState(""),[dados,setDados]=useState(null),[preview,setPreview]=useState(null);
  const [mapState,setMapState]=useState({pronto:false,erro:""});
  const wasOpen=useRef(false);
  const dialog=useRef(null),capture=useRef(null),trigger=useRef(null),lock=useRef(false);
  const aberto=Boolean(dados||preview);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
  useLayoutEffect(()=>{
    if(aberto && !dialog.current?.open) dialog.current?.showModal();
    if(!aberto && wasOpen.current) trigger.current?.focus();
    wasOpen.current=aberto;
  },[aberto]);
  async function acao(work) {
    if(lock.current)return;lock.current=true;setBusy(true);setErro("");
    try {await work();}catch(e){setErro(e.message);}finally{lock.current=false;setBusy(false);}
  }
  async function abrir(fixture=false) {
    await acao(async()=>{
      const current=await adminDesignacoesRequest("/admin/cartao",{grupoId:grupo.id});
      const {pontosCartao,carregarMapaCartao,mapaFixture}=await import("./cartaoMapa");
      pontosCartao(current);
      if(fixture && import.meta.env.DEV) {
        const mapa=await carregarMapaCartao(current,mapaFixture);await compor(current,mapa);
      } else {setMapState({pronto:false,erro:""});setDados(current);}
    });
  }
  async function compor(current,mapa) {
    const {criarCartaoPdf}=await import("./cartaoPdf");
    const doc=await criarCartaoPdf(current,mapa);
    setPreview({doc,dados:current,url:URL.createObjectURL(doc.output("blob"))});
    setDados(null);
  }
  function fechar() {if(busy)return;setDados(null);setPreview(null);setErro("");}
  return <div className="space-y-2">
    <button ref={trigger} type="button" disabled={busy} className="rounded border p-2" onClick={()=>void abrir()}>{busy?"Preparando cartão…":"Gerar cartão PDF"}</button>
    {import.meta.env.DEV&&<button type="button" disabled={busy} className="rounded border p-2" onClick={()=>void abrir(true)}>Prévia local com mapa fictício</button>}
    {erro&&!aberto&&<p role="alert">{erro}</p>}
    {aberto&&createPortal(<dialog ref={dialog} onCancel={e=>{e.preventDefault();fechar();}} onClick={e=>e.stopPropagation()} aria-label="Prévia do cartão de território" style={{width:"min(720px, 94vw)",maxHeight:"92dvh",overflow:"auto",borderRadius:12,padding:16}}>
      <h2 className="text-lg font-bold">Cartão {grupo.codigo}</h2>
      {erro&&<p role="alert" className="text-red-700">{erro}</p>}
      {dados&&<>
        <p>Enquadre todos os pontos. A captura usa somente o mapa visível, sem baixar outras áreas ou níveis de zoom.</p>
        <Suspense fallback={<p role="status">Abrindo mapa…</p>}><MapaCartaoPreview dados={dados} capturaRef={capture} onEstado={setMapState}/></Suspense>
        {mapState.erro?<p role="alert">{mapState.erro}</p>:!mapState.pronto&&<p role="status">Carregando mapa…</p>}
        <button type="button" className="rounded bg-blue-700 p-3 text-white" disabled={busy||!mapState.pronto} onClick={()=>void acao(async()=>{const mapa=await capture.current();await compor(dados,mapa);})}>{busy?"Gerando PDF…":"Capturar mapa visível e ver PDF"}</button>
      </>}
      {preview&&<>
        <p>{preview.doc.getNumberOfPages()} página(s), 93 × 145 mm. {preview.dados.arquivados} endereço(s) arquivado(s) excluído(s).</p>
        <p>Confira se as ruas e os códigos estão legíveis antes de imprimir. QR permanente. Informe o código recebido do dirigente. Este PDF não designa nem renova o acesso.</p>
        <object data={preview.url} type="application/pdf" width="100%" height="450" aria-label="PDF do cartão"><a href={preview.url}>Ver prévia</a></object>
        <button type="button" className="rounded bg-blue-700 p-3 text-white" disabled={busy} onClick={()=>void acao(()=>exportarPdfParaDispositivo(preview.doc,`territorio-${preview.dados.codigo}-cartao-${new Date().toISOString().slice(0,10)}.pdf`,{pasta:"cartoes",texto:"Cartão de território em PDF"}))}>Baixar / compartilhar PDF</button>
      </>}
      <button type="button" className="ml-3 rounded border p-3" disabled={busy} onClick={fechar}>Fechar prévia</button>
    </dialog>,document.body)}
  </div>;
}
