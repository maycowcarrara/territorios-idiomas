const { createHash } = require('crypto');
const { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = require('fs');
const path = require('path');
const zlib = require('zlib');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const liveUpdateDir = path.join(distDir, 'live-update');
const versionPath = path.join(distDir, 'version.json');

if (!existsSync(distDir)) {
  console.error('Diretorio dist nao encontrado. Rode npm run build antes.');
  process.exit(1);
}

if (!existsSync(versionPath)) {
  console.error('Arquivo dist/version.json nao encontrado.');
  process.exit(1);
}

const appInfo = JSON.parse(readFileSync(versionPath, 'utf8'));
const version = appInfo.version;

if (!version) {
  console.error('Versao invalida em dist/version.json.');
  process.exit(1);
}

const zipName = `territorios-idiomas-${version}.zip`;
const zipPath = path.join(liveUpdateDir, zipName);
const manifestPath = path.join(liveUpdateDir, 'manifest.json');

rmSync(liveUpdateDir, { recursive: true, force: true });
mkdirSync(liveUpdateDir, { recursive: true });

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(base, absolutePath).replace(/\\/g, '/');

    if (relativePath === 'live-update' || relativePath.startsWith('live-update/')) {
      return [];
    }

    if (entry.isDirectory()) {
      return listFiles(absolutePath, base);
    }

    if (!entry.isFile()) {
      return [];
    }

    return [{ absolutePath, relativePath }];
  });
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function uint16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.relativePath, 'utf8');
    const data = readFileSync(entry.absolutePath);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(8),
      uint16(dosTime),
      uint16(dosDate),
      uint32(crc),
      uint32(compressed.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      name,
    ]);

    localParts.push(localHeader, compressed);

    centralParts.push(Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(8),
      uint16(dosTime),
      uint16(dosDate),
      uint32(crc),
      uint32(compressed.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name,
    ]));

    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

const files = listFiles(distDir).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

if (!files.some((file) => file.relativePath === 'index.html')) {
  console.error('O bundle OTA precisa conter index.html.');
  process.exit(1);
}

const zipBuffer = createZip(files);
writeFileSync(zipPath, zipBuffer);

const zipSha256 = createHash('sha256').update(zipBuffer).digest('hex');
const manifest = {
  version,
  buildDate: appInfo.buildDate,
  generatedAt: new Date().toISOString(),
  bundleUrl: `/live-update/${zipName}`,
  zipSha256,
  files: files.length,
  size: statSync(zipPath).size,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Pacote OTA gerado: dist/live-update/${zipName}`);
console.log(`Manifest OTA gerado: dist/live-update/manifest.json`);
