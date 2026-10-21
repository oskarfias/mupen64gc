import { productBySlug } from '../data/products.js';
import { layout } from '../lib/layout.js';
import { esc } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { optionPrice } from '../lib/format.js';
import { subscribeLink, faqList, faqLd } from '../lib/components.js';

export default function membresia() {
  const p = productBySlug['membresia-para-duenos'];
  const [basica, plus] = p.pricing.options;
  const faqs = [
    { q: '¿Cómo se cobra?', a: 'Con cargo mensual recurrente a tu tarjeta. Precios más IVA. Facturamos cada mes con los datos fiscales que captures al suscribirte.' },
    { q: '¿Puedo cancelar?', a: '[DEFINE TU POLÍTICA DE CANCELACIÓN DE LA MEMBRESÍA].' },
    { q: '¿Dónde son las sesiones y la comunidad?', a: 'Las sesiones grupales son en línea: [PLATAFORMA DE VIDEOLLAMADA]. La comunidad privada está en [PLATAFORMA DE LA COMUNIDAD].' },
    { q: '¿Cuándo es la sesión grupal mensual?', a: '[DÍA Y HORA DE LA SESIÓN GRUPAL MENSUAL].' },
  ];
  const plan = (o, featured) => `<article class="plan${featured ? ' plan--featured' : ''} reveal">
  <h2 class="h2">${esc(o.label)}</h2>
  <p class="price-big">${esc(optionPrice(o))}</p>
  <ul class="checklist">${o.includes.map((x) => `<li>${icon('check', { size: 20 })}<span>${esc(x)}</span></li>`).join('')}</ul>
  ${subscribeLink(o, featured ? 'btn btn--primary btn--block' : 'btn btn--secondary btn--block')}
</article>`;

  const body = `
<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Membresía para dueños · mensual</p>
    <h1 class="display-1">Dirige con claridad, cada mes.</h1>
    <p class="lead">${esc(p.promise)} Para dueños que quieren avanzar sin contratar un proyecto completo.</p>
  </div>
</section>
<section class="section" id="planes" aria-label="Planes">
  <div class="container grid grid--2 plans">
    ${plan(basica, false)}
    ${plan(plus, true)}
  </div>
  <p class="container muted small">Precios en pesos mexicanos más IVA, con cobro mensual recurrente.</p>
</section>
<section class="section section--rule">
  <div class="container grid grid--3">
    <div class="reveal">${icon('calendar', { size: 32 })}<h2 class="h3">Sesión grupal mensual</h2><p>Un tema de dirección al mes, con plantillas para aplicarlo en tu empresa.</p></div>
    <div class="reveal">${icon('layers', { size: 32 })}<h2 class="h3">Biblioteca</h2><p>Plantillas y cursos para finanzas, personas, procesos y tecnología.</p></div>
    <div class="reveal">${icon('user', { size: 32 })}<h2 class="h3">Comunidad privada</h2><p>Dueños de pymes compartiendo lo que les funciona.</p></div>
  </div>
</section>
<section class="section section--rule">
  <div class="container narrow">
    <h2 class="h2">Preguntas frecuentes</h2>
    ${faqList(faqs, 'faq-memb')}
  </div>
</section>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.promise,
    brand: { '@type': 'Brand', name: 'Bikrom' },
    offers: p.pricing.options.map((o) => ({
      '@type': 'Offer', name: o.label, price: o.price, priceCurrency: 'MXN',
      priceSpecification: { '@type': 'UnitPriceSpecification', price: o.price, priceCurrency: 'MXN', valueAddedTaxIncluded: false, unitCode: 'MON' },
    })),
  };

  return layout({
    path: '/membresia/',
    title: 'Membresía para dueños de pymes',
    description: 'Membresía mensual para dueños de pymes: sesión grupal, biblioteca de plantillas y cursos, comunidad privada y asesoría individual. Desde $1,500 al mes + IVA.',
    body,
    jsonld: [ld, faqLd(faqs)],
  });
}
