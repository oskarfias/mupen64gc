// Adaptadores de servicios externos. Cada uno indica si está configurado; sin credenciales
// el sistema funciona en modo demostración y NO simula cobros, correos ni sincronizaciones.
import { createHmac, timingSafeEqual } from 'node:crypto';

// ───────────── Stripe (tarjeta) ─────────────
// Checkout Session en modo "payment", MXN. Confirmación solo por webhook firmado.
function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

export function stripeAdapter(env) {
  const secret = env.STRIPE_SECRET_KEY;
  return {
    configured: Boolean(secret && env.STRIPE_WEBHOOK_SECRET),
    async createCheckout({ amountCents, description, paymentToken, successUrl, cancelUrl, email, lang }) {
      const body = formEncode({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: email,
        locale: lang === 'en' ? 'en' : 'es',
        client_reference_id: paymentToken,
        'payment_method_types[0]': 'card',
        line_items: { 0: { quantity: 1, price_data: { currency: 'mxn', unit_amount: amountCents, product_data: { name: description } } } },
        metadata: { payment_token: paymentToken },
        payment_intent_data: { metadata: { payment_token: paymentToken } },
      });
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `pay-${paymentToken}` },
        body,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Stripe: ${j.error?.message || r.status}`);
      return { url: j.url, ref: j.id };
    },
    verifyWebhook(raw, header) {
      if (!header || !env.STRIPE_WEBHOOK_SECRET) return null;
      const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
      const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      const t = Number(parts.t);
      if (!t || Math.abs(Date.now() / 1000 - t) > 300) return null;
      const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');
      const ok = sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
      return ok ? JSON.parse(raw) : null;
    },
  };
}

// ───────────── PayPal (Orders v2) ─────────────
// Se crea la orden, el cliente aprueba en PayPal y el servidor CAPTURA la orden (respuesta servidor-a-servidor).
// Además se aceptan webhooks verificados con verify-webhook-signature.
export function paypalAdapter(env) {
  const base = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const configured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  let tokenCache = null;
  async function accessToken() {
    if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.value;
    const r = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`PayPal token: ${j.error_description || r.status}`);
    tokenCache = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }
  const api = async (method, path, body, extraHeaders = {}) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body: j };
  };
  return {
    configured,
    async createOrder({ amountCents, description, paymentToken, returnUrl, cancelUrl, lang }) {
      const r = await api('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: paymentToken,
          custom_id: paymentToken,
          description: description.slice(0, 127),
          amount: { currency_code: 'MXN', value: (amountCents / 100).toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: returnUrl,
              cancel_url: cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
              locale: lang === 'en' ? 'en-US' : 'es-MX',
            },
          },
        },
      }, { 'PayPal-Request-Id': `create-${paymentToken}` });
      if (!r.ok) throw new Error(`PayPal: ${r.body.message || r.status}`);
      const link = (r.body.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
      if (!link) throw new Error('PayPal: sin enlace de aprobación');
      return { url: link.href, ref: r.body.id };
    },
    // Devuelve {status:'COMPLETED', captureId, amountCents, paymentToken} solo con confirmación de PayPal.
    async captureOrder(orderId) {
      let r = await api('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { 'PayPal-Request-Id': `capture-${orderId}` });
      if (!r.ok && r.body?.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) r = await api('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
      if (!r.ok) return { status: 'FAILED', error: r.body.message || String(r.status) };
      const unit = r.body.purchase_units?.[0];
      const cap = unit?.payments?.captures?.[0];
      return {
        status: cap?.status || r.body.status,
        captureId: cap?.id,
        amountCents: cap ? Math.round(Number(cap.amount.value) * 100) : null,
        currency: cap?.amount?.currency_code,
        paymentToken: cap?.custom_id || unit?.custom_id || unit?.reference_id,
      };
    },
    async verifyWebhook(raw, headers) {
      if (!env.PAYPAL_WEBHOOK_ID) return null;
      const event = JSON.parse(raw);
      const r = await api('POST', '/v1/notifications/verify-webhook-signature', {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      });
      return r.ok && r.body.verification_status === 'SUCCESS' ? event : null;
    },
  };
}

// ───────────── Google Calendar ─────────────
// OAuth 2.0 (código de autorización con refresh token). Solo se consulta free/busy y se crean eventos
// con datos mínimos; nunca se muestran detalles del calendario a los clientes.
export function googleAdapter(env) {
  const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const calendarId = env.GOOGLE_CALENDAR_ID || 'primary';
  return {
    configured,
    calendarId,
    authUrl(redirectUri, state) {
      const q = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    },
    async exchange(code, redirectUri) {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const j = await r.json();
      if (!r.ok || !j.refresh_token) throw new Error(`Google: ${j.error_description || j.error || 'sin refresh_token'}`);
      return j.refresh_token;
    },
    async accessToken(refreshToken) {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: refreshToken, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }),
      });
      const j = await r.json();
      if (!r.ok) throw Object.assign(new Error(`Google: ${j.error_description || j.error}`), { revoked: j.error === 'invalid_grant' });
      return j.access_token;
    },
    async freeBusy(token, fromMs, toMs) {
      const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), timeZone: 'America/Mexico_City', items: [{ id: calendarId }] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Google freeBusy: ${j.error?.message || r.status}`);
      const cal = j.calendars?.[calendarId];
      if (cal?.errors?.length) throw new Error(`Google freeBusy: ${cal.errors[0].reason}`);
      return (cal?.busy || []).map((b) => [Date.parse(b.start), Date.parse(b.end)]);
    },
    async insertEvent(token, { summary, description, startMs, endMs, idempotencyId }) {
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: idempotencyId, // base32hex: evita eventos duplicados si se reintenta
          summary,
          description,
          start: { dateTime: new Date(startMs).toISOString(), timeZone: 'America/Mexico_City' },
          end: { dateTime: new Date(endMs).toISOString(), timeZone: 'America/Mexico_City' },
          visibility: 'private',
          transparency: 'opaque',
        }),
      });
      const j = await r.json();
      if (r.status === 409) return idempotencyId; // ya existe
      if (!r.ok) throw new Error(`Google insert: ${j.error?.message || r.status}`);
      return j.id;
    },
    async deleteEvent(token, eventId) {
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Google delete: ${r.status}`);
    },
  };
}

// ───────────── Correo (Resend) ─────────────
export function mailAdapter(env) {
  const configured = Boolean(env.RESEND_API_KEY && env.PHOTO_EMAIL_FROM);
  return {
    configured,
    async send({ to, subject, html, text, replyTo, idempotencyKey }) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {}) },
        body: JSON.stringify({ from: env.PHOTO_EMAIL_FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`Resend: ${j.message || r.status}`);
      return j.id;
    },
  };
}
