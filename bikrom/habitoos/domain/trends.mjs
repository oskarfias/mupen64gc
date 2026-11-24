// Indicadores de tendencia (PRD FR-07): series semanales o mensuales y comparación con la línea base.
// Todo se recalcula desde los registros fuente (habits.metrics), así una corrección histórica se refleja al instante.
// Cada valor lleva su n; con poca evidencia se marca como tal. No se infieren causas.
import { metrics, ownHabit, today } from './habits.mjs';
import { addDays, isoWeekday } from '../lib/tz.mjs';

export const BASELINE_DAYS = 14;
export const FEW = 7; // menos de 7 ocurrencias evaluables = poca evidencia

const round1 = (x) => Math.round(x * 10) / 10;
const bucketOf = (date, bucket) => (bucket === 'month' ? `${date.slice(0, 7)}-01` : addDays(date, -(isoWeekday(date) - 1)));

function aggregate(entries) {
  const c = { done: 0, partial: 0, missed: 0, skipped: 0, paused: 0, not_applicable: 0, pending: 0, no_data: 0 };
  const values = [];
  for (const e of entries) { c[e.status]++; if (e.value != null) values.push(e.value); }
  const evaluable = c.done + c.partial + c.missed;
  const eligible = entries.length - c.paused - c.not_applicable - c.pending;
  return {
    scheduled: entries.length, counts: c,
    adherence: evaluable ? round1((c.done / evaluable) * 100) : null, adherence_n: evaluable,
    coverage: eligible > 0 ? round1(((evaluable + c.skipped) / eligible) * 100) : null, coverage_n: eligible,
    value_avg: values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null, value_n: values.length,
  };
}

function buckets(from, to, bucket) {
  const out = [];
  for (let d = bucketOf(from, bucket); d <= to; ) {
    out.push(d);
    d = bucket === 'month' ? `${addDays(`${d.slice(0, 7)}-28`, 4).slice(0, 7)}-01` : addDays(d, 7);
  }
  return out;
}

// minDate: fecha más antigua visible (plan Free: últimos 30 días)
export function trends(app, user, from, to, { bucket = 'week', minDate = null } = {}) {
  const m = metrics(app, user, from, to);
  const keys = buckets(from, m.to, bucket);
  const all = Object.fromEntries(keys.map((k) => [k, []]));
  const habits = m.habits.map((h) => {
    const per = Object.fromEntries(keys.map((k) => [k, []]));
    for (const e of h.series) { const k = bucketOf(e.date, bucket); per[k]?.push(e); all[k]?.push(e); }
    return {
      habit_id: h.habit_id, name: h.name, emoji: h.emoji, kind: h.kind, unit: h.unit, measure: h.measure,
      series: keys.map((k) => ({ start: k, ...aggregate(per[k]) })),
      comparison: compare(app, user, h.habit_id, m.to, minDate),
    };
  });
  return { from, to: m.to, bucket, overall: keys.map((k) => ({ start: k, ...aggregate(all[k]) })), habits };
}

// Línea base = primeros 14 días del hábito (dentro de lo visible); reciente = últimos 14 días hasta `to`.
export function compare(app, user, habitId, to, minDate = null) {
  const h = ownHabit(app, user.id, habitId);
  const t = today(app, user);
  let bFrom = h.start_date;
  if (minDate && bFrom < minDate) bFrom = minDate;
  const bTo = addDays(bFrom, BASELINE_DAYS - 1);
  const rFrom = addDays(to, -(BASELINE_DAYS - 1));
  if (bTo >= rFrom || bTo > t) return { available: false, reason: 'not_enough_history', baseline_from: bFrom, recent_from: rFrom };
  const pick = (a, b) => {
    const x = metrics(app, user, a, b, { habitId }).habits[0];
    const s = aggregate(x.series);
    return { from: a, to: b, adherence: s.adherence, adherence_n: s.adherence_n, coverage: s.coverage, value_avg: s.value_avg, value_n: s.value_n, few: s.adherence_n < FEW };
  };
  const baseline = pick(bFrom, bTo);
  const recent = pick(rFrom, to);
  const diff = baseline.adherence != null && recent.adherence != null ? round1(recent.adherence - baseline.adherence) : null;
  return { available: true, baseline, recent, adherence_diff: diff, value_diff: baseline.value_avg != null && recent.value_avg != null ? round1(recent.value_avg - baseline.value_avg) : null };
}
