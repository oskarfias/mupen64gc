-- Fase B09: reflexión diaria opcional y obstáculos vinculados a hábitos, fechas y estadísticas.
-- Notas e intenciones se guardan cifradas (AES-256-GCM con APP_SECRET); el ánimo y los obstáculos no.
CREATE TABLE daily_reviews (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  note_enc TEXT,
  intention_if_enc TEXT,
  intention_then_enc TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0,  -- "Ahora no": no se vuelve a sugerir ese día; no penaliza
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, local_date)
);

CREATE TABLE review_obstacles (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES daily_reviews(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  habit_id TEXT REFERENCES habits(id) ON DELETE CASCADE,  -- NULL = obstáculo del día en general
  obstacle_key TEXT NOT NULL,
  UNIQUE (review_id, habit_id, obstacle_key)
);
CREATE INDEX review_obstacles_owner_date ON review_obstacles(owner_id, local_date);
