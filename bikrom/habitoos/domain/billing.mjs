// Plan Pro (PRD FR-09): suscripción con Stripe, permisos efectivos en el backend y webhooks idempotentes.
// - Precios configurables por entorno (no fijos en el código) y nunca tomados del navegador.
// - Cobro solo con consentimiento explícito; activación solo por webhook firmado.
// - Cancelar respeta el periodo pagado; perder Pro no borra datos.
const err = (code, status = 400) => Object.assign(new Error(code), { code, status });
const ACTIVE = ['active', 'trialing', 'past_due'];
const int = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);

export function plans(app) {
  const currency = /^[a-z]{3}$/.test(String(app.env.HABITOOS_CURRENCY || '').toLowerCase()) ? app.env.HABITOOS_CURRENCY.toLowerCase() : 'usd';
  return {
    pro_monthly: { key: 'pro_monthly', interval: 'month', amount_cents: int(app.env.HABITOOS_PRICE_MONTHLY_CENTS, 499), currency },
    pro_yearly: { key: 'pro_yearly', interval: 'year', amount_cents: int(app.env.HABITOOS_PRICE_YEARLY_CENTS, 3999), currency },
  };
}

export function billingStatus(app, user) {
  const sub = app.db.get('SELECT * FROM subscriptions WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 1', user.id);
  const ent = app.db.get("SELECT source, valid_until FROM entitlements WHERE owner_id = ? AND feature = 'pro' AND (valid_until IS NULL OR valid_until > ?) ORDER BY valid_until IS NULL DESC, valid_until DESC LIMIT 1", user.id, app.iso());
  return {
    pro: Boolean(ent), source: ent?.source || null, pro_until: ent?.valid_until || null,
    subscription: sub && { plan: sub.plan, status: sub.status, current_period_end: sub.current_period_end, cancel_at_period_end: Boolean(sub.cancel_at_period_end), amount_cents: sub.amount_cents, currency: sub.currency },
    available: app.billing.configured, plans: plans(app),
  };
}

export async function startCheckout(app, user, planKey, { consent, lang = 'es' } = {}) {
  if (!app.billing.configured) throw err('billing_unavailable', 503);
  const plan = plans(app)[planKey];
  if (!plan) throw err('invalid_plan');
  if (consent !== true && consent !== '1' && consent !== 'true') throw err('consent_required');
  const active = app.db.get(`SELECT 1 FROM subscriptions WHERE owner_id = ? AND status IN ('active','trialing','past_due') AND current_period_end > ?`, user.id, app.iso());
  if (active) throw err('already_pro', 409);
  const attemptId = app.id();
  const now = app.iso();
  app.db.run('INSERT INTO checkout_attempts (id, owner_id, plan, amount_cents, currency, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', attemptId, user.id, plan.key, plan.amount_cents, plan.currency, now, now);
  const customerId = app.db.get('SELECT provider_customer_id FROM subscriptions WHERE owner_id = ? AND provider_customer_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1', user.id)?.provider_customer_id;
  const s = await app.billing.createCheckout({
    attemptId, userId: user.id, email: user.email, customerId, plan: plan.key, amountCents: plan.amount_cents, currency: plan.currency, interval: plan.interval,
    productName: `HabitoOS Pro (${plan.interval === 'year' ? (lang === 'en' ? 'yearly' : 'anual') : (lang === 'en' ? 'monthly' : 'mensual')})`,
    successUrl: app.url('/app/plan?checkout=success'), cancelUrl: app.url('/app/plan?checkout=cancel'), lang,
  });
  app.db.run('UPDATE checkout_attempts SET provider_session_id = ? WHERE id = ?', s.ref, attemptId);
  app.audit(user.id, 'checkout_started', 'subscription', null, { plan: plan.key });
  return { url: s.url };
}

const toIso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
const periodEnd = (sub) => sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;

// Guarda el estado del proveedor tal como viene (fuente de verdad) y recalcula el permiso.
export function upsertSubscription(app, userId, sub, planHint = null) {
  if (!userId || !app.db.get('SELECT 1 FROM users WHERE id = ?', userId)) return false; // cuenta eliminada: se ignora
  const price = sub.items?.data?.[0]?.price;
  const plan = planHint || sub.metadata?.plan || (price?.recurring?.interval === 'year' ? 'pro_yearly' : 'pro_monthly');
  const now = app.iso();
  app.db.tx(() => {
    const prev = app.db.get('SELECT id, owner_id FROM subscriptions WHERE provider_subscription_id = ?', sub.id);
    if (prev && prev.owner_id !== userId) throw err('owner_mismatch', 409);
    if (prev) {
      app.db.run('UPDATE subscriptions SET provider_customer_id = COALESCE(?, provider_customer_id), plan = ?, status = ?, current_period_end = ?, cancel_at_period_end = ?, amount_cents = COALESCE(?, amount_cents), currency = COALESCE(?, currency), updated_at = ? WHERE id = ?',
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null, plan, sub.status, toIso(periodEnd(sub)), sub.cancel_at_period_end ? 1 : 0, price?.unit_amount ?? null, price?.currency ?? null, now, prev.id);
    } else {
      app.db.run('INSERT INTO subscriptions (id, owner_id, provider, provider_customer_id, provider_subscription_id, plan, status, current_period_end, cancel_at_period_end, amount_cents, currency, created_at, updated_at) VALUES (?, ?, \'stripe\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        app.id(), userId, typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null, sub.id, plan, sub.status, toIso(periodEnd(sub)), sub.cancel_at_period_end ? 1 : 0, price?.unit_amount ?? null, price?.currency ?? null, now, now);
    }
    syncEntitlement(app, userId);
  });
  return true;
}

export function syncEntitlement(app, userId) {
  app.db.tx(() => {
    const until = app.db.get(`SELECT MAX(current_period_end) AS u FROM subscriptions WHERE owner_id = ? AND status IN (${ACTIVE.map(() => '?').join(',')}) AND current_period_end > ?`, userId, ...ACTIVE, app.iso())?.u;
    const had = app.db.get("SELECT valid_until FROM entitlements WHERE owner_id = ? AND feature = 'pro' AND source = 'subscription'", userId);
    app.db.run("DELETE FROM entitlements WHERE owner_id = ? AND feature = 'pro' AND source = 'subscription'", userId);
    if (until) app.db.run("INSERT INTO entitlements (id, owner_id, feature, source, valid_until, created_at) VALUES (?, ?, 'pro', 'subscription', ?, ?)", app.id(), userId, until, app.iso());
    if (Boolean(had) !== Boolean(until)) app.audit(userId, until ? 'pro_activated' : 'pro_ended', 'entitlement', null);
  });
}

// Webhook verificado. Devuelve 'processed' | 'duplicate' | 'ignored'.
export async function handleEvent(app, ev) {
  if (app.db.get('SELECT 1 FROM billing_events WHERE provider_event_id = ?', ev.id)) return 'duplicate';
  const obj = ev.data?.object || {};
  let handled = true;
  if (ev.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
    const sub = await app.billing.getSubscription(obj.subscription);
    upsertSubscription(app, obj.client_reference_id || obj.metadata?.user_id, sub, obj.metadata?.plan);
  } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(ev.type)) {
    const owner = obj.metadata?.user_id || app.db.get('SELECT owner_id FROM subscriptions WHERE provider_subscription_id = ?', obj.id)?.owner_id;
    upsertSubscription(app, owner, ev.type === 'customer.subscription.deleted' ? { ...obj, status: 'canceled' } : obj);
  } else if (['invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed'].includes(ev.type)) {
    const subId = obj.subscription || obj.parent?.subscription_details?.subscription;
    if (subId) {
      const sub = await app.billing.getSubscription(subId);
      const owner = sub.metadata?.user_id || app.db.get('SELECT owner_id FROM subscriptions WHERE provider_subscription_id = ?', subId)?.owner_id;
      upsertSubscription(app, owner, sub);
    } else handled = false;
  } else handled = false;
  app.db.run('INSERT OR IGNORE INTO billing_events (provider_event_id, type, processed_at) VALUES (?, ?, ?)', ev.id, ev.type, app.iso());
  return handled ? 'processed' : 'ignored';
}

async function setCancel(app, user, value) {
  if (!app.billing.configured) throw err('billing_unavailable', 503);
  const s = app.db.get(`SELECT * FROM subscriptions WHERE owner_id = ? AND status IN ('active','trialing','past_due') ORDER BY updated_at DESC LIMIT 1`, user.id);
  if (!s) throw err('no_subscription', 404);
  const sub = await app.billing.setCancelAtPeriodEnd(s.provider_subscription_id, value);
  upsertSubscription(app, user.id, sub, s.plan);
  app.audit(user.id, value ? 'subscription_cancel_requested' : 'subscription_resumed', 'subscription', s.id);
  return billingStatus(app, user);
}
export const cancelAtPeriodEnd = (app, user) => setCancel(app, user, true);
export const resume = (app, user) => setCancel(app, user, false);
