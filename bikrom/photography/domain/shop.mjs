// Tienda desde galerías: productos con fotos de la sesión, envío por reglas configuradas y pago completo al ordenar.
// Nunca se cobra un pedido con envío sin definir. Cobrar no implica producir ni enviar: eso se gestiona en el panel.
import { json } from '../db.mjs';
import { token } from '../lib/security.mjs';
import { DAY } from '../lib/time.mjs';
import { mxn } from '../lib/money.mjs';
import { normCity } from './quote.mjs';
import { isLive, deleteFile, fileInActiveOrder } from './gallery.mjs';
import { schedule } from './jobs.mjs';
import { alertAdmin } from './mail.mjs';

const err = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });

export function catalog(app) {
  const products = app.db.all("SELECT * FROM products WHERE status = 'active' ORDER BY sort, id");
  return products
    .map((p) => ({ ...p, variants: app.db.all('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 AND price_cents IS NOT NULL ORDER BY price_cents', p.id) }))
    .filter((p) => p.variants.length);
}

// Resolución mínima recomendada para un tamaño
export function resolutionCheck(app, variant, file) {
  if (!variant.width_cm || !variant.height_cm || !file.width || !file.height) return { known: false };
  const { dpi_min = 150, dpi_good = 300 } = app.setting('shop');
  const longCm = Math.max(variant.width_cm, variant.height_cm);
  const longPx = Math.max(file.width, file.height);
  const dpi = longPx / (longCm / 2.54);
  return { known: true, dpi: Math.round(dpi), ok: dpi >= dpi_min, good: dpi >= dpi_good };
}

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

export function createOrder(app, { gallery, items, contact, address, lang = 'es' }) {
  if (!isLive(app, gallery)) throw err('gallery_unavailable');
  if (!Array.isArray(items) || !items.length || items.length > 50) throw err('empty');
  const fileIds = new Set(app.db.all("SELECT id FROM gallery_files WHERE gallery_id = ? AND status = 'ready' AND kind = 'photo'", gallery.id).map((r) => r.id));
  const rows = [];
  let subtotal = 0;
  for (const it of items) {
    const v = app.db.get('SELECT * FROM product_variants WHERE id = ? AND active = 1', Number(it.variantId));
    const p = v && app.db.get("SELECT * FROM products WHERE id = ? AND status = 'active'", v.product_id);
    if (!v || !p || v.price_cents == null) throw err('product_unavailable');
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 50)) throw err('invalid_qty');
    const photos = (Array.isArray(it.photos) ? it.photos : []).map((ph) => ({
      file_id: Number(ph.file_id),
      fit: ph.fit === 'fit' ? 'fit' : 'crop',
      orientation: ph.orientation === 'landscape' ? 'landscape' : 'portrait',
      crop: ph.crop ? { x: clamp01(ph.crop.x), y: clamp01(ph.crop.y), w: clamp01(ph.crop.w), h: clamp01(ph.crop.h) } : null,
    }));
    // Cada foto debe pertenecer a ESTA galería
    if (photos.some((ph) => !fileIds.has(ph.file_id))) throw err('invalid_photo');
    if (photos.length < p.min_photos || photos.length > p.max_photos) throw err('photo_count', { min: p.min_photos, max: p.max_photos });
    const description = `${lang === 'en' ? p.name_en : p.name_es} · ${v.size_label}${(lang === 'en' ? v.finish_en : v.finish_es) ? ' · ' + (lang === 'en' ? v.finish_en : v.finish_es) : ''}`;
    rows.push({ p, v, qty, photos, description, instructions: String(it.instructions || '').slice(0, 2000) });
    subtotal += v.price_cents * qty;
  }
  const state = normCity(address?.state);
  if (!address?.street || !address?.city || !state || !address?.zip) throw err('address');
  const rules = app.db.all('SELECT * FROM shipping_rules WHERE active = 1 ORDER BY price_cents');
  const rule = rules.find((r) => json(r.states, []).map(normCity).includes(state)) || rules.find((r) => json(r.states, []).includes('*'));
  const shipping = rule ? rule.price_cents : null;
  const now = app.now();
  return app.db.tx(() => {
    const tok = token(18);
    const id = Number(app.db.run(
      `INSERT INTO orders (token, gallery_id, customer_name, email, phone, lang, address, status, subtotal_cents, shipping_cents, shipping_rule_id, total_cents, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tok, gallery.id, contact.name, contact.email, contact.phone || null, lang, JSON.stringify(address),
      shipping == null ? 'awaiting_shipping_quote' : 'awaiting_payment', subtotal, shipping, rule?.id ?? null,
      shipping == null ? null : subtotal + shipping, gallery.is_demo, now, now
    ).lastInsertRowid);
    for (const r of rows) {
      app.db.run('INSERT INTO order_items (order_id, product_id, variant_id, qty, unit_price_cents, description, photos, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, r.p.id, r.v.id, r.qty, r.v.price_cents, r.description, JSON.stringify(r.photos), r.instructions || null);
    }
    app.log('cliente', 'pedido_creado', { entity: 'order', id, details: `${mxn(subtotal)}${shipping == null ? ' · envío por cotizar' : ''}` });
    if (shipping == null) alertAdmin(app, 'Pedido con envío por cotizar', `Pedido ${tok.slice(0, 6)} a ${address.state}. Define el costo de envío para que pueda pagarse.`);
    return { id, token: tok, needsShippingQuote: shipping == null };
  });
}

export function setShipping(app, orderId, cents, carrier = null) {
  const o = app.db.get('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o || !['awaiting_shipping_quote', 'awaiting_payment'].includes(o.status)) throw new Error('El pedido ya no admite cambios de envío.');
  if (!Number.isInteger(cents) || cents < 0) throw new Error('Costo de envío inválido.');
  app.db.run("UPDATE orders SET shipping_cents = ?, total_cents = subtotal_cents + ?, carrier = COALESCE(?, carrier), status = 'awaiting_payment', updated_at = ? WHERE id = ?",
    cents, cents, carrier, app.now(), orderId);
  app.log('admin', 'envio_cotizado', { entity: 'order', id: orderId, details: mxn(cents) });
  schedule(app, 'email', app.now(), { kind: 'order_shipping_quote', orderId }, `mail:order_shipping_quote:${orderId}:${cents}`);
}

export function onOrderPaid(app, orderId) {
  const o = app.db.get('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o || o.status !== 'awaiting_payment') return 'already';
  const needsReview = app.db.get('SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND p.requires_design_review = 1', orderId);
  app.db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', needsReview ? 'design_review' : 'paid', app.now(), orderId);
  schedule(app, 'email', app.now(), { kind: 'order_confirmed', orderId }, `mail:order_confirmed:${orderId}`);
  app.log('sistema', 'pedido_pagado', { entity: 'order', id: orderId });
  return 'paid';
}

const NEXT = {
  paid: ['in_production', 'design_review', 'cancelled'],
  design_review: ['in_production', 'cancelled'],
  in_production: ['shipped', 'delivered'],
  shipped: ['delivered'],
  awaiting_shipping_quote: ['cancelled'],
  awaiting_payment: ['cancelled'],
};

export function updateOrder(app, orderId, { status, carrier, tracking, note }) {
  const o = app.db.get('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o) throw new Error('Pedido no encontrado');
  if (status && status !== o.status && !(NEXT[o.status] || []).includes(status)) throw new Error(`No se puede pasar de ${o.status} a ${status}.`);
  const newStatus = status || o.status;
  const completed = ['delivered', 'cancelled'].includes(newStatus) && !o.completed_at ? app.now() : o.completed_at;
  app.db.run('UPDATE orders SET status = ?, carrier = ?, tracking = ?, admin_note = ?, completed_at = ?, updated_at = ? WHERE id = ?',
    newStatus, carrier ?? o.carrier, tracking ?? o.tracking, note ?? o.admin_note, completed, app.now(), orderId);
  if (newStatus !== o.status) {
    app.log('admin', 'pedido_actualizado', { entity: 'order', id: orderId, details: `${o.status} → ${newStatus}` });
    if (['in_production', 'shipped', 'delivered'].includes(newStatus)) schedule(app, 'email', app.now(), { kind: 'order_update', orderId, status: newStatus }, `mail:order_update:${orderId}:${newStatus}`);
    if (completed && !o.completed_at) {
      const days = app.setting('shop').order_file_retention_days ?? 30;
      schedule(app, 'order_files_cleanup', completed + days * DAY, { orderId }, `order_cleanup:${orderId}`);
    }
  }
}

// Tras completar un pedido y su periodo de retención, borra originales conservados solo para él.
export async function cleanupOrderFiles(app, orderId) {
  const items = app.db.all('SELECT photos FROM order_items WHERE order_id = ?', orderId);
  for (const it of items) {
    for (const ph of JSON.parse(it.photos)) {
      const f = app.db.get('SELECT f.*, g.status AS gstatus FROM gallery_files f JOIN galleries g ON g.id = f.gallery_id WHERE f.id = ?', ph.file_id);
      if (f && f.retained_for_orders && f.gstatus !== 'released' && !fileInActiveOrder(app, f.id)) await deleteFile(app, f.id, { keepForOrders: false });
    }
  }
}

// Archivos de pedidos: acceso restringido para producción desde el panel aunque la galería haya vencido.
export function orderFiles(app, orderId) {
  const items = app.db.all('SELECT * FROM order_items WHERE order_id = ?', orderId);
  return items.map((it) => ({ ...it, photos: JSON.parse(it.photos).map((ph) => ({ ...ph, file: app.db.get('SELECT * FROM gallery_files WHERE id = ?', ph.file_id) })) }));
}
