-- Fase B18: recordatorios por correo (opt-in). Se envían a la hora de cada hábito pendiente y,
-- si el usuario lo elige, un resumen diario de lo pendiente. Nunca por hábitos ya registrados.
ALTER TABLE profiles ADD COLUMN reminders_email INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN reminder_digest_time TEXT;

-- Un envío por usuario, día local y franja ('HH:MM' de hábito o 'digest'): evita duplicados.
CREATE TABLE reminder_log (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  slot TEXT NOT NULL,
  habits INTEGER NOT NULL,
  result TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, local_date, slot)
);
