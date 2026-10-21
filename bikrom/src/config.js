// Configuración general del sitio.
// Todo valor entre corchetes es un marcador pendiente de llenar.
// isSet() permite que el sitio funcione mientras un marcador siga vacío.

export const isSet = (v) => typeof v === 'string' && v.trim() !== '' && !v.trim().startsWith('[');

export const config = {
  brand: 'Bikrom',
  tagline: 'Tu empresa, en blanco y negro.',
  siteUrl: (process.env.SITE_URL || 'https://bikrom.com').replace(/\/$/, ''),
  domain: 'bikrom.com',

  contact: {
    email: '[CORREO]',
    whatsapp: '[WHATSAPP]',            // Número visible, por ejemplo +52 ...
    whatsappNumber: '[NÚMERO]',        // Solo dígitos con lada de país, para wa.me
    whatsappMessage: 'Hola, vengo del sitio de Bikrom y quiero información.',
    city: '[CIUDAD]',
    social: [
      { name: 'LinkedIn', url: '[REDES SOCIALES: URL DE LINKEDIN]' },
      { name: 'Instagram', url: '[REDES SOCIALES: URL DE INSTAGRAM]' },
      { name: 'Facebook', url: '[REDES SOCIALES: URL DE FACEBOOK]' },
    ],
  },

  legal: {
    businessName: '[RAZÓN SOCIAL]',
    address: '[DOMICILIO]',
    rfc: '[RFC DE BIKROM]',
    lastUpdate: '[FECHA DE ÚLTIMA ACTUALIZACIÓN]',
    guarantee: '[DEFINE TU GARANTÍA, por ejemplo reembolso si el diagnóstico no te da al menos tres acciones útiles]',
  },

  // Agenda (Calendly o Cal.com). Pega la URL pública de tu evento de 30 minutos.
  bookingUrl: '[URL DE CALENDLY O CAL.COM]',

  // Medición. Los scripts solo se cargan si el ID está definido y el visitante acepta cookies.
  analytics: {
    ga4Id: '[GA4_ID]',
    metaPixelId: '[META_PIXEL_ID]',
  },

  // Impuestos: los precios del catálogo NO incluyen IVA.
  ivaRate: 0.16,
  currency: 'MXN',

  // Idiomas. Para lanzar inglés: enabled: true y traduce src/i18n/en.js y los campos `en` del contenido.
  locales: {
    es: { enabled: true, prefix: '', htmlLang: 'es-MX', label: 'ES' },
    en: { enabled: false, prefix: '/en', htmlLang: 'en', label: 'EN' },
  },
};
