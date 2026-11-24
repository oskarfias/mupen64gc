// Onboarding adaptativo, guardable y reanudable. Crear los hábitos es idempotente (por clave de plantilla).
import { json } from '../../photography/db.mjs';
import { isTimeZone, isTime } from '../lib/tz.mjs';
import { categoryKeys, barrierKeys, templateByKey, TEMPLATES } from './catalog.mjs';
import { createHabit, FREE_ACTIVE_LIMIT, isPro } from './habits.mjs';

const err = (code, status = 400) => Object.assign(new Error(code), { code, status });
const MAX_STATE = 20_000;

export const getState = (app, userId) => json(app.db.get('SELECT onboarding_state FROM profiles WHERE user_id = ?', userId)?.onboarding_state, { step: 1 });

// Guarda el progreso tal como viene, acotado y saneado; no crea nada todavía.
export function saveState(app, user, input) {
  const s = {
    step: Math.min(8, Math.max(1, Number(input.step) || 1)),
    categories: (input.categories || []).filter((c) => categoryKeys.includes(c)).slice(0, 12),
    build: (input.build || []).filter((k) => templateByKey[k]?.kind === 'build').slice(0, 20),
    reduce: (input.reduce || []).filter((k) => templateByKey[k] && templateByKey[k].kind !== 'build').slice(0, 20),
    custom: (input.custom || []).slice(0, 5).map((c) => ({ name: String(c.name || '').slice(0, 80), kind: ['build', 'reduce', 'quit', 'maintain'].includes(c.kind) ? c.kind : 'build' })).filter((c) => c.name.trim()),
    priority: (input.priority || []).slice(0, FREE_ACTIVE_LIMIT).map(String),
    plans: input.plans && typeof input.plans === 'object' ? input.plans : {},
    barriers: (input.barriers || []).filter((b) => barrierKeys.includes(b)),
    motivation: String(input.motivation || '').slice(0, 500),
  };
  const raw = JSON.stringify(s);
  if (raw.length > MAX_STATE) throw err('too_large');
  const fields = ['onboarding_state = ?'];
  const args = [raw];
  if (input.locale === 'es' || input.locale === 'en') { fields.push('locale = ?'); args.push(input.locale); }
  if (isTimeZone(input.timezone)) { fields.push('timezone = ?'); args.push(input.timezone); }
  app.db.run(`UPDATE profiles SET ${fields.join(', ')}, updated_at = ? WHERE user_id = ?`, ...args, app.iso(), user.id);
  return s;
}

// Crea los hábitos priorizados con su plan. Repetirlo no duplica (clave de plantilla).
export function complete(app, user, lang) {
  const s = getState(app, user.id);
  if (!s.priority?.length) throw err('no_priority');
  const limit = isPro(app, user.id) ? 10 : FREE_ACTIVE_LIMIT;
  const created = [];
  for (const key of s.priority.slice(0, limit)) {
    const plan = s.plans?.[key] || {};
    const custom = key.startsWith('custom:') ? s.custom?.[Number(key.slice(7))] : null;
    const tpl = templateByKey[key];
    if (!tpl && !custom) continue;
    const measure = tpl?.measure || (plan.measure in { binary: 1, count: 1, duration: 1 } ? plan.measure : 'binary');
    const kind = tpl?.kind || custom.kind;
    const goal = measure === 'binary'
      ? { comparator: 'done' }
      : { comparator: plan.comparator || tpl?.comparator || (kind === 'build' || kind === 'maintain' ? '>=' : '<='), target: plan.target ?? tpl?.target ?? 0 };
    created.push(createHabit(app, user, {
      name: plan.name || (tpl ? tpl.name[lang] : custom.name), emoji: tpl?.emoji || '✨', category: tpl?.category || 'custom', kind, measure,
      unit: plan.unit || (tpl?.unit ? tpl.unit[lang] : null), goal,
      days: Array.isArray(plan.days) && plan.days.length ? plan.days : [1, 2, 3, 4, 5, 6, 7], time: isTime(plan.time) ? plan.time : null,
      baseline_value: plan.baseline_unknown ? null : plan.baseline, baseline_unknown: Boolean(plan.baseline_unknown),
      motivation: s.motivation || null, barriers: s.barriers, contingency: plan.contingency || null,
    }, { templateKey: tpl ? `tpl:${key}` : `custom:${custom.name.toLowerCase()}` }));
  }
  app.db.run('UPDATE profiles SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?), updated_at = ? WHERE user_id = ?', app.iso(), app.iso(), user.id);
  app.audit(user.id, 'onboarding_completed', 'user', user.id, { habits: created.length });
  return created;
}

export { TEMPLATES };
