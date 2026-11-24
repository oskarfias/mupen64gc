// Plan de alimentación por equivalentes (PRD §14 / B16).
// - Grupos configurables con emoji; el emoji es una etiqueta visual del grupo, no un alimento ni una cantidad de calorías.
// - Plan editable por comidas y horarios, versionado por fecha (editar no reescribe días pasados).
// - Cada toque marca una porción; se permiten consumos fuera del plan y deshacer. Sin conteo calórico.
import { encrypt, decrypt } from '../../photography/lib/security.mjs';
import { isDate, isTime, addDays, eachDate } from '../lib/tz.mjs';
import { today, isPro, FREE_HISTORY_DAYS } from './habits.mjs';

const err = (code, status = 400) => Object.assign(new Error(code), { code, status });
const T = (es, en) => ({ es, en });
export const DEFAULT_GROUPS = [
  ['protein', '🍳', T('Proteínas (AOA)', 'Protein')], ['dairy', '🥛', T('Lácteos', 'Dairy')], ['vegetables', '🥬', T('Verduras', 'Vegetables')],
  ['fruit', '🍎', T('Frutas', 'Fruit')], ['legumes', '🫘', T('Leguminosas', 'Legumes')], ['fats', '🥑', T('Grasas', 'Fats')], ['cereals', '🍞', T('Cereales', 'Grains')],
];
export const DEFAULT_MEALS = [
  ['breakfast', T('Desayuno', 'Breakfast'), '08:00'], ['snack1', T('Colación', 'Snack'), '11:00'], ['lunch', T('Comida', 'Lunch'), '14:30'],
  ['snack2', T('Colación', 'Snack'), '18:00'], ['dinner', T('Cena', 'Dinner'), '20:30'],
];
const MAX_MEALS = 8;
const MAX_GROUPS = 12;
const round = (x) => Math.round(x * 100) / 100;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmoji = (s) => typeof s === 'string' && s.length > 0 && s.length <= 16 && /\p{Extended_Pictographic}/u.test(s);
const open = (v) => { if (!v) return ''; try { return decrypt(v); } catch { return ''; } };

export function groups(app, user, { all = false } = {}) {
  let rows = app.db.all(`SELECT * FROM nutrition_groups WHERE owner_id = ?${all ? '' : ' AND archived = 0'} ORDER BY sort, created_at`, user.id);
  if (!rows.length && !app.db.get('SELECT 1 FROM nutrition_groups WHERE owner_id = ?', user.id)) {
    app.db.tx(() => DEFAULT_GROUPS.forEach(([key, emoji, name], i) =>
      app.db.run('INSERT OR IGNORE INTO nutrition_groups (id, owner_id, key, emoji, name, sort, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)', app.id(), user.id, key, emoji, name[user.locale === 'en' ? 'en' : 'es'], i, app.iso())));
    rows = app.db.all('SELECT * FROM nutrition_groups WHERE owner_id = ? AND archived = 0 ORDER BY sort, created_at', user.id);
  }
  return rows;
}

const versionAt = (app, userId, date) => app.db.get('SELECT * FROM nutrition_plan_versions WHERE owner_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1', userId, date, date);

export function planAt(app, user, date) {
  const v = versionAt(app, user.id, date);
  if (!v) return null;
  const meals = app.db.all('SELECT * FROM nutrition_meals WHERE version_id = ? ORDER BY sort', v.id).map((m) => ({
    id: m.id, slot: m.slot, name: m.name, time: m.local_time,
    targets: app.db.all('SELECT t.group_id, t.portions FROM nutrition_targets t JOIN nutrition_groups g ON g.id = t.group_id WHERE t.meal_id = ? ORDER BY g.sort, g.created_at', m.id),
  }));
  return { version_id: v.id, valid_from: v.valid_from, notes: open(v.notes_enc), meals };
}

// input: { meals: [{ slot?, name, time, targets: { [groupId]: portions } }], notes, from }
export function savePlan(app, user, input = {}) {
  const td = today(app, user);
  const from = isDate(input.from) && input.from >= td ? input.from : td; // nunca reescribe días pasados
  const myGroups = new Set(groups(app, user, { all: true }).map((g) => g.id));
  const meals = (Array.isArray(input.meals) ? input.meals : []).slice(0, MAX_MEALS).map((m, i) => ({
    slot: /^[a-z0-9_-]{1,40}$/.test(m?.slot || '') ? m.slot : `meal${i + 1}`,
    name: text(m?.name, 40), time: isTime(m?.time) ? m.time : null,
    targets: Object.entries(m?.targets || {}).map(([g, p]) => [String(g), Math.round(Number(p) * 2) / 2]).filter(([g, p]) => myGroups.has(g) && p > 0 && p <= 20),
  })).filter((m) => m.name);
  if (!meals.length) throw err('invalid_plan_meals');
  if (new Set(meals.map((m) => m.slot)).size !== meals.length) meals.forEach((m, i) => { m.slot = `meal${i + 1}`; });
  const notes = text(input.notes, 1000);
  const now = app.iso();
  return app.db.tx(() => {
    // Versiones desde `from` o posteriores se reemplazan; la vigente se cierra en `from`.
    for (const v of app.db.all('SELECT id FROM nutrition_plan_versions WHERE owner_id = ? AND valid_from >= ?', user.id, from)) app.db.run('DELETE FROM nutrition_plan_versions WHERE id = ?', v.id);
    app.db.run('UPDATE nutrition_plan_versions SET valid_to = ? WHERE owner_id = ? AND valid_from < ? AND (valid_to IS NULL OR valid_to > ?)', from, user.id, from, from);
    const vid = app.id();
    app.db.run('INSERT INTO nutrition_plan_versions (id, owner_id, valid_from, valid_to, notes_enc, created_at) VALUES (?, ?, ?, NULL, ?, ?)', vid, user.id, from, notes ? encrypt(notes) : null, now);
    meals.forEach((m, i) => {
      const mid = app.id();
      app.db.run('INSERT INTO nutrition_meals (id, version_id, owner_id, slot, name, local_time, sort) VALUES (?, ?, ?, ?, ?, ?, ?)', mid, vid, user.id, m.slot, m.name, m.time, i);
      for (const [g, p] of m.targets) app.db.run('INSERT INTO nutrition_targets (meal_id, group_id, owner_id, portions) VALUES (?, ?, ?, ?)', mid, g, user.id, p);
    });
    app.audit(user.id, 'nutrition_plan_saved', 'nutrition_plan', vid);
    return planAt(app, user, from);
  });
}

export function saveGroups(app, user, list = []) {
  const existing = groups(app, user, { all: true });
  const byId = new Map(existing.map((g) => [g.id, g]));
  app.db.tx(() => {
    let sort = 0;
    for (const g of list.slice(0, MAX_GROUPS + existing.length)) {
      const name = text(g?.name, 30);
      const emoji = isEmoji(g?.emoji) ? g.emoji.trim() : null;
      const archived = g?.archived === true || g?.archived === '1' ? 1 : 0;
      if (g?.id && byId.has(g.id)) {
        const cur = byId.get(g.id);
        app.db.run('UPDATE nutrition_groups SET name = ?, emoji = ?, archived = ?, sort = ? WHERE id = ?', name || cur.name, emoji || cur.emoji, archived, sort++, g.id);
      } else if (!g?.id && name && emoji && app.db.get('SELECT COUNT(*) n FROM nutrition_groups WHERE owner_id = ? AND archived = 0', user.id).n < MAX_GROUPS) {
        app.db.run('INSERT INTO nutrition_groups (id, owner_id, key, emoji, name, sort, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)', app.id(), user.id, `custom_${app.id().slice(0, 8)}`, emoji, name, sort++, app.iso());
      }
    }
  });
  return groups(app, user);
}

function checkDate(app, user, date) {
  const td = today(app, user);
  if (!isDate(date) || date > td) throw err('invalid_date');
  if (!isPro(app, user.id) && date < addDays(td, -(FREE_HISTORY_DAYS - 1))) throw err('history_limited', 402);
}

// Resumen del día: por comida y grupo (planeado vs. marcado), fuera del plan y totales.
export function day(app, user, date) {
  const plan = planAt(app, user, date);
  const gs = groups(app, user, { all: true });
  const logs = app.db.all('SELECT meal_slot, group_id, SUM(portions) AS p FROM nutrition_logs WHERE owner_id = ? AND local_date = ? AND undone_at IS NULL GROUP BY meal_slot, group_id', user.id, date);
  const got = (slot, g) => round(logs.find((l) => l.meal_slot === slot && l.group_id === g)?.p || 0);
  const meals = (plan?.meals || []).map((m) => ({ ...m, items: m.targets.map((t) => ({ group_id: t.group_id, planned: t.portions, done: got(m.slot, t.group_id) })) }));
  const slots = new Set(meals.map((m) => m.slot));
  // Registros de una comida que ya no está en el plan (o sin plan) cuentan como fuera del plan
  const extra = {};
  for (const l of logs) {
    const target = l.meal_slot != null && slots.has(l.meal_slot) ? meals.find((m) => m.slot === l.meal_slot).targets.find((t) => t.group_id === l.group_id) : null;
    const over = target ? l.p - target.portions : l.p; // lo que excede la porción planeada también es "fuera del plan"
    if (over > 0) extra[l.group_id] = round((extra[l.group_id] || 0) + over);
  }
  const totals = gs.map((g) => {
    const planned = round(meals.reduce((s, m) => s + (m.targets.find((t) => t.group_id === g.id)?.portions || 0), 0));
    const inPlan = round(meals.reduce((s, m) => s + Math.min(m.items.find((i) => i.group_id === g.id)?.done || 0, m.items.find((i) => i.group_id === g.id)?.planned || 0), 0));
    return { group_id: g.id, planned, in_plan: inPlan, extra: extra[g.id] || 0 };
  }).filter((x) => x.planned > 0 || x.extra > 0);
  const planned = round(totals.reduce((s, x) => s + x.planned, 0));
  const covered = round(totals.reduce((s, x) => s + x.in_plan, 0));
  return {
    date, today: today(app, user), has_plan: Boolean(plan), groups: gs.map((g) => ({ id: g.id, key: g.key, emoji: g.emoji, name: g.name, archived: Boolean(g.archived) })),
    meals, extra, totals,
    summary: { planned, covered, extra: round(Object.values(extra).reduce((a, b) => a + b, 0)), adherence: planned ? Math.round((covered / planned) * 1000) / 10 : null },
  };
}

export function addPortion(app, user, date, { meal_slot = null, group_id, portions = 1, requestId = null } = {}) {
  checkDate(app, user, date);
  const g = app.db.get('SELECT id FROM nutrition_groups WHERE id = ? AND owner_id = ?', String(group_id || ''), user.id);
  if (!g) throw err('not_found', 404);
  const p = [0.5, 1].includes(Number(portions)) ? Number(portions) : 1;
  const rid = typeof requestId === 'string' && requestId.length <= 64 ? requestId : null;
  const slot = meal_slot && /^[a-z0-9_-]{1,40}$/.test(meal_slot) ? meal_slot : null;
  app.db.tx(() => {
    if (rid && app.db.get('SELECT 1 FROM nutrition_logs WHERE owner_id = ? AND request_id = ?', user.id, rid)) return; // reintento de red
    app.db.run('INSERT INTO nutrition_logs (id, owner_id, local_date, meal_slot, group_id, portions, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', app.id(), user.id, date, slot, g.id, p, rid, app.iso());
  });
  return day(app, user, date);
}

// Deshacer: quita la última porción marcada de ese grupo en esa comida (o fuera del plan).
export function removePortion(app, user, date, { meal_slot = null, group_id } = {}) {
  checkDate(app, user, date);
  const slot = meal_slot && /^[a-z0-9_-]{1,40}$/.test(meal_slot) ? meal_slot : null;
  const last = app.db.get(`SELECT id FROM nutrition_logs WHERE owner_id = ? AND local_date = ? AND group_id = ? AND ${slot ? 'meal_slot = ?' : 'meal_slot IS NULL'} AND undone_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    ...[user.id, date, String(group_id || '')], ...(slot ? [slot] : []));
  if (last) app.db.run('UPDATE nutrition_logs SET undone_at = ? WHERE id = ?', app.iso(), last.id);
  return day(app, user, date);
}

// Historial descriptivo: % del plan cubierto por día y porciones fuera del plan (sin calorías).
export function history(app, user, from, to) {
  const days = [];
  for (const d of eachDate(from, to)) {
    const x = day(app, user, d);
    if (!x.has_plan && !x.summary.extra) continue;
    days.push({ date: d, ...x.summary, totals: x.totals });
  }
  const withPlan = days.filter((d) => d.planned > 0);
  const logged = withPlan.filter((d) => d.covered > 0 || d.extra > 0);
  return {
    from, to, days,
    avg_adherence: logged.length ? Math.round((logged.reduce((s, d) => s + d.adherence, 0) / logged.length) * 10) / 10 : null, n: logged.length,
    days_without_log: withPlan.length - logged.length,
  };
}

export function exportNutrition(app, userId) {
  const q = (sql) => app.db.all(sql, userId);
  return {
    groups: q('SELECT id, key, emoji, name, archived FROM nutrition_groups WHERE owner_id = ?'),
    plan_versions: q('SELECT id, valid_from, valid_to, notes_enc FROM nutrition_plan_versions WHERE owner_id = ? ORDER BY valid_from').map((v) => ({ id: v.id, valid_from: v.valid_from, valid_to: v.valid_to, notes: open(v.notes_enc) })),
    meals: q('SELECT id, version_id, slot, name, local_time, sort FROM nutrition_meals WHERE owner_id = ?'),
    targets: q('SELECT meal_id, group_id, portions FROM nutrition_targets WHERE owner_id = ?'),
    logs: q('SELECT local_date, meal_slot, group_id, portions, undone_at, created_at FROM nutrition_logs WHERE owner_id = ? ORDER BY created_at'),
  };
}
