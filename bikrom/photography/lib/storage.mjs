// Almacenamiento privado de archivos.
// - local: disco del servidor (demostración o servidor con disco persistente).
// - sqlite: dentro de la misma base de datos, en bloques de 1 MB (Cloudflare Durable Objects, sin disco).
// - s3: compatible con S3 (Cloudflare R2, Backblaze B2, AWS). Firma SigV4 sin dependencias.
// Los archivos nunca son públicos: se entregan a través del servidor o con URL firmadas de corta vida.
import { createReadStream, createWriteStream, mkdirSync, statSync, existsSync, rmSync, openSync, writeSync, closeSync, renameSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';

export const PART_SIZE = 8 * 1024 * 1024; // 8 MB (S3 exige ≥ 5 MB salvo la última parte)

export function createStorage(env, dataDir, db) {
  if (env.STORAGE_DRIVER === 's3') return s3Storage(env);
  if (env.STORAGE_DRIVER === 'sqlite') return sqliteStorage(db);
  return localStorage(join(dataDir, 'files'));
}

// ───────────── SQLite (bloques) ─────────────
// Pensado para Cloudflare Durable Objects (límite de 2 MB por valor): cada archivo se guarda en bloques de 1 MB.
export const CHUNK = 1024 * 1024;
export function sqliteStorage(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS file_blobs (key TEXT PRIMARY KEY, size INTEGER NOT NULL, complete INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS file_chunks (key TEXT NOT NULL, n INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (key, n));`);
  const partKey = (key) => key + '.part';
  const drop = (key) => db.tx(() => {
    db.run('DELETE FROM file_chunks WHERE key = ?', key);
    db.run('DELETE FROM file_blobs WHERE key = ?', key);
  });
  const writeAt = (key, offset, buf) => db.tx(() => {
    for (let i = 0; i < buf.length; i += CHUNK) {
      if ((offset + i) % CHUNK) throw new Error('bloque desalineado');
      db.run('INSERT OR REPLACE INTO file_chunks (key, n, data) VALUES (?, ?, ?)', key, (offset + i) / CHUNK, buf.subarray(i, i + CHUNK));
    }
    const end = offset + buf.length;
    db.run('INSERT INTO file_blobs (key, size, complete, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(key) DO UPDATE SET size = MAX(size, excluded.size), updated_at = excluded.updated_at', key, end, Date.now());
  });
  const toBuf = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v));
  return {
    driver: 'sqlite',
    async createUpload(key) {
      drop(partKey(key));
      db.run('INSERT INTO file_blobs (key, size, complete, updated_at) VALUES (?, 0, 0, ?)', partKey(key), Date.now());
      return { providerUploadId: null };
    },
    async putPart(upload, index, buf) {
      writeAt(partKey(upload.storage_key), index * PART_SIZE, buf);
      return { n: index + 1 };
    },
    async completeUpload(upload) {
      const key = upload.storage_key;
      db.tx(() => {
        db.run('DELETE FROM file_chunks WHERE key = ?', key);
        db.run('DELETE FROM file_blobs WHERE key = ?', key);
        db.run('UPDATE file_chunks SET key = ? WHERE key = ?', key, partKey(key));
        db.run('UPDATE file_blobs SET key = ?, complete = 1, updated_at = ? WHERE key = ?', key, Date.now(), partKey(key));
      });
    },
    async abortUpload(upload) {
      drop(partKey(upload.storage_key));
    },
    async putObject(key, buf) {
      db.tx(() => {
        drop(key);
        writeAt(key, 0, Buffer.from(buf));
        db.run('UPDATE file_blobs SET complete = 1 WHERE key = ?', key);
      });
    },
    async size(key) {
      return db.get('SELECT size FROM file_blobs WHERE key = ? AND complete = 1', key)?.size ?? null;
    },
    async stream(key, range) {
      const size = await this.size(key);
      if (size == null) return null;
      const start = range ? range.start : 0;
      const end = range ? Math.min(range.end, size - 1) : size - 1;
      async function* chunks() {
        for (let n = Math.floor(start / CHUNK); n * CHUNK <= end; n++) {
          const row = db.get('SELECT data FROM file_chunks WHERE key = ? AND n = ?', key, n);
          if (!row) throw new Error('bloque faltante');
          const buf = toBuf(row.data);
          const from = Math.max(0, start - n * CHUNK);
          const to = Math.min(buf.length, end - n * CHUNK + 1);
          yield buf.subarray(from, to);
        }
      }
      return { body: Readable.from(chunks()), size };
    },
    signedUrl: () => null,
    async remove(key) {
      drop(key);
      drop(partKey(key));
    },
  };
}

// ───────────── Local ─────────────
function localStorage(root) {
  mkdirSync(root, { recursive: true });
  const path = (key) => {
    const p = normalize(join(root, key));
    if (!p.startsWith(root)) throw new Error('clave inválida');
    return p;
  };
  const tmp = (key) => path(key) + '.part';
  return {
    driver: 'local',
    async createUpload(key) {
      mkdirSync(dirname(path(key)), { recursive: true });
      closeSync(openSync(tmp(key), 'w'));
      return { providerUploadId: null };
    },
    async putPart(upload, index, buf) {
      const fd = openSync(tmp(upload.storage_key), 'r+');
      try { writeSync(fd, buf, 0, buf.length, index * PART_SIZE); } finally { closeSync(fd); }
      return { n: index + 1 };
    },
    async completeUpload(upload) {
      renameSync(tmp(upload.storage_key), path(upload.storage_key));
    },
    async abortUpload(upload) {
      rmSync(tmp(upload.storage_key), { force: true });
    },
    async putObject(key, buf) {
      mkdirSync(dirname(path(key)), { recursive: true });
      await new Promise((ok, ko) => createWriteStream(path(key)).on('error', ko).end(buf, ok));
    },
    async size(key) {
      return existsSync(path(key)) ? statSync(path(key)).size : null;
    },
    async stream(key, range) {
      const p = path(key);
      if (!existsSync(p)) return null;
      const size = statSync(p).size;
      const opts = range ? { start: range.start, end: range.end } : {};
      return { body: createReadStream(p, opts), size };
    },
    signedUrl: () => null, // el servidor entrega el archivo directamente
    async remove(key) {
      rmSync(path(key), { force: true });
      rmSync(tmp(key), { force: true });
    },
  };
}

// ───────────── S3 compatible ─────────────
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

function s3Storage(env) {
  const endpoint = new URL(env.S3_ENDPOINT); // p. ej. https://<cuenta>.r2.cloudflarestorage.com
  const bucket = env.S3_BUCKET;
  const region = env.S3_REGION || 'auto';
  const accessKey = env.S3_ACCESS_KEY_ID;
  const secretKey = env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKey || !secretKey) throw new Error('Faltan S3_BUCKET, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY.');

  const objectPath = (key) => `/${enc(bucket)}/${key.split('/').map(enc).join('/')}`;
  const signingKey = (date) => hmac(hmac(hmac(hmac('AWS4' + secretKey, date), region), 's3'), 'aws4_request');
  const stamp = () => {
    const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    return { amz, date: amz.slice(0, 8) };
  };
  const canonicalQuery = (q) => Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join('&');

  async function request(method, key, { query = {}, body = null, headers = {} } = {}) {
    const { amz, date } = stamp();
    const payloadHash = body ? sha256(body) : sha256('');
    const h = { host: endpoint.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amz, ...headers };
    const names = Object.keys(h).map((k) => k.toLowerCase()).sort();
    const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
    const canonical = [method, objectPath(key), canonicalQuery(query), names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
    const scope = `${date}/${region}/s3/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
    const signature = hmac(signingKey(date), toSign).toString('hex');
    const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
    const qs = canonicalQuery(query);
    const res = await fetch(`${endpoint.origin}${objectPath(key)}${qs ? '?' + qs : ''}`, {
      method,
      headers: { ...h, authorization: auth },
      body,
    });
    return res;
  }

  function presign(key, expiresSec, extraQuery = {}) {
    const { amz, date } = stamp();
    const scope = `${date}/${region}/s3/aws4_request`;
    const query = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${scope}`,
      'X-Amz-Date': amz,
      'X-Amz-Expires': String(Math.max(1, Math.min(604800, Math.floor(expiresSec)))),
      'X-Amz-SignedHeaders': 'host',
      ...extraQuery,
    };
    const canonical = ['GET', objectPath(key), canonicalQuery(query), `host:${endpoint.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
    const signature = hmac(signingKey(date), toSign).toString('hex');
    return `${endpoint.origin}${objectPath(key)}?${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
  }

  const fail = async (res, what) => { throw new Error(`S3 ${what}: ${res.status} ${(await res.text()).slice(0, 200)}`); };

  return {
    driver: 's3',
    async createUpload(key) {
      const res = await request('POST', key, { query: { uploads: '' } });
      if (!res.ok) await fail(res, 'CreateMultipartUpload');
      const id = (await res.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
      if (!id) throw new Error('S3 sin UploadId');
      return { providerUploadId: id };
    },
    async putPart(upload, index, buf) {
      const res = await request('PUT', upload.storage_key, { query: { partNumber: String(index + 1), uploadId: upload.provider_upload_id }, body: buf });
      if (!res.ok) await fail(res, 'UploadPart');
      return { n: index + 1, etag: res.headers.get('etag') };
    },
    async completeUpload(upload, parts) {
      const xml = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
      const res = await request('POST', upload.storage_key, { query: { uploadId: upload.provider_upload_id }, body: Buffer.from(xml) });
      if (!res.ok) await fail(res, 'CompleteMultipartUpload');
    },
    async abortUpload(upload) {
      if (upload.provider_upload_id) await request('DELETE', upload.storage_key, { query: { uploadId: upload.provider_upload_id } });
    },
    async putObject(key, buf, mime = 'application/octet-stream') {
      const res = await request('PUT', key, { body: buf, headers: { 'content-type': mime } });
      if (!res.ok) await fail(res, 'PutObject');
    },
    async size(key) {
      const res = await request('HEAD', key);
      return res.ok ? Number(res.headers.get('content-length')) : null;
    },
    async stream(key, range) {
      const res = await request('GET', key, range ? { headers: { range: `bytes=${range.start}-${range.end}` } } : {});
      if (!res.ok) return null;
      const total = Number((res.headers.get('content-range') || '').split('/')[1]) || Number(res.headers.get('content-length'));
      return { body: Readable.fromWeb(res.body), size: total };
    },
    signedUrl(key, { expiresSec = 600, filename, inline = false } = {}) {
      const extra = filename ? { 'response-content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/"/g, '')}"` } : {};
      return presign(key, expiresSec, extra);
    },
    async remove(key) {
      await request('DELETE', key);
    },
  };
}
