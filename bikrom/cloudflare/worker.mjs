// Bikrom en Cloudflare Workers (plan gratis).
// - Archivos estáticos (dist/): Workers Static Assets.
// - Sitio, Fotografía y HabitoOS: un Durable Object con SQLite propio (datos persistentes, sin disco).
// - Tareas programadas de Fotografía: Cron Trigger cada 5 minutos.
import { DurableObject } from 'cloudflare:workers';
import { randomBytes } from 'node:crypto';
import { migrations } from './generated.mjs';
import { runNode } from './node-http.mjs';
import { sqlDb } from './sqlite.mjs';
import { sqlStore } from './store.mjs';

const DYNAMIC = /^\/(api\/|admin(\/|$)|descargas\/)/;
const inApp = (p, base) => (p === base || p.startsWith(base + '/')) && !p.startsWith(base + '/static/');
export const isDynamic = (p) => DYNAMIC.test(p) || inApp(p, '/photography') || inApp(p, '/habitoos');

const stub = (env) => env.BIKROM.get(env.BIKROM.idFromName('principal'));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // www.bikrom.com → bikrom.com (un solo dominio canónico)
    if (url.hostname.startsWith('www.')) return Response.redirect(`${url.protocol}//${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
    if (!isDynamic(url.pathname)) return env.ASSETS.fetch(request);
    const headers = new Headers(request.headers);
    const ip = request.headers.get('cf-connecting-ip') || '';
    headers.set('x-forwarded-for', ip); // nunca se confía en el valor que envía el cliente
    return stub(env).fetch(new Request(request, { headers }));
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(stub(env).runJobs());
  },
};

export class Bikrom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.apps = await boot(ctx, env); });
  }
  async fetch(request) {
    return runNode(this.apps.site.handle, request, (request.headers.get('x-forwarded-for') || '').split(',')[0]);
  }
  async runJobs() {
    return this.apps.photography.runJobs();
  }
}

// Secretos que el sitio necesita y que, si no se configuraron en Cloudflare, se generan una vez y se guardan.
function ensureSecret(sql, key) {
  if ((process.env[key] || '').length >= 32) return;
  sql.exec('CREATE TABLE IF NOT EXISTS app_secrets (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  let v = sql.exec('SELECT v FROM app_secrets WHERE k = ?', key).toArray()[0]?.v;
  if (!v) {
    v = randomBytes(32).toString('base64url');
    sql.exec('INSERT INTO app_secrets (k, v) VALUES (?, ?)', key, v);
  }
  process.env[key] = v;
}

async function boot(ctx, env) {
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
  process.env.STORAGE_DRIVER ||= 'sqlite';
  ensureSecret(ctx.storage.sql, 'APP_SECRET');
  // Se importan aquí (no arriba) para que lean process.env ya completo.
  const [{ createSite }, { createPhotography }, { createHabitoos }] = await Promise.all([
    import('../server/site.mjs'),
    import('../photography/index.mjs'),
    import('../habitoos/index.mjs'),
  ]);
  const penv = process.env;
  const photography = createPhotography({ env: penv, worker: false, db: sqlDb(ctx.storage, { namespace: 'photography', migrations: migrations.photography }) });
  const habitoos = createHabitoos({ env: penv, db: sqlDb(ctx.storage, { namespace: 'habitoos', migrations: migrations.habitoos }) });
  const store = sqlStore(sqlDb(ctx.storage, { namespace: 'site' }));
  const files = {
    // Normalmente los archivos estáticos no llegan aquí (los sirve el Worker); por si acaso:
    async serveStatic(req, res) {
      const r = await env.ASSETS.fetch(new Request(`https://assets.local${req.url}`, { method: req.method }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    },
    async notFound(req, res) {
      const r = await env.ASSETS.fetch(new Request('https://assets.local/404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(r.ok ? Buffer.from(await r.arrayBuffer()) : 'No encontrado');
    },
    download: () => false, // descargas privadas: se entregan por correo mientras no haya almacenamiento de archivos del sitio
  };
  const site = createSite({ env: penv, store, files, photography, habitoos });
  return { site, photography, habitoos };
}
