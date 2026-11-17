// Pagos de servicios (anticipo y saldo) y de productos. La confirmación llega solo del proveedor
// (webhook firmado de Stripe, captura servidor-a-servidor o webhook verificado de PayPal) o de un registro manual en el panel.
// Las notificaciones repetidas no duplican pagos, reservas ni correos.
import { token } from '../lib/security.mjs';
import { mxn } from '../lib/money.mjs';
import { bookingBalance, onDepositSucceeded } from './booking.mjs';
import { onOrderPaid } from './shop.mjs';
import { schedule } from './jobs.mjs';

const err = (code) => Object.assign(new Error(code), { code });

export function amountDue(app, { booking, order }) {
  if (order) {
    if (order.status !== 'awaiting_payment' || order.shipping_cents == null || order.total_cents == null) throw err('order_not_payable');
    return { purpose: 'order', amount: order.total_cents };
  }
  const bal = bookingBalance(app, booking);
  if (bal.needsReacceptance) throw err('quote_changed');
  if (booking.status === 'held') {
    if (booking.hold_expires_at <= app.now()) throw err('hold_expired');
    if (bal.depositPaid >= bal.deposit) throw err('already_paid');
    return { purpose: 'deposit', amount: bal.deposit - bal.depositPaid };
  }
  if (booking.status === 'confirmed') {
    if (bal.outstanding <= 0) throw err('already_paid');
    return { purpose: 'balance', amount: bal.outstanding };
  }
  throw err('not_payable');
}

// Crea el registro de pago pendiente y la sesión del proveedor. Devuelve la URL de pago.
export async function startPayment(app, { booking = null, order = null, method, lang = 'es', description }) {
  const provider = method === 'paypal' ? app.paypal : app.stripe;
  if (!provider.configured) throw err('payments_unavailable');
  const { purpose, amount } = amountDue(app, { booking, order });
  const now = app.now();
  const tok = token(18);
  const id = Number(app.db.run(
    `INSERT INTO payments (token, booking_id, order_id, purpose, method, provider, amount_cents, status, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    tok, booking?.id ?? null, order?.id ?? null, purpose, method === 'paypal' ? 'paypal' : 'card', method === 'paypal' ? 'paypal' : 'stripe', amount, now, now
  ).lastInsertRowid);
  const prefix = lang === 'en' ? '/en' : '';
  const back = booking ? `${prefix}/reserva/${booking.token}` : `${prefix}/pedido/${order.token}`;
  try {
    let session;
    if (method === 'paypal') {
      session = await app.paypal.createOrder({
        amountCents: amount, description, paymentToken: tok, lang,
        returnUrl: app.url(`/pago/paypal/retorno?pago=${tok}`), cancelUrl: app.url(`${back}?pago=cancelado`),
      });
    } else {
      session = await app.stripe.createCheckout({
        amountCents: amount, description, paymentToken: tok, lang, email: booking ? app.db.get('SELECT email FROM customers WHERE id = ?', booking.customer_id).email : order.email,
        successUrl: app.url(`${back}?pago=procesando`), cancelUrl: app.url(`${back}?pago=cancelado`),
      });
    }
    app.db.run('UPDATE payments SET provider_ref = ?, updated_at = ? WHERE id = ?', session.ref, app.now(), id);
    return session.url;
  } catch (e) {
    app.db.run("UPDATE payments SET status = 'failed', note = ?, updated_at = ? WHERE id = ?", String(e.message).slice(0, 300), app.now(), id);
    app.log(method === 'paypal' ? 'paypal' : 'stripe', 'pago_no_iniciado', { entity: 'payment', id, details: e.message, level: 'error' });
    throw err('provider_error');
  }
}

// Registra un pago confirmado por el proveedor. Idempotente por id de evento y por id de cobro.
export async function confirmPayment(app, { provider, eventId = null, paymentToken, providerPaymentRef, amountCents, currency = 'MXN' }) {
  const outcome = app.db.tx(() => {
    if (eventId) {
      const seen = app.db.get('SELECT 1 FROM webhook_events WHERE provider = ? AND event_id = ?', provider, eventId);
      if (seen) return { status: 'duplicate_event' };
      app.db.run('INSERT INTO webhook_events (provider, event_id, received_at) VALUES (?, ?, ?)', provider, eventId, app.now());
    }
    const p = app.db.get('SELECT * FROM payments WHERE token = ?', paymentToken);
    if (!p) return { status: 'unknown_payment' };
    if (p.status === 'succeeded') return { status: 'already', payment: p };
    if (providerPaymentRef && app.db.get('SELECT 1 FROM payments WHERE provider_payment_ref = ?', providerPaymentRef)) return { status: 'already', payment: p };
    if (String(currency).toUpperCase() !== 'MXN' || amountCents !== p.amount_cents) {
      app.log(provider, 'pago_importe_distinto', { entity: 'payment', id: p.id, details: `esperado ${p.amount_cents}, recibido ${amountCents} ${currency}`, level: 'error' });
      app.db.run("UPDATE payments SET note = ?, updated_at = ? WHERE id = ?", `Importe recibido ${amountCents} ${currency}: revisar`, app.now(), p.id);
      return { status: 'amount_mismatch', payment: p };
    }
    app.db.run("UPDATE payments SET status = 'succeeded', provider_payment_ref = ?, updated_at = ? WHERE id = ?", providerPaymentRef, app.now(), p.id);
    app.log(provider, 'pago_confirmado', { entity: 'payment', id: p.id, details: `${p.purpose} ${mxn(p.amount_cents)}` });
    return { status: 'recorded', payment: { ...p, status: 'succeeded' } };
  });
  if (outcome.status === 'recorded') await afterPayment(app, outcome.payment);
  return outcome.status;
}

async function afterPayment(app, payment) {
  if (payment.booking_id) {
    const booking = app.db.get('SELECT * FROM bookings WHERE id = ?', payment.booking_id);
    if (payment.purpose === 'deposit') return onDepositSucceeded(app, booking);
    if (payment.purpose === 'balance') schedule(app, 'email', app.now(), { kind: 'payment_received', bookingId: booking.id, paymentId: payment.id }, `mail:payment_received:${payment.id}`);
  } else if (payment.order_id) {
    return onOrderPaid(app, payment.order_id);
  }
}

// Registro manual (efectivo o ajuste) desde el panel, con historial.
export async function recordManualPayment(app, { bookingId, amountCents, method = 'cash', purpose = 'balance', note }) {
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new Error('Importe inválido');
  if (method === 'cash' && amountCents < 0) throw new Error('El efectivo debe ser un importe positivo');
  const booking = app.db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  if (!booking) throw new Error('Reserva no encontrada');
  const now = app.now();
  const id = Number(app.db.run(
    `INSERT INTO payments (token, booking_id, purpose, method, provider, amount_cents, status, note, recorded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'manual', ?, 'succeeded', ?, 'admin', ?, ?)`,
    token(18), bookingId, method === 'adjustment' ? 'adjustment' : purpose, method === 'adjustment' ? 'adjustment' : 'cash', amountCents, note || null, now, now
  ).lastInsertRowid);
  app.log('admin', method === 'adjustment' ? 'ajuste_registrado' : 'efectivo_registrado', { entity: 'booking', id: bookingId, details: `${mxn(amountCents)}${note ? ' — ' + note : ''}` });
  if (purpose === 'deposit' && method === 'cash') await onDepositSucceeded(app, booking);
  return id;
}

// Solo en modo demostración: confirmación marcada como DEMO, nunca se presenta como cobro real.
export async function demoConfirm(app, paymentToken) {
  if (!app.demo()) throw new Error('No disponible con pagos reales configurados.');
  const p = app.db.get('SELECT * FROM payments WHERE token = ?', paymentToken);
  if (!p) throw new Error('Pago no encontrado');
  app.db.run("UPDATE payments SET is_demo = 1, provider = 'demo' WHERE id = ?", p.id);
  return confirmPayment(app, { provider: 'demo', paymentToken, providerPaymentRef: `demo_${p.token}`, amountCents: p.amount_cents });
}

// Crea un pago pendiente de demostración (sin proveedor) para poder recorrer el flujo en la vista navegable.
export function demoPending(app, { booking = null, order = null }) {
  if (!app.demo()) throw new Error('No disponible con pagos reales configurados.');
  const { purpose, amount } = amountDue(app, { booking, order });
  const tok = token(18);
  app.db.run(`INSERT INTO payments (token, booking_id, order_id, purpose, method, provider, amount_cents, status, is_demo, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'card', 'demo', ?, 'pending', 1, ?, ?)`, tok, booking?.id ?? null, order?.id ?? null, purpose, amount, app.now(), app.now());
  return tok;
}
