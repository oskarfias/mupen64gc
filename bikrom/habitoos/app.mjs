// Contexto de Bikrom/HabitoOS: base propia, reloj inyectable (pruebas), correo y auditoría.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openDb } from '../photography/db.mjs';
import { mailAdapter } from '../photography/lib/providers.mjs';
import { stripeBilling } from './lib/stripe.mjs';

const here = (import.meta.url ? dirname(fileURLToPath(import.meta.url)) : '.'); // en Cloudflare no hay rutas de archivo
export const BASE = '/habitoos';

export function createApp({ env = process.env, dataDir, dbFile, now, db: givenDb } = {}) {
  const dir = dataDir || env.HABITOOS_DATA_DIR || join(env.DATA_DIR || join(process.cwd(), 'data'), 'habitoos');
  const db = givenDb || openDb(dbFile || join(dir, 'habitoos.db'), join(here, 'migrations'));
  const app = {
    env,
    db,
    base: BASE,
    now: now || (() => Date.now()),
    siteUrl: (env.HABITOOS_SITE_URL || env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    // Correo propio de HabitoOS (remitente independiente del de fotografía)
    mail: mailAdapter({ RESEND_API_KEY: env.RESEND_API_KEY, PHOTO_EMAIL_FROM: env.HABITOOS_EMAIL_FROM }),
    // Suscripción Pro (Stripe, claves propias de HabitoOS)
    billing: stripeBilling(env),
  };
  app.iso = () => new Date(app.now()).toISOString();
  app.id = () => randomUUID();
  app.url = (path) => `${app.siteUrl}${BASE}${path}`;
  // Auditoría sin contenido privado (solo acción, recurso e id)
  app.audit = (actorId, action, resource = null, resourceId = null, meta = null) =>
    db.run('INSERT INTO audit_events (id, actor_id, action, resource, resource_id, meta, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      randomUUID(), actorId, action, resource, resourceId, meta == null ? null : JSON.stringify(meta), app.iso());
  return app;
}
