// Estefanía Torres Fotografía — enrutador. Se monta en /photography dentro del servidor de Bikrom
// o se ejecuta solo con photography/server.mjs.
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { t } from './i18n.mjs';
import { json as jparse } from './db.mjs';
import { html, json, redirect, send, readBody, readForm, parseCookies, signedCookie, readSignedCookie, cookie, clientIp, limited, str, isEmail, SECURITY_HEADERS } from './lib/http.mjs';
import { zonedToUtc, isDate, isTime } from './lib/time.mjs';
import { batches, uniqueNames, zipSize, writeZip } from './lib/zip.mjs';
import * as pub from './views/pages/public.mjs';
import * as bk from './views/pages/booking.mjs';
import * as gv from './views/pages/gallery.mjs';
import { createQuote, acceptQuote } from './domain/quote.mjs';
import { slotsFor, holdSlot } from './domain/booking.mjs';
import { startPayment, confirmPayment, demoPending, demoConfirm } from './domain/payments.mjs';
import { verifyCode, sessionValid, galleryFiles } from './domain/gallery.mjs';
import { createOrder } from './domain/shop.mjs';
import { runDue, startWorker, schedule } from './domain/jobs.mjs';
import { handlers } from './domain/handlers.mjs';
import { adminRoutes, isAdminRequest } from './views/admin/routes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = join(here, 'public');
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };

export function createPhotography(options = {}) {
  const app = createApp(options);
  if (options.worker !== false) {
    startWorker(app, handlers);
    schedule(app, 'sweep', app.now(), {}, `sweep:${Math.floor(app.now() / 900_000)}`);
  }
  const handle = (req, res) => route(app, req, res).catch((e) => {
    app.log('sistema', 'error_http', { details: `${req.method} ${req.url}: ${e.message}`, level: 'error' });
    if (!res.headersSent) {
      if ((req.headers.accept || '').includes('application/json') || req.url.includes('/api/')) json(res, e.status || 500, { error: t('es').common.error });
      else html(res, `<p>${t('es').common.error}</p>`, { status: e.status || 500 });
    }
  });
  return { app, handle, runJobs: () => runDue(app, handlers) };
}

const langOf = (path) => (path === '/en' || path.startsWith('/en/') ? 'en' : 'es');
const stripLang = (path) => (langOf(path) === 'en' ? path.slice(3) || '/' : path);

async function route(app, req, res) {
  const url = new URL(req.url, 'http://localhost');
  let path = url.pathname.slice(app.base.length) || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  const method = req.method;

  // Archivos estáticos, imágenes del sitio y archivos de galería
  if (path.startsWith('/static/')) return serveStatic(res, path.slice(8));
  if (path.startsWith('/m/')) return serveMedia(app, req, res, Number(path.slice(3)));
  if (path.startsWith('/g/')) return serveGalleryAsset(app, req, res, path);
  if (path.startsWith('/admin')) return adminRoutes(app, req, res, path, url);
  if (path === '/api/webhooks/stripe' && method === 'POST') return stripeWebhook(app, req, res);
  if (path === '/api/webhooks/paypal' && method === 'POST') return paypalWebhook(app, req, res);
  if (path === '/api/cron') return cron(app, req, res, url);
  if (path === '/sitemap.xml') return sitemap(app, res);
  if (path === '/robots.txt') return send(res, 200, `User-agent: *\nDisallow: ${app.base}/galeria/\nDisallow: ${app.base}/g/\nDisallow: ${app.base}/cotizacion/\nDisallow: ${app.base}/reserva/\nDisallow: ${app.base}/pedido/\nDisallow: ${app.base}/admin\nSitemap: ${app.siteUrl}${app.base}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });

  const lang = langOf(path);
  const p = stripLang(path);
  const tx = t(lang);
  const isAdmin = isAdminRequest(app, req);

  // Preferencia de idioma guardada: solo en la portada
  if (path === '/' && method === 'GET' && parseCookies(req).etf_lang === 'en' && !url.searchParams.has('lang')) return redirect(res, `${app.base}/en`, 302);

  if (method === 'GET') {
    const page = {
      '/': () => pub.home(app, lang),
      '/servicios': () => pub.servicesPage(app, lang),
      '/escuelas': () => pub.schoolsPage(app, lang),
      '/negocios': () => pub.businessPage(app, lang),
      '/tesoro': () => pub.tesoroPage(app, lang),
      '/sobre-mi': () => pub.aboutPage(app, lang),
      '/portafolio': () => pub.portfolioPage(app, lang, url.searchParams.get('c')),
      '/productos': () => pub.productsPage(app, lang),
      '/contacto': () => pub.contactPage(app, lang, { sent: url.searchParams.has('enviado') }),
      '/reservar': () => bk.bookingForm(app, lang, { preselect: url.searchParams.get('servicio') }),
      '/mi-sesion': () => gv.mySessionPage(app, lang),
    }[p];
    if (page) return html(res, page());
    if (p.startsWith('/politicas/')) {
      const out = pub.policyPage(app, lang, p.slice(11));
      if (out) return html(res, out);
    }
  }

  // ───── Contacto ─────
  if (p === '/contacto' && method === 'POST') {
    const f = await readForm(req, 20_000);
    if (f.website) return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}/contacto?enviado=1`);
    if (limited(`contact:${clientIp(req)}`, 5, 600_000)) return html(res, pub.contactPage(app, lang), { status: 429 });
    if (!str(f.name) || !isEmail(f.email) || !str(f.message) || f.privacy !== '1') return html(res, pub.contactPage(app, lang), { status: 400 });
    app.db.run('INSERT INTO messages (name, email, phone, message, lang, created_at) VALUES (?, ?, ?, ?, ?, ?)', str(f.name), str(f.email), str(f.phone, 40), str(f.message, 5000), lang, app.now());
    app.log('cliente', 'mensaje_contacto', { details: str(f.name) });
    return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}/contacto?enviado=1`);
  }

  // ───── Cotización ─────
  if (p === '/api/cotizar' && method === 'POST') {
    if (limited(`quote:${clientIp(req)}`, 10, 600_000)) return json(res, 429, { error: tx.common.tooMany });
    const b = await readForm(req, 50_000);
    const service = app.db.get('SELECT * FROM services WHERE slug = ? AND active = 1', str(b.service, 60));
    const customer = { name: str(b.name, 120), email: str(b.email, 160).toLowerCase(), phone: str(b.phone, 40) };
    if (!service || !customer.name || !isEmail(customer.email) || !customer.phone || b.privacy !== '1') return json(res, 400, { error: tx.forms.invalid });
    const answers = sanitizeAnswers(b.answers || {});
    if (answers.date && !isDate(answers.date)) return json(res, 400, { error: tx.forms.invalid });
    if (answers.start_time && !isTime(answers.start_time)) return json(res, 400, { error: tx.forms.invalid });
    answers.portfolio_consent = b.portfolio_consent === '1';
    const q = createQuote(app, { service, customer, answers, lang });
    return json(res, 200, { redirect: `${app.base}${lang === 'en' ? '/en' : ''}/cotizacion/${q.token}`, complete: q.complete });
  }
  let m;
  if ((m = p.match(/^\/cotizacion\/([\w-]{20,})$/)) && method === 'GET') {
    const quote = app.db.get('SELECT * FROM quotes WHERE token = ?', m[1]);
    if (!quote) return html(res, pub.notFoundPage(app, lang), { status: 404 });
    return html(res, bk.quotePage(app, lang, quote), { noindex: true });
  }
  if ((m = p.match(/^\/cotizacion\/([\w-]{20,})\/aceptar$/)) && method === 'POST') {
    const f = await readForm(req, 5_000);
    const quote = app.db.get('SELECT * FROM quotes WHERE token = ?', m[1]);
    if (!quote) return html(res, pub.notFoundPage(app, lang), { status: 404 });
    if (f.terms !== '1') return html(res, bk.quotePage(app, lang, quote, { error: tx.forms.invalid }), { status: 400, noindex: true });
    try {
      acceptQuote(app, m[1], { revision: Number(f.revision) });
    } catch (e) {
      const fresh = app.db.get('SELECT * FROM quotes WHERE token = ?', m[1]);
      return html(res, bk.quotePage(app, lang, fresh, { error: e.code === 'changed' ? tx.booking.changed : tx.common.error }), { status: 409, noindex: true });
    }
    return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}/cotizacion/${m[1]}#fecha`);
  }
  if (p === '/api/disponibilidad' && method === 'GET') {
    if (limited(`avail:${clientIp(req)}`, 60, 60_000)) return json(res, 429, { error: 'too_many' });
    const quote = app.db.get('SELECT * FROM quotes WHERE token = ?', url.searchParams.get('cotizacion') || '');
    if (!quote || quote.status !== 'accepted') return json(res, 404, { error: 'not_found' });
    const hora = url.searchParams.get('hora');
    const r = await slotsFor(app, quote, url.searchParams.get('fecha') || '', isTime(hora) ? { eventStart: hora } : {});
    // Solo se exponen horarios libres; nunca detalles del calendario
    return json(res, 200, { slots: r.slots.map((s) => ({ start: s.start, label: s.label })), error: r.error });
  }
  if (p === '/api/apartar' && method === 'POST') {
    if (limited(`hold:${clientIp(req)}`, 10, 600_000)) return json(res, 429, { error: 'too_many', message: tx.common.tooMany });
    const b = await readForm(req, 5_000);
    try {
      const h = await holdSlot(app, str(b.token, 60), Number(b.start));
      const bkk = app.db.get('SELECT token FROM bookings WHERE id = ?', h.id);
      return json(res, 200, { redirect: `${app.base}${lang === 'en' ? '/en' : ''}/reserva/${bkk.token}` });
    } catch (e) {
      return json(res, 409, { error: e.code || 'error', message: e.code === 'calendar_unavailable' ? tx.booking.calendarError : e.code === 'slot_taken' ? tx.booking.slotTaken : tx.common.error });
    }
  }
  if ((m = p.match(/^\/reserva\/([\w-]{20,})$/)) && method === 'GET') {
    const booking = app.db.get('SELECT * FROM bookings WHERE token = ?', m[1]);
    if (!booking) return html(res, pub.notFoundPage(app, lang), { status: 404 });
    return html(res, bk.bookingPage(app, lang, booking, { flash: url.searchParams.get('pago'), isAdmin }), { noindex: true });
  }

  // ───── Pagos ─────
  if (p === '/pago/iniciar' && method === 'POST') {
    if (limited(`pay:${clientIp(req)}`, 10, 600_000)) return html(res, `<p>${tx.common.tooMany}</p>`, { status: 429 });
    const f = await readForm(req, 5_000);
    const method_ = f.method === 'paypal' ? 'paypal' : 'card';
    const booking = f.booking ? app.db.get('SELECT * FROM bookings WHERE token = ?', str(f.booking, 60)) : null;
    const order = f.order ? app.db.get('SELECT * FROM orders WHERE token = ?', str(f.order, 60)) : null;
    if (!booking && !order) return html(res, pub.notFoundPage(app, lang), { status: 404 });
    const back = booking ? `/reserva/${booking.token}` : `/pedido/${order.token}`;
    try {
      const service = booking && app.db.get('SELECT s.* FROM services s JOIN quotes q ON q.service_id = s.id WHERE q.id = ?', booking.quote_id);
      const description = booking ? `${lang === 'en' ? service.name_en : service.name_es} — ${app.setting('business').name}` : `${lang === 'en' ? 'Order' : 'Pedido'} ${order.token.slice(0, 8).toUpperCase()} — ${app.setting('business').name}`;
      const target = await startPayment(app, { booking, order, method: method_, lang, description });
      return redirect(res, target, 303);
    } catch (e) {
      return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}${back}?pago=error`);
    }
  }
  if (p === '/pago/paypal/retorno' && method === 'GET') {
    const payment = app.db.get('SELECT * FROM payments WHERE token = ?', url.searchParams.get('pago') || '');
    if (!payment || payment.provider !== 'paypal') return html(res, pub.notFoundPage(app, lang), { status: 404 });
    const target = payment.booking_id ? `/reserva/${app.db.get('SELECT token FROM bookings WHERE id = ?', payment.booking_id).token}` : `/pedido/${app.db.get('SELECT token FROM orders WHERE id = ?', payment.order_id).token}`;
    // El regreso no prueba el pago: se captura servidor-a-servidor y se usa la respuesta de PayPal
    try {
      const cap = await app.paypal.captureOrder(payment.provider_ref);
      if (cap.status === 'COMPLETED' && cap.paymentToken === payment.token) {
        await confirmPayment(app, { provider: 'paypal', paymentToken: payment.token, providerPaymentRef: cap.captureId, amountCents: cap.amountCents, currency: cap.currency });
      } else {
        app.log('paypal', 'captura_no_completada', { entity: 'payment', id: payment.id, details: cap.status || cap.error, level: 'warning' });
      }
    } catch (e) {
      app.log('paypal', 'captura_fallida', { entity: 'payment', id: payment.id, details: e.message, level: 'error' });
    }
    return redirect(res, `${app.base}${target}?pago=procesando`);
  }
  if (p === '/pago/demo' && method === 'POST') {
    // Solo administración y solo en modo demostración: queda marcado como DEMO
    if (!isAdmin || !app.demo()) return html(res, pub.notFoundPage(app, lang), { status: 404 });
    const f = await readForm(req, 5_000);
    const booking = f.booking ? app.db.get('SELECT * FROM bookings WHERE token = ?', str(f.booking, 60)) : null;
    const order = f.order ? app.db.get('SELECT * FROM orders WHERE token = ?', str(f.order, 60)) : null;
    try {
      const tok = demoPending(app, { booking, order });
      await demoConfirm(app, tok);
    } catch (e) {
      app.log('admin', 'demo_pago_error', { details: e.message, level: 'warning' });
    }
    return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}${booking ? `/reserva/${booking.token}` : `/pedido/${order.token}`}`);
  }

  // ───── Mi sesión y galerías ─────
  if (p === '/mi-sesion' && method === 'POST') return galleryLogin(app, req, res, lang, null);
  if ((m = p.match(/^\/galeria\/([\w-]{12,})$/))) {
    if (method === 'POST') return galleryLogin(app, req, res, lang, m[1]);
    const g = gallerySession(app, req, m[1]);
    if (!g) {
      const exists = app.db.get('SELECT status FROM galleries WHERE slug = ?', m[1]);
      if (exists && ['expired', 'deleted'].includes(exists.status)) return html(res, gv.expiredPage(app, lang), { noindex: true });
      return html(res, gv.mySessionPage(app, lang, { slug: m[1] }), { noindex: true }); // no revela si existe
    }
    return html(res, gv.galleryPage(app, lang, g), { noindex: true });
  }
  if ((m = p.match(/^\/galeria\/([\w-]{12,})\/salir$/)) && method === 'POST') {
    const g = app.db.get('SELECT id FROM galleries WHERE slug = ?', m[1]);
    return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}/mi-sesion`, 303, g ? { 'Set-Cookie': cookie(`etf_g${g.id}`, '', { maxAge: 0 }) } : {});
  }
  if ((m = p.match(/^\/galeria\/([\w-]{12,})\/tienda$/)) && method === 'GET') {
    const g = gallerySession(app, req, m[1]);
    if (!g) return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}/galeria/${m[1]}`);
    return html(res, gv.shopPage(app, lang, g), { noindex: true });
  }
  if ((m = p.match(/^\/galeria\/([\w-]{12,})\/pedido$/)) && method === 'POST') {
    const g = gallerySession(app, req, m[1]);
    if (!g) return json(res, 403, { error: 'gallery_unavailable', message: tx.gallery.expired });
    if (limited(`order:${clientIp(req)}`, 10, 600_000)) return json(res, 429, { message: tx.common.tooMany });
    const b = await readForm(req, 200_000);
    const contact = { name: str(b.contact?.name, 120), email: str(b.contact?.email, 160), phone: str(b.contact?.phone, 40) };
    if (!contact.name || !isEmail(contact.email)) return json(res, 400, { message: tx.forms.invalid });
    const address = Object.fromEntries(['street', 'neighborhood', 'city', 'state', 'zip', 'country'].map((k) => [k, str(b.address?.[k], 160)]));
    try {
      const o = createOrder(app, { gallery: g, items: b.items, contact, address, lang });
      return json(res, 200, { redirect: `${app.base}${lang === 'en' ? '/en' : ''}/pedido/${o.token}` });
    } catch (e) {
      return json(res, 400, { error: e.code, message: e.code === 'photo_count' ? (lang === 'en' ? `Choose between ${e.min} and ${e.max} photos.` : `Elige entre ${e.min} y ${e.max} fotografías.`) : tx.forms.invalid });
    }
  }
  if ((m = p.match(/^\/pedido\/([\w-]{20,})$/)) && method === 'GET') {
    const order = app.db.get('SELECT * FROM orders WHERE token = ?', m[1]);
    if (!order) return html(res, pub.notFoundPage(app, lang), { status: 404 });
    return html(res, gv.orderPage(app, lang, order, { flash: url.searchParams.get('pago'), isAdmin }), { noindex: true });
  }

  return html(res, pub.notFoundPage(app, lang), { status: 404 });
}

// Solo se aceptan respuestas simples y acotadas del cuestionario
function sanitizeAnswers(a) {
  const out = {};
  for (const [k, v] of Object.entries(a).slice(0, 40)) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue;
    if (k === 'groups' && Array.isArray(v)) out.groups = v.slice(0, 60).map((g) => ({ name: str(g?.name, 60), students: Math.max(0, Math.min(2000, Number.parseInt(g?.students, 10) || 0)), package_key: str(g?.package_key, 40) })).filter((g) => g.students > 0);
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => str(x, 60));
    else out[k] = str(String(v ?? ''), 2000);
  }
  return out;
}

// ───── Acceso a galerías ─────
function gallerySession(app, req, slug) {
  const g = app.db.get('SELECT * FROM galleries WHERE slug = ?', slug);
  if (!g) return null;
  const v = readSignedCookie(req, `etf_g${g.id}`);
  if (!v) return null;
  const [gid, aid, exp] = v.split(':').map(Number);
  if (gid !== g.id || !(exp > app.now())) return null;
  return sessionValid(app, g.id, aid);
}

async function galleryLogin(app, req, res, lang, slug) {
  const tx = t(lang);
  const ip = clientIp(req);
  const f = await readForm(req, 2_000);
  if (limited(`code:${ip}`, 10, 15 * 60_000) || (slug && limited(`code-g:${slug}`, 30, 15 * 60_000))) {
    return html(res, gv.mySessionPage(app, lang, { error: tx.common.tooMany, slug }), { status: 429, noindex: true });
  }
  const r = verifyCode(app, f.code, slug);
  if (!r || !r.live) {
    if (r && !r.live && ['expired', 'deleted'].includes(r.gallery.status)) return html(res, gv.expiredPage(app, lang), { noindex: true });
    return html(res, gv.mySessionPage(app, lang, { error: r && !r.live ? tx.gallery.notReady : tx.gallery.invalid, slug }), { status: 401, noindex: true });
  }
  const g = r.gallery;
  const maxAge = Math.floor((g.expires_at - app.now()) / 1000);
  app.log('cliente', 'galeria_acceso', { entity: 'gallery', id: g.id });
  return redirect(res, `${app.base}${lang === 'en' ? '/en' : ''}/galeria/${g.slug}`, 303, {
    'Set-Cookie': signedCookie(`etf_g${g.id}`, `${g.id}:${r.access.id}:${g.expires_at}`, { maxAge, sameSite: 'Lax' }),
  });
}

async function serveGalleryAsset(app, req, res, path) {
  const m = path.match(/^\/g\/([\w-]{12,})\/(?:f\/(\d+)\/(thumb|preview|original|stream)|zip\/(\d+))$/);
  if (!m) return send(res, 404, 'No encontrado');
  // Autorización comprobada en servidor en cada archivo
  const g = gallerySession(app, req, m[1]);
  const adminView = !g && isAdminRequest(app, req) ? app.db.get('SELECT * FROM galleries WHERE slug = ?', m[1]) : null;
  const gallery = g || adminView;
  if (!gallery) return send(res, 403, 'Acceso no autorizado', { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' });
  if (m[4]) return serveZip(app, req, res, gallery, Number(m[4]));
  const f = app.db.get("SELECT * FROM gallery_files WHERE id = ? AND gallery_id = ? AND status = 'ready'", Number(m[2]), gallery.id);
  if (!f) return send(res, 404, 'No encontrado');
  const variant = m[3];
  const key = variant === 'thumb' ? f.thumb_key || f.preview_key : variant === 'preview' ? f.preview_key || f.thumb_key : f.original_key;
  if (!key) return send(res, 404, 'Vista previa no disponible');
  const isOriginal = variant === 'original' || variant === 'stream';
  const expiresSec = Math.max(30, Math.min(600, Math.floor(((gallery.expires_at || app.now() + 600_000) - app.now()) / 1000)));
  const signed = app.storage.signedUrl(key, { expiresSec, filename: isOriginal ? f.filename : undefined, inline: variant !== 'original' });
  if (signed) return redirect(res, signed, 302, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  return streamKey(app, req, res, key, {
    mime: isOriginal ? f.mime || 'application/octet-stream' : 'image/jpeg',
    download: variant === 'original' ? f.filename : null,
    cache: isOriginal ? 'private, no-store' : 'private, max-age=3600',
  });
}

async function streamKey(app, req, res, key, { mime, download, cache }) {
  const size = await app.storage.size(key);
  if (size == null) return send(res, 404, 'No encontrado');
  const headers = {
    ...SECURITY_HEADERS, 'Content-Type': mime, 'Cache-Control': cache, 'Accept-Ranges': 'bytes', 'X-Robots-Tag': 'noindex',
    ...(download ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(download)}` } : {}),
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start < 0 || start >= size || end < start) return send(res, 416, '', { 'Content-Range': `bytes */${size}` });
    const s = await app.storage.stream(key, { start, end });
    res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}` });
    return s.body.pipe(res);
  }
  const s = await app.storage.stream(key);
  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  s.body.pipe(res);
}

// ZIP por lotes: originales sin recompresión, con tamaño exacto para mostrar el progreso.
async function serveZip(app, req, res, g, n) {
  const files = galleryFiles(app, g.id).filter((f) => f.original_key && f.original_crc32 != null);
  const maxBatch = Math.min(3500, app.setting('gallery').zip_batch_mb || 2048) * 1024 * 1024;
  const parts = batches(files, maxBatch);
  const part = parts[n - 1];
  if (!part) return send(res, 404, 'No encontrado');
  const names = uniqueNames(part);
  const entries = part.map((f, i) => ({ name: names[i], size: f.original_size, crc32: f.original_crc32, open: async () => (await app.storage.stream(f.original_key))?.body }));
  const safe = g.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'galeria';
  res.writeHead(200, {
    ...SECURITY_HEADERS, 'Content-Type': 'application/zip', 'Content-Length': zipSize(entries), 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(parts.length > 1 ? `${safe} (${n} de ${parts.length}).zip` : `${safe}.zip`)}`,
  });
  try {
    await writeZip(res, entries);
  } catch (e) {
    app.log('sistema', 'zip_interrumpido', { entity: 'gallery', id: g.id, details: e.message, level: 'warning' });
    res.destroy();
  }
}

function serveStatic(res, rel) {
  const file = normalize(join(STATIC, rel));
  if (!file.startsWith(STATIC) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'No encontrado');
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
  createReadStream(file).pipe(res);
}

async function serveMedia(app, req, res, id) {
  const m = app.db.get('SELECT * FROM media WHERE id = ? AND storage_key IS NOT NULL', id);
  if (!m) return send(res, 404, 'No encontrado');
  // Solo imágenes del sitio (logo, portada, portafolio autorizado, productos). Nunca archivos de clientes.
  if (m.slot === 'portfolio') {
    const ok = app.db.get('SELECT 1 FROM portfolio_items WHERE media_id = ? AND authorized = 1 AND visible = 1', id);
    if (!ok && !isAdminRequest(app, req)) return send(res, 404, 'No encontrado');
  }
  const signed = app.storage.signedUrl(m.storage_key, { expiresSec: 3600, inline: true });
  if (signed) return redirect(res, signed, 302, { 'Cache-Control': 'public, max-age=1800' });
  return streamKey(app, req, res, m.storage_key, { mime: m.mime || 'image/jpeg', cache: 'public, max-age=86400' });
}

// ───── Webhooks ─────
async function stripeWebhook(app, req, res) {
  const raw = (await readBody(req, 1_000_000)).toString('utf8');
  const ev = app.stripe.verifyWebhook(raw, req.headers['stripe-signature']);
  if (!ev) return json(res, 400, { error: 'firma inválida' });
  const obj = ev.data?.object || {};
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type) && obj.payment_status === 'paid') {
    await confirmPayment(app, {
      provider: 'stripe', eventId: ev.id, paymentToken: obj.metadata?.payment_token || obj.client_reference_id,
      providerPaymentRef: obj.payment_intent || obj.id, amountCents: obj.amount_total, currency: obj.currency,
    });
  } else if (ev.type === 'checkout.session.expired') {
    app.db.run("UPDATE payments SET status = 'cancelled', updated_at = ? WHERE token = ? AND status = 'pending'", app.now(), obj.metadata?.payment_token || '');
  }
  return json(res, 200, { received: true });
}

async function paypalWebhook(app, req, res) {
  const raw = (await readBody(req, 1_000_000)).toString('utf8');
  let ev = null;
  try { ev = await app.paypal.verifyWebhook(raw, req.headers); } catch (e) { app.log('paypal', 'webhook_error', { details: e.message, level: 'error' }); }
  if (!ev) return json(res, 400, { error: 'verificación fallida' });
  if (ev.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const r = ev.resource || {};
    await confirmPayment(app, {
      provider: 'paypal', eventId: ev.id, paymentToken: r.custom_id, providerPaymentRef: r.id,
      amountCents: Math.round(Number(r.amount?.value) * 100), currency: r.amount?.currency_code,
    });
  }
  return json(res, 200, { received: true });
}

// Disparador externo de tareas (p. ej. cron-job.org) para planes de hosting que se suspenden.
async function cron(app, req, res, url) {
  const secret = app.env.CRON_SECRET;
  const given = url.searchParams.get('key') || req.headers['x-cron-key'];
  if (!secret || given !== secret) return json(res, 403, { error: 'forbidden' });
  const n = await runDue(app, handlers);
  return json(res, 200, { ran: n });
}

function sitemap(app, res) {
  const paths = ['/', '/servicios', '/escuelas', '/negocios', '/tesoro', '/sobre-mi', '/productos', '/contacto', '/politicas/privacidad', '/politicas/reservas', '/politicas/compras', '/politicas/imagen'];
  const hasPortfolio = app.db.get('SELECT 1 FROM portfolio_items WHERE visible = 1 AND authorized = 1');
  if (hasPortfolio) paths.push('/portafolio');
  const urls = paths.flatMap((pth) => ['es', 'en'].map((l) => `<url><loc>${app.siteUrl}${app.base}${l === 'en' ? '/en' : ''}${pth === '/' ? '' : pth}</loc>
<xhtml:link rel="alternate" hreflang="es-MX" href="${app.siteUrl}${app.base}${pth === '/' ? '' : pth}"/><xhtml:link rel="alternate" hreflang="en" href="${app.siteUrl}${app.base}/en${pth === '/' ? '' : pth}"/></url>`));
  return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`, { 'Content-Type': 'application/xml; charset=utf-8' });
}

export { jparse };
