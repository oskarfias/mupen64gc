import { config, isSet } from '../config.js';
import t from '../i18n/es.js';
import { areaByKey, types } from '../data/areas.js';
import { productUrl, buyOptions } from '../data/products.js';
import { esc } from './html.js';
import { icon } from './icons.js';
import { symbol } from './logo.js';
import { cardPrice } from './format.js';
import { employeeRanges } from '../data/diagnostico.js';

export const areaIcon = (key, size = 28) => {
  const a = areaByKey[key];
  return icon(key, { color: a.color, size });
};

export const typeNames = (p) =>
  p.types.length ? p.types.map((k) => types.find((x) => x.key === k).name).join(' · ') : p.typeLabel;

// Botón "Comprar" de una opción con precio fijo (lo maneja assets/js/main.js).
export const buyButton = (o, label = t.cta.comprar, cls = 'btn btn--primary') =>
  `<button type="button" class="${cls}" data-add-to-cart="${esc(o.sku)}">${esc(label)}</button>`;

export const subscribeLink = (o, cls = 'btn btn--primary') =>
  `<a class="${cls}" href="/carrito/?suscripcion=${esc(o.sku)}" data-subscribe="${esc(o.sku)}">${t.cta.suscribirme}</a>`;

// Botones de la tarjeta del catálogo, según el tipo de precio.
export function cardButtons(p) {
  const url = productUrl(p);
  const buys = buyOptions(p);
  const out = [];
  p.ctas.forEach((c, i) => {
    const cls = i === 0 ? 'btn btn--primary btn--sm' : 'btn btn--secondary btn--sm';
    if (c === 'call') out.push(`<a class="${cls}" href="${url}#agenda">${t.cta.agenda}</a>`);
    if (c === 'proposal') out.push(`<a class="${cls}" href="/solicita-propuesta/?producto=${p.slug}">${t.cta.propuesta}</a>`);
    if (c === 'free') out.push(`<a class="${cls}" href="${url}">${t.cta.gratis}</a>`);
    if (c === 'subscribe') out.push(`<a class="${cls}" href="${url}#planes">${t.cta.suscribirme}</a>`);
    if (c === 'buy') {
      if (buys.length === 1) out.push(buyButton(buys[0], t.cta.comprar, cls));
      else out.push(`<a class="${cls}" href="${url}#precio">${t.cta.comprar}</a>`);
    }
  });
  return out.join('');
}

export function productCard(p, { headingLevel = 3 } = {}) {
  const h = `h${headingLevel}`;
  const url = productUrl(p);
  return `<article class="card product-card reveal" data-product data-area="${p.group}" data-types="${p.types.join(' ')}" data-search="${esc((p.name + ' ' + p.promise + ' ' + p.typeLabel + ' ' + areaByKey[p.group].name).toLowerCase())}">
  <div class="card-top">
    ${areaIcon(p.group)}
    <span class="card-type">${esc(p.typeLabel)}</span>
  </div>
  <${h} class="card-title"><a class="card-link" href="${url}">${esc(p.name)}</a></${h}>
  <p class="card-text">${esc(p.promise)}</p>
  <p class="card-price">${esc(cardPrice(p))}</p>
  <div class="card-actions">${cardButtons(p)}</div>
</article>`;
}

export function faqList(items, idPrefix = 'faq') {
  return `<div class="faq">${items
    .map(
      (f, i) => `<details class="faq-item">
  <summary id="${idPrefix}-${i}"><span>${esc(f.q)}</span>${icon('plus', { size: 20, cls: 'faq-icon' })}</summary>
  <div class="faq-answer"><p>${f.aHtml || esc(f.a)}</p></div>
</details>`
    )
    .join('')}</div>`;
}

export const faqLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

// Agenda integrada (Calendly o Cal.com). Si la URL aún es marcador, muestra un aviso visible.
export function bookingEmbed({ title = 'Agenda una llamada de 30 minutos', context = '' } = {}) {
  return `<div class="booking" data-booking data-context="${esc(context)}">
  <div class="booking-head">${icon('calendar', { size: 24 })}<h3 class="h4">${esc(title)}</h3></div>
  <div class="booking-frame" data-booking-frame>
    ${config.preview && !isSet(config.bookingUrl)
      ? '<p class="booking-fallback">La agenda en línea estará disponible muy pronto. Mientras tanto, <a class="link" href="/solicita-propuesta/">déjanos tus datos</a> y te contactamos para agendar.</p>'
      : `<p class="booking-fallback">${esc(config.bookingUrl)} — pega en <code>src/config.js</code> la URL de tu evento de Calendly o Cal.com y aquí aparecerá tu calendario.</p>`}
  </div>
</div>`;
}

export function photo(desc, { cls = '', ratio = '4 / 3' } = {}) {
  if (config.preview) return `<figure class="photo photo--symbol ${cls}" style="aspect-ratio:${ratio}" aria-hidden="true">${symbol({ size: 200 })}</figure>`;
  return `<figure class="photo ${cls}" style="aspect-ratio:${ratio}">
  <!-- Reemplazar por: <img src="/img/archivo.jpg" alt="${esc(desc)}" loading="lazy" width="1200" height="900"> (foto libre en blanco y negro, alto contraste) -->
  <div class="photo-ph" role="img" aria-label="${esc(desc)}"><span>[FOTO EN BLANCO Y NEGRO: ${esc(desc)}]</span></div>
</figure>`;
}

export function proposalForm({ productSlug = '', productOptions = [] } = {}) {
  const opts = productOptions
    .map((p) => `<option value="${esc(p.slug)}"${p.slug === productSlug ? ' selected' : ''}>${esc(p.name)}</option>`)
    .join('');
  return `<form class="form" data-api-form="/api/propuesta" data-event="solicitud_propuesta" novalidate>
  <div class="form-grid">
    <div class="field"><label for="pf-nombre">Nombre</label><input class="input" id="pf-nombre" name="nombre" required autocomplete="name"></div>
    <div class="field"><label for="pf-empresa">Empresa</label><input class="input" id="pf-empresa" name="empresa" required autocomplete="organization"></div>
    <div class="field"><label for="pf-correo">Correo</label><input class="input" id="pf-correo" name="correo" type="email" required autocomplete="email"></div>
    <div class="field"><label for="pf-whatsapp">WhatsApp <span class="optional">(opcional)</span></label><input class="input" id="pf-whatsapp" name="whatsapp" type="tel" autocomplete="tel"></div>
    <div class="field"><label for="pf-empleados">Número de empleados</label>
      <select class="input" id="pf-empleados" name="empleados" required><option value="">Selecciona</option>${employeeRanges.map((r) => `<option>${r}</option>`).join('')}</select></div>
    <div class="field"><label for="pf-producto">Producto de interés</label>
      <select class="input" id="pf-producto" name="producto" required><option value="">Selecciona</option>${opts}<option value="otro">Otro / no estoy seguro</option></select></div>
    <div class="field field--full"><label for="pf-mensaje">Mensaje</label><textarea class="input" id="pf-mensaje" name="mensaje" rows="5" required placeholder="Cuéntanos qué quieres resolver."></textarea></div>
  </div>
  <label class="check"><input type="checkbox" name="privacidad" required> <span>Acepto el <a class="link" href="/aviso-de-privacidad/">aviso de privacidad</a>.</span></label>
  <button class="btn btn--primary" type="submit">Enviar solicitud</button>
  <p class="form-status" role="status" aria-live="polite"></p>
</form>`;
}

