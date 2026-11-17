// Google Calendar: conexión, ocupados (free/busy) y eventos de reservas confirmadas.
import { encrypt, decrypt } from '../lib/security.mjs';
import { localDate, zonedToUtc, addDays, DAY } from '../lib/time.mjs';
import { alertAdmin } from './mail.mjs';

const CACHE_MS = 5 * 60_000;

export function calendarConnected(app) {
  return app.integrations().calendar;
}

export async function accessToken(app) {
  const g = app.setting('google');
  if (!g.refresh_token) throw new Error('Google Calendar no conectado');
  try {
    return await app.google.accessToken(decrypt(g.refresh_token));
  } catch (e) {
    if (e.revoked) {
      app.setSetting('google', { ...g, refresh_token: null, disconnected_at: app.now(), last_error: 'Acceso revocado' });
      await alertAdmin(app, 'Google Calendar se desconectó', 'Vuelve a conectarlo desde el panel (Agenda).');
    }
    throw e;
  }
}

export function saveConnection(app, refreshToken) {
  app.setSetting('google', { refresh_token: encrypt(refreshToken), connected_at: app.now(), last_error: null });
  app.db.run('DELETE FROM calendar_busy_cache');
  app.log('admin', 'google_conectado');
}

export function disconnect(app) {
  app.setSetting('google', { refresh_token: null, disconnected_at: app.now() });
  app.db.run('DELETE FROM calendar_busy_cache');
  app.log('admin', 'google_desconectado');
}

// Intervalos ocupados en Google para un rango. Lanza error si Calendar está conectado pero no responde
// (el sitio no ofrece horarios que no pudo verificar).
export async function googleBusy(app, fromMs, toMs) {
  if (!calendarConnected(app)) return [];
  const days = [];
  for (let d = localDate(fromMs); zonedToUtc(d) <= toMs; d = addDays(d, 1)) days.push(d);
  const now = app.now();
  const busy = [];
  const missing = [];
  for (const d of days) {
    const row = app.db.get('SELECT * FROM calendar_busy_cache WHERE day = ?', d);
    if (row && now - row.fetched_at < CACHE_MS) busy.push(...JSON.parse(row.busy));
    else missing.push(d);
  }
  if (missing.length) {
    try {
      const token = await accessToken(app);
      const start = zonedToUtc(missing[0]);
      const end = zonedToUtc(addDays(missing[missing.length - 1], 1));
      const fetched = await app.google.freeBusy(token, start, end);
      for (const d of missing) {
        const ds = zonedToUtc(d);
        const de = ds + DAY;
        const dayBusy = fetched.filter(([s, e]) => s < de && e > ds);
        app.db.run('INSERT INTO calendar_busy_cache (day, fetched_at, busy) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET fetched_at = excluded.fetched_at, busy = excluded.busy',
          d, now, JSON.stringify(dayBusy));
        busy.push(...dayBusy);
      }
    } catch (e) {
      app.log('google', 'freebusy_fallido', { details: e.message, level: 'error' });
      throw Object.assign(new Error('calendar_unavailable'), { code: 'calendar_unavailable' });
    }
  }
  return busy;
}

// Evento en Google para una reserva confirmada (sin datos sensibles; los detalles quedan en el panel).
export async function syncBookingEvent(app, bookingId) {
  if (!calendarConnected(app)) return;
  const b = app.db.get(`SELECT b.*, c.name AS customer, s.name_es AS service FROM bookings b JOIN customers c ON c.id = b.customer_id
    JOIN quotes q ON q.id = b.quote_id JOIN services s ON s.id = q.service_id WHERE b.id = ?`, bookingId);
  if (!b) return;
  const token = await accessToken(app);
  if (b.status !== 'confirmed') {
    if (b.google_event_id) {
      await app.google.deleteEvent(token, b.google_event_id);
      app.db.run('UPDATE bookings SET google_event_id = NULL WHERE id = ?', b.id);
    }
    return;
  }
  if (b.google_event_id) await app.google.deleteEvent(token, b.google_event_id); // reprogramación
  const eventId = `etf${b.id}v${b.start_at.toString(32)}`.toLowerCase().replace(/[^a-v0-9]/g, '0');
  const id = await app.google.insertEvent(token, {
    summary: `${b.service} · ${b.customer}`,
    description: `Reserva ${b.token.slice(0, 6)} — detalles en el panel.`,
    startMs: b.block_start, endMs: b.block_end, idempotencyId: eventId,
  });
  app.db.run('UPDATE bookings SET google_event_id = ? WHERE id = ?', id, b.id);
  app.db.run('DELETE FROM calendar_busy_cache WHERE day = ?', localDate(b.start_at));
}
