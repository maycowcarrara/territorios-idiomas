const fs = require('node:fs');
const crypto = require('node:crypto');
const origin = 'https://territ-es-sbs.web.app';
const api = 'https://territorios-designacoes-idiomas.espanhola-sul-sbs.workers.dev';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function get(path) {
  const r = await fetch(origin + path, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${path}`);
  return Buffer.from(await r.arrayBuffer());
}
(async () => {
  const version = JSON.parse(await get('/version.json'));
  const manifest = JSON.parse(await get('/live-update/manifest.json'));
  if (version.version !== '3.8.381' || manifest.version !== version.version) throw new Error('Versões divergentes');
  const localHtml = fs.readFileSync('dist/index.html');
  const publishedHtml = await get('/');
  if (hash(localHtml) !== hash(publishedHtml)) throw new Error('HTML divergente');
  const paths = [...localHtml.toString().matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(m => m[1]);
  for (const path of paths) {
    if (hash(await get(path)) !== hash(fs.readFileSync('dist' + path))) throw new Error(`Asset divergente: ${path}`);
  }
  const bundle = await get(manifest.bundleUrl);
  if (hash(bundle) !== manifest.zipSha256) throw new Error('Hash do pacote divergente');
  const rejected = await fetch(api + '/public/territorio', {
    method:'POST', headers: {Origin:origin, Authorization:'Bearer invalid', 'Content-Type':'application/json'},
    body:'{}', signal:AbortSignal.timeout(30000)
  });
  if (rejected.status !== 403 || rejected.headers.get('access-control-allow-origin') !== origin || !rejected.headers.get('cache-control')?.includes('no-store')) throw new Error('Resposta pública inesperada');
  const result = {version:version.version, htmlMatches:true, initialAssetsChecked:paths.length, bundleSha256:hash(bundle), bundleMatches:true, apiInvalidTokenStatus:rejected.status, corsMatches:true, noStore:true, checkedAt:new Date().toISOString()};
  fs.writeFileSync('artifacts/release/verification-3.8.381.json', JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
})().catch(e => {console.error(e.message); process.exitCode = 1;});
