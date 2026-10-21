// Integración de pagos sin SDK: Stripe Checkout y Mercado Pago (Checkout Pro y suscripciones).
// Métodos: tarjeta, OXXO y transferencia. Las suscripciones se cobran con tarjeta.
import { createHmac, timingSafeEqual } from 'node:crypto';

const cents = (n) => Math.round(n * 100);

// ───────────── Stripe ─────────────
function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

async function stripeApi(secret, path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formEncode(params),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe: ${j.error?.message || r.status}`);
  return j;
}

export async function stripeCheckout({ secret, order, siteUrl, ivaRate, metodo, priceIds = {} }) {
  const success = `${siteUrl}/gracias/?pedido=${order.id}`;
  const cancel = `${siteUrl}/carrito/`;
  if (order.tipo === 'suscripcion') {
    const it = order.items[0];
    const lineItem = priceIds[it.sku]
      ? { price: priceIds[it.sku], quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: cents(it.precio * (1 + ivaRate)),
            recurring: { interval: 'month' },
            product_data: { name: `${it.producto} — ${it.opcion} (IVA incluido)` },
          },
        };
    return stripeApi(secret, 'checkout/sessions', {
      mode: 'subscription',
      success_url: success,
      cancel_url: cancel,
      customer_email: order.cliente.correo,
      client_reference_id: order.id,
      line_items: { 0: lineItem },
      metadata: { order_id: order.id },
      subscription_data: { metadata: { order_id: order.id } },
    });
  }
  const lineItems = {};
  order.items.forEach((it, i) => {
    lineItems[i] = { quantity: it.cantidad, price_data: { currency: 'mxn', unit_amount: cents(it.precio), product_data: { name: `${it.producto} — ${it.opcion}` } } };
  });
  lineItems[order.items.length] = { quantity: 1, price_data: { currency: 'mxn', unit_amount: cents(order.iva), product_data: { name: `IVA (${Math.round(ivaRate * 100)}%)` } } };
  const methods = { tarjeta: ['card'], oxxo: ['oxxo'], transferencia: ['customer_balance'] }[metodo] || ['card'];
  const params = {
    mode: 'payment',
    success_url: success,
    cancel_url: cancel,
    customer_email: order.cliente.correo,
    client_reference_id: order.id,
    line_items: lineItems,
    payment_method_types: Object.fromEntries(methods.map((m, i) => [i, m])),
    metadata: { order_id: order.id },
    payment_intent_data: { metadata: { order_id: order.id } },
  };
  if (metodo === 'transferencia') {
    params.customer_creation = 'always';
    params.payment_method_options = { customer_balance: { funding_type: 'bank_transfer', bank_transfer: { type: 'mx_bank_transfer' } } };
  }
  return stripeApi(secret, 'checkout/sessions', params);
}

// Verifica la firma del webhook (encabezado Stripe-Signature).
export function verifyStripeSignature(raw, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

// ───────────── Mercado Pago ─────────────
async function mpApi(token, path, body, method = 'POST') {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago: ${j.message || r.status}`);
  return j;
}

export async function mercadoPagoCheckout({ token, order, siteUrl, ivaRate, metodo }) {
  if (order.tipo === 'suscripcion') {
    const it = order.items[0];
    const pre = await mpApi(token, '/preapproval', {
      reason: `Bikrom · ${it.producto} — ${it.opcion} (IVA incluido)`,
      external_reference: order.id,
      payer_email: order.cliente.correo,
      back_url: `${siteUrl}/gracias/?pedido=${order.id}`,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: Math.round(it.precio * (1 + ivaRate) * 100) / 100, currency_id: 'MXN' },
      status: 'pending',
    });
    return { url: pre.init_point, id: pre.id };
  }
  const excluded = {
    tarjeta: ['ticket', 'atm', 'bank_transfer'],
    oxxo: ['credit_card', 'debit_card', 'prepaid_card', 'bank_transfer', 'atm'],
    transferencia: ['credit_card', 'debit_card', 'prepaid_card', 'ticket'],
  }[metodo] || [];
  const pref = await mpApi(token, '/checkout/preferences', {
    items: order.items.map((it) => ({
      id: it.sku,
      title: `${it.producto} — ${it.opcion} (IVA incluido)`,
      quantity: it.cantidad,
      unit_price: Math.round(it.precio * (1 + ivaRate) * 100) / 100,
      currency_id: 'MXN',
    })),
    payer: { email: order.cliente.correo, name: order.cliente.nombre },
    external_reference: order.id,
    back_urls: {
      success: `${siteUrl}/gracias/?pedido=${order.id}`,
      pending: `${siteUrl}/gracias/?pedido=${order.id}`,
      failure: `${siteUrl}/carrito/`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/webhooks/mercadopago`,
    payment_methods: { excluded_payment_types: excluded.map((id) => ({ id })) },
    statement_descriptor: 'BIKROM',
  });
  return { url: pref.init_point, id: pref.id };
}

// Consulta el recurso notificado directamente a Mercado Pago (fuente de verdad).
export const mpGetPayment = (token, id) => mpApi(token, `/v1/payments/${encodeURIComponent(id)}`, null, 'GET');
export const mpGetPreapproval = (token, id) => mpApi(token, `/preapproval/${encodeURIComponent(id)}`, null, 'GET');
