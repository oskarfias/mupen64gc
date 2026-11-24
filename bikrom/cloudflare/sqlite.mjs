// Base de datos sobre el SQLite de un Durable Object (ctx.storage.sql).
// Misma interfaz que photography/db.mjs (get, all, run, exec, tx) para que el código de negocio no cambie.
const toNode = (row) => {
  for (const k in row) if (row[k] instanceof ArrayBuffer) row[k] = Buffer.from(row[k]);
  return row;
};
const args = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));

export function sqlDb(storage, { namespace, migrations = [] } = {}) {
  const sql = storage.sql;
  let depth = 0;
  const db = {
    raw: sql,
    get(q, ...p) {
      const row = sql.exec(q, ...args(p)).toArray()[0];
      return row ? toNode(row) : null;
    },
    all: (q, ...p) => sql.exec(q, ...args(p)).toArray().map(toNode),
    run(q, ...p) {
      sql.exec(q, ...args(p)).toArray();
      const r = sql.exec('SELECT changes() AS changes, last_insert_rowid() AS id').one();
      return { changes: r.changes, lastInsertRowid: r.id };
    },
    exec: (q) => { sql.exec(q); },
    // transactionSync: atómica y con reversión automática ante errores
    tx(fn) {
      if (depth > 0) return fn();
      depth++;
      try { return storage.transactionSync(fn); } finally { depth--; }
    },
    close() {},
  };
  sql.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const done = new Set(sql.exec('SELECT version FROM schema_migrations').toArray().map((r) => r.version));
  for (const m of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    const version = `${namespace}/${m.name}`;
    if (done.has(version)) continue;
    try {
      storage.transactionSync(() => {
        sql.exec(m.sql);
        sql.exec('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', version, Date.now());
      });
    } catch (e) {
      throw new Error(`Migración ${version} falló: ${e.message}`);
    }
  }
  return db;
}
