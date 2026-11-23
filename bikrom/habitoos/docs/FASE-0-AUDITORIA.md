# Bikrom/HabitoOS — Fase 0: auditoría de Bikrom y plan de integración

**Fecha:** 23 de noviembre de 2026  
**Alcance:** diagnóstico técnico de Bikrom e integración de HabitoOS, sin cambios en datos, despliegues ni DNS.  
**Requisitos de referencia:** `fuente/02_PROMPT_MAESTRO_BIKROM_HABITOOS.md` y `fuente/03_PRD_TECNICO_HABITOOS.md`.

---

## 1. Inventario técnico

| Elemento | Estado actual |
|---|---|
| Repositorio | `oskarfias/mupen64gc`, rama `claude/bikrom-website-049yh0`. **Bikrom vive en la carpeta `bikrom/` de un repositorio ajeno** (un emulador de Nintendo 64). |
| Lenguaje y entorno | Node.js 22, módulos ES. **Sin dependencias de npm** (no hay `node_modules` ni lockfile). |
| Código | ~11,000 líneas de JS, 88 archivos versionados. |
| Hosting | Render, servicio web `bikrom` administrado por Blueprint (`render.yaml`). Plan **Starter** con **disco persistente de 20 GB** en `/var/data` (cambio enviado el 20 de nov.; falta confirmar el primer despliegue en Render). |
| Dominio | `bikrom.com` y `www.bikrom.com` en Spaceship: registro A → 216.24.57.1 y CNAME `www` → `bikrom.onrender.com`. HTTPS de Render. |
| CI/CD | **Sin CI.** Render despliega cada push a la rama. No hay entorno de staging. |
| Respaldos | Sin procedimiento propio. Pendiente verificar los snapshots de disco que ofrezca Render en el plan contratado. |

### Aplicaciones dentro de Bikrom

**1. Sitio de consultoría Bikrom** (`/`)
- Generador estático (`build.mjs` → `dist/`, 54 páginas, 37 productos) más `server.mjs` como API.
- Funciones: diagnóstico 360, solicitudes, carrito, Stripe y Mercado Pago, webhooks y panel `/admin`.
- Persistencia: archivos JSON (`server/store.js`) en `DATA_DIR`.
- Autenticación: solo el panel, con Basic Auth (`ADMIN_PASSWORD`).
- Modo `PREVIEW=true`: sin cobros y sin indexación.

**2. Bikrom Photography** (`/photography`)
- Aplicación propia renderizada en servidor.
- Persistencia: **SQLite (`node:sqlite`)** con migraciones versionadas, transacciones `BEGIN IMMEDIATE`, cola de tareas persistente, plantillas de correo, almacenamiento local o S3 y 19 pruebas automáticas.
- Autenticación: un solo administrador (contraseña de entorno, cookie firmada, CSRF y límite de intentos). Clientes con códigos de galería, **sin cuentas de usuario**.

### Integraciones existentes

| Integración | Dónde | Estado |
|---|---|---|
| Stripe (pago único y suscripción) | Bikrom y Photography | Código listo, **sin llaves** |
| Mercado Pago, PayPal | Bikrom, Photography | Código listo, sin llaves |
| Resend (correo) | Ambos | Código listo, **sin llave ni dominio verificado** |
| Google Calendar | Photography | Código listo, sin credenciales |
| GA4 / Meta Pixel | Bikrom | Marcadores sin ID |

---

## 2. Qué se reutiliza para HabitoOS

| Necesidad de HabitoOS | Se reutiliza | Se construye nuevo |
|---|---|---|
| Base relacional con migraciones | `photography/db.mjs` (migrador, transacciones) | Esquema HabitoOS |
| Sesiones seguras, CSRF, límites | `photography/lib/http.mjs`, `lib/security.mjs` (scrypt, HMAC, AES-GCM) | Sesiones por usuario con revocación |
| Fechas por zona horaria | `photography/lib/time.mjs` | Generalizarlo a cualquier zona IANA (hoy fija en America/Mexico_City) |
| Tareas programadas | `photography/domain/jobs.mjs` | Recordatorios y agregados |
| Correo transaccional | `photography/domain/mail.mjs` (Resend) | Verificación, recuperación, resúmenes |
| Stripe | Adaptador de Photography (webhook firmado, idempotencia) | **Stripe Billing**: suscripciones recurrentes, portal del cliente, entitlements |
| ES/EN | Patrón de `i18n.mjs` | Textos de HabitoOS |
| Despliegue | Mismo servicio y disco de Render | — |
| **Cuentas multiusuario** | — | **Todo nuevo**: hoy no existe identidad de usuarios finales |

---

## 3. Decisión de arquitectura (requiere confirmación)

El prompt maestro pide **reutilizar el stack de Bikrom si es apto** y usar Next.js + TypeScript + PostgreSQL solo si no lo es.

### Opción A — Reutilizar el stack de Bikrom (recomendada para la beta)
**Descripción:** módulo `bikrom/habitoos/` en Node 22 sin dependencias, SQLite en el disco persistente y montado en `/habitoos`, igual que Photography.

| Ventajas | Limitaciones |
|---|---|
| Sin costo extra de infraestructura (mismo servicio y disco) | Una sola instancia: sin escalado horizontal mientras use SQLite |
| Reutiliza seguridad, correo, cola, Stripe y patrones ya probados | Sin RLS: el aislamiento se garantiza con una **capa única de acceso a datos** (toda consulta filtrada por `owner_id`) y pruebas de acceso cruzado |
| Un solo lenguaje y despliegue; carga muy rápida en celular | Sin React/TypeScript: más trabajo manual en la interfaz y en la PWA |
| Primera fase comprobable en días, no semanas | Reiniciar o desplegar deja el servicio fuera unos segundos (disco no compartible) |

**Ruta de crecimiento:** SQL portable (UUID en texto, fechas ISO, sin funciones propias de SQLite en la lógica) para migrar a PostgreSQL cuando lo pida la escala: varias instancias, decenas de miles de usuarios activos o necesidad de RLS.

### Opción B — Next.js + TypeScript + PostgreSQL (alternativa del PRD)
**Descripción:** servicio nuevo en Render más PostgreSQL administrado.

| Ventajas | Limitaciones |
|---|---|
| Ecosistema estándar para contratar equipo; RLS nativo; escalado horizontal | Costo adicional mensual (servicio + base administrada) y otra cadena de despliegue |
| Componentes React y PWA más cómodos | Dependencias de npm que mantener; no reutiliza código de Bikrom |
| | La primera fase tarda bastante más |

**Recomendación:** **Opción A para la beta** (fases 1 a 5 del roadmap) y **reevaluar PostgreSQL** con datos reales de uso antes de abrir mercado global.

---

## 4. Arquitectura de integración (opción A)

```
bikrom.com (Render, servicio "bikrom", disco /var/data)
│
├── /                      Sitio Bikrom (estático + server.mjs, JSON en /var/data)
├── /photography/…         Estefanía Torres Fotografía (SQLite /var/data/photography)
└── /habitoos/…            Bikrom/HabitoOS  ← NUEVO
      ├── Páginas (SSR ES/EN, mobile-first, PWA)
      ├── API /habitoos/api/v1/*   (JSON, sesión + CSRF, rate limit)
      ├── Dominio: identidad · hábitos · metas versionadas · ocurrencias ·
      │            reflexión · analítica · experimentos · billing · admin
      ├── Capa de acceso a datos con owner_id obligatorio
      ├── SQLite /var/data/habitoos/habitoos.db  (archivo propio, aislado)
      ├── Cola de tareas (recordatorios, agregados, limpieza)
      └── Integraciones: Resend (correo) · Stripe Billing (Pro) · OAuth Google (después)
```

**Aislamiento entre aplicaciones:**
- HabitoOS tendrá **su propia base**, sus cookies con `Path=/habitoos`, su propio secreto derivado y su propio panel. No lee ni escribe los datos de Bikrom ni de Photography.
- El panel de administración irá en `/habitoos/admin`, en lugar de `/admin/habitoos`, porque `/admin` ya es el panel de Bikrom con Basic Auth. Así se evita mezclar sesiones.

### Mapa de rutas

| Ruta | Uso |
|---|---|
| `/habitoos`, `/habitoos/en` | Página pública (ES/EN) |
| `/habitoos/registro`, `/habitoos/entrar`, `/habitoos/recuperar`, `/habitoos/verificar` | Identidad |
| `/habitoos/onboarding` | Configuración inicial, reanudable |
| `/habitoos/app/today` | Today (checklist del día) |
| `/habitoos/app/habits`, `/habitoos/app/plan` | Hábitos, metas y programación |
| `/habitoos/app/insights` | Indicadores de proceso y resultado |
| `/habitoos/app/experiments` | Experimentos (P2) |
| `/habitoos/app/settings`, `/habitoos/app/billing` | Cuenta, privacidad y suscripción |
| `/habitoos/api/v1/…` | API del PRD (§25) |
| `/habitoos/admin` | Administración SaaS (métricas agregadas) |

---

## 5. Modelo de datos y migraciones seguras

- **Base nueva y separada** (`habitoos.db`): ninguna migración toca datos existentes de Bikrom ni de Photography.
- Las migraciones solo **agregan** tablas, columnas o índices. Cada una se versiona en `migrations/` y se aplica en una transacción; si falla, se revierte completa.
- Antes de cada migración en producción: copia del archivo de base (`VACUUM INTO`) con fecha.
- **Identificadores y fechas:**
  - Identificadores UUID v4 (texto).
  - Instantes en UTC (ISO 8601).
  - Fecha local del usuario (`YYYY-MM-DD`) y zona IANA guardadas en cada ocurrencia, para que un viaje o un cambio de zona no reescriba días pasados.
- **Tablas de la primera fase:**
  - Identidad: `users`, `profiles`, `sessions`, `email_tokens`.
  - Hábitos: `habits`, `habit_goal_versions` (vigencia `valid_from`/`valid_to` sin traslapes), `habit_schedules`, `habit_occurrences` (único por hábito y fecha local), `habit_logs` (historial de cambios, sin borrar).
  - Plataforma: `audit_events`, `feature_flags`, `schema_migrations`.
- **Tablas de fases posteriores:** `daily_reviews`, `obstacles`, `review_obstacles`, `contingency_plans`, `outcome_measures`, `outcome_logs`, `habit_outcome_links`, `experiments`, `subscription_plans`, `subscriptions`, `entitlements`, `billing_events` (idempotencia por id de evento) y `organizations`/`memberships` (vacías, preparadas para B2B).
- **Datos sensibles:** las notas libres de reflexión se guardan cifradas (AES-256-GCM, llave fuera de la base). Las métricas de administración nunca leen esas notas.

---

## 6. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Bikrom vive dentro de un repositorio ajeno (emulador N64) | Confusión, permisos, historial mezclado | **Mover Bikrom a un repositorio propio** (p. ej. `bikrom-web`) antes de crecer. Render se reconecta en minutos. |
| R2 | Producción y pruebas comparten rama y servicio | Un error llega directo a bikrom.com | Rama de trabajo + **servicio de staging** en Render; producción solo desde rama protegida. |
| R3 | Sin CI | Regresiones no detectadas | GitHub Actions: `npm run check`, `photo:test` y pruebas de HabitoOS en cada push. |
| R4 | Un solo disco sin respaldo propio | Pérdida de datos | Respaldo diario cifrado fuera de Render (R2/B2) más una prueba de restauración documentada. |
| R5 | No hay correo conectado | Sin verificación de cuenta ni recuperación de contraseña | **Resend + dominio verificado es requisito previo** para abrir el registro. |
| R6 | Datos sensibles (salud, adicciones, emociones) | Riesgo legal y reputacional | Minimización, cifrado de notas, admin sin acceso a reflexiones, **revisión legal por jurisdicción** (GDPR/UK GDPR, LFPDPPP) antes de abrir países. |
| R7 | Cobro global en USD | Impuestos e IVA por país | Stripe Billing + Stripe Tax o un *merchant of record*; abrir cobros por país validado. |
| R8 | SQLite de una sola instancia | Límite de escala y segundos sin servicio al desplegar | Suficiente para la beta; plan documentado de migración a PostgreSQL. |
| R9 | Apple Sign-In | Requiere cuenta de Apple Developer (costo anual) | Correo primero; Google en fase 1b; Apple cuando exista la cuenta. |
| R10 | Mensajes de reducción de alcohol y tabaco | Seguridad del usuario | Textos revisados, sin diagnóstico, aviso de riesgo por abstinencia de alcohol y orientación a apoyo médico. |

---

## 7. Backlog de la primera fase (fundación + núcleo)

| ID | Entregable | Criterio de "hecho" |
|---|---|---|
| F1 | Módulo `/habitoos` montado, base propia, migración 001, ES/EN | Arranca junto a Bikrom y Photography sin afectarlos |
| F2 | Registro, verificación por correo, entrada, salida, recuperación; sesiones revocables | Contraseña con scrypt, cookie `HttpOnly`/`Secure`/`SameSite`, CSRF y límite de intentos |
| F3 | Capa de datos con `owner_id` obligatorio | Prueba de acceso cruzado: 404 al manipular ids |
| F4 | Hábitos (desarrollar, mantener, reducir, abandonar), unidades (sí/no, cantidad, duración, rango) | CRUD con validación en servidor; límite Free de 3 activos, aplicado en backend |
| F5 | Metas versionadas y programación (días, hora, zona) | Cambiar 20 → 30 min no altera la evaluación de días previos |
| F6 | Ocurrencias y registros con los 7 estados | "Sin registro" ≠ "no cumplido"; autoguardado idempotente; deshacer |
| F7 | Today (móvil primero, 1–2 toques) | Datos reales, persistentes tras recargar o cambiar de dispositivo |
| F8 | Onboarding reanudable (1–3 hábitos) | Repetir un paso no duplica hábitos; primer checklist en menos de 5 minutos |
| F9 | Adherencia y cobertura con denominador | Fórmulas del PRD §5 verificadas con pruebas; recálculo tras corrección |
| F10 | Exportación (JSON/CSV) y eliminación de cuenta | Funcionan desde Ajustes |
| F11 | Pruebas automáticas de la fase | Ver §8 |

Siguientes fases, según el PRD: reflexión y obstáculos (B09), Insights (B10), Stripe Billing y entitlements (B11), admin SaaS (B12), privacidad completa (B13), beta (B14), y en P2 experimentos y nutrición.

---

## 8. Pruebas de aceptación de la primera fase

1. Registro → verificación → onboarding → primer hábito → Today, en ES y EN.
2. Registro persistente tras recarga y desde otra sesión o dispositivo.
3. Usuario A no puede leer ni modificar hábitos, ocurrencias ni registros de B manipulando URL o id (respuesta 404).
4. Meta 20 min → cambio a 30 min el día 10: los días 1–9 se evalúan con 20 y los siguientes con 30.
5. Tres días sin abrir la app producen "sin registro", no "no cumplido", y no cuentan en la adherencia.
6. Un día de descanso o una pausa no penaliza la adherencia y aparece en la cobertura.
7. El mismo registro enviado dos veces (reintento de red) crea un solo valor vigente; deshacer restaura el anterior.
8. El usuario en `America/Mexico_City` y el usuario en `Europe/Madrid` ven "hoy" según su zona; cambiar de zona no mueve días pasados.
9. El cuarto hábito activo en Free se rechaza desde el backend, no solo en la interfaz.
10. Corregir un registro histórico recalcula adherencia y cobertura.
11. Exportación completa y eliminación de cuenta (los datos desaparecen; el registro de auditoría queda seudonimizado).
12. Bikrom y Photography siguen funcionando: `npm run check` y `npm run photo:test` sin regresiones.

---

## 9. Decisiones pendientes del propietario

1. **Stack:** opción A (reutilizar, recomendada) u opción B (Next.js + PostgreSQL).
2. **Repositorio propio para Bikrom** (recomendado antes de construir HabitoOS).
3. **Resend + dominio verificado**, necesario para abrir el registro de usuarios.
4. Proveedor de cobro global: Stripe Billing + Stripe Tax, o un *merchant of record*.
5. Confirmar que el disco y el plan Starter de Render quedaron activos.

**Esta fase no cambió código, datos ni DNS**: solo agregó estos documentos. Al subirlos, Render hace un redespliegue rutinario sin cambios funcionales.
