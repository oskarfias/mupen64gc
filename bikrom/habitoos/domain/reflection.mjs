// Reflexión diaria (PRD FR-06): ánimo, obstáculos por hábito, nota libre e intención "si X, entonces Y".
// Todo es opcional y omitirla no penaliza ningún indicador. Ante un día cumplido por completo no se insiste.
import { encrypt, decrypt } from '../../photography/lib/security.mjs';
import { isDate, addDays } from '../lib/tz.mjs';
import { BARRIERS, barrierKeys } from './catalog.mjs';
import { today, daily, ownHabit, isPro, FREE_HISTORY_DAYS } from './habits.mjs';

const err = (code, status = 400) => Object.assign(new Error(code), { code, status });
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const seal = (v) => (v ? encrypt(v) : null);
const open = (v) => { if (!v) return ''; try { return decrypt(v); } catch { return ''; } };
export const MOODS = [1, 2, 3, 4, 5];
export { BARRIERS };

function checkDate(app, user, date) {
  const td = today(app, user);
  if (!isDate(date) || date > td) throw err('invalid_date'); // no se reflexiona sobre días futuros
  if (!isPro(app, user.id) && date < addDays(td, -(FREE_HISTORY_DAYS - 1))) throw err('history_limited', 402);
}

export function getReview(app, user, date) {
  const r = app.db.get('SELECT * FROM daily_reviews WHERE owner_id = ? AND local_date = ?', user.id, date);
  if (!r) return null;
  const obstacles = app.db.all('SELECT habit_id, obstacle_key FROM review_obstacles WHERE review_id = ?', r.id);
  return {
    date: r.local_date, mood: r.mood, note: open(r.note_enc), intention_if: open(r.intention_if_enc), intention_then: open(r.intention_then_enc),
    dismissed: Boolean(r.dismissed), obstacles, updated_at: r.updated_at,
  };
}

// obstacles: [{ habit_id|null, key }]. Solo hábitos propios y programados ese día; claves del catálogo.
export function saveReview(app, user, date, input = {}) {
  checkDate(app, user, date);
  const mood = MOODS.includes(Number(input.mood)) ? Number(input.mood) : null;
  const note = text(input.note, 1000);
  const ifText = text(input.intention_if, 200);
  const thenText = text(input.intention_then, 200);
  const dayHabits = new Set(daily(app, user, date).items.map((i) => i.id));
  const seen = new Set();
  const obstacles = [];
  for (const o of Array.isArray(input.obstacles) ? input.obstacles.slice(0, 60) : []) {
    const key = String(o?.key || '');
    const habitId = o?.habit_id ? String(o.habit_id) : null;
    if (!barrierKeys.includes(key)) continue;
    if (habitId) { ownHabit(app, user.id, habitId); if (!dayHabits.has(habitId)) continue; }
    const k = `${habitId}|${key}`;
    if (!seen.has(k)) { seen.add(k); obstacles.push({ habitId, key }); }
  }
  const now = app.iso();
  return app.db.tx(() => {
    const prev = app.db.get('SELECT id FROM daily_reviews WHERE owner_id = ? AND local_date = ?', user.id, date);
    const id = prev?.id || app.id();
    if (prev) {
      app.db.run('UPDATE daily_reviews SET mood = ?, note_enc = ?, intention_if_enc = ?, intention_then_enc = ?, dismissed = 0, updated_at = ? WHERE id = ?',
        mood, seal(note), seal(ifText), seal(thenText), now, id);
      app.db.run('DELETE FROM review_obstacles WHERE review_id = ?', id);
    } else {
      app.db.run('INSERT INTO daily_reviews (id, owner_id, local_date, mood, note_enc, intention_if_enc, intention_then_enc, dismissed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
        id, user.id, date, mood, seal(note), seal(ifText), seal(thenText), now, now);
    }
    for (const o of obstacles) app.db.run('INSERT INTO review_obstacles (id, review_id, owner_id, local_date, habit_id, obstacle_key) VALUES (?, ?, ?, ?, ?, ?)', app.id(), id, user.id, date, o.habitId, o.key);
    app.audit(user.id, prev ? 'review_updated' : 'review_created', 'daily_review', id); // sin contenido
    return getReview(app, user, date);
  });
}

// "Ahora no": recuerda la decisión para no volver a sugerir ese día. No crea contenido ni afecta indicadores.
export function dismissReview(app, user, date) {
  checkDate(app, user, date);
  const now = app.iso();
  app.db.run(`INSERT INTO daily_reviews (id, owner_id, local_date, dismissed, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(owner_id, local_date) DO UPDATE SET dismissed = 1, updated_at = excluded.updated_at`, app.id(), user.id, date, now, now);
  return { ok: true };
}

export function deleteReview(app, user, date) {
  checkDate(app, user, date);
  app.db.run('DELETE FROM daily_reviews WHERE owner_id = ? AND local_date = ?', user.id, date);
  return { ok: true };
}

// Sugerir la reflexión solo cuando aporta: hubo parciales, no cumplidos u omitidos, o el día sigue abierto por la tarde.
// Un día cumplido por completo nunca insiste.
export function prompt(app, user, day, { localHour = 12 } = {}) {
  const s = day.summary;
  const r = app.db.get('SELECT mood, note_enc, dismissed FROM daily_reviews WHERE owner_id = ? AND local_date = ?', user.id, day.date);
  if (r && !r.dismissed) return 'saved';
  if (!day.items.length) return 'none';
  const eligible = s.scheduled - s.paused - s.not_applicable;
  if (eligible > 0 && s.done === eligible) return 'optional'; // éxito total: solo un enlace discreto
  if (r?.dismissed) return 'optional';
  const rough = s.partial + s.missed + s.skipped > 0;
  const past = day.date < day.today;
  if (rough || (past && s.no_data > 0) || (!past && localHour >= 18 && s.pending > 0)) return 'suggest';
  return 'optional';
}

// Frecuencia de obstáculos y ánimo en un periodo (solo del usuario). Descriptivo: sin conclusiones causales.
export function obstacleStats(app, user, from, to) {
  const rows = app.db.all(`SELECT ro.obstacle_key, ro.habit_id, h.name, h.emoji FROM review_obstacles ro LEFT JOIN habits h ON h.id = ro.habit_id
    WHERE ro.owner_id = ? AND ro.local_date BETWEEN ? AND ?`, user.id, from, to);
  const days = app.db.get('SELECT COUNT(*) AS n, AVG(mood) AS mood, SUM(mood IS NOT NULL) AS mood_n FROM daily_reviews WHERE owner_id = ? AND dismissed = 0 AND local_date BETWEEN ? AND ?', user.id, from, to);
  const byKey = {};
  const byHabit = {};
  for (const r of rows) {
    byKey[r.obstacle_key] = (byKey[r.obstacle_key] || 0) + 1;
    if (r.habit_id) {
      const h = (byHabit[r.habit_id] ||= { habit_id: r.habit_id, name: r.name, emoji: r.emoji, total: 0, keys: {} });
      h.total++;
      h.keys[r.obstacle_key] = (h.keys[r.obstacle_key] || 0) + 1;
    }
  }
  return {
    from, to, reviews_n: days.n || 0, mood_avg: days.mood_n ? Math.round(days.mood * 10) / 10 : null, mood_n: days.mood_n || 0,
    obstacles_n: rows.length,
    obstacles: Object.entries(byKey).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n),
    habits: Object.values(byHabit).map((h) => ({ ...h, keys: Object.entries(h.keys).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n) })).sort((a, b) => b.total - a.total),
  };
}

export function exportReviews(app, userId) {
  return app.db.all('SELECT id, local_date, mood, note_enc, intention_if_enc, intention_then_enc, dismissed, created_at, updated_at FROM daily_reviews WHERE owner_id = ? ORDER BY local_date', userId)
    .map((r) => ({
      date: r.local_date, mood: r.mood, note: open(r.note_enc), intention_if: open(r.intention_if_enc), intention_then: open(r.intention_then_enc), dismissed: Boolean(r.dismissed),
      obstacles: app.db.all('SELECT habit_id, obstacle_key AS key FROM review_obstacles WHERE review_id = ?', r.id), created_at: r.created_at, updated_at: r.updated_at,
    }));
}
