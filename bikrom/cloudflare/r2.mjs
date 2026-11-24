// Fotos de galerías en Cloudflare R2 (enlace directo del Worker, sin claves). Misma interfaz que photography/lib/storage.mjs.
// Se activa si el Worker tiene el enlace PHOTOS (wrangler.jsonc → r2_buckets).
import { Readable } from 'node:stream';

export function r2Storage(bucket) {
  return {
    driver: 'r2',
    async createUpload(key) {
      const u = await bucket.createMultipartUpload(key);
      return { providerUploadId: u.uploadId };
    },
    async putPart(upload, index, buf) {
      const u = bucket.resumeMultipartUpload(upload.storage_key, upload.provider_upload_id);
      const part = await u.uploadPart(index + 1, buf);
      return { n: part.partNumber, etag: part.etag };
    },
    async completeUpload(upload, parts) {
      const u = bucket.resumeMultipartUpload(upload.storage_key, upload.provider_upload_id);
      await u.complete(parts.map((p) => ({ partNumber: p.n, etag: p.etag })));
    },
    async abortUpload(upload) {
      if (!upload.provider_upload_id) return;
      try { await bucket.resumeMultipartUpload(upload.storage_key, upload.provider_upload_id).abort(); } catch {}
    },
    async putObject(key, buf, mime = 'application/octet-stream') {
      await bucket.put(key, buf, { httpMetadata: { contentType: mime } });
    },
    async size(key) {
      return (await bucket.head(key))?.size ?? null;
    },
    async stream(key, range) {
      const obj = await bucket.get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : {});
      if (!obj) return null;
      return { body: Readable.fromWeb(obj.body), size: obj.size };
    },
    signedUrl: () => null, // se entregan a través del Worker (acceso privado verificado)
    async remove(key) {
      await bucket.delete(key);
    },
  };
}
