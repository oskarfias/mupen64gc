// Contexto de la aplicación: base de datos, almacenamiento, proveedores y reloj (inyectable para pruebas).
import { join } from 'node:path';
import { openDb, json } from './db.mjs';
import { seed } from './seed.mjs';
import { createStorage } from './lib/storage.mjs';
import { stripeAdapter, paypalAdapter, googleAdapter, mailAdapter } from './lib/providers.mjs';

export const BASE = '/photography';

export function createApp({ env = process.env, dataDir, dbFile, now, db: givenDb, storage } = {}) {
  const dir = dataDir || env.PHOTO_DATA_DIR || join(env.DATA_DIR || join(process.cwd(), 'data'), 'photography');
  const db = givenDb || openDb(dbFile || join(dir, 'photography.db'));
  seed(db);
  const app = {
    env,
    db,
    dataDir: dir,
    storage: storage || createStorage(env, dir, db),
    stripe: stripeAdapter(env),
    paypal: paypalAdapter(env),
    google: googleAdapter(env),
    mail: mailAdapter(env),
    now: now || (() => Date.now()),
    siteUrl: (env.PHOTO_SITE_URL || env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '') ,
    base: env.PHOTO_BASE_PATH ?? BASE,
  };
  app.url = (path) => `${app.siteUrl}${app.base}${path}`;
  app.setting = (key) => json(db.get('SELECT value FROM settings WHERE key = ?', key)?.value, {});
  app.setSetting = (key, value) =>
    db.run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', key, JSON.stringify(value), app.now());
  app.content = (key, lang) => db.get('SELECT value FROM content WHERE key = ? AND lang = ?', key, lang)?.value ?? db.get("SELECT value FROM content WHERE key = ? AND lang = 'es'", key)?.value ?? '';
  app.log = (actor, action, { entity = null, id = null, details = null, level = 'info' } = {}) =>
    db.run('INSERT INTO activity_log (at, actor, action, entity, entity_id, details, level) VALUES (?, ?, ?, ?, ?, ?, ?)',
      app.now(), actor, action, entity, id, details == null ? null : typeof details === 'string' ? details : JSON.stringify(details), level);
  // Estado de integraciones: lo que está realmente conectado
  app.integrations = () => ({
    card: app.stripe.configured,
    paypal: app.paypal.configured,
    payments: app.stripe.configured || app.paypal.configured,
    calendar: app.google.configured && Boolean(app.setting('google').refresh_token),
    calendarConfigured: app.google.configured,
    email: app.mail.configured,
    storage: app.storage.driver,
  });
  app.demo = () => !app.integrations().payments;
  return app;
}
