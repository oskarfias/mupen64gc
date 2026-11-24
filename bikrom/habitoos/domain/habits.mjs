// Motor de hábitos. Toda consulta pasa por owner_id: un usuario nunca ve ni modifica datos de otro.
// Reglas clave: metas y programación versionadas por fecha; "sin registro" ≠ "no cumplido";
// pausas y "no aplica" no penalizan; los indicadores se recalculan siempre desde los registros fuente.
import { json } from '../../photography/db.mjs';
import { localDate, isDate, isTime, addDays, isoWeekday, eachDate } from '../lib/tz.mjs';
import { categoryKeys, barrierKeys, templateByKey } from './catalog.mjs';

export const FREE_ACTIVE_LIMIT = 3;
export const FREE_HISTORY_DAYS = 30;
export const STATUSES = ['done', 'partial', 'missed', 'skipped', 'not_applicable'];
const KINDS = ['build', 'maintain', 'reduce', 'quit'];
const MEASURES = ['binary', 'count', 'duration', 'range'];
const COMPARATORS = ['done', '>=', '<=', '=', 'range'];
const FAR = '9999-12-31';

const err = (code, status = 400, extra = {}) => Object.assign(new Error(code), { code, status, ...extra });
const num = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);
const clean = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : null) || null;

export const today = (app, user) => localDate(app.now(), user.timezone);

export function isPro(app, userId) {
  return Boolean(app.db.get("SELECT 1 FROM entitlements WHERE owner_id = ? AND feature = 'pro' AND (valid_until IS NULL OR valid_until > ?)", userId, app.iso()));
}

// Único punto de acceso a un hábito: siempre filtrado por propietario (404 si no es suyo)
export function ownHabit(app, userId, habitId) {
  const h = typeof habitId === 'string' && habitId.length <= 40 ? app.db.get('SELECT * FROM habits WHERE id = ? AND owner_id = ?', habitId, userId) : null;
  if (!h) throw err('not_found', 404);
  return h;
}

// ───────────── Validación ─────────────
function validateGoal(measure, g) {
  const comparator = measure === 'binary' ? 'done' : g.comparator;
  if (!COMPARATORS.includes(comparator)) throw err('invalid_goal');
  const target = num(g.target);
  const targetMax = num(g.target_max);
  const partialMin = num(g.partial_min);
  if (comparator !== 'done' && (target == null || Number.isNaN(target) || target < 0)) throw err('invalid_goal');
  if (comparator === 'range' && (targetMax == null || Number.isNaN(targetMax) || targetMax < target)) throw err('invalid_goal');
  if ([targetMax, partialMin].some((v) => Number.isNaN(v) || (v != null && v < 0))) throw err('invalid_goal');
  return { comparator, target: comparator === 'done' ? null : target, target_max: targetMax, partial_min: partialMin };
}

function validateDays(days) {
  const d = [...new Set((Array.isArray(days) ? days : []).map(Number))].filter((x) => x >= 1 && x <= 7).sort();
  if (!d.length) throw err('invalid_schedule');
  return d;
}

// ───────────── Evaluación de un valor contra la meta vigente ─────────────
export function evaluate(goal, value) {
  if (!goal || goal.comparator === 'done') return value > 0 ? 'done' : 'missed';
  const t = goal.target;
  switch (goal.comparator) {
    case '>=':
      if (value >= t) return 'done';
      if (goal.partial_min != null) return value >= goal.partial_min ? 'partial' : 'missed';
      return value > 0 ? 'partial' : 'missed';
    case '<=':
      if (value <= t) return 'done';
      return goal.target_max != null && value <= goal.target_max ? 'partial' : 'missed';
    case '=':
      return value === t ? 'done' : 'missed';
    case 'range':
      return value >= t && value <= goal.target_max ? 'done' : 'missed';
    default:
      return 'missed';
  }
}

export const goalAt = (app, habitId, date) =>
  app.db.get('SELECT * FROM habit_goal_versions WHERE habit_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1', habitId, date, date);
export const scheduleAt = (app, habitId, date) =>
  app.db.get('SELECT * FROM habit_schedules WHERE habit_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1', habitId, date, date);
const pausedAt = (app, habitId, date) => Boolean(app.db.get('SELECT 1 FROM habit_pauses WHERE habit_id = ? AND from_date <= ? AND to_date >= ?', habitId, date, date));

// ¿Estaba programado este hábito en esa fecha local?
export function scheduledOn(app, habit, date) {
  if (date < habit.start_date || (habit.archived_on && date >= habit.archived_on)) return false;
  const s = scheduleAt(app, habit.id, date);
  return Boolean(s && json(s.days, []).includes(isoWeekday(date)));
}

// ───────────── Alta, edición, metas y programación ─────────────
export function createHabit(app, user, input, { templateKey = null } = {}) {
  const measure = input.measure;
  if (!MEASURES.includes(measure) || !KINDS.includes(input.kind)) throw err('invalid_habit');
  const name = clean(input.name, 80);
  if (!name) throw err('invalid_habit');
  const category = categoryKeys.includes(input.category) ? input.category : 'custom';
  const goal = validateGoal(measure, input.goal || {});
  const days = validateDays(input.days || [1, 2, 3, 4, 5, 6, 7]);
  const time = isTime(input.time) ? input.time : null;
  const start = isDate(input.start_date) && input.start_date >= today(app, user) ? input.start_date : today(app, user);
  const barriers = (Array.isArray(input.barriers) ? input.barriers : []).filter((b) => barrierKeys.includes(b));
  const baseline = num(input.baseline_value);
  return app.db.tx(() => {
    if (templateKey) {
      const existing = app.db.get('SELECT id FROM habits WHERE owner_id = ? AND template_key = ?', user.id, templateKey);
      if (existing) return existing.id; // repetir un paso del onboarding no duplica hábitos
    }
    const active = app.db.get("SELECT COUNT(*) AS n FROM habits WHERE owner_id = ? AND status = 'active'", user.id).n;
    if (active >= FREE_ACTIVE_LIMIT && !isPro(app, user.id)) throw err('free_limit', 402, { limit: FREE_ACTIVE_LIMIT });
    const id = app.id();
    const now = app.iso();
    const sort = (app.db.get('SELECT COALESCE(MAX(sort), 0) AS m FROM habits WHERE owner_id = ?', user.id).m || 0) + 1;
    app.db.run(`INSERT INTO habits (id, owner_id, name, category, emoji, kind, measure, unit, baseline_value, baseline_unknown, motivation, barriers, contingency, status, start_date, template_key, sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      id, user.id, name, category, clean(input.emoji, 8), input.kind, measure, measure === 'binary' ? null : clean(input.unit, 20),
      Number.isNaN(baseline) ? null : baseline, input.baseline_unknown || baseline == null ? 1 : 0, clean(input.motivation, 500),
      JSON.stringify(barriers), clean(input.contingency, 300), start, templateKey, sort, now, now);
    app.db.run('INSERT INTO habit_goal_versions (id, habit_id, owner_id, comparator, target, target_max, partial_min, valid_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      app.id(), id, user.id, goal.comparator, goal.target, goal.target_max, goal.partial_min, start, now);
    app.db.run('INSERT INTO habit_schedules (id, habit_id, owner_id, days, local_time, valid_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      app.id(), id, user.id, JSON.stringify(days), time, start, now);
    app.audit(user.id, 'habit_created', 'habit', id, { kind: input.kind, measure, template: templateKey });
    return id;
  });
}

export function updateHabit(app, user, habitId, patch) {
  const h = ownHabit(app, user.id, habitId);
  const fields = {};
  if (patch.name !== undefined) { const n = clean(patch.name, 80); if (!n) throw err('invalid_habit'); fields.name = n; }
  if (patch.emoji !== undefined) fields.emoji = clean(patch.emoji, 8);
  if (patch.unit !== undefined && h.measure !== 'binary') fields.unit = clean(patch.unit, 20);
  if (patch.category !== undefined) fields.category = categoryKeys.includes(patch.category) ? patch.category : 'custom';
  if (patch.motivation !== undefined) fields.motivation = clean(patch.motivation, 500);
  if (patch.contingency !== undefined) fields.contingency = clean(patch.contingency, 300);
  if (patch.barriers !== undefined) fields.barriers = JSON.stringify((patch.barriers || []).filter((b) => barrierKeys.includes(b)));
  const t = today(app, user);
  return app.db.tx(() => {
    if (patch.status && patch.status !== h.status) {
      if (!['active', 'paused', 'archived'].includes(patch.status)) throw err('invalid_status');
      if (patch.status === 'active') {
        const active = app.db.get("SELECT COUNT(*) AS n FROM habits WHERE owner_id = ? AND status = 'active'", user.id).n;
        if (active >= FREE_ACTIVE_LIMIT && !isPro(app, user.id)) throw err('free_limit', 402, { limit: FREE_ACTIVE_LIMIT });
        // Termina la pausa abierta ayer; reactivar un archivado lo vuelve a programar desde hoy
        app.db.run("UPDATE habit_pauses SET to_date = ? WHERE habit_id = ? AND to_date = ? AND from_date < ?", addDays(t, -1), h.id, FAR, t);
        app.db.run("DELETE FROM habit_pauses WHERE habit_id = ? AND to_date = ? AND from_date >= ?", h.id, FAR, t);
        fields.archived_on = null;
      }
      if (patch.status === 'paused') app.db.run('INSERT INTO habit_pauses (id, habit_id, owner_id, from_date, to_date, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', app.id(), h.id, user.id, t, FAR, 'pause', app.iso());
      if (patch.status === 'archived') fields.archived_on = t;
      fields.status = patch.status;
    }
    const cols = Object.keys(fields);
    if (cols.length) app.db.run(`UPDATE habits SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND owner_id = ?`, ...cols.map((c) => fields[c]), app.iso(), h.id, user.id);
    app.audit(user.id, 'habit_updated', 'habit', h.id, { fields: cols });
    return ownHabit(app, user.id, h.id);
  });
}

// Nueva versión de meta desde una fecha: el historial anterior se sigue evaluando con la meta original.
export function changeGoal(app, user, habitId, goalInput, effectiveFrom) {
  const h = ownHabit(app, user.id, habitId);
  const goal = validateGoal(h.measure, goalInput);
  const from = isDate(effectiveFrom) ? effectiveFrom : today(app, user);
  if (from < h.start_date) throw err('invalid_date');
  app.db.tx(() => {
    const id = app.id();
    app.db.run('INSERT INTO habit_goal_versions (id, habit_id, owner_id, comparator, target, target_max, partial_min, valid_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, h.id, user.id, goal.comparator, goal.target, goal.target_max, goal.partial_min, from, app.iso());
    // Los registros desde la fecha de vigencia se reevalúan con la nueva meta; los anteriores no cambian
    for (const o of app.db.all('SELECT * FROM habit_occurrences WHERE habit_id = ? AND local_date >= ?', h.id, from)) {
      const status = o.value != null && ['done', 'partial', 'missed'].includes(o.status) && h.measure !== 'binary' ? evaluate(goal, o.value) : o.status;
      app.db.run('UPDATE habit_occurrences SET status = ?, goal_version_id = ?, updated_at = ? WHERE id = ?', status, id, app.iso(), o.id);
    }
    app.db.run('DELETE FROM habit_goal_versions WHERE habit_id = ? AND valid_from >= ? AND id != ?', h.id, from, id);
    app.db.run('UPDATE habit_goal_versions SET valid_to = ? WHERE habit_id = ? AND valid_from < ? AND (valid_to IS NULL OR valid_to >= ?)', addDays(from, -1), h.id, from, from);
  });
  app.audit(user.id, 'goal_versioned', 'habit', h.id, { from });
}

export function changeSchedule(app, user, habitId, { days, time }, effectiveFrom) {
  const h = ownHabit(app, user.id, habitId);
  const d = validateDays(days);
  const from = isDate(effectiveFrom) && effectiveFrom >= h.start_date ? effectiveFrom : today(app, user);
  app.db.tx(() => {
    app.db.run('DELETE FROM habit_schedules WHERE habit_id = ? AND valid_from >= ?', h.id, from);
    app.db.run('UPDATE habit_schedules SET valid_to = ? WHERE habit_id = ? AND valid_from < ? AND (valid_to IS NULL OR valid_to >= ?)', addDays(from, -1), h.id, from, from);
    app.db.run('INSERT INTO habit_schedules (id, habit_id, owner_id, days, local_time, valid_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      app.id(), h.id, user.id, JSON.stringify(d), isTime(time) ? time : null, from, app.iso());
  });
  app.audit(user.id, 'schedule_versioned', 'habit', h.id, { from });
}

export function addRestDay(app, user, habitId, date) {
  const h = ownHabit(app, user.id, habitId);
  if (!isDate(date)) throw err('invalid_date');
  app.db.run('INSERT INTO habit_pauses (id, habit_id, owner_id, from_date, to_date, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', app.id(), h.id, user.id, date, date, 'rest_day', app.iso());
}

// ───────────── Registro diario (autoguardado idempotente con deshacer) ─────────────
export function logOccurrence(app, user, habitId, date, { status = null, value = null, requestId = null } = {}) {
  const h = ownHabit(app, user.id, habitId);
  if (!isDate(date) || date > today(app, user)) throw err('invalid_date'); // no se registran días futuros
  if (date < h.start_date) throw err('invalid_date');
  const rid = typeof requestId === 'string' && requestId.length <= 64 ? requestId : null;
  return app.db.tx(() => {
    if (rid) {
      const prior = app.db.get('SELECT l.*, o.local_date, o.habit_id FROM habit_logs l JOIN habit_occurrences o ON o.id = l.occurrence_id WHERE l.owner_id = ? AND l.request_id = ?', user.id, rid);
      if (prior) return occurrenceView(app, h, date, today(app, user)); // reintento de red: no duplica
    }
    const goal = goalAt(app, h.id, date);
    let v = num(value);
    if (Number.isNaN(v) || (v != null && (v < 0 || v > 1e7))) throw err('invalid_value');
    let s;
    if (status === 'cleared') { s = 'cleared'; v = null; }
    else if (['skipped', 'not_applicable'].includes(status)) { s = status; v = null; }
    else if (h.measure === 'binary') {
      if (!['done', 'missed'].includes(status)) throw err('invalid_status');
      s = status; v = status === 'done' ? 1 : 0;
    } else {
      if (v == null) { if (status !== 'missed') throw err('invalid_value'); s = 'missed'; }
      else s = evaluate(goal, v);
    }
    const prev = app.db.get('SELECT * FROM habit_occurrences WHERE habit_id = ? AND local_date = ?', h.id, date);
    const now = app.iso();
    let occId = prev?.id;
    if (prev) app.db.run('UPDATE habit_occurrences SET status = ?, value = ?, goal_version_id = ?, updated_at = ? WHERE id = ?', s, v, goal?.id ?? null, now, prev.id);
    else {
      occId = app.id();
      app.db.run('INSERT INTO habit_occurrences (id, habit_id, owner_id, local_date, timezone, status, value, goal_version_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        occId, h.id, user.id, date, user.timezone, s, v, goal?.id ?? null, now);
    }
    app.db.run('INSERT INTO habit_logs (id, occurrence_id, owner_id, status, value, prev_status, prev_value, request_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      app.id(), occId, user.id, s, v, prev?.status ?? null, prev?.value ?? null, rid, 'app', now);
    return occurrenceView(app, h, date, today(app, user));
  });
}

export function undoLog(app, user, habitId, date) {
  const h = ownHabit(app, user.id, habitId);
  return app.db.tx(() => {
    const o = app.db.get('SELECT * FROM habit_occurrences WHERE habit_id = ? AND local_date = ?', h.id, date);
    if (!o) throw err('nothing_to_undo', 409);
    const last = app.db.get("SELECT * FROM habit_logs WHERE occurrence_id = ? AND source = 'app' ORDER BY created_at DESC, rowid DESC LIMIT 1", o.id);
    if (!last) throw err('nothing_to_undo', 409);
    const status = last.prev_status ?? 'cleared';
    app.db.run('UPDATE habit_occurrences SET status = ?, value = ?, updated_at = ? WHERE id = ?', status, last.prev_value, app.iso(), o.id);
    app.db.run("UPDATE habit_logs SET source = 'undone' WHERE id = ?", last.id);
    app.db.run("INSERT INTO habit_logs (id, occurrence_id, owner_id, status, value, prev_status, prev_value, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'undo', ?)",
      app.id(), o.id, user.id, status, last.prev_value, o.status, o.value, app.iso());
    return occurrenceView(app, h, date, today(app, user));
  });
}

// Estado mostrado: registrado, o derivado (pendiente hoy / sin registro en días pasados / pausado)
export function occurrenceView(app, habit, date, todayDate = null) {
  const o = app.db.get('SELECT * FROM habit_occurrences WHERE habit_id = ? AND local_date = ?', habit.id, date);
  const goal = goalAt(app, habit.id, date);
  const recorded = o && o.status !== 'cleared';
  let status;
  if (recorded) status = o.status;
  else if (pausedAt(app, habit.id, date)) status = 'paused';
  else status = todayDate && date === todayDate ? 'pending' : 'no_data';
  return { habit_id: habit.id, date, status, value: o && o.status !== 'cleared' ? o.value : null, goal: goal && { comparator: goal.comparator, target: goal.target, target_max: goal.target_max } };
}

// ───────────── Today ─────────────
export function daily(app, user, date) {
  const t = today(app, user);
  const habits = app.db.all("SELECT * FROM habits WHERE owner_id = ? AND status != 'archived' OR (owner_id = ? AND archived_on > ?) ORDER BY sort, created_at", user.id, user.id, date)
    .filter((h) => h.owner_id === user.id && scheduledOn(app, h, date));
  const items = habits.map((h) => ({
    id: h.id, name: h.name, emoji: h.emoji, kind: h.kind, measure: h.measure, unit: h.unit, category: h.category, contingency: h.contingency,
    ...occurrenceView(app, h, date, t),
  }));
  const count = (s) => items.filter((i) => i.status === s).length;
  const eligible = items.filter((i) => !['paused', 'not_applicable'].includes(i.status)).length;
  const recorded = items.filter((i) => ['done', 'partial', 'missed', 'skipped'].includes(i.status)).length;
  return {
    date, today: t, items,
    summary: {
      scheduled: items.length, done: count('done'), partial: count('partial'), missed: count('missed'), skipped: count('skipped'),
      pending: count('pending'), no_data: count('no_data'), paused: count('paused'), not_applicable: count('not_applicable'),
      evaluated: count('done') + count('partial') + count('missed'), coverage: eligible ? Math.round((recorded / eligible) * 100) : null,
    },
  };
}

// ───────────── Indicadores (PRD §5), recalculados desde los registros fuente ─────────────
// Adherencia = cumplidas / (cumplidas + parciales + no cumplidas). Pendientes y sin registro NO cuentan.
// Cobertura  = (cumplidas + parciales + no cumplidas + omitidas) / (programadas − pausadas − no aplica).
// Recuperación = oportunidades programadas hasta volver a cumplir tras una no cumplida (promedio descriptivo).
export function metrics(app, user, from, to, { habitId = null } = {}) {
  const t = today(app, user);
  const end = to > t ? t : to;
  const habits = habitId ? [ownHabit(app, user.id, habitId)] : app.db.all('SELECT * FROM habits WHERE owner_id = ? ORDER BY sort, created_at', user.id);
  const perHabit = habits.map((h) => {
    const c = { scheduled: 0, done: 0, partial: 0, missed: 0, skipped: 0, not_applicable: 0, paused: 0, no_data: 0, pending: 0 };
    const recoveries = [];
    let gap = null;
    const series = [];
    for (const d of eachDate(from, end)) {
      if (!scheduledOn(app, h, d)) continue;
      const v = occurrenceView(app, h, d, t);
      c.scheduled++;
      c[v.status]++;
      series.push({ date: d, status: v.status, value: v.value });
      if (v.status === 'missed') gap = gap == null ? 1 : gap + 1;
      else if (v.status === 'done' && gap != null) { recoveries.push(gap); gap = null; }
      else if (gap != null && ['partial', 'no_data', 'skipped'].includes(v.status)) gap++;
    }
    const evaluable = c.done + c.partial + c.missed;
    const eligible = c.scheduled - c.paused - c.not_applicable - c.pending;
    return {
      habit_id: h.id, name: h.name, emoji: h.emoji, kind: h.kind, unit: h.unit, measure: h.measure, counts: c,
      adherence: evaluable ? Math.round((c.done / evaluable) * 1000) / 10 : null, adherence_n: evaluable,
      coverage: eligible > 0 ? Math.round(((c.done + c.partial + c.missed + c.skipped) / eligible) * 1000) / 10 : null, coverage_n: eligible,
      recovery_avg: recoveries.length ? Math.round((recoveries.reduce((a, b) => a + b, 0) / recoveries.length) * 10) / 10 : null, recovery_n: recoveries.length,
      series,
    };
  });
  const sum = (k) => perHabit.reduce((s, h) => s + h.counts[k], 0);
  const evaluable = sum('done') + sum('partial') + sum('missed');
  const eligible = sum('scheduled') - sum('paused') - sum('not_applicable') - sum('pending');
  return {
    from, to: end, habits: perHabit,
    overall: {
      adherence: evaluable ? Math.round((sum('done') / evaluable) * 1000) / 10 : null, adherence_n: evaluable,
      coverage: eligible > 0 ? Math.round(((sum('done') + sum('partial') + sum('missed') + sum('skipped')) / eligible) * 1000) / 10 : null, coverage_n: eligible,
    },
  };
}

// ───────────── Exportación de todos los datos del usuario ─────────────
export function exportData(app, userId) {
  const q = (sql) => app.db.all(sql, userId);
  return {
    exported_at: app.iso(), format: 'bikrom-habitoos/v1',
    account: app.db.get('SELECT id, email, email_verified_at, created_at FROM users WHERE id = ?', userId),
    profile: app.db.get('SELECT locale, timezone, units, theme, onboarding_completed_at FROM profiles WHERE user_id = ?', userId),
    habits: q('SELECT * FROM habits WHERE owner_id = ?'),
    goal_versions: q('SELECT * FROM habit_goal_versions WHERE owner_id = ?'),
    schedules: q('SELECT * FROM habit_schedules WHERE owner_id = ?'),
    pauses: q('SELECT * FROM habit_pauses WHERE owner_id = ?'),
    occurrences: q('SELECT * FROM habit_occurrences WHERE owner_id = ? ORDER BY local_date'),
    logs: q('SELECT id, occurrence_id, status, value, prev_status, prev_value, source, created_at FROM habit_logs WHERE owner_id = ? ORDER BY created_at'),
    subscriptions: q('SELECT plan, status, current_period_end, cancel_at_period_end, amount_cents, currency, created_at, updated_at FROM subscriptions WHERE owner_id = ?'),
  };
}

export function exportCsv(app, userId) {
  const rows = app.db.all(`SELECT o.local_date, h.name, h.kind, h.unit, o.status, o.value, g.comparator, g.target, g.target_max
    FROM habit_occurrences o JOIN habits h ON h.id = o.habit_id LEFT JOIN habit_goal_versions g ON g.id = o.goal_version_id
    WHERE o.owner_id = ? AND o.status != 'cleared' ORDER BY o.local_date, h.sort`, userId);
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + ['date,habit,kind,unit,status,value,goal_comparator,goal_target,goal_target_max', ...rows.map((r) => [r.local_date, r.name, r.kind, r.unit, r.status, r.value, r.comparator, r.target, r.target_max].map(cell).join(','))].join('\r\n');
}

export { templateByKey };
