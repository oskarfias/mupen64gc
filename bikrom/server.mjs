// Servidor de Bikrom: sirve el sitio (dist/) y las funciones del negocio.
// Sin dependencias. Uso: `npm run build && npm start`.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream, readdirSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(root, '.env')) && process.loadEnvFile) process.loadEnvFile(join(root, '.env'));

const { config, isSet } = await import('./src/config.js');
const { products, productBySlug, skus } = await import('./src/data/products.js');
const { scoreDiagnostic, answersComplete } = await import('./src/data/diagnostico.js');
const { createStore, COLLECTIONS } = await import('./server/store.js');
const { createMailer, emailLayout, button, esc } = await import('./server/email.js');
const pay = await import('./server/payments.js');
const { renderAdmin, toCsv } = await import('./server/admin.js');

const env = process.env;
const PORT = Number(env.PORT || 3000);
const SITE = config.siteUrl;
const dist = join(root, 'dist');
const store = createStore(join(root, 'data'));
const sendMail = createMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM || 'Bikrom <onboarding@resend.dev>', store });
const NOTIFY = isSet(env.EMAIL_NOTIFY || '') ? env.EMAIL_NOTIFY : null;
const IVA = config.ivaRate;
const round2 = (n) => Math.round(n * 100) / 100;

// ───────────── Utilidades HTTP ─────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.zip': 'application/zip', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.mp4': 'video/mp4' };
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY });
  res.end(JSON.stringify(data));
}
function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJson(req) {
  try { return JSON.parse(await readBody(req)); } catch { return null; }
}

// Límite simple de peticiones por IP para los formularios.
const hits = new Map();
function rateLimited(req, max = 20) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// ───────────── Archivos estáticos ─────────────
function serveStatic(req, res, pathname) {
  let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, rel);
  if (!file.startsWith(dist)) return notFound(res);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }); return res.end(); }
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) return notFound(res);
  const ext = extname(file);
  const cache = ext === '.html' ? 'no-cache' : pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SECURITY });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}
function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY });
  res.end(existsSync(join(dist, '404.html')) ? readFileSync(join(dist, '404.html')) : 'No encontrado');
}

// ───────────── Correos de negocio ─────────────
async function notify(subject, rows) {
  if (!NOTIFY) return;
  const html = emailLayout(subject, `<table cellpadding="6" style="border-collapse:collapse;font-size:14px;">${Object.entries(rows).map(([k, v]) => `<tr><td style="border-bottom:1px solid #E6E6E6;color:#5C5C5C;">${esc(k)}</td><td style="border-bottom:1px solid #E6E6E6;">${esc(v ?? '')}</td></tr>`).join('')}</table>${button(SITE + '/admin', 'Abrir panel')}`);
  await sendMail({ to: NOTIFY, subject: `[Bikrom] ${subject}`, html, tipo: 'aviso interno' });
}

function diagnosticEmail(lead, r) {
  const bars = r.areas
    .map((a) => `<tr><td style="padding:6px 0;width:110px;font-weight:600;">${esc(a.name)}</td><td style="padding:6px 0;"><div style="border:1px solid #E6E6E6;height:18px;"><div style="background:#0A0A0A;height:18px;width:${a.score}%;"></div></div></td><td style="padding:6px 0 6px 10px;width:40px;text-align:right;font-weight:700;">${a.score}</td></tr>`)
    .join('');
  const recs = r.recommendations.map((x, i) => `<li style="margin-bottom:10px;"><a href="${SITE}${x.url}" style="color:#0A0A0A;font-weight:600;">${i + 1}. ${esc(x.name)}</a><br><span style="color:#5C5C5C;">${esc(x.promise)}</span></li>`).join('');
  return emailLayout(
    `Tu Diagnóstico Empresa 360: ${r.overall} / 100`,
    `<p>Hola ${esc(lead.nombre)}, este es el resultado de ${esc(lead.empresa)}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${bars}</table>
<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:18px;margin:24px 0 12px;">Tus tres recomendaciones</h2>
<ol style="padding-left:0;list-style:none;">${recs}</ol>
<p>Revisemos juntos tu resultado en una llamada gratuita de 30 minutos.</p>
${button(isSet(config.bookingUrl) ? config.bookingUrl : SITE + '/contacto/#agenda', 'Agenda tu llamada gratuita')}`
  );
}

// Entrega automática tras el pago: enlaces de descarga, accesos a cursos y siguientes pasos de servicios.
async function fulfill(orderId) {
  const order = store.find('pedidos', orderId);
  if (!order || order.entregado) return;
  const days = Number(env.DOWNLOAD_LINK_DAYS || 30);
  const descargas = [];
  const blocks = [];
  for (const it of order.items) {
    if (it.entrega === 'download') {
      const token = randomBytes(24).toString('hex');
      descargas.push({ sku: it.sku, token, expira: new Date(Date.now() + days * 864e5).toISOString() });
      blocks.push(`<p><strong>${esc(it.producto)} — ${esc(it.opcion)}</strong><br>${button(`${SITE}/descargas/${token}`, 'Descargar')}<span style="color:#5C5C5C;font-size:13px;">Enlace personal, vigente ${days} días.</span></p>`);
    } else if (it.entrega === 'course') {
      const url = env.COURSE_ACCESS_URL || '[URL DE LA PLATAFORMA DE CURSOS]';
      blocks.push(`<p><strong>${esc(it.producto)} — ${esc(it.opcion)}</strong> (×${it.cantidad})<br>Tu acceso al curso: ${isSet(url) ? `<a href="${esc(url)}" style="color:#0A0A0A;">${esc(url)}</a>` : esc(url)}<br><span style="color:#5C5C5C;">[INSTRUCCIONES DE ACCESO AL CURSO]</span></p>`);
    } else {
      blocks.push(`<p><strong>${esc(it.producto)} — ${esc(it.opcion)}</strong><br>Te contactaremos para agendar el arranque. Si prefieres, agenda tú mismo:</p>${button(isSet(config.bookingUrl) ? config.bookingUrl : SITE + '/contacto/#agenda', 'Agendar arranque')}`);
    }
  }
  store.update('pedidos', orderId, { descargas, entregado: true });
  await sendMail({
    to: order.cliente.correo,
    subject: `Tu pedido ${order.id} en Bikrom`,
    tipo: 'entrega',
    html: emailLayout('Gracias por tu compra', `<p>Hola ${esc(order.cliente.nombre)}, confirmamos tu pago de ${esc('$' + order.total.toLocaleString('en-US', { minimumFractionDigits: 2 }))} (IVA incluido).</p>${blocks.join('')}${order.facturacion ? '<p>Tu factura llegará por correo en [PLAZO DE ENVÍO DE LA FACTURA].</p>' : ''}`),
  });
  await notify(`Compra pagada ${order.id}`, { Cliente: order.cliente.nombre, Correo: order.cliente.correo, Total: order.total, Productos: order.items.map((i) => i.producto + ' — ' + i.opcion).join('; '), RFC: order.facturacion?.rfc || 'sin factura' });
}

async function markPaid(orderId, extra = {}) {
  const order = store.find('pedidos', orderId) || store.find('suscripciones', orderId);
  if (!order) return;
  if (order.tipo === 'suscripcion') {
    const first = order.estado !== 'activa';
    store.update('suscripciones', orderId, { estado: 'activa', ...extra });
    if (first) {
      await sendMail({
        to: order.cliente.correo,
        subject: 'Te damos la bienvenida a la Membresía para dueños',
        tipo: 'suscripción',
        html: emailLayout('Tu membresía está activa', `<p>Hola ${esc(order.cliente.nombre)}, tu plan ${esc(order.items[0].opcion)} ya está activo.</p><p>[INSTRUCCIONES DE ACCESO: biblioteca, comunidad privada y calendario de sesiones]</p>`),
      });
      await notify(`Nueva suscripción ${orderId}`, { Cliente: order.cliente.nombre, Correo: order.cliente.correo, Plan: order.items[0].opcion });
    }
    return;
  }
  if (order.estado === 'pagado') return;
  store.update('pedidos', orderId, { estado: 'pagado', pagado: new Date().toISOString(), ...extra });
  await fulfill(orderId);
}

// ───────────── API ─────────────
async function apiDiagnostico(req, res) {
  const body = await readJson(req);
  const lead = body?.lead || {};
  const data = { nombre: str(lead.nombre), empresa: str(lead.empresa), correo: str(lead.correo), whatsapp: str(lead.whatsapp, 30), empleados: str(lead.empleados, 30) };
  if (!data.nombre || !data.empresa || !isEmail(data.correo) || !data.whatsapp || !data.empleados || lead.privacidad !== true) return json(res, 400, { error: 'Faltan datos del formulario.' });
  if (!answersComplete(body.answers)) return json(res, 400, { error: 'Faltan respuestas del diagnóstico.' });
  const answers = Object.fromEntries(Object.entries(body.answers).map(([k, v]) => [str(k, 5), Number(v)]));
  const resultado = scoreDiagnostic(answers, productBySlug);
  const row = store.insert('diagnosticos', { ...data, privacidadAceptada: true, respuestas: answers, resultado });
  const ok = await sendMail({ to: data.correo, subject: `Tu Diagnóstico Empresa 360: ${resultado.overall} / 100`, html: diagnosticEmail(data, resultado), tipo: 'diagnóstico' });
  store.update('diagnosticos', row.id, { correoEnviado: ok });
  notify(`Nuevo diagnóstico: ${data.empresa}`, { ...data, General: resultado.overall, Recomendaciones: resultado.recommendations.map((r) => r.name).join('; ') });
  json(res, 200, { result: resultado, emailSent: ok });
}

async function apiPropuesta(req, res) {
  const b = await readJson(req);
  const data = { nombre: str(b?.nombre), empresa: str(b?.empresa), correo: str(b?.correo), whatsapp: str(b?.whatsapp, 30), empleados: str(b?.empleados, 30), producto: str(b?.producto, 80), mensaje: str(b?.mensaje, 3000), pagina: str(b?.pagina, 200) };
  if (!data.nombre || !data.empresa || !isEmail(data.correo) || !data.empleados || !data.producto || !data.mensaje || b.privacidad !== true) return json(res, 400, { error: 'Faltan datos del formulario.' });
  data.productoNombre = productBySlug[data.producto]?.name || data.producto;
  store.insert('solicitudes', data);
  notify(`Solicitud de propuesta: ${data.productoNombre}`, data);
  json(res, 200, { ok: true });
}

async function apiBoletin(req, res) {
  const b = await readJson(req);
  const correo = str(b?.email).toLowerCase();
  if (!isEmail(correo) || b.privacidad !== true) return json(res, 400, { error: 'Correo inválido.' });
  if (!store.findBy('boletin', (r) => r.correo === correo)) store.insert('boletin', { correo, pagina: str(b.pagina, 200) });
  json(res, 200, { ok: true });
}

async function apiEvento(req, res) {
  const b = await readJson(req);
  if (b?.tipo === 'llamada_agendada') store.insert('eventos', { tipo: 'llamada_agendada', pagina: str(b.pagina, 200) });
  json(res, 200, { ok: true });
}

function providerFor() {
  const list = (env.PAYMENT_PROVIDERS || 'stripe,mercadopago').split(',').map((s) => s.trim());
  for (const p of list) {
    if (p === 'stripe' && env.STRIPE_SECRET_KEY) return 'stripe';
    if (p === 'mercadopago' && env.MERCADOPAGO_ACCESS_TOKEN) return 'mercadopago';
  }
  return 'demo';
}

async function apiCheckout(req, res) {
  const b = await readJson(req);
  if (!b) return json(res, 400, { error: 'Solicitud inválida.' });
  const cliente = { nombre: str(b.cliente?.nombre), correo: str(b.cliente?.correo), whatsapp: str(b.cliente?.whatsapp, 30), empresa: str(b.cliente?.empresa) };
  if (!cliente.nombre || !isEmail(cliente.correo)) return json(res, 400, { error: 'Revisa tu nombre y correo.' });
  let facturacion = null;
  if (b.facturacion) {
    const f = b.facturacion;
    facturacion = { rfc: str(f.rfc, 13).toUpperCase(), razonSocial: str(f.razonSocial), regimenFiscal: str(f.regimenFiscal, 5), cpFiscal: str(f.cpFiscal, 5), usoCfdi: str(f.usoCfdi, 5) };
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(facturacion.rfc) || !facturacion.razonSocial || !facturacion.regimenFiscal || !/^\d{5}$/.test(facturacion.cpFiscal) || !facturacion.usoCfdi)
      return json(res, 400, { error: 'Revisa tus datos de facturación (RFC, razón social, régimen, código postal y uso del CFDI).' });
  }
  const isSub = !!b.suscripcion;
  // Precios siempre desde el catálogo del servidor; nunca desde el navegador.
  const raw = isSub ? [{ sku: b.suscripcion, qty: 1 }] : Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  const items = [];
  for (const i of raw) {
    const s = skus[i?.sku];
    if (!s || (isSub ? s.kind !== 'subscription' : s.kind !== 'buy')) return json(res, 400, { error: 'Hay un producto no válido en tu carrito.' });
    const cantidad = s.delivery === 'course' ? Math.max(1, Math.min(50, Number(i.qty) || 1)) : 1;
    items.push({ sku: s.sku, producto: s.productName, opcion: s.label, precio: s.price, cantidad, entrega: s.delivery || null });
  }
  if (!items.length) return json(res, 400, { error: 'Tu carrito está vacío.' });
  const metodo = isSub ? 'tarjeta' : ['tarjeta', 'oxxo', 'transferencia'].includes(b.metodo) ? b.metodo : 'tarjeta';
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const iva = round2(subtotal * IVA);
  const proveedor = providerFor();
  const col = isSub ? 'suscripciones' : 'pedidos';
  const order = store.insert(col, { tipo: isSub ? 'suscripcion' : 'compra', estado: 'pendiente', proveedor, metodo, cliente, facturacion, items, subtotal, iva, total: round2(subtotal + iva) });

  try {
    let url;
    if (proveedor === 'stripe') {
      const priceIds = { 'membresia-basica': env.STRIPE_PRICE_MEMBRESIA_BASICA, 'membresia-plus': env.STRIPE_PRICE_MEMBRESIA_PLUS };
      const s = await pay.stripeCheckout({ secret: env.STRIPE_SECRET_KEY, order, siteUrl: SITE, ivaRate: IVA, metodo, priceIds: Object.fromEntries(Object.entries(priceIds).filter(([, v]) => v)) });
      store.update(col, order.id, { externoId: s.id });
      url = s.url;
    } else if (proveedor === 'mercadopago') {
      const m = await pay.mercadoPagoCheckout({ token: env.MERCADOPAGO_ACCESS_TOKEN, order, siteUrl: SITE, ivaRate: IVA, metodo });
      store.update(col, order.id, { externoId: m.id });
      url = m.url;
    } else {
      // Modo demostración: sin claves de pago, el pedido queda pendiente y se puede marcar como pagado desde el panel.
      url = `/gracias/?pedido=${order.id}&demo=1`;
    }
    notify(`Pedido iniciado ${order.id}`, { Cliente: cliente.nombre, Correo: cliente.correo, Total: order.total, Proveedor: proveedor, Método: metodo });
    json(res, 200, { url, orderId: order.id });
  } catch (e) {
    store.update(col, order.id, { estado: 'error', error: e.message });
    console.error(e);
    json(res, 502, { error: 'No pudimos conectar con el proveedor de pagos. Intenta de nuevo en unos minutos.' });
  }
}

function apiPedido(res, id) {
  const o = store.find('pedidos', id) || store.find('suscripciones', id);
  if (!o) return json(res, 404, { error: 'No encontrado' });
  json(res, 200, { id: o.id, estado: o.estado, tipo: o.tipo, total: o.total });
}

async function webhookStripe(req, res) {
  const raw = await readBody(req, 1_000_000);
  if (!pay.verifyStripeSignature(raw, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)) return json(res, 400, { error: 'firma inválida' });
  const ev = JSON.parse(raw);
  const obj = ev.data?.object || {};
  const orderId = obj.metadata?.order_id || obj.client_reference_id || obj.subscription_details?.metadata?.order_id;
  switch (ev.type) {
    case 'checkout.session.completed':
      if (obj.mode === 'subscription') await markPaid(orderId, { externoId: obj.subscription });
      else if (obj.payment_status === 'paid') await markPaid(orderId);
      else store.update('pedidos', orderId, { estado: 'pendiente', nota: 'Esperando pago (OXXO o transferencia)' });
      break;
    case 'checkout.session.async_payment_succeeded':
      await markPaid(orderId);
      break;
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      if (orderId && store.find('pedidos', orderId)?.estado !== 'pagado') store.update('pedidos', orderId, { estado: 'no pagado' });
      break;
    case 'customer.subscription.deleted': {
      const sub = store.findBy('suscripciones', (s) => s.externoId === obj.id || s.id === obj.metadata?.order_id);
      if (sub) store.update('suscripciones', sub.id, { estado: 'cancelada' });
      break;
    }
    case 'invoice.payment_failed': {
      const sub = store.findBy('suscripciones', (s) => s.externoId === obj.subscription);
      if (sub) store.update('suscripciones', sub.id, { estado: 'pago fallido' });
      break;
    }
  }
  json(res, 200, { received: true });
}

async function webhookMercadoPago(req, res, url) {
  const raw = await readBody(req, 1_000_000);
  let body = {};
  try { body = JSON.parse(raw || '{}'); } catch {}
  const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const id = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  const token = env.MERCADOPAGO_ACCESS_TOKEN;
  json(res, 200, { received: true }); // responder rápido; se consulta el recurso a Mercado Pago
  if (!token || !id) return;
  try {
    if (type === 'payment') {
      const p = await pay.mpGetPayment(token, id);
      const orderId = p.external_reference;
      if (p.status === 'approved') await markPaid(orderId, { pagoId: String(p.id) });
      else if (['rejected', 'cancelled'].includes(p.status) && store.find('pedidos', orderId)?.estado !== 'pagado') store.update('pedidos', orderId, { estado: 'no pagado' });
    } else if (type === 'preapproval' || type === 'subscription_preapproval') {
      const s = await pay.mpGetPreapproval(token, id);
      if (s.status === 'authorized') await markPaid(s.external_reference, { externoId: s.id });
      if (s.status === 'cancelled') store.update('suscripciones', s.external_reference, { estado: 'cancelada' });
    }
  } catch (e) {
    console.error('Webhook Mercado Pago:', e.message);
  }
}

function serveDownload(res, token) {
  const order = store.findBy('pedidos', (o) => (o.descargas || []).some((d) => d.token === token));
  const d = order?.descargas.find((x) => x.token === token);
  if (!order || order.estado !== 'pagado' || !d || new Date(d.expira) < new Date()) return notFound(res);
  const dir = join(root, 'private', 'descargas');
  const fileName = existsSync(dir) ? readdirSync(dir).find((f) => f.startsWith(d.sku + '.') || f === d.sku) : null;
  if (!fileName) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('El archivo todavía no está disponible. Escríbenos y te lo enviamos de inmediato.');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(fileName)] || 'application/octet-stream', 'Content-Disposition': `attachment; filename="bikrom-${fileName}"`, 'Cache-Control': 'private, no-store', ...SECURITY });
  createReadStream(join(dir, fileName)).pipe(res);
}

// ───────────── Panel ─────────────
function adminAuth(req, res) {
  const user = env.ADMIN_USER || 'admin';
  const pass = env.ADMIN_PASSWORD;
  if (!isSet(pass || '')) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Define ADMIN_PASSWORD en .env para usar el panel.');
    return false;
  }
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  const given = Buffer.from(scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString() : '');
  const expected = Buffer.from(`${user}:${pass}`);
  if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Bikrom"', 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Acceso restringido');
  return false;
}

async function admin(req, res, url) {
  if (!adminAuth(req, res)) return;
  const view = COLLECTIONS[url.searchParams.get('vista')] ? url.searchParams.get('vista') : 'diagnosticos';
  const m = url.pathname.match(/^\/admin\/pedidos\/([A-Z0-9-]+)\/pagado$/);
  if (m && req.method === 'POST') {
    await markPaid(m[1], { nota: 'Marcado como pagado desde el panel' });
    res.writeHead(303, { Location: '/admin?vista=pedidos' });
    return res.end();
  }
  if (url.pathname === '/admin/export.csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bikrom-${view}.csv"` });
    return res.end(toCsv(view, store.all(view)));
  }
  const counts = Object.fromEntries(Object.keys(COLLECTIONS).map((k) => [k, store.all(k).length]));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY });
  res.end(renderAdmin(view, store.all(view), counts));
}

// ───────────── Rutas ─────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (req.method === 'POST' && p.startsWith('/api/') && !p.startsWith('/api/webhooks/') && rateLimited(req)) return json(res, 429, { error: 'Demasiadas solicitudes. Intenta en un minuto.' });
    if (req.method === 'POST' && p === '/api/diagnostico') return await apiDiagnostico(req, res);
    if (req.method === 'POST' && p === '/api/propuesta') return await apiPropuesta(req, res);
    if (req.method === 'POST' && p === '/api/boletin') return await apiBoletin(req, res);
    if (req.method === 'POST' && p === '/api/evento') return await apiEvento(req, res);
    if (req.method === 'POST' && p === '/api/checkout') return await apiCheckout(req, res);
    if (req.method === 'POST' && p === '/api/webhooks/stripe') return await webhookStripe(req, res);
    if (p === '/api/webhooks/mercadopago') return await webhookMercadoPago(req, res, url);
    if (req.method === 'GET' && p.startsWith('/api/pedido/')) return apiPedido(res, decodeURIComponent(p.slice(12)));
    if (req.method === 'GET' && p.startsWith('/descargas/')) return serveDownload(res, p.slice(11));
    if (p === '/admin' || p.startsWith('/admin/')) return await admin(req, res, url);
    if (p.startsWith('/api/')) return json(res, 404, { error: 'No encontrado' });
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
    res.writeHead(405);
    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Error del servidor' });
  }
});

if (!existsSync(dist)) console.warn('Aviso: no existe dist/. Ejecuta `npm run build` primero.');
server.listen(PORT, () => {
  console.log(`Bikrom en http://localhost:${PORT} · pagos: ${providerFor()} · correo: ${env.RESEND_API_KEY ? 'Resend' : 'sin enviar (se guarda en el panel)'} · ${products.length} productos`);
});
