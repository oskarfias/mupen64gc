-- Estefanía Torres Fotografía — esquema inicial.
-- Importes en centavos de MXN (INTEGER). Instantes en milisegundos UTC (INTEGER). Fechas de calendario en 'YYYY-MM-DD'.
-- is_demo = 1 identifica registros de demostración, separados de producción.

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,              -- JSON
  updated_at INTEGER NOT NULL
);

-- Textos editables del sitio (por clave e idioma)
CREATE TABLE content (
  key TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('es','en')),
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key, lang)
);

-- Imágenes del sitio (logo, portada, secciones, productos). Los recursos de demostración se marcan.
CREATE TABLE media (
  id INTEGER PRIMARY KEY,
  slot TEXT,                         -- 'logo', 'hero', 'about', 'service:<slug>', 'product:<id>', 'portfolio'
  storage_key TEXT,                  -- NULL = espacio reemplazable sin imagen
  mime TEXT,
  width INTEGER, height INTEGER,
  alt_es TEXT, alt_en TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  license_note TEXT,                 -- permiso de uso del recurso
  created_at INTEGER NOT NULL
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  lang TEXT NOT NULL DEFAULT 'es',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX customers_email ON customers(email);

-- Servicios (familias) y versiones de paquete (inmutables una vez usadas en una cotización)
CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('session','event','wedding','school','business','tesoro')),
  name_es TEXT NOT NULL, name_en TEXT NOT NULL,
  summary_es TEXT, summary_en TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE package_versions (
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id),
  package_key TEXT NOT NULL,         -- identifica el paquete a través de sus versiones
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  name_es TEXT NOT NULL, name_en TEXT NOT NULL,
  pricing TEXT NOT NULL CHECK (pricing IN ('fixed','per_unit','quote')),
  price_cents INTEGER,               -- NULL = no definido → cotización pendiente
  unit_es TEXT, unit_en TEXT,        -- p. ej. 'por alumno'
  duration_min INTEGER,              -- tiempo de sesión/cobertura; NULL = por definir
  photos_included INTEGER,
  video_minutes INTEGER,
  includes_es TEXT, includes_en TEXT, -- JSON array de entregables
  delivery_days INTEGER,             -- NULL = fecha acordada (escuelas)
  notes_es TEXT, notes_en TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (package_key, version)
);
CREATE INDEX package_current ON package_versions(service_id, is_current);

-- Cuestionarios versionados por servicio (campos condicionales en JSON)
CREATE TABLE questionnaires (
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id),
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  fields TEXT NOT NULL,              -- JSON
  created_at INTEGER NOT NULL
);

-- Extras: price_cents NULL significa "no configurado": se registra como pendiente, nunca se cobra.
CREATE TABLE extras (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  service_kinds TEXT,                -- JSON array o NULL = todos
  name_es TEXT NOT NULL, name_en TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('fixed','per_hour','per_unit')),
  price_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE travel_zones (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  cities TEXT NOT NULL,              -- JSON array de nombres normalizados
  price_cents INTEGER,               -- 0 = incluido; NULL = por cotizar
  is_base INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE discounts (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value INTEGER NOT NULL,            -- porcentaje entero o centavos
  valid_from INTEGER, valid_to INTEGER,
  max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0,
  min_subtotal_cents INTEGER,
  service_kinds TEXT,                -- JSON array o NULL
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Cotizaciones versionadas. Al aceptarse se guarda una copia íntegra de precios y condiciones.
CREATE TABLE quotes (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,        -- enlace privado para el cliente (aleatorio)
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  package_version_id INTEGER REFERENCES package_versions(id),
  questionnaire_id INTEGER REFERENCES questionnaires(id),
  answers TEXT NOT NULL,             -- JSON
  lang TEXT NOT NULL DEFAULT 'es',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending_admin','ready','accepted','cancelled')),
  pending_reasons TEXT,              -- JSON array
  lines TEXT NOT NULL,               -- JSON: conceptos con importes
  subtotal_cents INTEGER, discount_cents INTEGER, travel_cents INTEGER,
  total_cents INTEGER, deposit_cents INTEGER, balance_cents INTEGER,
  discount_id INTEGER REFERENCES discounts(id),
  duration_min INTEGER,
  location_city TEXT,
  admin_note TEXT,
  accepted_at INTEGER,
  accepted_revision INTEGER,
  accepted_snapshot TEXT,            -- JSON inmutable: precios, conceptos y condiciones aceptados
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

-- Reservas: block_start/block_end incluyen preparación y traslado.
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  quote_id INTEGER NOT NULL REFERENCES quotes(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  start_at INTEGER NOT NULL, end_at INTEGER NOT NULL,
  block_start INTEGER NOT NULL, block_end INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held','confirmed','expired','cancelled','completed','conflict')),
  hold_expires_at INTEGER,
  delivery_due_date TEXT,            -- 'YYYY-MM-DD'
  cancel_note TEXT,
  google_event_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX bookings_block ON bookings(status, block_start, block_end);

CREATE TABLE calendar_blocks (
  id INTEGER PRIMARY KEY,
  start_at INTEGER NOT NULL, end_at INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- Copia local de ocupados de Google Calendar (sin títulos ni detalles)
CREATE TABLE calendar_busy_cache (
  day TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  fetched_at INTEGER NOT NULL,
  busy TEXT NOT NULL,                -- JSON [[start,end],...]
  PRIMARY KEY (day)
);

-- Pagos: de servicios (booking) o de productos (order). Nunca datos de tarjeta.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  booking_id INTEGER REFERENCES bookings(id),
  order_id INTEGER REFERENCES orders(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('deposit','balance','order','adjustment')),
  method TEXT NOT NULL CHECK (method IN ('card','paypal','cash','adjustment')),
  provider TEXT,                     -- 'stripe' | 'paypal' | 'manual' | 'demo'
  provider_ref TEXT,                 -- id de sesión/orden del proveedor
  provider_payment_ref TEXT UNIQUE,  -- id de cobro confirmado (evita duplicados)
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','cancelled','refunded')),
  note TEXT,
  recorded_by TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  CHECK ((booking_id IS NULL) <> (order_id IS NULL))
);
CREATE INDEX payments_booking ON payments(booking_id);
CREATE INDEX payments_order ON payments(order_id);

-- Notificaciones de proveedores ya procesadas (idempotencia)
CREATE TABLE webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  type TEXT,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (provider, event_id)
);

-- Galerías privadas
CREATE TABLE galleries (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,         -- aleatorio, no secuencial
  booking_id INTEGER REFERENCES bookings(id),
  audience TEXT NOT NULL DEFAULT 'client' CHECK (audience IN ('client','family','group')),
  title TEXT NOT NULL,
  message TEXT,
  cover_file_id INTEGER,
  lang TEXT NOT NULL DEFAULT 'es',
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','released','expired','deleted')),
  release_at INTEGER,                -- liberación programada
  released_at INTEGER,
  expires_at INTEGER,
  files_deleted_at INTEGER,
  without_booking_confirmed INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE gallery_files (
  id INTEGER PRIMARY KEY,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id),
  kind TEXT NOT NULL CHECK (kind IN ('photo','video')),
  filename TEXT NOT NULL,
  mime TEXT,
  original_key TEXT, original_size INTEGER, original_crc32 INTEGER,
  preview_key TEXT, preview_size INTEGER,
  thumb_key TEXT, thumb_size INTEGER,
  width INTEGER, height INTEGER,
  status TEXT NOT NULL CHECK (status IN ('uploading','ready','deleted')),
  retained_for_orders INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX gallery_files_g ON gallery_files(gallery_id, status, sort);

-- Credenciales de acceso (código privado). lookup en claro, secreto con hash.
CREATE TABLE gallery_access (
  id INTEGER PRIMARY KEY,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id),
  lookup TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  label TEXT,
  revoked_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

-- Cargas reanudables por fragmentos
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,              -- 'gallery_original' | 'gallery_preview' | 'gallery_thumb' | 'media'
  gallery_file_id INTEGER,
  media_id INTEGER,
  storage_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  next_part INTEGER NOT NULL DEFAULT 0,
  crc32 INTEGER NOT NULL DEFAULT 0,
  provider_upload_id TEXT,
  parts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('open','done','aborted')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

-- Tienda
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('print','enlargement','frame','photobook')),
  name_es TEXT NOT NULL, name_en TEXT NOT NULL,
  description_es TEXT, description_en TEXT,
  min_photos INTEGER NOT NULL DEFAULT 1,
  max_photos INTEGER NOT NULL DEFAULT 1,
  requires_design_review INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  size_label TEXT NOT NULL,
  width_cm REAL, height_cm REAL,
  finish_es TEXT, finish_en TEXT,
  price_cents INTEGER,               -- NULL = sin precio → no se vende
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE shipping_rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  states TEXT NOT NULL,              -- JSON array de estados (normalizados) o ["*"]
  price_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id),
  customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  lang TEXT NOT NULL DEFAULT 'es',
  address TEXT,                      -- JSON
  status TEXT NOT NULL CHECK (status IN ('awaiting_shipping_quote','awaiting_payment','paid','design_review','in_production','shipped','delivered','cancelled')),
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER,            -- NULL = envío sin definir: no se puede cobrar
  shipping_rule_id INTEGER,
  total_cents INTEGER,
  carrier TEXT, tracking TEXT,
  admin_note TEXT,
  completed_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER NOT NULL REFERENCES product_variants(id),
  qty INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  description TEXT NOT NULL,         -- copia del nombre/variante al ordenar
  photos TEXT NOT NULL,              -- JSON [{file_id, crop:{x,y,w,h}, fit:'crop'|'fit', orientation}]
  instructions TEXT
);

-- Correo: plantillas editables por clave, idioma y tipo de servicio
CREATE TABLE email_templates (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  service_kind TEXT,                 -- NULL = general
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  offset_days INTEGER,               -- para recordatorios programados
  updated_at INTEGER NOT NULL,
  UNIQUE (key, lang, service_kind)
);

CREATE TABLE email_log (
  id INTEGER PRIMARY KEY,
  dedupe_key TEXT UNIQUE,
  to_email TEXT NOT NULL,
  template_key TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'sent' | 'failed' | 'not_sent_demo'
  provider_id TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
);

-- Tareas programadas persistentes
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_due ON jobs(status, run_at);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,               -- 'admin' | 'cliente' | 'sistema' | 'stripe' | 'paypal' | 'google'
  action TEXT NOT NULL,
  entity TEXT, entity_id INTEGER,
  details TEXT,
  level TEXT NOT NULL DEFAULT 'info' -- 'info' | 'warning' | 'error'
);
CREATE INDEX activity_at ON activity_log(at);

CREATE TABLE testimonials (
  id INTEGER PRIMARY KEY,
  quote_es TEXT, quote_en TEXT,
  author TEXT,
  authorized INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE faqs (
  id INTEGER PRIMARY KEY,
  q_es TEXT NOT NULL, a_es TEXT NOT NULL,
  q_en TEXT, a_en TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE portfolio_categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL, name_en TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Publicar en portafolio exige autorización independiente
CREATE TABLE portfolio_items (
  id INTEGER PRIMARY KEY,
  category_id INTEGER REFERENCES portfolio_categories(id),
  media_id INTEGER NOT NULL REFERENCES media(id),
  title_es TEXT, title_en TEXT,
  authorization_note TEXT,
  authorized INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

