-- Fase B11: suscripción Pro (Stripe). El permiso efectivo vive en entitlements (fuente 'subscription').
-- Perder el plan nunca borra datos: solo vuelven los límites Free.
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id TEXT,
  provider_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL,                       -- 'pro_monthly' | 'pro_yearly'
  status TEXT NOT NULL,                     -- estado del proveedor: active, trialing, past_due, canceled, unpaid, incomplete…
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER,
  currency TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX subscriptions_owner ON subscriptions(owner_id);

-- Idempotencia de webhooks: un evento del proveedor se procesa una sola vez
CREATE TABLE billing_events (
  provider_event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

-- Intentos de compra (consentimiento explícito, precio y plan registrados antes de ir al proveedor)
CREATE TABLE checkout_attempts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider_session_id TEXT,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
