# Bikrom — sitio web

**Tu empresa, en blanco y negro.** Sitio de Bikrom, consultoría para pymes en México.

Este sitio no usa dependencias. Solo necesitas Node.js 20 o una versión más reciente.

```bash
cp .env.example .env      # llena las claves
npm run build             # genera dist/ (53 páginas, 37 productos, sitemap, robots)
npm start                 # sitio y API en http://localhost:3000
npm run check             # revisa SEO y precios "+ IVA", y lista los marcadores pendientes
```

## Estructura

| Ruta | Qué contiene |
|---|---|
| `src/config.js` | Contacto, datos legales, garantía, agenda, GA4/Pixel, IVA, idiomas. **Aquí se llenan casi todos los marcadores.** |
| `src/data/products.js` | Los 37 productos (precios sin IVA, entregables y botones). |
| `src/data/areas.js` | Las 6 áreas, el color de su icono y su problema típico. |
| `src/data/diagnostico.js` | Las 20 afirmaciones, el cálculo del puntaje y las recomendaciones. |
| `src/data/posts.js` | El blog: 3 borradores que no se indexan mientras tengan `draft: true`. |
| `src/data/faqs.js` | Las preguntas frecuentes generales y las de producto. |
| `src/i18n/es.js`, `en.js` | Los textos de la interfaz en ES y EN. |
| `src/pages/*.js` | Las plantillas de página. |
| `assets/css/styles.css` | El diseño. Solo usa los colores #FFFFFF, #0A0A0A, #5C5C5C y #E6E6E6; el color va únicamente en los iconos. |
| `assets/js/*.js` | El menú, el carrito, los filtros, el diagnóstico, el pago, el consentimiento de cookies y la medición. |
| `server.mjs`, `server/` | La API, los pagos, los webhooks, la entrega automática, los correos y el panel `/admin`. |
| `private/descargas/` | Los archivos que se entregan después del pago (nombre = `sku` + extensión). |
| `data/` | La base de datos en JSON: prospectos, solicitudes, pedidos, suscripciones, boletín y eventos. |

## Funciones

- **Pagos:** Stripe Checkout o Mercado Pago, con tarjeta, OXXO y transferencia SPEI. Las suscripciones mensuales de la Membresía se cobran con tarjeta. Los precios siempre se recalculan en el servidor, con el IVA desglosado.
  - Webhook de Stripe: `POST /api/webhooks/stripe`. Los eventos son `checkout.session.*`, `customer.subscription.deleted` e `invoice.payment_failed`.
  - Webhook de Mercado Pago: `/api/webhooks/mercadopago`. Se configura sola en cada preferencia.
  - Si no hay claves, el sitio trabaja en **modo demostración**: el pedido queda pendiente y lo marcas como pagado desde el panel. Ese botón también sirve para las transferencias manuales.
- **Entrega automática:** cuando se confirma el pago, se envía por correo un enlace personal con vigencia para los descargables, el acceso a los cursos y los siguientes pasos para los servicios.
- **Facturación:** el pago pide RFC, razón social, régimen fiscal, código postal fiscal y uso del CFDI. Estos datos aparecen en el panel y en el CSV.
- **Diagnóstico Empresa 360:** guarda las respuestas y los datos del prospecto. Calcula el puntaje y envía el resultado por correo con Resend. Sin `RESEND_API_KEY`, los correos se guardan en el panel y no se envían.
- **Agenda:** Calendly o Cal.com, insertado en los productos con rango de precio, en Contacto y en el resultado del diagnóstico.
- **Panel `/admin`:** pide usuario y contraseña. Muestra prospectos, solicitudes, compras, suscripciones, boletín, llamadas agendadas y correos, y exporta a CSV.
- **Medición:** GA4 y Meta Pixel cargan solo si el visitante acepta las cookies. Eventos:
  - `diagnostico_completado` (Lead)
  - `llamada_agendada` (Schedule)
  - `compra` (Purchase)
  - `suscripcion` (Subscribe)
  - `solicitud_propuesta` (Contact)
- **SEO:** cada página tiene un título y una descripción únicos y URLs amigables. Incluye datos estructurados Organization, Product y FAQPage, además de ItemList y Article, junto con `sitemap.xml`, `robots.txt` y canonical/hreflang.

## Versión en inglés

El selector ES/EN ya está en el encabezado. Por ahora, `/en/` es una página de "próximamente". Para lanzar el inglés:

1. Traduce `src/i18n/en.js` y los textos del contenido.
2. Activa `locales.en.enabled` en `src/config.js`.
3. Genera las páginas con el prefijo `/en`.

## Contenido y datos legales

- Los únicos datos legales que usa el sitio son los permitidos: el registro electrónico de la jornada es obligatorio desde el 1/1/2027; la jornada baja de 48 a 46 h en 2027 y llega a 40 h en 2030; NOM-035 por tamaño (hasta 15, de 16 a 50 y más de 50 trabajadores) con multas de 250 a 5,000 UMA.
- Los textos legales son un **borrador para revisión legal**.
- La sección de testimonios está oculta (`hidden`) hasta que tengas casos reales.
- Las fotos son marcadores. Reemplázalas por fotos libres en blanco y negro; el CSS ya les aplica `grayscale` y contraste alto.
