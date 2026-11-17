// Galerías privadas: creación, cargas reanudables, publicación, acceso por código, vigencia y borrado.
import { crc32 } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { token, newAccessCode, parseAccessCode, hashSecret, verifySecret } from '../lib/security.mjs';
import { PART_SIZE } from '../lib/storage.mjs';
import { DAY, formatDateTime } from '../lib/time.mjs';
import { bookingBalance } from './booking.mjs';
import { schedule, cancelJobs } from './jobs.mjs';
import { sendTemplate, alertAdmin } from './mail.mjs';

const err = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const GB = 1024 ** 3;

export function createGallery(app, { bookingId = null, title, message = '', audience = 'client', lang = 'es', withoutBookingConfirmed = false, isDemo = 0 }) {
  if (!bookingId && !withoutBookingConfirmed) throw new Error('Asocia la galería a una reserva o confirma que es una galería sin reserva.');
  const now = app.now();
  const slug = randomBytes(12).toString('base64url'); // no secuencial ni adivinable
  const id = Number(app.db.run(
    `INSERT INTO galleries (slug, booking_id, audience, title, message, lang, status, without_booking_confirmed, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    slug, bookingId, audience, title, message, lang, withoutBookingConfirmed ? 1 : 0, isDemo, now, now
  ).lastInsertRowid);
  app.log('admin', 'galeria_creada', { entity: 'gallery', id, details: title });
  return id;
}

// ───────────── Almacenamiento ─────────────
export function storageUsage(app) {
  const g = app.db.get(`SELECT COALESCE(SUM(COALESCE(original_size,0) + COALESCE(preview_size,0) + COALESCE(thumb_size,0)), 0) AS used
    FROM gallery_files WHERE status != 'deleted'`).used;
  const pending = app.db.get("SELECT COALESCE(SUM(size), 0) AS s FROM uploads WHERE status = 'open'").s;
  const quota = (app.setting('storage').quota_gb || 15) * GB;
  return { used: g, reserved: pending, quota, free: Math.max(0, quota - g - pending), percent: quota ? Math.round(((g + pending) / quota) * 100) : 0 };
}

export function galleryUsage(app, galleryId) {
  return app.db.get(`SELECT COUNT(*) AS files, COALESCE(SUM(COALESCE(original_size,0)),0) AS originals,
    COALESCE(SUM(COALESCE(preview_size,0) + COALESCE(thumb_size,0)),0) AS derived FROM gallery_files WHERE gallery_id = ? AND status != 'deleted'`, galleryId);
}

// ───────────── Cargas reanudables ─────────────
// Inicia la carga de un original. Las vistas previas (preview/thumb) se generan en el navegador y se suben aparte.
export async function startFileUpload(app, galleryId, { filename, size, mime, width = null, height = null }) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g || ['expired', 'deleted'].includes(g.status)) throw err('gallery_unavailable');
  size = Number(size);
  if (!Number.isFinite(size) || size <= 0) throw err('invalid_size');
  const usage = storageUsage(app);
  if (size > usage.free) throw err('quota_exceeded', { usage });
  const kind = String(mime || '').startsWith('video/') ? 'video' : 'photo';
  const now = app.now();
  const sort = (app.db.get('SELECT COALESCE(MAX(sort), 0) AS m FROM gallery_files WHERE gallery_id = ?', galleryId).m || 0) + 1;
  const fileId = Number(app.db.run(
    `INSERT INTO gallery_files (gallery_id, kind, filename, mime, width, height, status, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, 'uploading', ?, ?)`,
    galleryId, kind, String(filename).slice(0, 200), mime || null, width, height, sort, now
  ).lastInsertRowid);
  const upload = await openUpload(app, { target: 'gallery_original', fileId, key: `galleries/${g.slug}/originals/${fileId}-${token(6)}`, size });
  return { fileId, uploadId: upload.id, partSize: PART_SIZE, warning: usage.percent >= (app.setting('storage').warn_percent?.[0] ?? 80) ? 'storage_high' : null };
}

export async function startDerivedUpload(app, fileId, variant, size) {
  const f = app.db.get('SELECT f.*, g.slug FROM gallery_files f JOIN galleries g ON g.id = f.gallery_id WHERE f.id = ?', fileId);
  if (!f || !['preview', 'thumb'].includes(variant)) throw err('invalid');
  return openUpload(app, { target: `gallery_${variant}`, fileId, key: `galleries/${f.slug}/${variant}s/${fileId}-${token(6)}.jpg`, size: Number(size) });
}

async function openUpload(app, { target, fileId = null, mediaId = null, key, size }) {
  const id = token(16);
  const { providerUploadId } = await app.storage.createUpload(key);
  const now = app.now();
  app.db.run(`INSERT INTO uploads (id, target, gallery_file_id, media_id, storage_key, size, provider_upload_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`, id, target, fileId, mediaId, key, size, providerUploadId, now, now);
  return { id, partSize: PART_SIZE };
}

export async function startMediaUpload(app, mediaId, { size, mime }) {
  const ext = (String(mime).split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5);
  return openUpload(app, { target: 'media', mediaId, key: `media/${mediaId}-${token(6)}.${ext}`, size: Number(size) });
}

export const uploadStatus = (app, id) => app.db.get('SELECT id, size, received, next_part, status FROM uploads WHERE id = ?', id);

// Recibe una parte. Deben llegar en orden; si se interrumpe, el cliente consulta next_part y reanuda.
export async function putUploadPart(app, id, index, buf) {
  const u = app.db.get('SELECT * FROM uploads WHERE id = ?', id);
  if (!u || u.status !== 'open') throw err('upload_closed');
  if (index < u.next_part) return { next_part: u.next_part, received: u.received }; // parte repetida: ya estaba
  if (index !== u.next_part) throw err('out_of_order', { next_part: u.next_part });
  const isLast = u.received + buf.length >= u.size;
  if (!isLast && buf.length !== PART_SIZE) throw err('bad_part_size');
  if (u.received + buf.length > u.size) throw err('too_large');
  const part = await app.storage.putPart(u, index, buf);
  const parts = JSON.parse(u.parts);
  parts.push(part);
  app.db.run('UPDATE uploads SET received = received + ?, next_part = next_part + 1, crc32 = ?, parts = ?, updated_at = ? WHERE id = ?',
    buf.length, crc32(buf, u.crc32), JSON.stringify(parts), app.now(), id);
  return { next_part: index + 1, received: u.received + buf.length };
}

export async function completeUpload(app, id) {
  const u = app.db.get('SELECT * FROM uploads WHERE id = ?', id);
  if (!u) throw err('not_found');
  if (u.status === 'done') return u;
  if (u.received !== u.size) throw err('incomplete', { received: u.received, size: u.size });
  await app.storage.completeUpload(u, JSON.parse(u.parts));
  app.db.tx(() => {
    app.db.run("UPDATE uploads SET status = 'done', updated_at = ? WHERE id = ?", app.now(), id);
    if (u.target === 'gallery_original') {
      app.db.run("UPDATE gallery_files SET original_key = ?, original_size = ?, original_crc32 = ?, status = 'ready' WHERE id = ?", u.storage_key, u.size, u.crc32 >>> 0, u.gallery_file_id);
    } else if (u.target === 'gallery_preview') {
      app.db.run('UPDATE gallery_files SET preview_key = ?, preview_size = ? WHERE id = ?', u.storage_key, u.size, u.gallery_file_id);
    } else if (u.target === 'gallery_thumb') {
      app.db.run('UPDATE gallery_files SET thumb_key = ?, thumb_size = ? WHERE id = ?', u.storage_key, u.size, u.gallery_file_id);
    } else if (u.target === 'media') {
      app.db.run('UPDATE media SET storage_key = ?, is_demo = 0 WHERE id = ?', u.storage_key, u.media_id);
    }
  });
  const usage = storageUsage(app);
  const warn = app.setting('storage').warn_percent || [80, 95];
  for (const p of warn) if (usage.percent >= p) await alertAdmin(app, `Almacenamiento al ${usage.percent}%`, 'Libera espacio eliminando galerías vencidas o amplía la capacidad.', { dedupeKey: `alert:storage:${p}:${new Date(app.now()).toISOString().slice(0, 10)}` });
  return u;
}

export async function deleteFile(app, fileId, { keepForOrders = true } = {}) {
  const f = app.db.get('SELECT * FROM gallery_files WHERE id = ?', fileId);
  if (!f || f.status === 'deleted') return;
  if (keepForOrders && fileInActiveOrder(app, f.id)) {
    // Solo se conserva el original necesario para producir el pedido
    for (const k of [f.preview_key, f.thumb_key]) if (k) await app.storage.remove(k).catch(() => {});
    app.db.run('UPDATE gallery_files SET retained_for_orders = 1, preview_key = NULL, preview_size = 0, thumb_key = NULL, thumb_size = 0 WHERE id = ?', f.id);
    return 'retained';
  }
  for (const k of [f.original_key, f.preview_key, f.thumb_key]) if (k) await app.storage.remove(k).catch(() => {});
  app.db.run("UPDATE gallery_files SET status = 'deleted', original_key = NULL, preview_key = NULL, thumb_key = NULL, original_size = 0, preview_size = 0, thumb_size = 0, retained_for_orders = 0 WHERE id = ?", f.id);
  return 'deleted';
}

export function fileInActiveOrder(app, fileId) {
  const orders = app.db.all(`SELECT oi.photos FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('paid','design_review','in_production','shipped')`);
  return orders.some((r) => JSON.parse(r.photos).some((p) => p.file_id === fileId));
}

// ───────────── Publicación ─────────────
// Revisa el saldo. Si falta registrar efectivo, debe registrarse explícitamente antes de liberar.
export function publishCheck(app, galleryId) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g) throw err('not_found');
  const ready = app.db.get("SELECT COUNT(*) AS n FROM gallery_files WHERE gallery_id = ? AND status = 'ready'", galleryId).n;
  const uploading = app.db.get("SELECT COUNT(*) AS n FROM gallery_files WHERE gallery_id = ? AND status = 'uploading'", galleryId).n;
  let balance = null;
  if (g.booking_id) {
    const b = app.db.get('SELECT * FROM bookings WHERE id = ?', g.booking_id);
    balance = bookingBalance(app, b);
  }
  return { gallery: g, files: ready, uploading, outstanding: balance ? balance.outstanding : 0, balance };
}

export function publishGallery(app, galleryId, { releaseAt = null } = {}) {
  const check = publishCheck(app, galleryId);
  const g = check.gallery;
  if (!['draft', 'scheduled'].includes(g.status)) throw err('invalid_status');
  if (check.files === 0) throw err('empty_gallery');
  if (check.uploading > 0) throw err('uploads_in_progress');
  if (check.outstanding > 0) throw err('balance_due', { outstanding: check.outstanding });
  const now = app.now();
  const when = releaseAt && releaseAt > now ? releaseAt : now;
  app.db.run("UPDATE galleries SET status = 'scheduled', release_at = ?, updated_at = ? WHERE id = ?", when, now, galleryId);
  schedule(app, 'gallery_release', when, { galleryId, releaseAt: when }, `gallery_release:${galleryId}:${when}`);
  app.log('admin', when > now ? 'galeria_programada' : 'galeria_publicada', { entity: 'gallery', id: galleryId, details: formatDateTime(when) });
  return when;
}

// Liberación efectiva: fija vigencia de 3 semanas y envía el acceso (solo si hay archivos listos).
export async function releaseGallery(app, galleryId, releaseAt) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g || g.status !== 'scheduled' || g.release_at !== releaseAt) return 'skipped';
  const files = app.db.get("SELECT COUNT(*) AS n FROM gallery_files WHERE gallery_id = ? AND status = 'ready'", galleryId).n;
  if (!files) {
    app.db.run("UPDATE galleries SET status = 'draft', updated_at = ? WHERE id = ?", app.now(), galleryId);
    await alertAdmin(app, 'Galería sin archivos', `«${g.title}» no se liberó porque no tiene archivos listos.`);
    return 'empty';
  }
  if (g.booking_id && publishCheck(app, galleryId).outstanding > 0) {
    app.db.run("UPDATE galleries SET status = 'draft', updated_at = ? WHERE id = ?", app.now(), galleryId);
    await alertAdmin(app, 'Galería no liberada: saldo pendiente', `«${g.title}» tiene saldo pendiente; regístralo para publicarla.`);
    return 'balance_due';
  }
  const now = app.now();
  const expires = now + (app.setting('gallery').validity_days || 21) * DAY;
  app.db.run("UPDATE galleries SET status = 'released', released_at = ?, expires_at = ?, updated_at = ? WHERE id = ?", now, expires, now, galleryId);
  scheduleExpiryJobs(app, galleryId, expires);
  app.log('sistema', 'galeria_liberada', { entity: 'gallery', id: galleryId, details: `vence ${formatDateTime(expires)}` });
  await sendDeliveryEmail(app, galleryId);
  return 'released';
}

function scheduleExpiryJobs(app, galleryId, expires) {
  for (const days of app.setting('gallery').reminder_days_before || [7, 2]) {
    const at = expires - days * DAY;
    if (at > app.now()) schedule(app, 'gallery_reminder', at, { galleryId, expires }, `gallery_reminder:${galleryId}:${expires}:${days}`);
  }
  schedule(app, 'gallery_expire', expires, { galleryId, expires }, `gallery_expire:${galleryId}:${expires}`);
}

// Correo de entrega: genera un código nuevo para el correo (solo se guarda su hash).
export async function sendDeliveryEmail(app, galleryId) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g || g.status !== 'released' || g.expires_at <= app.now()) return 'not_released';
  const files = app.db.get("SELECT COUNT(*) AS n FROM gallery_files WHERE gallery_id = ? AND status = 'ready'", galleryId).n;
  if (!files) return 'empty';
  const recipient = galleryRecipient(app, g);
  if (!recipient) {
    await alertAdmin(app, 'Galería liberada sin destinatario', `«${g.title}» no tiene correo de cliente; comparte el acceso manualmente.`);
    return 'no_recipient';
  }
  if (app.db.get("SELECT 1 FROM email_log WHERE dedupe_key = ? AND status IN ('sent','not_sent_demo')", `mail:gallery_delivery:${g.id}:${g.released_at}`)) return 'duplicate';
  const { code } = createAccess(app, g.id, 'Correo de entrega');
  const res = await sendTemplate(app, {
    key: 'gallery_delivery', lang: g.lang, to: recipient.email, dedupeKey: `mail:gallery_delivery:${g.id}:${g.released_at}`,
    vars: { nombre: recipient.name.split(' ')[0], galeria: g.title, enlace: app.url(`${g.lang === 'en' ? '/en' : ''}/galeria/${g.slug}`), codigo: code, vence: formatDateTime(g.expires_at, g.lang) },
  });
  return res.status;
}

export function galleryRecipient(app, g) {
  if (!g.booking_id) return null;
  return app.db.get('SELECT c.name, c.email FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.id = ?', g.booking_id);
}

export function extendGallery(app, galleryId, newExpires) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g || g.status !== 'released') throw new Error('Solo se amplían galerías publicadas y vigentes.');
  if (g.expires_at <= app.now()) throw new Error('La galería ya venció.');
  if (newExpires <= g.expires_at) throw new Error('La nueva fecha debe ser posterior a la actual.');
  app.db.run('UPDATE galleries SET expires_at = ?, updated_at = ? WHERE id = ?', newExpires, app.now(), galleryId);
  cancelJobs(app, `gallery_reminder:${galleryId}:%`);
  cancelJobs(app, `gallery_expire:${galleryId}:%`);
  scheduleExpiryJobs(app, galleryId, newExpires);
  app.log('admin', 'galeria_ampliada', { entity: 'gallery', id: galleryId, details: formatDateTime(newExpires) });
}

// Al vencer: se revocan accesos (por estado) y se programa el borrado de archivos.
export async function expireGallery(app, galleryId, expires) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g || g.status !== 'released' || g.expires_at !== expires || expires > app.now()) return 'skipped';
  app.db.run("UPDATE galleries SET status = 'expired', updated_at = ? WHERE id = ?", app.now(), galleryId);
  app.db.run('UPDATE gallery_access SET revoked_at = COALESCE(revoked_at, ?) WHERE gallery_id = ?', app.now(), galleryId);
  const rule = app.setting('gallery').auto_delete || {};
  if (rule.enabled) schedule(app, 'gallery_purge', app.now() + (rule.grace_days || 0) * DAY, { galleryId }, `gallery_purge:${galleryId}:${expires}`);
  app.log('sistema', 'galeria_vencida', { entity: 'gallery', id: galleryId });
  return 'expired';
}

// Borra los archivos; conserva solo originales usados por pedidos pagados en curso.
export async function purgeGallery(app, galleryId, { force = false } = {}) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  if (!g) return;
  if (!force && g.status !== 'expired') return 'skipped';
  const files = app.db.all("SELECT id FROM gallery_files WHERE gallery_id = ? AND status != 'deleted'", galleryId);
  let retained = 0;
  for (const f of files) if ((await deleteFile(app, f.id)) === 'retained') retained++;
  app.db.run('UPDATE galleries SET status = ?, files_deleted_at = ?, updated_at = ? WHERE id = ?', force ? 'deleted' : g.status, app.now(), app.now(), galleryId);
  if (force) app.db.run('UPDATE gallery_access SET revoked_at = COALESCE(revoked_at, ?) WHERE gallery_id = ?', app.now(), galleryId);
  app.log('sistema', 'archivos_eliminados', { entity: 'gallery', id: galleryId, details: retained ? `${retained} original(es) conservado(s) para pedidos en curso` : null });
  return retained;
}

// ───────────── Acceso ─────────────
export function createAccess(app, galleryId, label = null) {
  const { lookup, secret, code } = newAccessCode();
  app.db.run('INSERT INTO gallery_access (gallery_id, lookup, secret_hash, label, created_at) VALUES (?, ?, ?, ?, ?)', galleryId, lookup, hashSecret(secret), label, app.now());
  app.log('admin', 'acceso_generado', { entity: 'gallery', id: galleryId, details: label });
  return { code };
}

export function revokeAccess(app, accessId) {
  app.db.run('UPDATE gallery_access SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', app.now(), accessId);
  app.log('admin', 'acceso_revocado', { entity: 'gallery_access', id: accessId });
}

export const isLive = (app, g) => g && g.status === 'released' && g.expires_at > app.now();

// Valida un código. Si se indica la galería (enlace directo), el código debe pertenecer a esa galería.
export function verifyCode(app, input, gallerySlug = null) {
  const parsed = parseAccessCode(input);
  if (!parsed) return null;
  const a = app.db.get('SELECT * FROM gallery_access WHERE lookup = ?', parsed.lookup);
  // Un código válido de una galería vencida o eliminada se reconoce para mostrar el aviso correcto (sin dar acceso)
  if (a?.revoked_at && verifySecret(parsed.secret, a.secret_hash)) {
    const gone = app.db.get('SELECT * FROM galleries WHERE id = ?', a.gallery_id);
    return ['expired', 'deleted'].includes(gone?.status) && (!gallerySlug || gone.slug === gallerySlug) ? { gallery: gone, access: a, live: false } : null;
  }
  if (!a || a.revoked_at) {
    verifySecret(parsed.secret, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'); // tiempo constante
    return null;
  }
  if (!verifySecret(parsed.secret, a.secret_hash)) return null;
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', a.gallery_id);
  if (gallerySlug && g.slug !== gallerySlug) return null;
  if (!isLive(app, g)) return { gallery: g, access: a, live: false };
  app.db.run('UPDATE gallery_access SET last_used_at = ? WHERE id = ?', app.now(), a.id);
  return { gallery: g, access: a, live: true };
}

// Comprueba en cada solicitud que el acceso siga vigente (sesión firmada con galería + acceso).
export function sessionValid(app, galleryId, accessId) {
  const a = app.db.get('SELECT * FROM gallery_access WHERE id = ? AND gallery_id = ?', accessId, galleryId);
  if (!a || a.revoked_at) return null;
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', galleryId);
  return isLive(app, g) ? g : null;
}

export const galleryFiles = (app, galleryId) =>
  app.db.all("SELECT * FROM gallery_files WHERE gallery_id = ? AND status = 'ready' ORDER BY sort, id", galleryId);

// Aviso a Fani si la entrega se acerca y no ha publicado
export async function deliveryCheck(app, bookingId, due) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  if (!b || b.status !== 'confirmed' || b.delivery_due_date !== due) return;
  const published = app.db.get("SELECT 1 FROM galleries WHERE booking_id = ? AND status IN ('scheduled','released','expired')", bookingId);
  if (published) return;
  await alertAdmin(app, 'Entrega próxima sin publicar', `La reserva ${b.token.slice(0, 6)} tiene entrega prevista el ${due} y aún no tiene galería publicada.`, { dedupeKey: `alert:delivery:${bookingId}:${due}` });
}
