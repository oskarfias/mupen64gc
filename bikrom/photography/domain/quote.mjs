// Cotizador. Calcula siempre en el servidor con los precios vigentes.
// Un concepto sin importe configurado deja la cotización "pendiente" (no se puede pagar).
import { json } from '../db.mjs';
import { split } from '../lib/money.mjs';
import { token } from '../lib/security.mjs';

export const normCity = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const L = (es, en) => ({ es, en });

export function currentPackages(app, serviceId) {
  return app.db.all('SELECT * FROM package_versions WHERE service_id = ? AND is_current = 1 ORDER BY id', serviceId);
}

export function currentQuestionnaire(app, serviceId) {
  const q = app.db.get('SELECT * FROM questionnaires WHERE service_id = ? AND is_current = 1 ORDER BY version DESC', serviceId);
  return q ? { ...q, fields: json(q.fields, []) } : null;
}

export function findDiscount(app, code, kind, subtotal) {
  if (!code) return { discount: null };
  const d = app.db.get('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE AND active = 1', String(code).trim());
  const now = app.now();
  const kinds = json(d?.service_kinds, null);
  const invalid =
    !d || (d.valid_from && now < d.valid_from) || (d.valid_to && now > d.valid_to) ||
    (d.max_uses != null && d.uses >= d.max_uses) || (d.min_subtotal_cents && subtotal < d.min_subtotal_cents) ||
    (kinds && !kinds.includes(kind));
  return invalid ? { discount: null, invalidCode: true } : { discount: d };
}

// Construye los conceptos de una cotización a partir del servicio y las respuestas.
export function buildQuote(app, service, answers, { adminOverrides = {}, customLines = [], durationOverride = null } = {}) {
  const lines = [];
  const reasons = [];
  const packages = currentPackages(app, service.id);
  let pkg = packages.find((p) => p.package_key === answers.package_key) || packages[0];
  let duration = pkg?.duration_min ?? null;

  if (service.kind === 'school') {
    const groups = Array.isArray(answers.groups) ? answers.groups : [];
    const byPkg = new Map();
    for (const g of groups) {
      const p = packages.find((x) => x.package_key === g.package_key) || packages[0];
      const n = Math.max(0, Math.floor(Number(g.students) || 0));
      byPkg.set(p.id, { p, qty: (byPkg.get(p.id)?.qty || 0) + n });
    }
    if (!byPkg.size) reasons.push(L('Faltan grupos y alumnos.', 'Groups and students are missing.'));
    for (const { p, qty } of byPkg.values()) {
      lines.push({ key: `base:${p.package_key}`, kind: 'base', label: L(`${p.name_es} (${p.unit_es || 'por unidad'})`, `${p.name_en} (${p.unit_en || 'per unit'})`), qty, unit_cents: p.price_cents, amount_cents: p.price_cents == null ? null : p.price_cents * qty });
    }
    pkg = [...byPkg.values()][0]?.p || pkg;
  } else if (pkg) {
    if (pkg.pricing === 'quote' || pkg.price_cents == null) {
      lines.push({ key: `base:${pkg.package_key}`, kind: 'base', label: L(pkg.name_es, pkg.name_en), qty: 1, unit_cents: null, amount_cents: null });
    } else {
      lines.push({ key: `base:${pkg.package_key}`, kind: 'base', label: L(pkg.name_es, pkg.name_en), qty: 1, unit_cents: pkg.price_cents, amount_cents: pkg.price_cents });
    }
  }

  // Extras declarados en el cuestionario (p. ej. fotos u horas adicionales)
  const q = currentQuestionnaire(app, service.id);
  for (const f of q?.fields || []) {
    if (!f.extra) continue;
    const included = Number(f.included || 0);
    const value = Math.max(0, Math.floor(Number(answers[f.name]) || 0));
    if (f.name === 'coverage_hours' && value) duration = value * 60;
    const qty = value - included;
    if (qty <= 0) continue;
    const extra = app.db.get('SELECT * FROM extras WHERE key = ? AND active = 1', f.extra);
    if (!extra) continue;
    lines.push({ key: `extra:${extra.key}`, kind: 'extra', label: L(extra.name_es, extra.name_en), qty, unit_cents: extra.price_cents, amount_cents: extra.price_cents == null ? null : extra.price_cents * qty });
  }

  // Viáticos por ciudad
  const city = normCity(answers.city);
  if (city) {
    const zones = app.db.all('SELECT * FROM travel_zones WHERE active = 1');
    const zone = zones.find((z) => json(z.cities, []).some((c) => normCity(c) === city));
    if (!zone) {
      lines.push({ key: 'travel', kind: 'travel', label: L(`Viáticos a ${answers.city}`, `Travel to ${answers.city}`), qty: 1, unit_cents: null, amount_cents: null });
    } else if (zone.price_cents == null) {
      lines.push({ key: 'travel', kind: 'travel', label: L(`Viáticos (${zone.name})`, `Travel (${zone.name})`), qty: 1, unit_cents: null, amount_cents: null });
    } else if (zone.price_cents > 0) {
      lines.push({ key: 'travel', kind: 'travel', label: L(`Viáticos (${zone.name})`, `Travel (${zone.name})`), qty: 1, unit_cents: zone.price_cents, amount_cents: zone.price_cents });
    }
  } else {
    reasons.push(L('Falta la ciudad.', 'The city is missing.'));
  }

  // Importes que Fani completa desde el panel
  for (const line of lines) {
    if (line.amount_cents == null && adminOverrides[line.key] != null) {
      line.amount_cents = adminOverrides[line.key];
      line.unit_cents = line.qty ? Math.round(line.amount_cents / line.qty) : line.amount_cents;
      line.set_by_admin = true;
    }
  }
  for (const c of customLines) {
    if (c && c.label && Number.isFinite(c.amount_cents)) lines.push({ key: `custom:${c.id || lines.length}`, kind: 'custom', label: L(c.label, c.label_en || c.label), qty: 1, unit_cents: c.amount_cents, amount_cents: c.amount_cents });
  }

  if (durationOverride) duration = durationOverride;
  for (const l of lines) if (l.amount_cents == null) reasons.push(L(`Importe por definir: ${l.label.es}`, `Amount to be defined: ${l.label.en}`));
  if (!duration) reasons.push(L('Duración por definir.', 'Duration to be defined.'));
  return { pkg, lines, reasons, duration };
}

export function totals(app, kind, lines, discountCode) {
  const subtotal = lines.filter((l) => l.kind !== 'travel').reduce((s, l) => s + (l.amount_cents || 0), 0);
  const travel = lines.filter((l) => l.kind === 'travel').reduce((s, l) => s + (l.amount_cents || 0), 0);
  const { discount, invalidCode } = findDiscount(app, discountCode, kind, subtotal);
  let discountCents = 0;
  if (discount) discountCents = discount.kind === 'percent' ? Math.round((subtotal * Math.min(100, discount.value)) / 100) : Math.min(subtotal, discount.value);
  const total = subtotal - discountCents + travel;
  const { deposit, balance } = split(total, app.setting('booking').deposit_percent ?? 50);
  return { subtotal, travel, discountCents, discount, invalidCode, total, deposit, balance };
}

function upsertCustomer(app, { name, email, phone, lang }) {
  const existing = app.db.get('SELECT * FROM customers WHERE email = ? COLLATE NOCASE ORDER BY id DESC', email);
  if (existing) {
    app.db.run('UPDATE customers SET name = ?, phone = ?, lang = ? WHERE id = ?', name, phone, lang, existing.id);
    return existing.id;
  }
  return Number(app.db.run('INSERT INTO customers (name, email, phone, lang, created_at) VALUES (?, ?, ?, ?, ?)', name, email, phone, lang, app.now()).lastInsertRowid);
}

export function createQuote(app, { service, customer, answers, lang }) {
  const built = buildQuote(app, service, answers);
  const complete = built.reasons.length === 0;
  const t = complete ? totals(app, service.kind, built.lines, answers.discount_code) : null;
  const q = currentQuestionnaire(app, service.id);
  const now = app.now();
  return app.db.tx(() => {
    const customerId = upsertCustomer(app, { ...customer, lang });
    const tok = token(18);
    const id = Number(app.db.run(
      `INSERT INTO quotes (token, customer_id, service_id, package_version_id, questionnaire_id, answers, lang, status, pending_reasons, lines,
        subtotal_cents, discount_cents, travel_cents, total_cents, deposit_cents, balance_cents, discount_id, duration_min, location_city, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tok, customerId, service.id, built.pkg?.id ?? null, q?.id ?? null, JSON.stringify(answers), lang,
      complete ? 'ready' : 'pending_admin', JSON.stringify(built.reasons), JSON.stringify(built.lines),
      t?.subtotal ?? null, t?.discountCents ?? null, t?.travel ?? null, t?.total ?? null, t?.deposit ?? null, t?.balance ?? null,
      t?.discount?.id ?? null, built.duration, answers.city || null, now, now
    ).lastInsertRowid);
    app.log('cliente', complete ? 'cotizacion_lista' : 'cotizacion_pendiente', { entity: 'quote', id, details: complete ? null : built.reasons.map((r) => r.es).join(' · ') });
    return { id, token: tok, complete, invalidCode: t?.invalidCode };
  });
}

// Fani completa importes, agrega conceptos o define duración. Si la cotización ya se había aceptado, pide nueva aceptación.
export function adminUpdateQuote(app, quoteId, { overrides = {}, customLines = [], duration = null, note = null, discountCode }) {
  const quote = app.db.get('SELECT * FROM quotes WHERE id = ?', quoteId);
  if (!quote || quote.status === 'cancelled') throw new Error('Cotización no disponible');
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const answers = json(quote.answers, {});
  if (discountCode !== undefined) answers.discount_code = discountCode;
  const built = buildQuote(app, service, answers, { adminOverrides: overrides, customLines, durationOverride: duration });
  const complete = built.reasons.length === 0;
  const t = complete ? totals(app, service.kind, built.lines, answers.discount_code) : null;
  app.db.run(
    `UPDATE quotes SET answers = ?, lines = ?, pending_reasons = ?, status = ?, revision = revision + 1, subtotal_cents = ?, discount_cents = ?, travel_cents = ?,
      total_cents = ?, deposit_cents = ?, balance_cents = ?, discount_id = ?, duration_min = ?, admin_note = ?, updated_at = ? WHERE id = ?`,
    JSON.stringify(answers), JSON.stringify(built.lines), JSON.stringify(built.reasons), complete ? 'ready' : 'pending_admin',
    t?.subtotal ?? null, t?.discountCents ?? null, t?.travel ?? null, t?.total ?? null, t?.deposit ?? null, t?.balance ?? null, t?.discount?.id ?? null,
    built.duration, note, app.now(), quoteId
  );
  app.log('admin', 'cotizacion_actualizada', { entity: 'quote', id: quoteId, details: complete ? 'completa' : built.reasons.map((r) => r.es).join(' · ') });
  return { complete, reasons: built.reasons };
}

// Aceptación: guarda una copia inmutable de precios y condiciones (los cambios posteriores no la alteran).
export function acceptQuote(app, quoteToken, { revision }) {
  return app.db.tx(() => {
    const q = app.db.get('SELECT * FROM quotes WHERE token = ?', quoteToken);
    if (!q) throw Object.assign(new Error('not_found'), { code: 'not_found' });
    if (q.status === 'accepted' && q.accepted_revision === q.revision) return q;
    if (q.status !== 'ready') throw Object.assign(new Error('not_ready'), { code: 'not_ready' });
    if (Number(revision) !== q.revision) throw Object.assign(new Error('changed'), { code: 'changed' });
    if (q.discount_id) {
      const d = app.db.get('SELECT * FROM discounts WHERE id = ?', q.discount_id);
      if (!d || !d.active || (d.max_uses != null && d.uses >= d.max_uses)) throw Object.assign(new Error('discount'), { code: 'discount_unavailable' });
      if (q.accepted_revision == null) app.db.run('UPDATE discounts SET uses = uses + 1 WHERE id = ?', d.id);
    }
    const service = app.db.get('SELECT * FROM services WHERE id = ?', q.service_id);
    const pkg = q.package_version_id ? app.db.get('SELECT * FROM package_versions WHERE id = ?', q.package_version_id) : null;
    const settings = app.setting('booking');
    const snapshot = {
      revision: q.revision,
      accepted_at: app.now(),
      service: { slug: service.slug, kind: service.kind, name_es: service.name_es, name_en: service.name_en },
      package: pkg && {
        id: pkg.id, key: pkg.package_key, version: pkg.version, name_es: pkg.name_es, name_en: pkg.name_en, price_cents: pkg.price_cents,
        includes_es: json(pkg.includes_es, []), includes_en: json(pkg.includes_en, []), delivery_days: pkg.delivery_days,
      },
      lines: json(q.lines, []),
      subtotal_cents: q.subtotal_cents, discount_cents: q.discount_cents, travel_cents: q.travel_cents,
      total_cents: q.total_cents, deposit_cents: q.deposit_cents, balance_cents: q.balance_cents,
      deposit_percent: settings.deposit_percent,
      duration_min: q.duration_min,
      cancellation: app.setting('cancellation')[q.lang] || app.setting('cancellation').es,
      conditions: app.content('general_conditions', q.lang),
    };
    app.db.run("UPDATE quotes SET status = 'accepted', accepted_at = ?, accepted_revision = ?, accepted_snapshot = ?, updated_at = ? WHERE id = ?",
      app.now(), q.revision, JSON.stringify(snapshot), app.now(), q.id);
    app.log('cliente', 'cotizacion_aceptada', { entity: 'quote', id: q.id, details: `revisión ${q.revision}` });
    return app.db.get('SELECT * FROM quotes WHERE id = ?', q.id);
  });
}

export const quoteSnapshot = (q) => json(q?.accepted_snapshot, null);
