// Manejadores de tareas programadas.
import { sendTemplate } from './mail.mjs';
import { bookingVars, expireHold } from './booking.mjs';
import { syncBookingEvent } from './calendar.mjs';
import { releaseGallery, expireGallery, purgeGallery, deliveryCheck } from './gallery.mjs';
import { cleanupOrderFiles } from './shop.mjs';
import { mxn } from '../lib/money.mjs';
import { formatDateTime } from '../lib/time.mjs';
import { t } from '../i18n.mjs';
import { schedule } from './jobs.mjs';

const BOOKING_MAILS = ['hold_received', 'booking_confirmed', 'hold_expired', 'booking_conflict', 'payment_received', 'prep_recommendations', 'poses', 'logistics'];
// Recomendaciones y poses solo se envían si existe una plantilla específica para ese servicio
const SPECIFIC_ONLY = ['prep_recommendations', 'poses'];

async function bookingMail(app, p) {
  const { lang, to, serviceKind, vars, booking } = bookingVars(app, p.bookingId);
  const valid = {
    hold_received: booking.status === 'held',
    booking_confirmed: booking.status === 'confirmed',
    hold_expired: booking.status === 'expired',
    booking_conflict: booking.status === 'conflict',
    payment_received: true,
    prep_recommendations: booking.status === 'confirmed' && booking.start_at === p.startAt,
    poses: booking.status === 'confirmed' && booking.start_at === p.startAt,
    logistics: booking.status === 'confirmed' && booking.start_at === p.startAt,
  }[p.kind];
  if (!valid) return;
  if (p.kind === 'hold_expired') {
    const q = app.db.get('SELECT token FROM quotes WHERE id = ?', booking.quote_id);
    vars.enlace = app.url(`${lang === 'en' ? '/en' : ''}/cotizacion/${q.token}`);
  }
  await sendTemplate(app, {
    key: p.kind, lang, serviceKind, to, vars, specificOnly: SPECIFIC_ONLY.includes(p.kind),
    dedupeKey: `mail:${p.kind}:${p.bookingId}:${p.startAt || p.paymentId || ''}`,
  });
}

async function orderMail(app, p) {
  const o = app.db.get('SELECT * FROM orders WHERE id = ?', p.orderId);
  if (!o) return;
  const s = t(o.lang).status;
  await sendTemplate(app, {
    key: p.kind, lang: o.lang, to: o.email,
    dedupeKey: `mail:${p.kind}:${o.id}:${p.status || o.shipping_cents || ''}`,
    vars: {
      nombre: o.customer_name.split(' ')[0], pedido: o.token.slice(0, 8).toUpperCase(), total: mxn(o.total_cents), envio: mxn(o.shipping_cents),
      estado: s[p.status || o.status] || o.status, rastreo: o.tracking ? `\n\n${o.lang === 'en' ? 'Tracking' : 'Rastreo'}: ${o.carrier || ''} ${o.tracking}` : '',
      enlace: app.url(`${o.lang === 'en' ? '/en' : ''}/pedido/${o.token}`),
    },
  });
}

export const handlers = {
  async email(app, p) {
    if (BOOKING_MAILS.includes(p.kind)) return bookingMail(app, p);
    if (p.kind.startsWith('order_')) return orderMail(app, p);
    if (p.kind === 'quote_ready') {
      const q = app.db.get('SELECT q.*, c.name, c.email, s.name_es, s.name_en FROM quotes q JOIN customers c ON c.id = q.customer_id JOIN services s ON s.id = q.service_id WHERE q.id = ?', p.quoteId);
      if (!q || q.status !== 'ready' || q.revision !== p.revision) return;
      await sendTemplate(app, {
        key: 'quote_ready', lang: q.lang, to: q.email, dedupeKey: `mail:quote_ready:${q.id}:${q.revision}`,
        vars: { nombre: q.name.split(' ')[0], servicio: q.lang === 'en' ? q.name_en : q.name_es, total: mxn(q.total_cents), anticipo: mxn(q.deposit_cents), enlace: app.url(`${q.lang === 'en' ? '/en' : ''}/cotizacion/${q.token}`) },
      });
    }
  },
  hold_expire: async (app, p) => { expireHold(app, p.bookingId); },
  calendar_sync: (app, p) => syncBookingEvent(app, p.bookingId),
  gallery_release: (app, p) => releaseGallery(app, p.galleryId, p.releaseAt),
  async gallery_reminder(app, p) {
    const g = app.db.get('SELECT * FROM galleries WHERE id = ?', p.galleryId);
    if (!g || g.status !== 'released' || g.expires_at !== p.expires) return;
    const r = app.db.get('SELECT c.name, c.email FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.id = ?', g.booking_id);
    if (!r) return;
    await sendTemplate(app, {
      key: 'gallery_expiry_reminder', lang: g.lang, to: r.email, dedupeKey: `mail:gallery_reminder:${g.id}:${p.expires}:${Math.round((p.expires - app.now()) / 864e5)}`,
      vars: { nombre: r.name.split(' ')[0], galeria: g.title, vence: formatDateTime(g.expires_at, g.lang), enlace: app.url(`${g.lang === 'en' ? '/en' : ''}/galeria/${g.slug}`) },
    });
  },
  gallery_expire: (app, p) => expireGallery(app, p.galleryId, p.expires),
  gallery_purge: (app, p) => purgeGallery(app, p.galleryId),
  delivery_check: (app, p) => deliveryCheck(app, p.bookingId, p.due),
  order_files_cleanup: (app, p) => cleanupOrderFiles(app, p.orderId),
  // Barrido de seguridad: vence apartados cuya tarea se perdió y cierra cargas abandonadas.
  async sweep(app) {
    for (const b of app.db.all("SELECT id FROM bookings WHERE status = 'held' AND hold_expires_at <= ?", app.now())) expireHold(app, b.id);
    const stale = app.db.all("SELECT * FROM uploads WHERE status = 'open' AND updated_at < ?", app.now() - 3 * 864e5);
    for (const u of stale) {
      await app.storage.abortUpload(u).catch(() => {});
      app.db.run("UPDATE uploads SET status = 'aborted' WHERE id = ?", u.id);
      if (u.target === 'gallery_original') app.db.run("UPDATE gallery_files SET status = 'deleted' WHERE id = ? AND status = 'uploading'", u.gallery_file_id);
    }
    schedule(app, 'sweep', app.now() + 15 * 60_000, {}, `sweep:${Math.floor(app.now() / (15 * 60_000)) + 1}`);
  },
};
