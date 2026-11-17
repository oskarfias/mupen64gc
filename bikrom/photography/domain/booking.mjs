// Disponibilidad, apartados y reservas. Una sola fotógrafa: ningún bloque puede superponerse con otro,
// sin importar el servicio. Los bloques incluyen tiempos de preparación y traslado.
import { json } from '../db.mjs';
import { token } from '../lib/security.mjs';
import { zonedToUtc, localDate, localTime, minutesOfDay, hhmm, addDays, isDate, isTime, MIN, HOUR, formatDateTime } from '../lib/time.mjs';
import { mxn } from '../lib/money.mjs';
import { quoteSnapshot } from './quote.mjs';
import { googleBusy, calendarConnected } from './calendar.mjs';
import { schedule, cancelJobs } from './jobs.mjs';
import { alertAdmin } from './mail.mjs';

export const EVENT_KINDS = ['event', 'wedding'];
const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;

export function blockFor(app, startMs, durationMin) {
  const b = app.setting('booking');
  const before = (b.prep_min || 0) + (b.travel_min || 0);
  const after = b.travel_min || 0;
  const endMs = startMs + durationMin * MIN;
  return { startMs, endMs, blockStart: startMs - before * MIN, blockEnd: endMs + after * MIN };
}

// Conflictos internos: reservas confirmadas, apartados vigentes, casos en revisión y bloqueos manuales.
export function internalConflict(app, blockStart, blockEnd, excludeBookingId = null) {
  const now = app.now();
  const booking = app.db.get(
    `SELECT id FROM bookings WHERE block_start < ? AND block_end > ? AND id IS NOT ?
       AND (status IN ('confirmed','conflict') OR (status = 'held' AND hold_expires_at > ?)) LIMIT 1`,
    blockEnd, blockStart, excludeBookingId, now
  );
  if (booking) return { type: 'booking', id: booking.id };
  const block = app.db.get('SELECT id FROM calendar_blocks WHERE start_at < ? AND end_at > ? LIMIT 1', blockEnd, blockStart);
  return block ? { type: 'block', id: block.id } : null;
}

async function busyExternal(app, fromMs, toMs, excludeBooking) {
  const busy = await googleBusy(app, fromMs, toMs);
  // El evento propio de una reserva que se reprograma no la bloquea a sí misma
  return excludeBooking ? busy.filter(([s, e]) => !(s === excludeBooking.block_start && e === excludeBooking.block_end)) : busy;
}

// Horarios posibles para una cotización aceptada en una fecha.
export async function slotsFor(app, quote, date, { eventStart = null, excludeBookingId = null } = {}) {
  if (!isDate(date)) return { slots: [], error: 'invalid_date' };
  const snapshot = quoteSnapshot(quote);
  const duration = snapshot?.duration_min || quote.duration_min;
  if (!duration) return { slots: [], error: 'no_duration' };
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const settings = app.setting('booking');
  const now = app.now();
  const minStart = now + (settings.min_notice_hours || 0) * HOUR;
  if (zonedToUtc(addDays(date, 1)) <= minStart) return { slots: [], error: 'past' };
  if (zonedToUtc(date) > now + (settings.horizon_days || 365) * 24 * HOUR) return { slots: [], error: 'too_far' };

  const candidates = [];
  if (EVENT_KINDS.includes(service.kind)) {
    // Los eventos usan su horario real, aunque esté fuera del horario de sesiones
    const start = eventStart || json(quote.answers, {}).start_time;
    if (!isTime(start)) return { slots: [], error: 'no_event_time' };
    candidates.push(zonedToUtc(date, start));
  } else {
    const ws = minutesOfDay(settings.session_window?.start || '07:00');
    const we = minutesOfDay(settings.session_window?.end || '16:00');
    const step = settings.slot_step_min || 30;
    for (let m = ws; m + duration <= we; m += step) candidates.push(zonedToUtc(date, hhmm(m)));
  }

  const exclude = excludeBookingId ? app.db.get('SELECT * FROM bookings WHERE id = ?', excludeBookingId) : null;
  let external = [];
  try {
    const first = blockFor(app, candidates[0] ?? zonedToUtc(date), duration);
    const last = blockFor(app, candidates[candidates.length - 1] ?? zonedToUtc(date), duration);
    external = await busyExternal(app, first.blockStart, last.blockEnd, exclude);
  } catch {
    return { slots: [], error: 'calendar_unavailable' };
  }
  const slots = [];
  for (const startMs of candidates) {
    if (startMs < minStart) continue;
    const b = blockFor(app, startMs, duration);
    if (internalConflict(app, b.blockStart, b.blockEnd, excludeBookingId)) continue;
    if (external.some(([s, e]) => overlaps(b.blockStart, b.blockEnd, s, e))) continue;
    slots.push({ start: startMs, end: b.endMs, label: localTime(startMs) });
  }
  return { slots, error: null, calendarChecked: calendarConnected(app) };
}

// Aparta una fecha. Verifica Google fuera de la transacción y repite la verificación interna dentro de ella,
// de modo que dos solicitudes simultáneas no pueden apartar bloques que se superpongan.
export async function holdSlot(app, quoteToken, startMs) {
  const quote = app.db.get('SELECT * FROM quotes WHERE token = ?', quoteToken);
  if (!quote || quote.status !== 'accepted' || quote.accepted_revision !== quote.revision) throw Object.assign(new Error('quote_not_accepted'), { code: 'quote_not_accepted' });
  const snapshot = quoteSnapshot(quote);
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const date = localDate(startMs);
  const { slots, error } = await slotsFor(app, quote, date, EVENT_KINDS.includes(service.kind) ? { eventStart: localTime(startMs) } : {});
  if (error) throw Object.assign(new Error(error), { code: error });
  if (!slots.some((s) => s.start === startMs)) throw Object.assign(new Error('slot_taken'), { code: 'slot_taken' });

  const b = blockFor(app, startMs, snapshot.duration_min);
  const holdHours = app.setting('booking').hold_hours || 24;
  const result = app.db.tx(() => {
    const active = app.db.get("SELECT * FROM bookings WHERE quote_id = ? AND status IN ('confirmed','conflict')", quote.id);
    if (active) throw Object.assign(new Error('already_booked'), { code: 'already_booked' });
    // Un nuevo apartado reemplaza el anterior de la misma cotización
    const previous = app.db.get("SELECT id FROM bookings WHERE quote_id = ? AND status = 'held'", quote.id);
    if (previous) app.db.run("UPDATE bookings SET status = 'cancelled', cancel_note = 'Reemplazado por un nuevo apartado', updated_at = ? WHERE id = ?", app.now(), previous.id);
    if (internalConflict(app, b.blockStart, b.blockEnd)) throw Object.assign(new Error('slot_taken'), { code: 'slot_taken' });
    const now = app.now();
    const expires = now + holdHours * HOUR;
    const tok = token(18);
    const id = Number(app.db.run(
      `INSERT INTO bookings (token, quote_id, customer_id, start_at, end_at, block_start, block_end, status, hold_expires_at, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'held', ?, ?, ?, ?)`,
      tok, quote.id, quote.customer_id, b.startMs, b.endMs, b.blockStart, b.blockEnd, expires, quote.is_demo, now, now
    ).lastInsertRowid);
    schedule(app, 'hold_expire', expires, { bookingId: id }, `hold_expire:${id}`);
    schedule(app, 'email', now, { kind: 'hold_received', bookingId: id }, `mail:hold_received:${id}`);
    app.log('cliente', 'apartado_creado', { entity: 'booking', id, details: formatDateTime(b.startMs) });
    return { id, token: tok, expires };
  });
  return result;
}

// Totales de una reserva a partir de la copia aceptada y los pagos registrados.
export function bookingBalance(app, booking) {
  const quote = app.db.get('SELECT * FROM quotes WHERE id = ?', booking.quote_id);
  const snapshot = quoteSnapshot(quote);
  const paid = app.db.get("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payments WHERE booking_id = ? AND status = 'succeeded'", booking.id).s;
  const depositPaid = app.db.get("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payments WHERE booking_id = ? AND status = 'succeeded' AND purpose = 'deposit'", booking.id).s;
  const total = snapshot?.total_cents ?? 0;
  return {
    total, paid, depositPaid,
    deposit: snapshot?.deposit_cents ?? 0,
    outstanding: Math.max(0, total - paid),
    needsReacceptance: quote.status !== 'accepted' || quote.accepted_revision !== quote.revision,
    snapshot, quote,
  };
}

// Se llama cuando el proveedor confirma un anticipo. Nunca confirma una fecha que ya no esté disponible.
export async function onDepositSucceeded(app, booking) {
  if (booking.status === 'confirmed' || booking.status === 'completed') return 'already';
  if (booking.status === 'held' && booking.hold_expires_at > app.now()) return confirm(app, booking.id, 'held');
  // Pago tardío o apartado cancelado: confirmar solo si el horario sigue libre
  let free = !internalConflict(app, booking.block_start, booking.block_end, booking.id);
  if (free) {
    try {
      const busy = await googleBusy(app, booking.block_start, booking.block_end);
      free = !busy.some(([s, e]) => overlaps(booking.block_start, booking.block_end, s, e));
    } catch {
      free = false;
    }
  }
  if (free) {
    const ok = app.db.tx(() => {
      if (internalConflict(app, booking.block_start, booking.block_end, booking.id)) return false;
      confirm(app, booking.id, booking.status);
      return true;
    });
    if (ok) {
      app.log('sistema', 'pago_tardio_confirmado', { entity: 'booking', id: booking.id, details: 'El horario seguía disponible.', level: 'warning' });
      return 'confirmed_late';
    }
  }
  app.db.run("UPDATE bookings SET status = 'conflict', updated_at = ? WHERE id = ?", app.now(), booking.id);
  await alertAdmin(app, 'Pago recibido para una fecha no disponible', `Reserva ${booking.token.slice(0, 6)} (${formatDateTime(booking.start_at)}): el anticipo llegó después de vencer el apartado y el horario ya no está libre. Resuélvelo con la clienta o el cliente.`, { dedupeKey: `alert:conflict:${booking.id}` });
  schedule(app, 'email', app.now(), { kind: 'booking_conflict', bookingId: booking.id }, `mail:conflict:${booking.id}`);
  return 'conflict';
}

function confirm(app, bookingId, fromStatus) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  const quote = app.db.get('SELECT * FROM quotes WHERE id = ?', b.quote_id);
  const snapshot = quoteSnapshot(quote);
  const answers = json(quote.answers, {});
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const days = snapshot?.package?.delivery_days ?? app.setting('delivery').default_days ?? 14;
  const due = service.kind === 'school' && isDate(answers.delivery_date) ? answers.delivery_date : addDays(localDate(b.end_at), days);
  const res = app.db.run(`UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL, delivery_due_date = ?, updated_at = ? WHERE id = ? AND status = ?`,
    due, app.now(), bookingId, fromStatus);
  if (!res.changes) return 'already';
  cancelJobs(app, `hold_expire:${bookingId}`);
  scheduleBookingJobs(app, bookingId);
  schedule(app, 'email', app.now(), { kind: 'booking_confirmed', bookingId }, `mail:booking_confirmed:${bookingId}`);
  schedule(app, 'calendar_sync', app.now(), { bookingId }, `calendar:${bookingId}:${b.start_at}:confirmed`);
  app.log('sistema', 'reserva_confirmada', { entity: 'booking', id: bookingId });
  return 'confirmed';
}

// Recordatorios previos y aviso de entrega. La clave incluye la fecha: si se reprograma, los anteriores se cancelan.
export function scheduleBookingJobs(app, bookingId) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  const r = app.setting('reminders');
  const at = (days) => b.start_at - days * 24 * HOUR;
  const now = app.now();
  for (const [kind, days] of [['prep_recommendations', r.prep_days_before], ['poses', r.poses_days_before], ['logistics', r.logistics_days_before]]) {
    if (days == null) continue;
    const when = at(days);
    if (when > now) schedule(app, 'email', when, { kind, bookingId, startAt: b.start_at }, `mail:${kind}:${bookingId}:${b.start_at}`);
  }
  if (b.delivery_due_date) {
    const warnDays = app.setting('delivery').warn_before_days ?? 3;
    const when = zonedToUtc(addDays(b.delivery_due_date, -warnDays), '09:00');
    schedule(app, 'delivery_check', Math.max(when, now), { bookingId, due: b.delivery_due_date }, `delivery_check:${bookingId}:${b.delivery_due_date}`);
  }
}

export function expireHold(app, bookingId) {
  return app.db.tx(() => {
    const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
    if (!b || b.status !== 'held' || b.hold_expires_at > app.now()) return false;
    app.db.run("UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ?", app.now(), bookingId);
    app.log('sistema', 'apartado_vencido', { entity: 'booking', id: bookingId });
    schedule(app, 'email', app.now(), { kind: 'hold_expired', bookingId }, `mail:hold_expired:${bookingId}`);
    return true;
  });
}

// Cancelación: registra la resolución; NO genera reembolsos ni penalizaciones automáticas.
export function cancelBooking(app, bookingId, note) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  if (!b || ['cancelled', 'expired', 'completed'].includes(b.status)) return false;
  const hoursBefore = (b.start_at - app.now()) / HOUR;
  app.db.run("UPDATE bookings SET status = 'cancelled', cancel_note = ?, updated_at = ? WHERE id = ?",
    `${note || ''} (aviso con ${Math.max(0, Math.floor(hoursBefore))} h de anticipación)`.trim(), app.now(), bookingId);
  cancelJobs(app, `mail:%:${bookingId}:%`);
  cancelJobs(app, `delivery_check:${bookingId}:%`);
  cancelJobs(app, `hold_expire:${bookingId}`);
  schedule(app, 'calendar_sync', app.now(), { bookingId }, `calendar:${bookingId}:cancel:${app.now()}`);
  app.log('admin', 'reserva_cancelada', { entity: 'booking', id: bookingId, details: note });
  return true;
}

export async function rescheduleBooking(app, bookingId, startMs) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  if (!b || !['confirmed', 'conflict', 'held'].includes(b.status)) throw new Error('La reserva no se puede reprogramar en su estado actual.');
  const quote = app.db.get('SELECT * FROM quotes WHERE id = ?', b.quote_id);
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const { slots, error } = await slotsFor(app, quote, localDate(startMs), { excludeBookingId: b.id, ...(EVENT_KINDS.includes(service.kind) ? { eventStart: localTime(startMs) } : {}) });
  if (error) throw new Error(`No se pudo verificar la disponibilidad (${error}).`);
  if (!slots.some((s) => s.start === startMs)) throw new Error('Ese horario no está disponible.');
  const duration = quoteSnapshot(quote)?.duration_min || quote.duration_min;
  const nb = blockFor(app, startMs, duration);
  app.db.tx(() => {
    if (internalConflict(app, nb.blockStart, nb.blockEnd, b.id)) throw new Error('Ese horario acaba de ocuparse.');
    const status = b.status === 'conflict' ? 'confirmed' : b.status;
    app.db.run('UPDATE bookings SET start_at = ?, end_at = ?, block_start = ?, block_end = ?, status = ?, updated_at = ? WHERE id = ?',
      nb.startMs, nb.endMs, nb.blockStart, nb.blockEnd, status, app.now(), b.id);
    if (status === 'confirmed') {
      const days = quoteSnapshot(quote)?.package?.delivery_days ?? app.setting('delivery').default_days ?? 14;
      if (service.kind !== 'school') app.db.run('UPDATE bookings SET delivery_due_date = ? WHERE id = ?', addDays(localDate(nb.endMs), days), b.id);
      cancelJobs(app, `mail:%:${b.id}:${b.start_at}`);
      cancelJobs(app, `delivery_check:${b.id}:%`);
      scheduleBookingJobs(app, b.id);
      schedule(app, 'calendar_sync', app.now(), { bookingId: b.id }, `calendar:${b.id}:${startMs}:resched`);
    }
  });
  app.log('admin', 'reserva_reprogramada', { entity: 'booking', id: b.id, details: `${formatDateTime(b.start_at)} → ${formatDateTime(startMs)}` });
}

// Variables para plantillas de correo de una reserva
export function bookingVars(app, bookingId) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  const quote = app.db.get('SELECT * FROM quotes WHERE id = ?', b.quote_id);
  const c = app.db.get('SELECT * FROM customers WHERE id = ?', b.customer_id);
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const lang = quote.lang;
  const bal = bookingBalance(app, b);
  const answers = json(quote.answers, {});
  return {
    lang, to: c.email, serviceKind: service.kind, booking: b,
    vars: {
      nombre: c.name.split(' ')[0],
      servicio: lang === 'en' ? service.name_en : service.name_es,
      fecha: formatDateTime(b.start_at, lang),
      vence: b.hold_expires_at ? formatDateTime(b.hold_expires_at, lang) : '',
      anticipo: mxn(bal.deposit),
      pagado: mxn(bal.paid),
      saldo: mxn(bal.outstanding),
      lugar: [answers.location, answers.city].filter(Boolean).join(', ') || '—',
      enlace: app.url(`${lang === 'en' ? '/en' : ''}/reserva/${b.token}`),
      cancelacion: bal.snapshot?.cancellation || '',
    },
  };
}
