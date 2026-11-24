// Stripe para HabitoOS (suscripciones). Claves propias: HABITOOS_STRIPE_SECRET_KEY y HABITOOS_STRIPE_WEBHOOK_SECRET
// (independientes de las de Fotografía y del sitio). Sin claves no hay cobro ni simulación.
import { createHmac, timingSafeEqual } from 'node:crypto';

function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

export function stripeBilling(env) {
  const secret = env.HABITOOS_STRIPE_SECRET_KEY;
  const whsec = env.HABITOOS_STRIPE_WEBHOOK_SECRET;
  const call = async (method, path, body, idem) => {
    const r = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(idem ? { 'Idempotency-Key': idem } : {}) },
      body: body ? formEncode(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Stripe: ${j.error?.message || r.status}`);
    return j;
  };
  return {
    configured: Boolean(secret && whsec),
    // Precio desde la configuración del servidor (price_data), nunca desde el navegador.
    async createCheckout({ attemptId, userId, email, customerId, plan, amountCents, currency, interval, productName, successUrl, cancelUrl, lang }) {
      const s = await call('POST', '/checkout/sessions', {
        mode: 'subscription',
        success_url: successUrl, cancel_url: cancelUrl, locale: lang === 'en' ? 'en' : 'es',
        client_reference_id: userId,
        ...(customerId ? { customer: customerId } : { customer_email: email }),
        line_items: { 0: { quantity: 1, price_data: { currency, unit_amount: amountCents, recurring: { interval }, product_data: { name: productName } } } },
        metadata: { user_id: userId, plan, attempt_id: attemptId },
        subscription_data: { metadata: { user_id: userId, plan } },
      }, `hos-checkout-${attemptId}`);
      return { url: s.url, ref: s.id };
    },
    getSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
    setCancelAtPeriodEnd: (id, value) => call('POST', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: value ? 'true' : 'false' }),
    verifyWebhook(raw, header, nowSec = Date.now() / 1000) {
      if (!header || !whsec) return null;
      const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
      const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      const t = Number(parts.t);
      if (!t || Math.abs(nowSec - t) > 300) return null;
      const expected = createHmac('sha256', whsec).update(`${t}.${raw}`).digest('hex');
      const ok = sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
      return ok ? JSON.parse(raw) : null;
    },
  };
}
