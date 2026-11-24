// Registros del sitio de Bikrom (diagnósticos, solicitudes, pedidos…) en el SQLite del Durable Object.
// Misma interfaz que server/store.js (all, find, findBy, insert, update).
import { randomUUID } from 'node:crypto';

export function sqlStore(db) {
  db.exec('CREATE TABLE IF NOT EXISTS site_records (seq INTEGER PRIMARY KEY AUTOINCREMENT, col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, UNIQUE (col, id))');
  const cache = {};
  const load = (col) => (cache[col] ||= db.all('SELECT data FROM site_records WHERE col = ? ORDER BY seq', col).map((r) => JSON.parse(r.data)));
  return {
    all: (col) => [...load(col)].reverse(),
    find: (col, id) => load(col).find((r) => r.id === id) || null,
    findBy: (col, fn) => load(col).find(fn) || null,
    insert(col, data, id = randomUUID().slice(0, 8).toUpperCase()) {
      const row = { id, creado: new Date().toISOString(), ...data };
      db.run('INSERT INTO site_records (col, id, data) VALUES (?, ?, ?)', col, id, JSON.stringify(row));
      load(col).push(row);
      return row;
    },
    update(col, id, patch) {
      const row = load(col).find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch, { actualizado: new Date().toISOString() });
      db.run('UPDATE site_records SET data = ? WHERE col = ? AND id = ?', JSON.stringify(row), col, id);
      return row;
    },
  };
}
