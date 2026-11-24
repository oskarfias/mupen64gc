// Pruebas: imita ctx.storage de un Durable Object (sql.exec, transactionSync) sobre node:sqlite,
// para correr las pruebas completas de Fotografía y HabitoOS con la capa de Cloudflare (npm run cf:test).
import { sqlDb } from './sqlite.mjs';
import { migrations } from './generated.mjs';

function fakeStorage() {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  let inTx = 0;
  const cursor = (rows, written) => ({ toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error('se esperaba una fila'); return rows[0]; }, rowsWritten: written });
  const toDo = (row) => { for (const k in row) if (row[k] instanceof Uint8Array) row[k] = row[k].buffer.slice(row[k].byteOffset, row[k].byteOffset + row[k].byteLength); return row; };
  const sql = {
    exec(q, ...p) {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT)/i.test(q)) throw new Error('Use transactionSync');
      if (!p.length && q.split(';').filter((s) => s.trim() && !/^\s*--/.test(s.trim())).length > 1) { db.exec(q); return cursor([], 0); }
      const st = db.prepare(q);
      if (/^\s*(SELECT|WITH|PRAGMA)|RETURNING/i.test(q)) return cursor(st.all(...p).map(toDo), 0);
      const r = st.run(...p);
      return cursor([], Number(r.changes));
    },
  };
  return {
    sql,
    transactionSync(fn) {
      const name = `sp${++inTx}`;
      db.exec(`SAVEPOINT ${name}`);
      try { const out = fn(); db.exec(`RELEASE ${name}`); return out; } catch (e) { db.exec(`ROLLBACK TO ${name}`); db.exec(`RELEASE ${name}`); throw e; } finally { inTx--; }
    },
  };
}

export function shim(namespace) {
  return { db: sqlDb(fakeStorage(), { namespace, migrations: migrations[namespace] }) };
}
