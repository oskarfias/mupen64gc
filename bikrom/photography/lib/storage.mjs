// Almacenamiento privado de archivos.
// - local: disco del servidor (demostración o servidor con disco persistente).
// - s3: compatible con S3 (Cloudflare R2, Backblaze B2, AWS). Firma SigV4 sin dependencias.
// Los archivos nunca son públicos: se entregan a través del servidor o con URL firmadas de corta vida.
import { createReadStream, createWriteStream, mkdirSync, statSync, existsSync, rmSync, openSync, writeSync, closeSync, renameSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';

export const PART_SIZE = 8 * 1024 * 1024; // 8 MB (S3 exige ≥ 5 MB salvo la última parte)

export function createStorage(env, dataDir) {
  if (env.STORAGE_DRIVER === 's3') return s3Storage(env);
  return localStorage(join(dataDir, 'files'));
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
