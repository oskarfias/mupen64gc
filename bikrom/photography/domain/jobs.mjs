// Tareas programadas persistentes: se guardan en la base, sobreviven reinicios,
// tienen reintentos con espera creciente y una clave que impide duplicados.
const BACKOFF = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000];

export function schedule(app, type, runAt, payload = {}, dedupeKey = null) {
  const now = app.now();
  if (dedupeKey) {
    const existing = app.db.get('SELECT id, status FROM jobs WHERE dedupe_key = ?', dedupeKey);
    if (existing) return existing.id;
  }
  return Number(app.db.run(
    "INSERT INTO jobs (type, run_at, payload, dedupe_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
    type, runAt, JSON.stringify(payload), dedupeKey, now, now
  ).lastInsertRowid);
}

export function cancelJobs(app, likeKey) {
  app.db.run("UPDATE jobs SET status = 'cancelled', updated_at = ? WHERE status = 'pending' AND dedupe_key LIKE ?", app.now(), likeKey);
}

let running = false;

// Ejecuta las tareas vencidas. handlers: { tipo: async (app, payload) => void }
export async function runDue(app, handlers, { limit = 50 } = {}) {
  if (running) return 0;
  running = true;
  let count = 0;
  try {
    // Recupera tareas que quedaron "running" por un reinicio
    app.db.run("UPDATE jobs SET status = 'pending' WHERE status = 'running' AND updated_at < ?", app.now() - 15 * 60_000);
    // Varias pasadas: una tarea puede programar otra inmediata (p. ej. vencer apartado → correo de aviso)
    for (let pass = 0; pass < 5; pass++) {
    const due = app.db.all("SELECT * FROM jobs WHERE status = 'pending' AND run_at <= ? ORDER BY run_at LIMIT ?", app.now(), limit);
    if (!due.length) break;
    for (const job of due) {
      const claimed = app.db.run("UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'pending'", app.now(), job.id);
      if (!claimed.changes) continue;
      const handler = handlers[job.type];
      try {
        if (!handler) throw new Error(`Tipo de tarea desconocido: ${job.type}`);
        await handler(app, JSON.parse(job.payload || '{}'), job);
        app.db.run("UPDATE jobs SET status = 'done', attempts = attempts + 1, last_error = NULL, updated_at = ? WHERE id = ?", app.now(), job.id);
      } catch (e) {
        const attempts = job.attempts + 1;
        const final = attempts >= BACKOFF.length + 1;
        app.db.run('UPDATE jobs SET status = ?, attempts = ?, last_error = ?, run_at = ?, updated_at = ? WHERE id = ?',
          final ? 'failed' : 'pending', attempts, String(e.message).slice(0, 500), app.now() + (BACKOFF[attempts - 1] || 0), app.now(), job.id);
        app.log('sistema', final ? 'tarea_fallida' : 'tarea_reintento', { entity: 'job', id: job.id, details: `${job.type}: ${e.message}`, level: final ? 'error' : 'warning' });
      }
      count++;
    }
    }
  } finally {
    running = false;
  }
  return count;
}

export function startWorker(app, handlers, intervalMs = 30_000) {
  const tick = () => runDue(app, handlers).catch((e) => app.log('sistema', 'worker_error', { details: e.message, level: 'error' }));
  const t = setInterval(tick, intervalMs);
  t.unref?.();
  setTimeout(tick, 2_000).unref?.();
  return () => clearInterval(t);
}
