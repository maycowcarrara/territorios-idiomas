import React, { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

// Render the actual PDF locally: mobile browsers/WebViews need no PDF plugin.
export default function CartaoPdfPreview({ bytes }) {
  const container = useRef(null);
  const [status, setStatus] = useState("Abrindo PDF…");
  useEffect(() => {
    let cancelled = false, renderTask;
    const host = container.current;
    const loading = getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false });
    async function render() {
      try {
        const pdf = await loading.promise;
        for (let number = 1; number <= pdf.numPages && !cancelled; number++) {
          const page = await pdf.getPage(number);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 3 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.cssText = "display:block;width:100%;height:auto;margin:8px auto;background:white";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `Prévia do PDF do cartão, página ${number}`);
          host.appendChild(canvas);
          renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport });
          await renderTask.promise;
        }
        if (!cancelled) setStatus("");
      } catch {
        if (!cancelled) setStatus("Não foi possível exibir a prévia. Use Baixar / compartilhar PDF para abrir o arquivo.");
      }
    }
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loading.destroy();
      host.replaceChildren();
    };
  }, [bytes]);
  return <div>
    {status && <p role="status">{status}</p>}
    <div ref={container} style={{ width: "100%", maxWidth: 620, margin: "auto" }}/>
  </div>;
}
