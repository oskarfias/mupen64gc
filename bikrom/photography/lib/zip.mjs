// ZIP en flujo (método "store", sin recompresión). Tamaño exacto calculable de antemano,
// así el navegador muestra el progreso real. Cada lote debe quedar < 4 GB y cada archivo < 4 GB (sin ZIP64).
export const ZIP_LIMIT = 0xffffffff;

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

const localHeader = (name, size, crc, d) => {
  const n = Buffer.from(name, 'utf8');
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(0x0800, 6); // nombres en UTF-8
  b.writeUInt16LE(0, 8);      // store
  b.writeUInt16LE(dosTime(d), 10);
  b.writeUInt16LE(dosDate(d), 12);
  b.writeUInt32LE(crc >>> 0, 14);
  b.writeUInt32LE(size, 18);
  b.writeUInt32LE(size, 22);
  b.writeUInt16LE(n.length, 26);
  b.writeUInt16LE(0, 28);
  return Buffer.concat([b, n]);
};

const centralHeader = (name, size, crc, d, offset) => {
  const n = Buffer.from(name, 'utf8');
  const b = Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(20, 6);
  b.writeUInt16LE(0x0800, 8);
  b.writeUInt16LE(0, 10);
  b.writeUInt16LE(dosTime(d), 12);
  b.writeUInt16LE(dosDate(d), 14);
  b.writeUInt32LE(crc >>> 0, 16);
  b.writeUInt32LE(size, 20);
  b.writeUInt32LE(size, 24);
  b.writeUInt16LE(n.length, 28);
  b.writeUInt32LE(offset, 42);
  return Buffer.concat([b, n]);
};

const endRecord = (count, cdSize, cdOffset) => {
  const b = Buffer.alloc(22);
  b.writeUInt32LE(0x06054b50, 0);
  b.writeUInt16LE(count, 8);
  b.writeUInt16LE(count, 10);
  b.writeUInt32LE(cdSize, 12);
  b.writeUInt32LE(cdOffset, 16);
  return b;
};

// Nombres únicos dentro del ZIP
export function uniqueNames(files) {
  const seen = new Map();
  return files.map((f) => {
    const base = f.filename.replace(/[\\/:*?"<>|]/g, '_') || 'archivo';
    const c = seen.get(base) || 0;
    seen.set(base, c + 1);
    if (!c) return base;
    const dot = base.lastIndexOf('.');
    return dot > 0 ? `${base.slice(0, dot)} (${c + 1})${base.slice(dot)}` : `${base} (${c + 1})`;
  });
}

export function zipSize(entries) {
  let total = 22;
  for (const e of entries) {
    const n = Buffer.byteLength(e.name, 'utf8');
    total += 30 + n + e.size + 46 + n;
  }
  return total;
}

// Divide los archivos en lotes que no superen maxBytes (los mayores a 4 GB se descargan por separado).
export function batches(files, maxBytes) {
  const out = [];
  let cur = [];
  let curSize = 0;
  for (const f of files) {
    if (f.original_size >= ZIP_LIMIT - 1024) continue;
    const add = f.original_size + 76 + 2 * Buffer.byteLength(f.filename, 'utf8');
    if (cur.length && (curSize + add > maxBytes || cur.length >= 65000)) { out.push(cur); cur = []; curSize = 0; }
    cur.push(f);
    curSize += add;
  }
  if (cur.length) out.push(cur);
  return out;
}

// entries: [{name, size, crc32, open: async () => Readable}]
export async function writeZip(out, entries) {
  const d = new Date();
  let offset = 0;
  const central = [];
  const write = (buf) => new Promise((ok) => (out.write(buf) ? ok() : out.once('drain', ok)));
  for (const e of entries) {
    const h = localHeader(e.name, e.size, e.crc32, d);
    central.push(centralHeader(e.name, e.size, e.crc32, d, offset));
    await write(h);
    offset += h.length;
    const stream = await e.open();
    if (!stream) throw new Error(`Archivo no disponible: ${e.name}`);
    let written = 0;
    for await (const chunk of stream) {
      written += chunk.length;
      await write(chunk);
    }
    if (written !== e.size) throw new Error(`Tamaño inesperado en ${e.name}`);
    offset += written;
  }
  const cd = Buffer.concat(central);
  await write(cd);
  await write(endRecord(entries.length, cd.length, offset));
  out.end();
}
