// Verificación práctica de los recorridos críticos (sección 15). Uso: npm run photo:test
// Usa una base temporal, un reloj simulado y adaptadores de prueba para Stripe, PayPal y Google
// (sin red). No toca datos reales.
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createPhotography } from '../index.mjs';
import { createQuote, acceptQuote, adminUpdateQuote } from '../domain/quote.mjs';
import { slotsFor, holdSlot, bookingBalance } from '../domain/booking.mjs';
import { startPayment, recordManualPayment, confirmPayment } from '../domain/payments.mjs';
import { createGallery, startFileUpload, putUploadPart, completeUpload, publishGallery, createAccess } from '../domain/gallery.mjs';
import { createOrder, setShipping, updateOrder } from '../domain/shop.mjs';
import { zonedToUtc, DAY, HOUR } from '../lib/time.mjs';
import { encrypt } from '../lib/security.mjs';

const dir = mkdtempSync(join(tmpdir(), 'etf-test-'));
let clock = Date.parse('2026-11-20T15:00:00Z');
const env = {
  NODE_ENV: 'test', APP_SECRET: 'x'.repeat(40), PHOTO_ADMIN_PASSWORD: 'prueba-segura-123',
  STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: 'whsec_local', PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret',
  GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret', SITE_URL: 'http://localhost',
};
// CF_SHIM=1: misma prueba sobre la capa de Cloudflare (base del Durable Object y archivos en SQLite)
const cf = process.env.CF_SHIM ? (await import('../../cloudflare/test-shim.mjs')).shim('photography') : {};
if (process.env.CF_SHIM) env.STORAGE_DRIVER = 'sqlite';
const { app, handle, runJobs } = createPhotography({ env, dataDir: dir, now: () => clock, worker: false, ...cf });

// Adaptadores de prueba (sin red)
let ref = 0;
app.stripe.createCheckout = async ({ paymentToken }) => ({ url: `https://checkout.stripe.test/${paymentToken}`, ref: `cs_${++ref}` });
app.paypal.createOrder = async ({ paymentToken, amountCents }) => { paypalOrders.set(`PP${++ref}`, { paymentToken, amountCents }); return { url: 'https://paypal.test/approve', ref: `PP${ref}` }; };
const paypalOrders = new Map();
app.paypal.captureOrder = async (id) => { const o = paypalOrders.get(id); return { status: 'COMPLETED', captureId: `CAP-${id}`, amountCents: o.amountCents, currency: 'MXN', paymentToken: o.paymentToken }; };
let googleBusy = [];
let googleFails = false;
app.google.accessToken = async () => 'token';
app.google.freeBusy = async () => { if (googleFails) throw new Error('Google caído'); return googleBusy; };
app.google.insertEvent = async (t, e) => e.idempotencyId;
app.google.deleteEvent = async () => {};

const server = createServer(handle).listen(0);
const port = server.address().port;
const B = `http://localhost:${port}/photography`;

let passed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log(`✓ ${name}`); } catch (e) { failures.push(name); console.log(`✗ ${name}\n   ${e.stack.split('\n').slice(0, 3).join('\n   ')}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
const svc = (slug) => app.db.get('SELECT * FROM services WHERE slug = ?', slug);
const customer = (n) => ({ name: `Cliente ${n}`, email: `c${n}@ejemplo.mx`, phone: '4420000000' });
const day = '2026-12-05';

async function acceptedQuote(slug, answers, n = Math.random()) {
  const q = createQuote(app, { service: svc(slug), customer: customer(n), lang: 'es', answers: { city: 'Irapuato', ...answers } });
  return acceptQuote(app, q.token, { revision: 1 });
}
function stripeEvent(id, paymentToken, amount) {
  const payload = JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { id: 'cs', payment_status: 'paid', amount_total: amount, currency: 'mxn', payment_intent: `pi_${id}`, metadata: { payment_token: paymentToken } } } });
  const t = Math.floor(clock / 1000);
  // La firma usa la hora real del sistema (Stripe valida contra el reloj del servidor)
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${ts}.${payload}`).digest('hex');
  return { payload, header: `t=${ts},v1=${sig}`, t };
}
const post = (path, body, headers = {}) => fetch(B + path, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

// ───────────────────────────────── Cotización y precios
await test('Cotización correcta, anticipo del 50% y saldo', async () => {
  const q = await acceptedQuote('sesion-express', { people: 2, goal: 'x', date: day });
  eq(q.total_cents, 250000, 'total'); eq(q.deposit_cents, 125000, 'anticipo'); eq(q.balance_cents, 125000, 'saldo');
  const snap = JSON.parse(q.accepted_snapshot);
  eq(snap.total_cents, 250000, 'copia aceptada'); assert(snap.cancellation.includes('72 horas'), 'condiciones de cancelación guardadas');
});

await test('Precios históricos se conservan tras cambiar tarifas', async () => {
  const q = await acceptedQuote('bodas', { date: day, start_time: '17:00', coverage_hours: 6, venues: 'Jardín' });
  const pkg = app.db.get("SELECT * FROM package_versions WHERE package_key = 'boda' AND is_current = 1");
  app.db.run('UPDATE package_versions SET is_current = 0 WHERE id = ?', pkg.id);
  app.db.run(`INSERT INTO package_versions (service_id, package_key, version, is_current, name_es, name_en, pricing, price_cents, duration_min, photos_included, includes_es, includes_en, delivery_days, created_at)
    VALUES (?, 'boda', 2, 1, 'Boda', 'Wedding', 'fixed', 1800000, 360, 120, '[]', '[]', 14, ?)`, pkg.service_id, clock);
  const again = app.db.get('SELECT * FROM quotes WHERE id = ?', q.id);
  eq(JSON.parse(again.accepted_snapshot).total_cents, 1500000, 'la reserva anterior conserva $15,000');
  const nueva = createQuote(app, { service: svc('bodas'), customer: customer('n'), lang: 'es', answers: { city: 'Irapuato', date: day, start_time: '17:00', coverage_hours: 6, venues: 'x' } });
  eq(app.db.get('SELECT total_cents FROM quotes WHERE id = ?', nueva.id).total_cents, 1800000, 'las nuevas usan el precio vigente');
});

await test('Extras sin precio configurado no se cobran (cotización pendiente)', async () => {
  const r = createQuote(app, { service: svc('eventos-sociales'), customer: customer('e'), lang: 'es', answers: { city: 'Querétaro', event_type: 'Cumpleaños', date: day, start_time: '18:00', coverage_hours: 3, extra_photos: 10 } });
  const q = app.db.get('SELECT * FROM quotes WHERE id = ?', r.id);
  eq(q.status, 'pending_admin', 'estado'); eq(q.total_cents, null, 'sin total');
  const lines = JSON.parse(q.lines);
  assert(lines.filter((l) => l.kind === 'extra').every((l) => l.amount_cents === null), 'extras sin importe');
  let threw = false;
  try { acceptQuote(app, q.token, { revision: 1 }); } catch { threw = true; }
  assert(threw, 'no se puede aceptar ni pagar una cotización incompleta');
  // Viáticos fuera de las ciudades base también quedan pendientes
  const t = createQuote(app, { service: svc('sesion-express'), customer: customer('v'), lang: 'es', answers: { city: 'León', people: 1, goal: 'x', date: day } });
  eq(app.db.get('SELECT status FROM quotes WHERE id = ?', t.id).status, 'pending_admin', 'viáticos por cotizar');
  // Fani completa importes → lista; cambio posterior exige nueva aceptación
  adminUpdateQuote(app, r.id, { overrides: { 'extra:extra_hour': 100000, 'extra:extra_photos': 50000 } });
  const ready = app.db.get('SELECT * FROM quotes WHERE id = ?', r.id);
  eq(ready.status, 'ready', 'completa'); eq(ready.total_cents, 500000, 'total con extras definidos');
  acceptQuote(app, ready.token, { revision: ready.revision });
  adminUpdateQuote(app, r.id, { overrides: { 'extra:extra_hour': 120000, 'extra:extra_photos': 50000 } });
  eq(app.db.get('SELECT status FROM quotes WHERE id = ?', r.id).status, 'ready', 'requiere nueva aceptación');
});

// ───────────────────────────────── Agenda y apartados
await test('Sesiones dentro de 7:00–16:00; eventos en su horario real', async () => {
  const q = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: day });
  const s = await slotsFor(app, q, day);
  eq(s.slots[0].label, '07:00', 'primer horario'); eq(s.slots.at(-1).label, '15:00', 'la sesión de 60 min cabe hasta 16:00');
  const w = await acceptedQuote('bodas', { date: day, start_time: '18:00', coverage_hours: 6, venues: 'x' });
  const e = await slotsFor(app, w, day);
  eq(e.slots.length, 1, 'boda a las 18:00 disponible fuera del horario de sesiones'); eq(e.slots[0].label, '18:00', 'hora real');
});

await test('Reserva confirmada solo tras pago verificado; webhooks duplicados no duplican', async () => {
  const q = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-06' });
  const h = await holdSlot(app, q.token, zonedToUtc('2026-12-06', '09:00'));
  let b = app.db.get('SELECT * FROM bookings WHERE id = ?', h.id);
  eq(b.status, 'held', 'apartada');
  const url = await startPayment(app, { booking: b, method: 'card', lang: 'es', description: 'x' });
  assert(url.startsWith('https://checkout.stripe.test/'), 'sesión de pago');
  const pay = app.db.get("SELECT * FROM payments WHERE booking_id = ? AND status = 'pending'", b.id);
  // Regresar a la página no confirma nada
  await fetch(`${B}/reserva/${b.token}?pago=procesando`);
  eq(app.db.get('SELECT status FROM bookings WHERE id = ?', b.id).status, 'held', 'sigue apartada sin notificación');
  // Firma inválida → rechazada
  const bad = await post('/api/webhooks/stripe', '{"id":"evt_x"}', { 'stripe-signature': 't=1,v1=00' });
  eq(bad.status, 400, 'firma inválida rechazada');
  const ev = stripeEvent('evt_1', pay.token, pay.amount_cents);
  const r1 = await post('/api/webhooks/stripe', ev.payload, { 'stripe-signature': ev.header });
  const r2 = await post('/api/webhooks/stripe', ev.payload, { 'stripe-signature': ev.header });
  const ev2 = stripeEvent('evt_2', pay.token, pay.amount_cents); // mismo cobro, otro evento
  await post('/api/webhooks/stripe', ev2.payload, { 'stripe-signature': ev2.header });
  eq(r1.status, 200, 'webhook aceptado'); eq(r2.status, 200, 'repetido aceptado');
  eq(app.db.get('SELECT status FROM bookings WHERE id = ?', b.id).status, 'confirmed', 'confirmada');
  eq(app.db.get("SELECT COUNT(*) n FROM payments WHERE booking_id = ? AND status = 'succeeded'", b.id).n, 1, 'un solo pago');
  eq(app.db.get("SELECT COUNT(*) n FROM jobs WHERE dedupe_key = ?", `mail:booking_confirmed:${b.id}`).n, 1, 'un solo correo de confirmación');
  eq(bookingBalance(app, app.db.get('SELECT * FROM bookings WHERE id = ?', b.id)).outstanding, 125000, 'saldo restante 50%');
});

await test('PayPal: el regreso captura en servidor y confirma una sola vez', async () => {
  const q = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-07' });
  const h = await holdSlot(app, q.token, zonedToUtc('2026-12-07', '10:00'));
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', h.id);
  await startPayment(app, { booking: b, method: 'paypal', lang: 'es', description: 'x' });
  const p = app.db.get("SELECT * FROM payments WHERE booking_id = ? AND provider = 'paypal'", b.id);
  await fetch(`${B}/pago/paypal/retorno?pago=${p.token}&token=${p.provider_ref}`, { redirect: 'manual' });
  await fetch(`${B}/pago/paypal/retorno?pago=${p.token}&token=${p.provider_ref}`, { redirect: 'manual' });
  eq(app.db.get('SELECT status FROM bookings WHERE id = ?', b.id).status, 'confirmed', 'confirmada');
  eq(app.db.get("SELECT COUNT(*) n FROM payments WHERE booking_id = ? AND status = 'succeeded'", b.id).n, 1, 'un solo pago');
});

await test('Apartados vencidos liberan la disponibilidad', async () => {
  const q = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-08' });
  const start = zonedToUtc('2026-12-08', '11:00');
  const h = await holdSlot(app, q.token, start);
  const other = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-08' });
  assert(!(await slotsFor(app, other, '2026-12-08')).slots.some((s) => s.start === start), 'ocupado mientras está apartado');
  clock += 25 * HOUR;
  await runJobs();
  eq(app.db.get('SELECT status FROM bookings WHERE id = ?', h.id).status, 'expired', 'vencido');
  assert((await slotsFor(app, other, '2026-12-08')).slots.some((s) => s.start === start), 'horario liberado');
  assert(app.db.get("SELECT 1 FROM email_log WHERE template_key = 'hold_expired'"), 'aviso de vencimiento registrado');
  clock -= 25 * HOUR;
});

await test('Pago tardío no confirma una fecha ya ocupada', async () => {
  const q = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-09' });
  const start = zonedToUtc('2026-12-09', '08:00');
  const h = await holdSlot(app, q.token, start);
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', h.id);
  await startPayment(app, { booking: b, method: 'card', lang: 'es', description: 'x' });
  const pay = app.db.get("SELECT * FROM payments WHERE booking_id = ? AND status = 'pending'", b.id);
  clock += 25 * HOUR; await runJobs();
  const q2 = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-09' });
  await holdSlot(app, q2.token, start); // otra persona aparta el mismo horario
  await confirmPayment(app, { provider: 'stripe', eventId: 'evt_late', paymentToken: pay.token, providerPaymentRef: 'pi_late', amountCents: pay.amount_cents });
  eq(app.db.get('SELECT status FROM bookings WHERE id = ?', b.id).status, 'conflict', 'queda en revisión, no confirmada');
  assert(app.db.get("SELECT 1 FROM activity_log WHERE action = 'alerta' AND details LIKE 'Pago recibido para una fecha no disponible%'"), 'aviso a Fani');
  clock -= 25 * HOUR;
});

await test('Sin dobles reservas con solicitudes simultáneas', async () => {
  const start = zonedToUtc('2026-12-10', '12:00');
  const quotes = await Promise.all([1, 2, 3, 4].map((i) => acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-10' }, `sim${i}`)));
  const results = await Promise.allSettled(quotes.map((q) => holdSlot(app, q.token, start)));
  eq(results.filter((r) => r.status === 'fulfilled').length, 1, 'solo un apartado gana');
  // Un evento que se traslapa con esa sesión también se rechaza
  const w = await acceptedQuote('eventos-sociales', { event_type: 'x', date: '2026-12-10', start_time: '11:30', coverage_hours: 2 });
  let threw = false;
  try { await holdSlot(app, w.token, zonedToUtc('2026-12-10', '11:30')); } catch { threw = true; }
  assert(threw, 'traslape entre servicios bloqueado');
});

await test('Conflictos con Google Calendar', async () => {
  app.setSetting('google', { refresh_token: encrypt('rt'), connected_at: clock });
  googleBusy = [[zonedToUtc('2026-12-11', '09:00'), zonedToUtc('2026-12-11', '11:00')]];
  const q = await acceptedQuote('sesion-express', { people: 1, goal: 'x', date: '2026-12-11' });
  const labels = (await slotsFor(app, q, '2026-12-11')).slots.map((s) => s.label);
  assert(!labels.includes('09:00') && !labels.includes('10:00') && !labels.includes('08:30'), 'ocupados de Google excluidos');
  assert(labels.includes('11:00'), 'después del evento sí');
  googleFails = true;
  app.db.run('DELETE FROM calendar_busy_cache');
  eq((await slotsFor(app, q, '2026-12-11')).error, 'calendar_unavailable', 'sin verificación no se ofrecen horarios');
  const res = await (await fetch(`${B}/api/disponibilidad?cotizacion=${q.token}&fecha=2026-12-11`)).json();
  assert(!JSON.stringify(res).includes('09:00Z') && res.error === 'calendar_unavailable', 'no se exponen datos del calendario');
  googleFails = false; googleBusy = [];
  app.setSetting('google', { refresh_token: null }); app.db.run('DELETE FROM calendar_busy_cache');
});

await test('Saldo en efectivo registrable con historial', async () => {
  const b = app.db.get("SELECT * FROM bookings WHERE status = 'confirmed' ORDER BY id LIMIT 1");
  const before = bookingBalance(app, b).outstanding;
  await recordManualPayment(app, { bookingId: b.id, amountCents: before, method: 'cash', purpose: 'balance', note: 'Efectivo el día de la sesión' });
  eq(bookingBalance(app, b).outstanding, 0, 'liquidado');
  assert(app.db.get("SELECT 1 FROM activity_log WHERE action = 'efectivo_registrado' AND entity_id = ?", b.id), 'queda en el historial');
});

// ───────────────────────────────── Galerías
async function galleryWithFiles(bookingId, files) {
  const id = createGallery(app, { bookingId, title: `Sesión ${bookingId}`, withoutBookingConfirmed: !bookingId });
  for (const [name, content] of files) {
    const buf = Buffer.from(content);
    const s = await startFileUpload(app, id, { filename: name, size: buf.length, mime: 'image/jpeg', width: 4000, height: 6000 });
    await putUploadPart(app, s.uploadId, 0, buf);
    await completeUpload(app, s.uploadId);
  }
  return id;
}
const confirmedPaid = app.db.get("SELECT * FROM bookings WHERE status = 'confirmed' ORDER BY id LIMIT 1");
const unpaid = app.db.get("SELECT * FROM bookings WHERE status = 'confirmed' ORDER BY id DESC LIMIT 1");
let gA, gB, codeA, codeB, cookieA;

await test('Publicar exige saldo liquidado (sin marcarlo pagado en silencio)', async () => {
  gB = await galleryWithFiles(unpaid.id, [['b1.jpg', 'BBBB-original-uno']]);
  let code = null;
  try { publishGallery(app, gB); } catch (e) { code = e.code; }
  eq(code, 'balance_due', 'bloqueada por saldo');
  eq(bookingBalance(app, unpaid).outstanding > 0, true, 'el saldo sigue pendiente');
  await recordManualPayment(app, { bookingId: unpaid.id, amountCents: bookingBalance(app, unpaid).outstanding, method: 'cash', note: 'Efectivo al publicar' });
  publishGallery(app, gB);
});

await test('Correo de entrega solo con contenido publicado y en la fecha programada', async () => {
  let empty = null;
  const gEmpty = createGallery(app, { bookingId: confirmedPaid.id, title: 'Vacía' });
  try { publishGallery(app, gEmpty); } catch (e) { empty = e.code; }
  eq(empty, 'empty_gallery', 'una galería vacía no se publica');
  gA = await galleryWithFiles(confirmedPaid.id, [['a1.jpg', 'AAAA-original-uno-' + 'x'.repeat(2000)], ['a2.jpg', 'AAAA-original-dos']]);
  const later = clock + 2 * DAY;
  publishGallery(app, gA, { releaseAt: later });
  await runJobs();
  eq(app.db.get('SELECT COUNT(*) n FROM email_log WHERE dedupe_key LIKE ?', `mail:gallery_delivery:${gA}:%`).n, 0, 'no se envía antes de la fecha');
  clock = later + 1000; await runJobs();
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', gA);
  eq(g.status, 'released', 'liberada'); eq(g.expires_at, g.released_at + 21 * DAY, 'vence a las 3 semanas');
  eq(app.db.get('SELECT COUNT(*) n FROM email_log WHERE dedupe_key LIKE ?', `mail:gallery_delivery:${gA}:%`).n, 1, 'un correo de entrega');
  await runJobs();
  eq(app.db.get('SELECT status FROM galleries WHERE id = ?', gB).status, 'released', 'la otra galería también se liberó');
  codeA = createAccess(app, gA, 'prueba').code;
  codeB = createAccess(app, gB, 'prueba').code;
});

const slugOf = (id) => app.db.get('SELECT slug FROM galleries WHERE id = ?', id).slug;
const fileOf = (id) => app.db.get("SELECT * FROM gallery_files WHERE gallery_id = ? AND status = 'ready' ORDER BY id LIMIT 1", id);

await test('Acceso privado aislado por galería', async () => {
  const r = await fetch(`${B}/mi-sesion`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `code=${codeA}` });
  eq(r.status, 303, 'código válido');
  cookieA = r.headers.get('set-cookie').split(';')[0];
  const own = await fetch(`${B}/g/${slugOf(gA)}/f/${fileOf(gA).id}/original`, { headers: { cookie: cookieA } });
  eq(own.status, 200, 'descarga propia');
  const other = await fetch(`${B}/g/${slugOf(gB)}/f/${fileOf(gB).id}/original`, { headers: { cookie: cookieA } });
  eq(other.status, 403, 'otra galería bloqueada');
  const swapped = await fetch(`${B}/g/${slugOf(gA)}/f/${fileOf(gB).id}/original`, { headers: { cookie: cookieA } });
  eq(swapped.status, 404, 'cambiar el id de archivo no da acceso');
  const wrongLink = await fetch(`${B}/galeria/${slugOf(gB)}`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `code=${codeA}` });
  eq(wrongLink.status, 401, 'el código de A no abre el enlace de B');
  const noCookie = await fetch(`${B}/g/${slugOf(gA)}/f/${fileOf(gA).id}/original`);
  eq(noCookie.status, 403, 'sin sesión no hay descarga');
  const page = await (await fetch(`${B}/galeria/${slugOf(gA)}`)).text();
  assert(page.includes('name="code"') && !page.includes('a1.jpg'), 'el enlace directo sigue pidiendo el código');
  assert(!(await (await fetch(`${B}/sitemap.xml`)).text()).includes('galeria'), 'galerías fuera del sitemap');
});

await test('Descarga de originales sin recompresión y ZIP válido', async () => {
  const f = fileOf(gA);
  const body = Buffer.from(await (await fetch(`${B}/g/${slugOf(gA)}/f/${f.id}/original`, { headers: { cookie: cookieA } })).arrayBuffer());
  eq(body.toString(), 'AAAA-original-uno-' + 'x'.repeat(2000), 'bytes idénticos al original');
  const zr = await fetch(`${B}/g/${slugOf(gA)}/zip/1`, { headers: { cookie: cookieA } });
  const zip = Buffer.from(await zr.arrayBuffer());
  eq(Number(zr.headers.get('content-length')), zip.length, 'tamaño anunciado exacto');
  const file = join(dir, 'prueba.zip');
  writeFileSync(file, zip);
  const out = execFileSync('unzip', ['-t', file]).toString();
  assert(out.includes('No errors detected'), 'ZIP íntegro (CRC verificados)');
  assert(out.includes('a1.jpg') && out.includes('a2.jpg'), 'contiene los archivos');
});

// ───────────────────────────────── Tienda
let paidOrder;
await test('Compras asociadas a la foto correcta y envío sin tarifa no se cobra', async () => {
  const prod = app.db.get("SELECT * FROM products WHERE slug = 'impresiones'");
  const v = Number(app.db.run("INSERT INTO product_variants (product_id, size_label, width_cm, height_cm, price_cents, active) VALUES (?, '20×30', 20, 30, 35000, 1)", prod.id).lastInsertRowid);
  app.db.run("UPDATE products SET status = 'active' WHERE id = ?", prod.id);
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', gA);
  let code = null;
  try { createOrder(app, { gallery: g, items: [{ variantId: v, qty: 1, photos: [{ file_id: fileOf(gB).id }] }], contact: { name: 'A', email: 'a@x.mx' }, address: { street: 'x', city: 'x', state: 'Jalisco', zip: '1' } }); } catch (e) { code = e.code; }
  eq(code, 'invalid_photo', 'foto de otra galería rechazada');
  const o = createOrder(app, { gallery: g, items: [{ variantId: v, qty: 2, photos: [{ file_id: fileOf(gA).id, crop: { x: 0.1, y: 0, w: 0.8, h: 1 } }] }], contact: { name: 'A', email: 'a@x.mx' }, address: { street: 'x', city: 'x', state: 'Jalisco', zip: '1' } });
  const order = app.db.get('SELECT * FROM orders WHERE id = ?', o.id);
  eq(order.status, 'awaiting_shipping_quote', 'envío por cotizar'); eq(order.total_cents, null, 'sin total');
  let notPayable = null;
  try { await startPayment(app, { order, method: 'card', lang: 'es', description: 'x' }); } catch (e) { notPayable = e.code; }
  eq(notPayable, 'order_not_payable', 'no se cobra con envío sin definir');
  setShipping(app, o.id, 15000);
  const ready = app.db.get('SELECT * FROM orders WHERE id = ?', o.id);
  eq(ready.total_cents, 85000, 'total con envío'); eq(JSON.parse(app.db.get('SELECT photos FROM order_items WHERE order_id = ?', o.id).photos)[0].file_id, fileOf(gA).id, 'foto correcta guardada');
  await startPayment(app, { order: ready, method: 'card', lang: 'es', description: 'x' });
  const pay = app.db.get("SELECT * FROM payments WHERE order_id = ? AND status = 'pending'", o.id);
  const ev = stripeEvent('evt_order', pay.token, pay.amount_cents);
  await post('/api/webhooks/stripe', ev.payload, { 'stripe-signature': ev.header });
  eq(app.db.get('SELECT status FROM orders WHERE id = ?', o.id).status, 'paid', 'pagado (pago de producto separado del servicio)');
  eq(app.db.get('SELECT booking_id FROM payments WHERE id = ?', pay.id).booking_id, null, 'no se mezcla con el saldo de la sesión');
  updateOrder(app, o.id, { status: 'in_production' });
  paidOrder = o.id;
});

await test('Vencimiento a las 3 semanas; pedidos pagados sobreviven', async () => {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', gA);
  clock = g.expires_at + 1000;
  await runJobs();
  eq(app.db.get('SELECT status FROM galleries WHERE id = ?', gA).status, 'expired', 'vencida');
  const r = await fetch(`${B}/g/${slugOf(gA)}/f/${fileOf(gA)?.id || 1}/original`, { headers: { cookie: cookieA } });
  eq(r.status, 403, 'accesos y descargas revocados');
  const login = await fetch(`${B}/mi-sesion`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `code=${codeA}` });
  assert((await login.text()).includes(app.db ? 'ya no está disponible' : ''), 'mensaje de galería vencida');
  clock += 8 * DAY; await runJobs(); // periodo de gracia y borrado automático
  const files = app.db.all('SELECT * FROM gallery_files WHERE gallery_id = ?', gA);
  const used = JSON.parse(app.db.get('SELECT photos FROM order_items WHERE order_id = ?', paidOrder).photos)[0].file_id;
  const kept = files.find((f) => f.id === used);
  assert(kept.status === 'ready' && kept.retained_for_orders === 1 && kept.original_key, 'original del pedido conservado');
  assert(files.filter((f) => f.id !== used).every((f) => f.status === 'deleted'), 'los demás archivos se eliminaron');
  assert((await app.storage.size(kept.original_key)) > 0, 'archivo disponible para producción');
  eq(app.db.get('SELECT status FROM orders WHERE id = ?', paidOrder).status, 'in_production', 'el pedido sigue en curso');
  let code = null;
  try { createOrder(app, { gallery: app.db.get('SELECT * FROM galleries WHERE id = ?', gA), items: [], contact: {}, address: {} }); } catch (e) { code = e.code; }
  eq(code, 'gallery_unavailable', 'no hay compras nuevas desde una galería vencida');
});

// ───────────────────────────────── Idiomas, celular y SEO
await test('Español e inglés, celular y metadatos', async () => {
  const es = await (await fetch(`${B}/`)).text();
  const en = await (await fetch(`${B}/en`)).text();
  assert(es.includes('lang="es-MX"') && es.includes('Encuentra tu sesión'), 'español');
  assert(en.includes('lang="en"') && en.includes('Find your session'), 'inglés');
  assert(es.includes('name="viewport"') && es.includes('hreflang="en"'), 'viewport y hreflang');
  const enBooking = await (await fetch(`${B}/en/reservar`)).text();
  assert(enBooking.includes('Book your session') && enBooking.includes('MXN'), 'reserva en inglés con MXN');
  const priv = await fetch(`${B}/galeria/${slugOf(gB)}`);
  assert((await priv.text()).includes('noindex'), 'páginas privadas sin indexar');
  const redirect = await fetch(`${B}/`, { redirect: 'manual', headers: { cookie: 'etf_lang=en' } });
  eq(redirect.status, 302, 'se respeta la preferencia de idioma');
});

await test('Panel: acceso protegido, CSRF y límite de intentos', async () => {
  eq((await fetch(`${B}/admin`, { redirect: 'manual' })).status, 303, 'redirige a entrar');
  const bad = await fetch(`${B}/admin/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=mal' });
  eq(bad.status, 401, 'contraseña incorrecta');
  const ok = await fetch(`${B}/admin/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `password=${env.PHOTO_ADMIN_PASSWORD}` });
  const c = ok.headers.get('set-cookie').split(';')[0];
  eq((await fetch(`${B}/admin`, { headers: { cookie: c } })).status, 200, 'panel con sesión');
  const noCsrf = await fetch(`${B}/admin/agenda/bloqueos`, { method: 'POST', headers: { cookie: c, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'from_date=2026-12-01&to_date=2026-12-02' });
  eq(noCsrf.status, 403, 'escritura sin CSRF rechazada');
});

server.close();
rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} pruebas superadas${failures.length ? `, ${failures.length} fallidas: ${failures.join('; ')}` : ''}.`);
process.exit(failures.length ? 1 : 0);
