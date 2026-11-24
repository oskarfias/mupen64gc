-- Fase B16: plan de alimentación por equivalentes con emojis.
-- Los emojis son etiquetas de GRUPO (🍳 🥛 🥬 🍎 🫘 🥑 🍞), no alimentos ni calorías fijas. No se calculan calorías.
CREATE TABLE nutrition_groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  emoji TEXT NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, key)
);

-- Versiones del plan: editar crea una versión nueva desde una fecha; los días anteriores conservan su plan.
CREATE TABLE nutrition_plan_versions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  notes_enc TEXT,                        -- indicaciones del profesional (cifradas)
  created_at TEXT NOT NULL
);
CREATE INDEX nutrition_versions_owner ON nutrition_plan_versions(owner_id, valid_from);

CREATE TABLE nutrition_meals (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES nutrition_plan_versions(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,                    -- identificador estable entre versiones (p. ej. 'desayuno')
  name TEXT NOT NULL,
  local_time TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE nutrition_targets (
  meal_id TEXT NOT NULL REFERENCES nutrition_meals(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES nutrition_groups(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portions REAL NOT NULL CHECK (portions > 0 AND portions <= 20),
  PRIMARY KEY (meal_id, group_id)
);

-- Cada toque es un registro; deshacer lo marca (no se borra) para conservar el historial.
CREATE TABLE nutrition_logs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  meal_slot TEXT,                        -- NULL = fuera del plan
  group_id TEXT NOT NULL REFERENCES nutrition_groups(id) ON DELETE CASCADE,
  portions REAL NOT NULL DEFAULT 1,
  request_id TEXT,
  undone_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, request_id)
);
CREATE INDEX nutrition_logs_day ON nutrition_logs(owner_id, local_date);
