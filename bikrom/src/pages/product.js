import { config } from '../config.js';
import t from '../i18n/es.js';
import { areaByKey } from '../data/areas.js';
import { products, productUrl, buyOptions } from '../data/products.js';
import { productFaqs } from '../data/faqs.js';
import { layout } from '../lib/layout.js';
import { esc, abs } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { optionPrice, cardPrice, priceBounds } from '../lib/format.js';
import { areaIcon, productCard, faqList, faqLd, bookingEmbed, buyButton, subscribeLink } from '../lib/components.js';

const needsCall = (p) => p.pricing.options.some((o) => ['range', 'percent', 'quote'].includes(o.kind));

function optionActions(p, o) {
  switch (o.kind) {
    case 'buy':
      return buyButton(o, o.buyLabel || t.cta.comprar);
    case 'subscription':
      return subscribeLink(o);
    case 'range':
      return `<a class="btn btn--primary" href="#agenda">${t.cta.agenda}</a><a class="btn btn--secondary" href="/solicita-propuesta/?producto=${p.slug}">${t.cta.propuesta}</a>`;
    case 'percent':
    case 'quote':
      return `<a class="btn btn--primary" href="/solicita-propuesta/?producto=${p.slug}">${t.cta.propuesta}</a>`;
    case 'free':
      return `<a class="btn btn--primary" href="${productUrl(p)}">${t.cta.gratis}</a>`;
    default:
      return '';
  }
}

function stickyCta(p) {
  const first = p.ctas[0];
  const buys = buyOptions(p);
  let action = '';
  if (first === 'call') action = `<a class="btn btn--primary" href="#agenda">${t.cta.agenda}</a>`;
  else if (first === 'proposal') action = `<a class="btn btn--primary" href="/solicita-propuesta/?producto=${p.slug}">${t.cta.propuesta}</a>`;
  else if (first === 'buy') action = buys.length === 1 ? buyButton(buys[0], t.cta.comprar) : `<a class="btn btn--primary" href="#precio">${t.cta.comprar}</a>`;
  return `<div class="sticky-cta" data-sticky-cta>
  <div class="sticky-cta-inner"><div><p class="sticky-name">${esc(p.name)}</p><p class="sticky-price">${esc(cardPrice(p))}</p></div>${action}</div>
</div>`;
}

function related(p) {
  const same = products.filter((x) => x.slug !== p.slug && x.group === p.group);
  const near = products.filter((x) => x.slug !== p.slug && x.group !== p.group && x.areas.some((a) => p.areas.includes(a)));
  return [...same, ...near].slice(0, 3);
}

function productLd(p) {
  const url = abs(productUrl(p));
  const offers = [];
  for (const o of p.pricing.options) {
    const spec = { '@type': 'PriceSpecification', priceCurrency: 'MXN', valueAddedTaxIncluded: false };
    if (o.kind === 'buy' || o.kind === 'subscription') {
      offers.push({
        '@type': 'Offer', name: o.label, price: o.price, priceCurrency: 'MXN', url, availability: 'https://schema.org/InStock',
        priceSpecification: { ...spec, price: o.price, ...(o.kind === 'subscription' ? { '@type': 'UnitPriceSpecification', unitText: 'MON', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } } : {}) },
      });
    }
    if (o.kind === 'range') {
      offers.push({ '@type': 'AggregateOffer', name: o.label, lowPrice: o.min, highPrice: o.max, priceCurrency: 'MXN', url, priceSpecification: { ...spec, minPrice: o.min, maxPrice: o.max } });
    }
  }
  const b = priceBounds(p);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.promise,
    category: areaByKey[p.group].name,
    brand: { '@type': 'Brand', name: 'Bikrom' },
    url,
    ...(offers.length === 1 ? { offers: offers[0] } : offers.length ? { offers: b ? { '@type': 'AggregateOffer', lowPrice: b.low, highPrice: b.high, priceCurrency: 'MXN', offerCount: offers.length, offers } : offers } : {}),
  };
}

export default function product(p) {
  const area = areaByKey[p.group];
  const faqs = productFaqs(p);
  const rel = related(p);
  const delivTitle = p.deliverablesTitle || 'Entregables';

  const body = `
<nav class="container breadcrumb" aria-label="Ruta de navegación">
  <ol><li><a class="link" href="/">Inicio</a></li><li><a class="link" href="/soluciones/">Soluciones</a></li><li><a class="link" href="/soluciones/?area=${area.key}#${area.key}">${esc(area.name)}</a></li><li aria-current="page">${esc(p.name)}</li></ol>
</nav>

<section class="page-hero product-hero">
  <div class="container product-hero-grid">
    <div>
      <div class="card-top">${areaIcon(p.group, 40)}<span class="card-type">${esc(area.name)} · ${esc(p.typeLabel)}</span></div>
      <h1 class="display-1">${esc(p.name)}</h1>
      <p class="lead">${esc(p.promise)}</p>
      ${p.legal ? `<p class="legal-note">${icon('shield', { size: 20 })}<span>${esc(p.legal)}</span></p>` : ''}
    </div>
    <aside class="price-box" aria-label="Precio">
      <p class="eyebrow">Precio</p>
      <p class="price-big">${esc(cardPrice(p))}</p>
      <div class="btn-col">
        ${p.ctas.map((c, i) => {
          const cls = i === 0 ? 'btn btn--primary' : 'btn btn--secondary';
          if (c === 'call') return `<a class="${cls}" href="#agenda">${t.cta.agenda}</a>`;
          if (c === 'proposal') return `<a class="${cls}" href="/solicita-propuesta/?producto=${p.slug}">${t.cta.propuesta}</a>`;
          if (c === 'buy') { const b = buyOptions(p); return b.length === 1 ? buyButton(b[0], b[0].buyLabel || t.cta.comprar, cls) : `<a class="${cls}" href="#precio">${t.cta.comprar}</a>`; }
          return '';
        }).join('')}
      </div>
    </aside>
  </div>
</section>

<section class="section section--rule">
  <div class="container grid grid--2 two-col">
    <div class="reveal">
      <h2 class="h2">Para quién es</h2>
      <p>${esc(p.forWho)}</p>
    </div>
    <div class="reveal">
      <h2 class="h2">Problema que resuelve</h2>
      <p>${esc(p.problem)}</p>
    </div>
  </div>
</section>

<section class="section section--rule" aria-labelledby="deliv-title">
  <div class="container">
    <h2 id="deliv-title" class="h2">${delivTitle}</h2>
    <ul class="deliverables">
      ${p.deliverables.map((d) => `<li class="reveal">${icon('check', { color: area.color, size: 24 })}<span>${esc(d)}</span></li>`).join('')}
    </ul>
  </div>
</section>

<section class="section section--rule" aria-labelledby="format-title">
  <div class="container">
    <h2 id="format-title" class="h2">Formato y tiempo</h2>
    <dl class="facts">
      <div>${icon('format', { size: 24 })}<dt>Formato</dt><dd>${esc(p.format)}</dd></div>
      <div>${icon('clock', { size: 24 })}<dt>Tiempo</dt><dd>${esc(p.duration)}</dd></div>
    </dl>
  </div>
</section>

<section class="section section--rule" id="precio" aria-labelledby="price-title">
  <div class="container">
    <h2 id="price-title" class="h2">Precio</h2>
    <ul class="options">
      ${p.pricing.options
        .map(
          (o) => `<li class="option">
        <div class="option-info">
          <p class="option-label">${esc(o.label)}</p>
          <p class="option-price">${esc(optionPrice(o))}</p>
          ${o.note ? `<p class="muted">${esc(o.note)}</p>` : ''}
          ${o.includes ? `<ul class="mini-list">${o.includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="option-actions">${optionActions(p, o)}</div>
      </li>`
        )
        .join('')}
    </ul>
    <p class="muted small">Precios en pesos mexicanos más IVA. Pago con tarjeta, OXXO o transferencia. Facturamos.</p>
  </div>
</section>

${needsCall(p) ? `<section class="section section--rule" id="agenda" aria-labelledby="agenda-title">
  <div class="container narrow">
    <h2 id="agenda-title" class="h2">Agenda una llamada</h2>
    <p>30 minutos para entender tu caso. Después te enviamos una propuesta con alcance, tiempos y precio fijo. ¿Prefieres escribir? <a class="link" href="/solicita-propuesta/?producto=${p.slug}">Solicita propuesta</a>.</p>
    ${bookingEmbed({ context: p.slug })}
  </div>
</section>` : ''}

<section class="section section--rule" aria-labelledby="guarantee-title">
  <div class="container narrow guarantee reveal">
    ${icon('shield', { size: 32 })}
    <div>
      <h2 id="guarantee-title" class="h2">Garantía</h2>
      <p>${esc(config.legal.guarantee)}</p>
      <p class="small"><a class="link" href="/politica-de-reembolsos/">Ver política de reembolsos</a></p>
    </div>
  </div>
</section>

<section class="section section--rule" aria-labelledby="pfaq-title">
  <div class="container narrow">
    <h2 id="pfaq-title" class="h2">Preguntas frecuentes</h2>
    ${faqList(faqs, 'faq-' + p.slug)}
  </div>
</section>

${rel.length ? `<section class="section section--rule" aria-labelledby="rel-title">
  <div class="container">
    <h2 id="rel-title" class="h2">Productos relacionados</h2>
    <div class="grid grid--3">${rel.map((r) => productCard(r)).join('')}</div>
  </div>
</section>` : ''}

${stickyCta(p)}
`;

  return layout({
    path: productUrl(p),
    title: `${p.name} · ${area.name} para pymes`,
    description: `${p.promise} ${p.typeLabel} de ${area.name.toLowerCase()} para pymes en México. ${cardPrice(p)}.`.slice(0, 160),
    body,
    jsonld: [productLd(p), faqLd(faqs)],
    bodyClass: 'has-sticky-cta',
    ogType: 'product',
  });
}
