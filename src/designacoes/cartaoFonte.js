// Loaded only for a PDF that needs characters outside the built-in font.
let fonte;
export async function carregarFonteCartao() {
  if (!fonte) fonte = (async () => {
    const response = await fetch(new URL("./fonts/unifont.ttf", import.meta.url), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("Não foi possível carregar a fonte de impressão. Tente novamente.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })().catch(error => { fonte = null; throw error; });
  return fonte;
}

export const precisaFonteUnicode = textos => textos.some(t =>
  /[^\u0020-\u007e\u00a0-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/u.test(String(t || "").replace(/[\t\r\n]/g, "")));
