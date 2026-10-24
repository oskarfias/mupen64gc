import { config, isSet } from '../config.js';
import t from '../i18n/es.js';
import { esc, abs, safeHref, waLink, jsonLd, highlightMarkers, contactValue, hasWhatsapp } from './html.js';
import { logo } from './logo.js';
import { icon } from './icons.js';

// Versión de los archivos CSS/JS: cambia en cada despliegue para que nadie vea estilos viejos en caché.
const V = (process.env.RENDER_GIT_COMMIT || Date.now().toString(36)).slice(0, 8);
const asset = (src) => `${src}?v=${V}`;

const nav = [
  { href: '/soluciones/', label: t.nav.soluciones },
  { href: '/diagnostico-empresa-360/', label: t.nav.diagnostico },
  { href: '/certificaciones/', label: t.nav.certificaciones },
  { href: '/membresia/', label: t.nav.membresia },
  { href: '/recursos/', label: t.nav.recursos },
  { href: '/nosotros/', label: t.nav.nosotros },
  { href: '/contacto/', label: t.nav.contacto },
];

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Bikrom',
  url: config.siteUrl + '/',
  logo: abs('/img/logo.svg'),
  slogan: 'Tu empresa, en blanco y negro.',
  description: 'Consultoría para pymes en México: finanzas, recursos humanos, liderazgo, cultura, operación y automatización con entregables claros y precio fijo.',
  ...(isSet(contactValue('email')) ? { email: contactValue('email') } : {}),
  ...(isSet(config.contact.whatsapp) ? { telephone: config.contact.whatsapp } : {}),
  areaServed: ['MX', 'Americas'],
  address: { '@type': 'PostalAddress', addressLocality: config.contact.locality, addressRegion: 'Querétaro', addressCountry: 'MX' },
  sameAs: config.contact.social.map((s) => s.url).filter(isSet),
});

function header(path) {
  const links = nav
    .map((n) => `<li><a class="nav-link" href="${n.href}"${path.startsWith(n.href) ? ' aria-current="page"' : ''}>${n.label}</a></li>`)
    .join('');
  const enEnabled = config.locales.en.enabled;
  return `<header class="site-header">
  <div class="container header-inner">
    ${logo()}
    <nav class="main-nav" id="main-nav" aria-label="Principal">
      <ul class="nav-list">${links}</ul>
      <div class="nav-extra">
        <div class="lang" role="group" aria-label="Idioma">
          <a href="/" lang="es" aria-current="true" class="lang-item is-active">ES</a><span aria-hidden="true">/</span><a href="/en/" lang="en" class="lang-item" hreflang="en"${enEnabled ? '' : ' title="English version coming soon"'}>EN</a>
        </div>
        <a class="btn btn--primary btn--sm nav-cta" href="/diagnostico-empresa-360/">${t.cta.diagnostico}</a>
      </div>
    </nav>
    <div class="header-actions">
      <a class="cart-link" href="/carrito/" aria-label="${t.nav.carrito}">${icon('cart')}<span class="cart-count" data-cart-count hidden>0</span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" data-menu-toggle>${icon('menu')}<span class="sr-only">${t.nav.menu}</span></button>
    </div>
  </div>
</header>`;
}

export function finalCta() {
  return `<section class="section section--dark final-cta" aria-labelledby="final-cta-title">
  <div class="container final-cta-inner reveal">
    <h2 id="final-cta-title" class="display-2">Pon tu empresa en blanco y negro.</h2>
    <p class="lead">Empieza con el diagnóstico gratuito o agenda una llamada de 30 minutos. Sin compromiso y con precio fijo desde la propuesta.</p>
    <div class="btn-row">
      <a class="btn btn--light" href="/diagnostico-empresa-360/">${t.cta.diagnostico}</a>
      <a class="btn btn--ghost-light" href="/contacto/#agenda">${t.cta.agenda}</a>
    </div>
  </div>
</section>`;
}

function footer() {
  const c = config.contact;
  const social = c.social
    .filter((s) => !config.preview || isSet(s.url))
    .map((s) => `<li><a class="link-light" href="${safeHref(s.url)}" rel="noopener" target="_blank">${esc(s.name)}</a> <span class="footer-small">${esc(s.url)}</span></li>`)
    .join('');
  return `<footer class="site-footer section--dark">
  <div class="container footer-grid">
    <div class="footer-brand">
      ${logo({ inverse: true })}
      <p class="footer-tag">${esc(config.tagline)}</p>
      <p class="footer-small">Consultoría para pymes. Presencial en ${esc(c.city)}; en línea en ${esc(c.coverage)}.</p>
    </div>
    <div>
      <h2 class="footer-title">${t.footer.contacto}</h2>
      <ul class="footer-list">
        <li>${icon('mail', { color: '#FFFFFF', size: 18 })} <a class="link-light" href="mailto:${esc(contactValue('email'))}">${esc(contactValue('email'))}</a></li>
        <li>${icon('whatsapp', { color: '#FFFFFF', size: 18 })} <a class="link-light" href="${waLink()}"${hasWhatsapp() || !config.preview ? ' rel="noopener" target="_blank"' : ''}>${esc(c.whatsapp)}</a></li>
        <li>${icon('pin', { color: '#FFFFFF', size: 18 })} ${esc(c.city)}</li>
      </ul>
      ${social ? `<h2 class="footer-title">${t.footer.redes}</h2>
      <ul class="footer-list">${social}</ul>` : ''}
    </div>
    <div>
      <h2 class="footer-title">Sitio</h2>
      <ul class="footer-list">
        ${nav.map((n) => `<li><a class="link-light" href="${n.href}">${n.label}</a></li>`).join('')}
      </ul>
      <h2 class="footer-title">${t.footer.legales}</h2>
      <ul class="footer-list">
        <li><a class="link-light" href="/aviso-de-privacidad/">${t.footer.privacidad}</a></li>
        <li><a class="link-light" href="/terminos-y-condiciones/">${t.footer.terminos}</a></li>
        <li><a class="link-light" href="/politica-de-reembolsos/">${t.footer.reembolsos}</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-title" id="newsletter-title">${t.footer.boletin}</h2>
      <p class="footer-small">${t.footer.boletinTexto}</p>
      <form class="newsletter" data-api-form="/api/boletin" aria-labelledby="newsletter-title" novalidate>
        <label class="sr-only" for="newsletter-email">${t.footer.correo}</label>
        <input id="newsletter-email" class="input input--dark" type="email" name="email" required autocomplete="email" placeholder="${t.footer.correo}">
        <label class="check check--dark"><input type="checkbox" name="privacidad" required> <span>Acepto el <a class="link-light" href="/aviso-de-privacidad/">aviso de privacidad</a>.</span></label>
        <button class="btn btn--light btn--sm" type="submit">${t.footer.suscribir}</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>© <span data-year>2026</span> Bikrom${config.preview && !isSet(config.legal.businessName) ? '' : ` · ${esc(config.legal.businessName)}`} · ${t.footer.derechos}</p>
  </div>
</footer>`;
}

function noticeBar() {
  return `<div class="notice-bar" role="region" aria-label="Aviso">
  <div class="container notice-inner"><p>${t.notice} <a class="link-light" href="/soluciones/ruta-40-horas/">${t.noticeLink}</a></p></div>
</div>`;
}

function cookieBanner() {
  return `<div class="cookie-banner" data-cookie-banner hidden role="dialog" aria-live="polite" aria-label="Cookies">
  <p>${t.cookies.texto} <a class="link" href="/aviso-de-privacidad/#cookies">${t.cookies.mas}</a></p>
  <div class="btn-row">
    <button class="btn btn--primary btn--sm" type="button" data-cookie="accept">${t.cookies.aceptar}</button>
    <button class="btn btn--secondary btn--sm" type="button" data-cookie="reject">${t.cookies.rechazar}</button>
  </div>
</div>`;
}

export function layout({
  path,
  title,
  description,
  body,
  jsonld = [],
  noindex = false,
  notice = false,
  showFinalCta = true,
  scripts = [],
  bodyClass = '',
  ogType = 'website',
}) {
  const fullTitle = path === '/' ? title : `${title} | Bikrom`;
  const clientConfig = {
    ga4Id: isSet(config.analytics.ga4Id) ? config.analytics.ga4Id : '',
    metaPixelId: isSet(config.analytics.metaPixelId) ? config.analytics.metaPixelId : '',
    bookingUrl: isSet(config.bookingUrl) ? config.bookingUrl : '',
    ivaRate: config.ivaRate,
    preview: config.preview,
    v: V,
  };
  const html = `<!doctype html>
<html lang="${config.locales.es.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="Bikrom, consultoría para pymes, NOM-035, jornada de 40 horas, flujo de efectivo, CFO externo, formación de líderes, automatización para empresas">
${noindex || config.preview ? '<meta name="robots" content="noindex, follow">' : ''}
<link rel="canonical" href="${abs(path)}">
<link rel="alternate" hreflang="es-MX" href="${abs(path)}">
${config.locales.en.enabled ? `<link rel="alternate" hreflang="en" href="${abs('/en' + path)}">` : '<!-- hreflang en: se activa con config.locales.en.enabled -->'}
<link rel="alternate" hreflang="x-default" href="${abs(path)}">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="es_MX">
<meta property="og:site_name" content="Bikrom">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${abs('/img/og-bikrom.svg')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFFFFF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap">
<link rel="stylesheet" href="${asset('/assets/css/styles.css')}">
<script>window.BIKROM=${JSON.stringify(clientConfig)};</script>
<script src="${asset('/assets/js/main.js')}" defer></script>
${scripts.map((s) => `<script src="${asset(s)}" defer></script>`).join('\n')}
${jsonLd(organizationLd())}
${jsonld.map(jsonLd).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#contenido">${t.skip}</a>
${config.preview ? '<div class="preview-bar" role="note"><div class="container"><p><strong>Versión preliminar.</strong> Algunos datos son de ejemplo y los pagos en línea aún no están activos.</p></div></div>' : ''}
${notice ? noticeBar() : ''}
${header(path)}
<main id="contenido" tabindex="-1">
${body}
</main>
${showFinalCta ? finalCta() : ''}
${footer()}
<a class="wa-float" href="${waLink()}"${hasWhatsapp() || !config.preview ? ' target="_blank" rel="noopener"' : ''} aria-label="${hasWhatsapp() || !config.preview ? `${t.whatsapp} (${esc(config.contact.whatsappNumber)})` : t.nav.contacto}">${icon('whatsapp', { color: '#FFFFFF', size: 26 })}</a>
${cookieBanner()}
</body>
</html>
`;
  return highlightMarkers(html);
}
