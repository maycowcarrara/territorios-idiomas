import { enderecoParaCartao } from "./enderecoCartao.js";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export const CARTAO_WIDTH = 93;
export const CARTAO_HEIGHT = 145;
// Pure layout: no Firestore, remote fetch, assignment or credential renewal.
export async function criarCartaoPdf(dados, mapa, data = new Date()) {
  if (!mapa?.dataUrl?.startsWith("data:image/png;base64,") || !mapa.creditos || mapa.width < 900 || mapa.height < 400)
    throw new Error("Mapa estático válido e créditos são obrigatórios.");
  if (!dados.enderecos?.length || !/\/#\/c\/[\w-]+$/.test(dados.url))
    throw new Error("Cartão permanente ou endereços inválidos.");
  const textos = [dados.codigo,dados.nome,dados.idioma,dados.bairro,mapa.creditos,...dados.enderecos.flatMap(e=>[e.codigo,e.endereco])];
  if (textos.some(t => /[^\u0020-\u007e\u00a0-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/u.test(String(t || "").replace(/[\t\r\n]/g, ""))))
    throw new Error("Há caracteres sem suporte na fonte de impressão. Revise a fonte antes de gerar; nenhum endereço foi omitido.");
  const doc = new jsPDF({ unit: "mm", format: [93, 145], orientation: "portrait", compress: true });
  const qr = QRCode.create(dados.url, { errorCorrectionLevel: "M" });
  const margin = 3, width = 87, bottom = 114;
  let y = 0;
  const header = first => {
    doc.setTextColor(25, 51, 75); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    const title = doc.splitTextToSize(`${dados.codigo} - ${dados.nome}`, width);
    doc.text(title, margin, 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const subtitle = doc.splitTextToSize([dados.idioma,dados.bairro].filter(Boolean).join(" / "), width);
    let top = 9 + title.length * 4;
    if (subtitle.length && subtitle[0]) { doc.text(subtitle, margin, top); top += subtitle.length * 3.5; }
    if (first) {
      doc.addImage(mapa.dataUrl, "PNG", margin, top, width, 50.75);
      top += 51.75;
      doc.setFontSize(6); const credits = doc.splitTextToSize(mapa.creditos, width); doc.text(credits, margin, top + 1); top += credits.length * 2.5 + 3;
    }
    y = top + 2;
  };
  header(true);
  for (const e of dados.enderecos) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const lines = doc.splitTextToSize(`${e.codigo} - ${enderecoParaCartao(e.endereco)}`, width);
    // Prefer keeping each address together; split only if longer than a whole page.
    if (y + lines.length * 4.1 + 2 > bottom && lines.length * 4.1 < 85) {
      doc.addPage([93,145]); header(false);
    }
    for (const line of lines) {
      if (y + 4.1 > bottom) { doc.addPage([93,145]); header(false); }
      doc.text(line, margin, y); y += 4.1;
    }
    y += 2;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(205); doc.line(3,116,90,116);
    // Vector QR, with a four-module quiet zone, repeated on every continuation.
    const module = 23 / (qr.modules.size + 8), x = 3, top = 118;
    doc.setFillColor(255); doc.rect(x,top,23,23,"F"); doc.setFillColor(0);
    for (let row=0; row<qr.modules.size; row++) for (let col=0; col<qr.modules.size; col++)
      if (qr.modules.get(row,col)) doc.rect(x+(col+4)*module,top+(row+4)*module,module,module,"F");
    doc.setTextColor(30); doc.setFontSize(7);
    doc.text(doc.splitTextToSize("Código de acesso: ____\nLeia o QR e informe o código atual recebido do dirigente para navegar e consultar observações.",62),28,121);
    doc.setFontSize(7);
    doc.text(`Gerado em ${data.toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})}`,28,134);
    doc.text(`${page}/${pages} - Imprimir a 100%`,28,138);
    doc.setFontSize(6); doc.text(doc.splitTextToSize(mapa.creditos,87),3,143);
  }
  return doc;
}
