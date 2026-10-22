import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Read-only proof of the released artifacts; never create real assignments.
const origin = "https://territ-es-sbs.web.app";
const api = "https://territorios-designacoes-idiomas.espanhola-sul-sbs.workers.dev";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const localVersion = JSON.parse(await readFile("dist/version.json", "utf8")).version;
async function get(path) {
  const response = await fetch(origin + path, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return Buffer.from(await response.arrayBuffer());
}
const version = JSON.parse(await get("/version.json"));
const manifest = JSON.parse(await get("/live-update/manifest.json"));
if (version.version !== localVersion || manifest.version !== localVersion) throw new Error("Versões divergentes");
const paths = ["/index.html", "/sw.js", ...(await readdir("dist/assets")).map(name => `/assets/${name}`)];
// Small bounded batches also verify the lazy PDF/font chunks, not only entry JS.
for (let i = 0; i < paths.length; i += 4) await Promise.all(paths.slice(i,i+4).map(async path => {
  const [remote, local] = await Promise.all([get(path), readFile("dist" + path)]);
  if (hash(remote) !== hash(local)) throw new Error(`Arquivo divergente: ${path}`);
}));
const [bundle, localBundle] = await Promise.all([get(manifest.bundleUrl), readFile("dist" + manifest.bundleUrl)]);
if (hash(bundle) !== manifest.zipSha256 || hash(bundle) !== hash(localBundle)) throw new Error("Pacote OTA divergente");
const rejected = await fetch(api + "/public/territorio", {
  method: "POST", headers: { Origin: origin, Authorization: "Bearer invalid", "Content-Type": "application/json" },
  body: "{}", signal: AbortSignal.timeout(30000),
});
if (rejected.status !== 403 || rejected.headers.get("access-control-allow-origin") !== origin || !rejected.headers.get("cache-control")?.includes("no-store")) throw new Error("Resposta pública inesperada");
const result = { version: localVersion, filesChecked: paths.length, allFilesMatch: true, fontAssetChecked: paths.some(p=>p.endsWith(".ttf")), bundleSha256: hash(bundle), bundleMatches: true, apiInvalidTokenStatus: rejected.status, corsMatches: true, noStore: true, productionDataWritten: false, checkedAt: new Date().toISOString() };
await writeFile(`artifacts/release/verification-${localVersion}.json`, JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
