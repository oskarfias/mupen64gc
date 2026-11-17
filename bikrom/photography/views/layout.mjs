// Marco del sitio público.
import { esc, when, list } from './html.mjs';
import { t } from '../i18n.mjs';

export const P = (app, lang, path = '/') => `${app.base}${lang === 'en' ? '/en' : ''}${path}`;
export const asset = (app, file) => `${app.base}/static/${file}?v=${ASSET_VERSION}`;
export const ASSET_VERSION = (process.env.RENDER_GIT_COMMIT || String(Date.now())).slice(0, 8);

export function media(app, slot) {
  return app.db.get('SELECT * FROM media WHERE slot = ? ORDER BY id LIMIT 1', slot);
}

// Fotografía o espacio reemplazable (marco cálido con nota discreta)
export function photo(app, slot, lang, { ratio = 'r-portrait', eager = false, sizes = '(min-width: 900px) 50vw, 100vw' } = {}) {
  const m = typeof slot === 'object' ? slot : media(app, slot);
  const alt = m ? (lang === 'en' ? m.alt_en : m.alt_es) || '' : '';
  if (m?.storage_key) {
    return `<figure class="ph ${ratio}"><img src="${app.base}/m/${m.id}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" sizes="${sizes}"${m.width ? ` width="${m.width}" height="${m.height}"` : ''}></figure>`;
  }
  return `<figure class="ph ph--empty ${ratio}" role="img" aria-label="${esc(alt)}"><figcaption>${lang === 'en' ? 'Photograph coming soon' : 'Fotografía próximamente'}</figcaption></figure>`;
}

const navItems = (tx) => [
  ['/servicios', tx.nav.services], ['/escuelas', tx.nav.schools], ['/negocios', tx.nav.business], ['/tesoro', tx.nav.tesoro],
  ['/portafolio', tx.nav.portfolio], ['/sobre-mi', tx.nav.about], ['/productos', tx.nav.products], ['/contacto', tx.nav.contact],
];

function brand(app, lang) {
  const biz = app.setting('business');
  const logo = biz.logo_media_id ? app.db.get('SELECT * FROM media WHERE id = ? AND storage_key IS NOT NULL', biz.logo_media_id) : null;
  const inner = logo
    ? `<img src="${app.base}/m/${logo.id}" alt="${esc(biz.name)}" width="${logo.width || 180}" height="${logo.height || 48}">`
    : `<span class="brand-word">Estefanía Torres<small>${lang === 'en' ? 'Photography' : 'Fotografía'}</small></span>`;
  return `<a class="brand" href="${P(app, lang, '/')}" aria-label="${esc(biz.name)} — ${lang === 'en' ? 'home' : 'inicio'}">${inner}</a>`;
}

export function layout(app, { lang, path, title, description, body, noindex = false, jsonld = [], scripts = [], showWhatsapp = true, isAdmin = false }) {
  const tx = t(lang);
  const biz = app.setting('business');
  const otherPath = P(app, tx.other, path);
  const canonical = app.siteUrl + P(app, lang, path);
  const links = navItems(tx).map(([href, label]) => `<li><a href="${P(app, lang, href)}"${path.startsWith(href) ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('');
  const demo = app.demo();
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'es-MX'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="es-MX" href="${esc(app.siteUrl + P(app, 'es', path))}">
<link rel="alternate" hreflang="en" href="${esc(app.siteUrl + P(app, 'en', path))}">
<link rel="alternate" hreflang="x-default" href="${esc(app.siteUrl + P(app, 'es', path))}">`}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'es_MX'}">
<meta name="theme-color" content="#FBF7F1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Jost:wght@400;500&display=swap">
<link rel="stylesheet" href="${asset(app, 'css/site.css')}">
<script src="${asset(app, 'js/site.js')}" defer></script>
${scripts.map((s) => `<script src="${asset(app, s)}" defer></script>`).join('')}
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('')}
</head>
<body>
<a class="skip" href="#main">${tx.skip}</a>
${when(demo, `<div class="demo-bar" role="note"><div class="wrap"><p><strong>${tx.common.demo}.</strong> ${lang === 'en' ? 'Online payments, emails and calendar sync are not connected yet.' : 'Los pagos en línea, los correos y la agenda todavía no están conectados.'}</p></div></div>`)}
<header class="header">
  <div class="wrap header-in">
    ${brand(app, lang)}
    <nav class="nav" id="nav" aria-label="${lang === 'en' ? 'Main' : 'Principal'}">
      <ul>${links}</ul>
      <div class="nav-extra">
        <a class="btn btn--solid" href="${P(app, lang, '/reservar')}">${tx.nav.book}</a>
        <a class="btn" href="${P(app, lang, '/mi-sesion')}">${tx.nav.mySession}</a>
      </div>
    </nav>
    <div class="head-actions">
      <a class="lang" href="${otherPath}" hreflang="${tx.other}" lang="${tx.other}" data-lang="${tx.other}">${tx.other.toUpperCase()}<span class="sr-only"> — ${tx.otherLabel}</span></a>
      <a class="lang head-book" href="${P(app, lang, '/mi-sesion')}">${tx.nav.mySession}</a>
      <a class="btn btn--solid head-book" href="${P(app, lang, '/reservar')}">${tx.nav.book}</a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" data-menu><span></span><span class="sr-only">${tx.nav.menu}</span></button>
    </div>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <p class="brand-word" style="font-size:1.6rem">${esc(biz.name)}</p>
        <p class="muted">${esc(tx.footer.locations)}${lang === 'en' ? ' · travel available' : ' · viajo a otros destinos'}</p>
        <address style="font-style:normal" class="muted small">${list(biz.address, (l) => esc(l), '<br>')}</address>
      </div>
      <div>
        <h2>${tx.nav.contact}</h2>
        <ul>
          <li><a href="${esc(biz.whatsapp)}" rel="noopener" target="_blank">WhatsApp ${esc(biz.phone)}</a></li>
          <li><a href="tel:+52${esc(String(biz.phone).replace(/\D/g, ''))}">${lang === 'en' ? 'Call' : 'Llamar'} ${esc(biz.phone)}</a></li>
          <li><a href="${esc(biz.instagram)}" rel="noopener" target="_blank">Instagram</a></li>
          ${when(biz.email, `<li><a href="mailto:${esc(biz.email)}">${esc(biz.email)}</a></li>`)}
        </ul>
      </div>
      <div>
        <h2>${lang === 'en' ? 'Explore' : 'Explora'}</h2>
        <ul>
          <li><a href="${P(app, lang, '/servicios')}">${tx.nav.services}</a></li>
          <li><a href="${P(app, lang, '/mi-sesion')}">${tx.nav.mySession}</a></li>
          <li><a href="${P(app, lang, '/contacto#preguntas')}">${lang === 'en' ? 'FAQ' : 'Preguntas frecuentes'}</a></li>
        </ul>
      </div>
      <div>
        <h2>${tx.footer.policies}</h2>
        <ul>
          <li><a href="${P(app, lang, '/politicas/privacidad')}">${tx.footer.privacy}</a></li>
          <li><a href="${P(app, lang, '/politicas/reservas')}">${tx.footer.bookings}</a></li>
          <li><a href="${P(app, lang, '/politicas/compras')}">${tx.footer.purchases}</a></li>
          <li><a href="${P(app, lang, '/politicas/imagen')}">${tx.footer.image}</a></li>
        </ul>
      </div>
    </div>
    <p class="footer-bottom">© <span data-year>2026</span> ${esc(biz.name)}. ${tx.footer.rights}</p>
  </div>
</footer>
${when(showWhatsapp, `<a class="wa-float" href="${esc(biz.whatsapp)}?text=${encodeURIComponent(lang === 'en' ? 'Hi Estefanía, I would like information about a session.' : 'Hola Estefanía, me gustaría información sobre una sesión.')}" target="_blank" rel="noopener" aria-label="${tx.cta.whatsapp}">WhatsApp</a>`)}
</body>
</html>`;
}

export function localBusinessLd(app, lang) {
  const biz = app.setting('business');
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: biz.name,
    url: app.siteUrl + P(app, lang, '/'),
    telephone: '+52 ' + biz.phone,
    sameAs: [biz.instagram].filter(Boolean),
    address: { '@type': 'PostalAddress', streetAddress: biz.address?.[0], addressLocality: 'Irapuato', addressRegion: 'Guanajuato', addressCountry: 'MX' },
    areaServed: ['Irapuato', 'Querétaro', 'Guanajuato'],
    priceRange: 'MXN',
  };
}
