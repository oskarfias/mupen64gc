-- Mensajes del formulario de contacto
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'es',
  handled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
