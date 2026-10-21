import t from '../i18n/es.js';
import { areas } from '../data/areas.js';
import { productBySlug, productUrl } from '../data/products.js';
import { homeFaqs } from '../data/faqs.js';
import { layout } from '../lib/layout.js';
import { esc } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { symbol } from '../lib/logo.js';
import { areaIcon, faqList, faqLd, buyButton } from '../lib/components.js';
import { optionPrice } from '../lib/format.js';

function starCard(p) {
  const range = p.pricing.options.find((o) => o.kind === 'range');
  const buy = p.pricing.options.find((o) => o.kind === 'buy');
  return `<article class="star reveal">
  <div class="star-head">${areaIcon(p.group, 32)}<span class="eyebrow">Producto estrella</span></div>
  <h3 class="h2"><a class="card-link" href="${productUrl(p)}">${esc(p.name)}</a></h3>
  <p class="lead">${esc(p.promise)}</p>
  <p class="legal-note">${icon('shield', { size: 20 })}<span>${esc(p.legal)}</span></p>
  <dl class="price-list">
    <div><dt>${esc(range.label)}</dt><dd>${esc(optionPrice(range))}${range.note ? ` <span class="muted">· ${esc(range.note)}</span>` : ''}</dd></div>
    <div><dt>${esc(buy.label)}</dt><dd>${esc(optionPrice(buy))}</dd></div>
  </dl>
  <div class="btn-row">
    <a class="btn btn--primary" href="${productUrl(p)}#agenda">${t.cta.agenda}</a>
    ${buyButton(buy, buy.buyLabel, 'btn btn--secondary')}
  </div>
</article>`;
}

export default function home() {
  const ruta = productBySlug['ruta-40-horas'];
  const nom = productBySlug['nom-035-llave-en-mano'];

  const levels = [
    { icon: 'download', title: 'Hazlo tú', sub: 'Descargables', text: 'Plantillas, kits y guías listas para usar desde hoy, a precio fijo.', href: '/soluciones/?tipo=descargable' },
    { icon: 'layers', title: 'Hazlo conmigo', sub: 'Cursos y talleres', text: 'Aprendes con tu equipo y aplicas en tu empresa con acompañamiento.', href: '/soluciones/?tipo=curso' },
    { icon: 'hand', title: 'Lo hacemos por ti', sub: 'Proyectos e igualas mensuales', text: 'Implementamos con entregables claros, responsables y precio fijo.', href: '/soluciones/?tipo=servicio' },
  ];

  const steps = [
    { n: '01', title: 'Diagnóstico', text: 'Medimos dónde está tu empresa en finanzas, personas, procesos y tecnología.' },
    { n: '02', title: 'Propuesta con precio fijo', text: 'Alcance, entregables, tiempos y precio por escrito antes de empezar.' },
    { n: '03', title: 'Implementación', text: 'Trabajamos con tu equipo, con responsables y fechas claras.' },
    { n: '04', title: 'Resultados medibles', text: 'Cerramos con indicadores que puedes revisar, no con un reporte que se archiva.' },
  ];

  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="container hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Consultoría para pymes en México</p>
      <h1 id="hero-title" class="display-1">Tu empresa, en blanco y negro.</h1>
      <p class="lead">Ordenamos finanzas, personas, procesos y tecnología de pymes mexicanas, con entregables claros y precio fijo.</p>
      <div class="btn-row">
        <a class="btn btn--primary btn--lg" href="/diagnostico-empresa-360/">${t.cta.diagnostico}</a>
        <a class="btn btn--secondary btn--lg" href="/soluciones/">${t.cta.verSoluciones}</a>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">${symbol({ size: 360 })}</div>
  </div>
</section>

<section class="section" aria-labelledby="areas-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Seis áreas</p>
      <h2 id="areas-title" class="display-2">Sin zonas grises.</h2>
      <p class="lead">Números claros, roles claros y procesos claros. Elige por dónde empezar.</p>
    </div>
    <div class="grid grid--3 area-grid">
      ${areas
        .map(
          (a) => `<a class="card area-card reveal" href="/soluciones/?area=${a.key}#${a.key}">
        ${areaIcon(a.key, 36)}
        <h3 class="card-title">${esc(a.name)}</h3>
        <p class="card-text">${esc(a.problem)}</p>
        <span class="card-more">Ver soluciones ${icon('arrow', { size: 18 })}</span>
      </a>`
        )
        .join('')}
    </div>
  </div>
</section>

<section class="section section--rule" aria-labelledby="stars-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">2027 ya está aquí</p>
      <h2 id="stars-title" class="display-2">Llega en regla.</h2>
    </div>
    <div class="grid grid--2">
      ${starCard(ruta)}
      ${starCard(nom)}
    </div>
  </div>
</section>

<section class="section section--rule" aria-labelledby="levels-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Cómo trabajamos</p>
      <h2 id="levels-title" class="display-2">Tres niveles. Tú eliges.</h2>
    </div>
    <div class="grid grid--3">
      ${levels
        .map(
          (l) => `<a class="card level-card reveal" href="${l.href}">
        ${icon(l.icon, { size: 32 })}
        <h3 class="h3">${l.title}</h3>
        <p class="card-type">${l.sub}</p>
        <p class="card-text">${l.text}</p>
        <span class="card-more">Ver opciones ${icon('arrow', { size: 18 })}</span>
      </a>`
        )
        .join('')}
    </div>
  </div>
</section>

<section class="section section--rule" aria-labelledby="process-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Proceso</p>
      <h2 id="process-title" class="display-2">Cuatro pasos, sin sorpresas.</h2>
    </div>
    <ol class="steps">
      ${steps
        .map(
          (s) => `<li class="step reveal">
        <span class="step-number" aria-hidden="true">${s.n}</span>
        <h3 class="h3">${s.title}</h3>
        <p>${s.text}</p>
      </li>`
        )
        .join('')}
    </ol>
  </div>
</section>

<section class="section section--rule" aria-labelledby="diag-title">
  <div class="container">
    <div class="diag-feature reveal">
      <div>
        <p class="eyebrow">Gratis · menos de 10 minutos</p>
        <h2 id="diag-title" class="display-2">Diagnóstico Empresa 360</h2>
        <p class="lead">20 afirmaciones sobre lo que hoy pasa en tu empresa. Recibes tu puntaje general y por área, tres recomendaciones concretas y una llamada gratuita de 30 minutos.</p>
        <a class="btn btn--primary btn--lg" href="/diagnostico-empresa-360/">${t.cta.diagnostico}</a>
      </div>
      <ul class="diag-areas" aria-label="Áreas del diagnóstico">
        <li>${areaIcon('finanzas', 32)}<span>Finanzas</span></li>
        <li>${areaIcon('rh', 32)}<span>Personas</span></li>
        <li>${areaIcon('operacion', 32)}<span>Procesos</span></li>
        <li>${areaIcon('automatizacion', 32)}<span>Tecnología</span></li>
      </ul>
    </div>
  </div>
</section>

<!--
  TESTIMONIOS Y LOGOS DE CLIENTES — OCULTO.
  LLENAR CON CASOS REALES antes de quitar el atributo "hidden".
  No publicar testimonios, nombres, logos ni resultados que no sean reales y autorizados por escrito.
-->
<section class="section section--rule" aria-labelledby="testimonials-title" hidden data-llenar-con-casos-reales>
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Clientes</p>
      <h2 id="testimonials-title" class="display-2">Lo que dicen nuestros clientes</h2>
      <p class="muted">[LLENAR CON CASOS REALES]</p>
    </div>
    <div class="grid grid--3">
      ${[1, 2, 3]
        .map(
          () => `<figure class="card testimonial">
        <blockquote><p>[TESTIMONIO REAL]</p></blockquote>
        <figcaption><strong>[NOMBRE]</strong><br><span class="muted">[PUESTO], [EMPRESA]</span></figcaption>
      </figure>`
        )
        .join('')}
    </div>
    <ul class="client-logos" aria-label="Logos de clientes">
      <li>[LOGO DE CLIENTE EN BLANCO Y NEGRO]</li><li>[LOGO DE CLIENTE EN BLANCO Y NEGRO]</li><li>[LOGO DE CLIENTE EN BLANCO Y NEGRO]</li><li>[LOGO DE CLIENTE EN BLANCO Y NEGRO]</li>
    </ul>
  </div>
</section>

<section class="section section--rule" aria-labelledby="faq-title">
  <div class="container narrow">
    <div class="section-head">
      <p class="eyebrow">Preguntas frecuentes</p>
      <h2 id="faq-title" class="display-2">Claro desde el principio.</h2>
    </div>
    ${faqList(homeFaqs, 'faq-home')}
  </div>
</section>
`;

  return layout({
    path: '/',
    title: 'Bikrom | Consultoría para pymes en México: tu empresa, en blanco y negro',
    description:
      'Consultoría para pymes mexicanas: flujo de efectivo, CFO externo, NOM-035, jornada de 40 horas, formación de líderes y automatización para empresas. Entregables claros y precio fijo.',
    body,
    notice: true,
    jsonld: [faqLd(homeFaqs)],
  });
}
