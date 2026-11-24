# Bikrom en Cloudflare (plan gratis)

Todo bikrom.com (sitio, `/photography` y `/habitoos`) corre en **un Worker de Cloudflare**:

| Pieza | Cloudflare | Archivo |
|---|---|---|
| Páginas y recursos (`dist/`) | Workers Static Assets | `wrangler.jsonc` → `assets` |
| Sitio, Fotografía, HabitoOS | Un Durable Object con SQLite (datos persistentes) | `cloudflare/worker.mjs` |
| Base de datos | `ctx.storage.sql` con la misma interfaz que `photography/db.mjs` | `cloudflare/sqlite.mjs` |
| Fotos de galerías | R2 si existe el enlace `PHOTOS` (`cloudflare/r2.mjs`); si no, en la base en bloques de 1 MB | `photography/lib/storage.mjs` |
| Registros del sitio | Tabla `site_records` | `cloudflare/store.mjs` |
| Tareas programadas | Cron Trigger cada 5 min | `wrangler.jsonc` → `triggers` |
| Puente Fetch ↔ (req, res) de Node | | `cloudflare/node-http.mjs` |

El código de negocio es el mismo que en Node/Render; solo cambian la base, los archivos y el servidor HTTP.

## Límites del plan gratis (aprox.)
- 100 000 peticiones al día. Durable Objects con SQLite: 5 GB en total.
- Fotos: con R2 enlazado no cuentan en la base. Para enlazarlo: crea el bucket `bikrom-fotos` en R2 y agrega a
  `wrangler.jsonc`: `"r2_buckets": [{ "binding": "PHOTOS", "bucket_name": "bikrom-fotos" }]`.
  Sin R2, las fotos se guardan en la base (cuentan dentro del límite del Durable Object).

## Publicar (Workers Builds, desde GitHub)
1. Cloudflare → Workers & Pages → Create → **Import a repository** → este repositorio.
2. Root directory: `bikrom` · Build command: `npm run build` · Deploy command: `npx wrangler deploy`.
3. Rama de producción: la rama que se use para publicar.
4. Settings → Variables and Secrets → agrega como **Secret**:
   - `ADMIN_PASSWORD` (panel `/admin`), `PHOTO_ADMIN_PASSWORD` (panel de fotografía, 10+ caracteres)
   - Opcionales: `RESEND_API_KEY`, `HABITOOS_EMAIL_FROM`, `PHOTO_EMAIL_FROM`, `EMAIL_NOTIFY`,
     claves de Stripe, PayPal, Mercado Pago y Google.
   - `APP_SECRET` es opcional: si no existe, el Worker genera uno y lo guarda en la base.
5. Dominio: con bikrom.com en Cloudflare (nameservers), Settings → Domains & Routes → Custom domain
   `bikrom.com` y `www.bikrom.com` (www redirige a bikrom.com).

## Desarrollo
```
npm install            # instala wrangler
npm run cf:dev         # http://localhost:8787 (datos locales en .wrangler/state)
npm run cf:test        # pruebas completas de Fotografía y HabitoOS sobre la capa de Cloudflare
```
Secretos locales en `bikrom/.dev.vars` (no se sube a git), p. ej. `PHOTO_ADMIN_PASSWORD=...`.
