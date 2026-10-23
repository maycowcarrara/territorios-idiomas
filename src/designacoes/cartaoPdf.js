import { enderecoParaCartao } from "./enderecoCartao.js";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { carregarFonteCartao, precisaFonteUnicode } from "./cartaoFonte.js";

export const CARTAO_WIDTH = 93;
export const CARTAO_HEIGHT = 145;
const MM_PER_PT = 25.4 / 72;
const CLASSES = { confirmado: "Confirmado", verificar: "Verificar", estudo: "Estudo" };

// Measure addresses and their smaller notes together before choosing a size.
export function ajustarEnderecosCartao(doc, enderecos, width, height) {
  // Leave 1 mm for differences between PDF font metrics and rendered glyphs.
  const textWidth = width - 1;
  const medir = fontSize => {
    const gap = fontSize * MM_PER_PT * 0.4;
    const itens = enderecos.map(e => {
      doc.setFontSize(fontSize);
      const classe = CLASSES[e.classe] || CLASSES.confirmado;
      const linhas = doc.splitTextToSize(`${e.codigo} - ${classe} - ${enderecoParaCartao(e.endereco)}`, textWidth);
      const obsFontSize = fontSize * 0.8;
      doc.setFontSize(obsFontSize);
      const observacoes = e.observacao?.trim() ? doc.splitTextToSize(`Obs.: ${e.observacao.trim()}`, textWidth) : [];
      return { linhas, observacoes, obsFontSize, lineHeight: fontSize * MM_PER_PT * 1.18, obsLineHeight: obsFontSize * MM_PER_PT * 1.1 };
    });
    return { fontSize, gap, itens, height: itens.reduce((n, item) => n + item.linhas.length * item.lineHeight + item.observacoes.length * item.obsLineHeight, 0) + Math.max(0, itens.length - 1) * gap };
  };
  let layout = medir(10);
  if (layout.height <= height) return layout;
  let low = 0, high = 10;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    const candidate = medir(middle);
    if (candidate.height <= height) { low = middle; layout = candidate; }
    else high = middle;
  }
  return layout;
}

// Measure every wrapped line before drawing. All addresses share the largest
// font that fits; neither continuation pages nor truncated addresses are used.
export function ajustarListaCartao(doc, textos, width, height, maxFontSize = 10) {
  const medir = fontSize => {
    doc.setFontSize(fontSize);
    const linhas = textos.map(texto => doc.splitTextToSize(texto, width));
    const lineHeight = fontSize * MM_PER_PT * 1.18;
    const gap = fontSize * MM_PER_PT * 0.4;
    return { fontSize, linhas, lineHeight, gap, height: linhas.reduce((n, ls) => n + ls.length * lineHeight, 0) + Math.max(0, linhas.length - 1) * gap };
  };
  let layout = medir(maxFontSize);
  if (layout.height <= height) return layout;
  let low = 0, high = maxFontSize;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    const candidate = medir(middle);
    if (candidate.height <= height) { low = middle; layout = candidate; }
    else high = middle;
  }
  return layout;
}
// Pure layout: no Firestore, remote fetch, assignment or credential renewal.
export async function criarCartaoPdf(dados, mapa, data = new Date(), { carregarFonte = carregarFonteCartao } = {}) {
  if (!mapa?.dataUrl?.startsWith("data:image/png;base64,") || !mapa.creditos || mapa.width < 900 || mapa.height < 400)
    throw new Error("Mapa estático válido e créditos são obrigatórios.");
  if (!dados.enderecos?.length || !/\/#\/c\/[\w-]+$/.test(dados.url))
    throw new Error("Cartão permanente ou endereços inválidos.");
  const textos = [dados.codigo,dados.nome,dados.idioma,dados.cidade,dados.bairro,mapa.creditos,...dados.enderecos.flatMap(e=>[e.codigo,e.endereco,e.observacao])];
  const doc = new jsPDF({ unit: "mm", format: [93, 145], orientation: "portrait", compress: true });
  const unicode = precisaFonteUnicode(textos);
  if (unicode) {
    doc.addFileToVFS("unifont.ttf", await carregarFonte());
    doc.addFont("unifont.ttf", "cartao", "normal");
    doc.setFont("cartao", "normal");
    const glyphs = doc.getFont().metadata?.cmap?.unicode?.codeMap;
    for (const char of textos.map(t => String(t || "")).join("")) {
      if (!/[\t\r\n]/.test(char) && !glyphs?.[char.codePointAt(0)])
        throw new Error(`A fonte de impressão não contém o caractere ${char}. Nenhum endereço foi omitido.`);
    }
  }
  const fonte = bold => doc.setFont(unicode ? "cartao" : "helvetica", !unicode && bold ? "bold" : "normal");
  const qr = QRCode.create(dados.url, { errorCorrectionLevel: "M" });
  const margin = 3, width = 87, qrSize = 20;
  doc.setTextColor(25, 51, 75); fonte(true);
  const title = ajustarListaCartao(doc, [`${dados.codigo} - ${dados.nome}`], 64, 12);
  doc.setFontSize(title.fontSize);
  let y = margin;
  for (const line of title.linhas[0]) {
    doc.text(line, margin, y, { baseline: "top" }); y += title.lineHeight;
  }
  fonte(false);
  const subtitle = ajustarListaCartao(doc, [dados.idioma,dados.cidade,dados.bairro ? `Bairro: ${dados.bairro}` : ""].filter(Boolean), 64, 20 - title.height - 1, 8);
  doc.setFontSize(subtitle.fontSize);
  y += 1;
  for (const lines of subtitle.linhas) {
    for (const line of lines) {
      doc.text(line, margin, y, { baseline: "top" }); y += subtitle.lineHeight;
    }
    y += subtitle.gap;
  }
  // Vector QR beside the title, outside the map, with a four-module quiet zone.
  const module = qrSize / (qr.modules.size + 8), x = CARTAO_WIDTH - margin - qrSize;
  doc.setFillColor(255); doc.rect(x,margin,qrSize,qrSize,"F"); doc.setFillColor(0);
  for (let row=0; row<qr.modules.size; row++) for (let col=0; col<qr.modules.size; col++)
    if (qr.modules.get(row,col)) doc.rect(x+(col+4)*module,margin+(row+4)*module,module,module,"F");

  doc.addImage(mapa.dataUrl, "PNG", margin, 25, width, 50.75);
  fonte(false); doc.setTextColor(30);
  const date = `Gerado em ${data.toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})}`;
  const footer = ajustarListaCartao(doc, [`${mapa.creditos} | ${date}`], width, 4, 5);
  const footerTop = CARTAO_HEIGHT - margin - footer.height;
  doc.setFontSize(footer.fontSize); doc.setTextColor(95);
  footer.linhas[0].forEach((line, i) => doc.text(line, 90, footerTop + i * footer.lineHeight, { align: "right", baseline: "top" }));

  y = 79;
  const layout = ajustarEnderecosCartao(doc, dados.enderecos, width, footerTop - 2 - y);
  doc.setTextColor(30);
  for (const item of layout.itens) {
    doc.setFontSize(layout.fontSize);
    for (const line of item.linhas) {
      doc.text(line, margin, y, { baseline: "top" }); y += item.lineHeight;
    }
    doc.setFontSize(item.obsFontSize);
    for (const line of item.observacoes) {
      doc.text(line, margin, y, { baseline: "top" }); y += item.obsLineHeight;
    }
    y += layout.gap;
  }
  // Inset cutting guide: a visible print stroke, fully inside the PDF page.
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(1, 1, CARTAO_WIDTH - 2, CARTAO_HEIGHT - 2, "S");
  return doc;
}
