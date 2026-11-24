-- Bikrom/HabitoOS — esquema inicial (fase 1: identidad, hábitos, metas versionadas, ocurrencias y registros).
-- Identificadores UUID (texto). Instantes en UTC ISO-8601. Fechas locales 'YYYY-MM-DD' con zona IANA.
-- Las tablas de fases posteriores se agregan con nuevas migraciones (solo aditivas).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es','en')),
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric','imperial')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  onboarding_state TEXT,                 -- JSON del cuestionario en curso (reanudable)
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Sesiones revocables: se guarda solo el hash del token
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                   -- sha256 del token de la cookie
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

-- Preparado para B2B futuro (sin uso en el MVP)
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'team',
  created_at TEXT NOT NULL
);
CREATE TABLE organization_memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member','professional','org_admin')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, organization_id)
);

-- Hábitos
CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('build','maintain','reduce','quit')),
  measure TEXT NOT NULL CHECK (measure IN ('binary','count','duration','range')),
  unit TEXT,                             -- p. ej. 'min', 'páginas', 'cigarrillos'
  baseline_value REAL,
  baseline_unknown INTEGER NOT NULL DEFAULT 0,
  motivation TEXT,
  barriers TEXT,                         -- JSON array de claves de barreras previstas
  contingency TEXT,                      -- plan "si X, entonces Y"
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  start_date TEXT NOT NULL,
  archived_on TEXT,                      -- fecha local desde la que deja de programarse
  template_key TEXT,                     -- idempotencia del onboarding
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX habits_owner ON habits(owner_id, status);
CREATE UNIQUE INDEX habits_owner_template ON habits(owner_id, template_key) WHERE template_key IS NOT NULL;

-- Metas versionadas: cada versión rige un intervalo de fechas locales sin traslapes
CREATE TABLE habit_goal_versions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comparator TEXT NOT NULL CHECK (comparator IN ('done','>=','<=','=','range')),
  target REAL,
  target_max REAL,                       -- límite superior (rango) o tolerancia parcial en '<='
  partial_min REAL,                      -- en '>=': desde este valor cuenta como parcial (NULL = cualquier valor > 0)
  valid_from TEXT NOT NULL,
  valid_to TEXT,                         -- NULL = vigente
  created_at TEXT NOT NULL
);
CREATE INDEX goal_versions_habit ON habit_goal_versions(habit_id, valid_from);

-- Programación versionada: días de la semana (lunes=1 … domingo=7) y hora local opcional
CREATE TABLE habit_schedules (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days TEXT NOT NULL,                    -- JSON array, p. ej. [1,2,3,4,5]
  local_time TEXT,                       -- 'HH:MM' opcional (recordatorio)
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX schedules_habit ON habit_schedules(habit_id, valid_from);

-- Pausas y días de descanso: no penalizan adherencia ni cobertura
CREATE TABLE habit_pauses (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

-- Ocurrencia: estado de un hábito en una fecha local. Sin fila = sin registro (nunca "no cumplido").
CREATE TABLE habit_occurrences (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done','partial','missed','skipped','not_applicable','cleared')),
  value REAL,
  goal_version_id TEXT REFERENCES habit_goal_versions(id),
  updated_at TEXT NOT NULL,
  UNIQUE (habit_id, local_date)
);
CREATE INDEX occurrences_owner_date ON habit_occurrences(owner_id, local_date);

-- Historial de registros (trazabilidad, deshacer, idempotencia por request_id)
CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES habit_occurrences(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  value REAL,
  prev_status TEXT,
  prev_value REAL,
  request_id TEXT,
  source TEXT NOT NULL DEFAULT 'app',
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, request_id)
);

-- Permisos de plan (Pro). El cobro se agrega en la fase de billing; el límite Free ya se aplica en backend.
CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,                 -- 'pro'
  source TEXT NOT NULL,                  -- 'subscription' | 'admin_grant' | 'trial'
  valid_until TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX entitlements_owner ON entitlements(owner_id, feature);

-- Auditoría sin contenido privado
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  meta TEXT,
  at TEXT NOT NULL
);
CREATE INDEX audit_at ON audit_events(at);

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
