# Bikrom Photography · Estefanía Torres Fotografía

Esta es la plataforma de Estefanía Torres Fotografía. Incluye:

- Sitio editorial en español e inglés.
- Cotizador y reservas con anticipo.
- Agenda conectada a Google Calendar.
- Galerías privadas al estilo Pixieset.
- Tienda de impresiones, cuadros y fotolibros desde las galerías.
- Correos automáticos.
- Panel privado de administración.

Vive en **bikrom.com/photography** como una sección de Bikrom, pero es una aplicación independiente. Funciona sola con `photography/server.mjs` y se puede mover a un dominio propio cuando exista.

## Arquitectura (decisión)

| Pieza | Elección | Por qué |
|---|---|---|
| Servidor | Node.js 22, **sin dependencias** | Es fácil de mantener, no tiene paquetes que actualizar y es el mismo entorno de Bikrom. |
| Páginas | Generadas en el servidor (HTML + CSS + JS mínimo) | Lo que se edita en el panel se ve al instante. Carga rápido en celular y funciona sin un framework. |
| Base de datos | **SQLite** (`node:sqlite`) en un archivo persistente | Usa transacciones `BEGIN IMMEDIATE` que impiden dobles reservas. Tiene migraciones versionadas en `migrations/`. |
| Archivos | **Almacenamiento privado**: disco local en demostración o almacenamiento compatible con S3 (Cloudflare R2, Backblaze B2, AWS) | Los originales nunca son públicos. Se entregan con autorización del servidor o con URL firmadas de vida corta. |
| Miniaturas | Se generan **en el navegador** al subir | El servidor no recomprime nada. El original se guarda tal cual y las vistas previas son archivos aparte. |
| Pagos | **Stripe** (tarjeta) y **PayPal** (Orders v2) | La reserva se confirma solo con un webhook firmado o con la captura servidor a servidor de PayPal. |
| Calendario | **Google Calendar** (OAuth, free/busy y eventos) | Considera ocupados, bloqueos y apartados. Al cliente solo se le muestran horarios libres. |
| Correo | **Resend** | Las plantillas son editables y tienen una clave contra duplicados. |
| Tareas | Cola persistente en la base (`jobs`) | Tiene reintentos con espera creciente y sobrevive a reinicios. Se puede disparar por cron externo. |

### Modelo de datos (`migrations/001_init.sql`)

Entidades: clientes, servicios, **versiones de paquete**, cuestionarios versionados, cotizaciones (con **copia aceptada inmutable**), reservas, pagos, eventos del proveedor (idempotencia), bloqueos y caché de ocupados, galerías, archivos, accesos, cargas, productos, variantes, pedidos con sus partidas, reglas de envío, descuentos, plantillas, registro de correos, tareas, registro de actividad, testimonios, preguntas frecuentes, portafolio y mensajes.

Cada entidad tiene sus propios estados, para que "pagado", "reservado", "publicado" y "entregado" no se confundan:

- **Cotización:** por completar → lista → aceptada (o cancelada).
- **Reserva:** apartada → confirmada → realizada (o vencida, cancelada o en conflicto).
- **Pago:** pendiente → pagado (o fallido, cancelado o reembolsado manualmente). Cada pago es de un servicio (anticipo, saldo o ajuste) o de un producto, nunca de ambos.
- **Galería:** borrador → programada → publicada → vencida → eliminada.
- **Pedido:** envío por cotizar → pendiente de pago → pagado → revisión de diseño → en producción → enviado → entregado (o cancelado).

## Ejecutar en local

```bash
cd bikrom
cp photography/.env.example photography/.env   # PHOTO_ADMIN_PASSWORD como mínimo
npm run photo        # http://localhost:3100/photography/   (panel: /photography/admin)
npm run photo:test   # 19 pruebas de los recorridos críticos
```

En bikrom.com se sirve desde el servidor de Bikrom (`npm start`) en `/photography`.

Sin credenciales, el sitio entra en **modo demostración**:

- No cobra: los pagos en línea aparecen como "no activos".
- No envía correos: quedan registrados como "no enviados".
- No sincroniza el calendario.
- Solo el panel puede registrar una confirmación de pago "DEMO", marcada como tal y excluida de los indicadores.

## Publicar

1. **Base persistente.** En Render, usa el plan Starter con disco y define `DATA_DIR=/var/data`. El plan gratuito borra la base en cada despliegue: sirve solo para mostrar el sitio.
2. **Archivos.** Crea un bucket privado en Cloudflare R2 (o Backblaze B2) y define `STORAGE_DRIVER=s3` y las variables `S3_*`. R2 cobra por GB almacenado después de su cuota gratuita; consulta su precio vigente.
3. **Secretos.** Define `APP_SECRET` (32 o más caracteres aleatorios) y `PHOTO_ADMIN_PASSWORD` como variables de entorno del servidor, nunca en el código.
4. **Stripe.**
   - Crea el endpoint `https://bikrom.com/photography/api/webhooks/stripe` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`.
   - Copia `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`.
   - Prueba primero con llaves de prueba (`sk_test_…`).
5. **PayPal.**
   - Crea una app REST y define `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `PAYPAL_ENV=sandbox` (y después `live`).
   - Crea el webhook `https://bikrom.com/photography/api/webhooks/paypal` con `PAYMENT.CAPTURE.COMPLETED` y copia su id en `PAYPAL_WEBHOOK_ID`.
6. **Google Calendar.**
   - En Google Cloud, crea credenciales OAuth de tipo "Aplicación web".
   - Usa como URI de redirección `https://bikrom.com/photography/admin/agenda/google/retorno`.
   - Habilita la Calendar API y define `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
   - Después, en el panel, entra a **Agenda → Conectar**.
7. **Correo.**
   - Verifica el dominio en Resend (con los registros DNS que indica Resend) y define `RESEND_API_KEY` y `PHOTO_EMAIL_FROM` (por ejemplo `Estefanía Torres <hola@dominio>`).
   - El correo comercial y el dominio están pendientes de definirse.
8. **Tareas.** El servidor revisa la cola cada 30 segundos. Si el hosting se suspende, como el plan gratuito, configura un cron externo para que llame cada 5 a 10 minutos a `https://bikrom.com/photography/api/cron?key=CRON_SECRET`.

> **Documentación de proveedores.** Las integraciones usan las API que conozco: Stripe Checkout Sessions, PayPal Orders v2 y verify-webhook-signature, Google Calendar v3 (freeBusy y events) y OAuth 2.0, y Resend. Desde la sesión de desarrollo no fue posible consultar la documentación oficial vigente porque la red estaba restringida. Cada adaptador vive aislado en `lib/providers.mjs`; antes de pasar a producción, revisa con la documentación actual y haz un pago de prueba de punta a punta en sandbox.

## Seguridad y privacidad

- **Galerías:**
  - Cada una tiene un identificador aleatorio y no hay directorio público.
  - El acceso es con un código `XXXX-XXXX-XXXX`, de unos 50 bits; del secreto solo se guarda su hash scrypt.
  - Los intentos tienen límite por IP y por galería.
  - La sesión se guarda en una cookie firmada y se revalida en cada archivo.
  - Las contraseñas nunca viajan en la URL.
- **Descargas:** el servidor comprueba el acceso en cada archivo y las URL firmadas duran como máximo 10 minutos, sin exceder la vigencia de la galería. Al vencer, los accesos se revocan.
- **Indexación:** las páginas privadas llevan `noindex`, tanto en el encabezado como en `X-Robots-Tag`. Esto complementa el control de acceso, no lo sustituye.
- **Menores:**
  - En escuelas se crea una galería por alumno o familia, más la grupal si corresponde.
  - El portafolio exige una autorización registrada aparte.
  - El sitio nunca muestra nombres de menores.
- **Panel:**
  - Contraseña desde el entorno, sesión firmada `HttpOnly` y `SameSite=Strict`, y token CSRF en toda escritura.
  - Bloqueo tras 5 intentos fallidos.
  - Registro de cada acción administrativa.
- **Tarjetas:** no se recopilan datos de tarjeta; los capturan Stripe y PayPal en sus propias páginas.
- **Retención:**
  - Los archivos de una galería se borran al vencer, después de un periodo de gracia configurable.
  - Los originales que usa un pedido pagado se conservan con acceso restringido hasta que se completa y pasa el periodo de retención.
  - Las descargas ZIP no se guardan: se generan al momento.

## Estructura

```
photography/
  index.mjs            enrutador (sitio, galerías, webhooks, cron)
  app.mjs  db.mjs      contexto, base de datos y migraciones
  seed.mjs policies.mjs datos iniciales (servicios reales, plantillas, borradores de políticas)
  domain/              cotizador, agenda/reservas, pagos, galerías, tienda, correos, tareas
  lib/                 seguridad, HTTP, fechas (America/Mexico_City), almacenamiento, ZIP, proveedores
  views/               plantillas del sitio y del panel
  public/              CSS y JS del navegador
  tests/run.mjs        verificación de la sección 15
  docs/                guía de administración y pendientes
```
