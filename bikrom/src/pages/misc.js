import { config, isSet } from '../config.js';
import { areaByKey } from '../data/areas.js';
import { products, productBySlug } from '../data/products.js';
import { posts } from '../data/posts.js';
import { layout } from '../lib/layout.js';
import { esc, safeHref, waLink, contactValue, hasWhatsapp } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { areaIcon, bookingEmbed, proposalForm, productCard, photo } from '../lib/components.js';

const c = config.contact;
const draftBanner = (text) => `<div class="draft-banner" role="note">${icon('doc', { size: 20 })}<strong>${text}</strong></div>`;

// ───────────── Recursos ─────────────
export function recursos() {
  const body = `
<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Recursos</p>
    <h1 class="display-1">Ideas claras para dirigir.</h1>
    <p class="lead">Guías prácticas sobre finanzas, personas, procesos y tecnología para pymes mexicanas.</p>
  </div>
</section>
<section class="section">
  <div class="container grid grid--3">
    ${posts
      .map(
        (p) => `<article class="card post-card reveal">
      <div class="card-top">${areaIcon(p.area)}${p.draft ? '<span class="tag">Borrador · revisar antes de publicar</span>' : ''}</div>
      <h2 class="card-title"><a class="card-link" href="/recursos/${p.slug}/">${esc(p.title)}</a></h2>
      <p class="card-text">${esc(p.description)}</p>
      <span class="card-more">Leer ${icon('arrow', { size: 18 })}</span>
    </article>`
      )
      .join('')}
  </div>
</section>`;
  return layout({
    path: '/recursos/',
    title: 'Recursos para dueños de pymes',
    description: 'Guías sobre jornada de 40 horas, NOM-035 y flujo de efectivo para pymes en México. Prácticas, claras y aplicables.',
    body,
  });
}

export function post(p) {
  const rel = p.related.map((s) => productBySlug[s]);
  const body = `
<article class="article">
  <header class="page-hero">
    <div class="container narrow">
      ${p.draft ? draftBanner('BORRADOR — REVISAR ANTES DE PUBLICAR') : ''}
      <p class="eyebrow"><a class="link" href="/recursos/">Recursos</a> · ${esc(areaByKey[p.area].name)}</p>
      <h1 class="display-2">${esc(p.title)}</h1>
      <p class="lead">${esc(p.description)}</p>
      <p class="muted small">Por el equipo de Bikrom · ${esc(p.date)}</p>
    </div>
  </header>
  <div class="container narrow prose">${p.body}</div>
</article>
<section class="section section--rule">
  <div class="container">
    <h2 class="h2">Soluciones relacionadas</h2>
    <div class="grid grid--3">${rel.map((r) => productCard(r)).join('')}</div>
  </div>
</section>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: p.description,
    author: { '@type': 'Organization', name: 'Bikrom' },
    publisher: { '@type': 'Organization', name: 'Bikrom' },
    inLanguage: 'es-MX',
  };
  return layout({
    path: `/recursos/${p.slug}/`,
    title: p.title,
    description: p.description,
    body,
    jsonld: [ld],
    noindex: p.draft,
    ogType: 'article',
  });
}

// ───────────── Nosotros ─────────────
export function nosotros() {
  const body = `
<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Nosotros</p>
    <h1 class="display-1">Blanco y negro, sin zonas grises.</h1>
    <p class="lead">Bikrom nace para que los dueños de pymes dirijan con números claros, roles claros y procesos claros.</p>
  </div>
</section>
<section class="section">
  <div class="container grid grid--2 about">
    ${photo('equipo de consultores trabajando en planta o en oficina', { ratio: '4 / 5' })}
    <div class="reveal">
      <h2 class="h2">Un equipo de consultores</h2>
      <p class="lead">Sumamos más de 10 años de experiencia en roles de manufactura y liderazgo de organizaciones industriales.</p>
      <p>Cada proyecto lo atiende el consultor con la experiencia que tu reto necesita: finanzas, personas, procesos o tecnología. Trabajamos con entregables claros, responsables con nombre y precio fijo.</p>
      <a class="btn btn--primary" href="/contacto/#agenda">Agenda una llamada</a>
    </div>
  </div>
</section>
<section class="section section--rule">
  <div class="container">
    <h2 class="display-2">Cómo pensamos</h2>
    <div class="grid grid--3 principles">
      <div class="reveal"><span class="step-number" aria-hidden="true">01</span><h3 class="h3">Números claros</h3><p>Cada decisión con datos que el dueño entiende y revisa cada semana.</p></div>
      <div class="reveal"><span class="step-number" aria-hidden="true">02</span><h3 class="h3">Roles claros</h3><p>Cada persona sabe qué hace, cómo se mide y hasta dónde puede crecer.</p></div>
      <div class="reveal"><span class="step-number" aria-hidden="true">03</span><h3 class="h3">Procesos claros</h3><p>Cada tarea se hace igual de bien, la haga quien la haga.</p></div>
    </div>
  </div>
</section>`;
  return layout({
    path: '/nosotros/',
    title: 'Nosotros',
    description: 'Bikrom es un equipo de consultores con más de 10 años de experiencia sumada en manufactura y liderazgo de organizaciones industriales. Números, roles y procesos claros.',
    body,
  });
}

// ───────────── Contacto ─────────────
export function contacto() {
  const opts = products.map((p) => ({ slug: p.slug, name: p.name }));
  const body = `
<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Contacto</p>
    <h1 class="display-1">Hablemos claro.</h1>
    <p class="lead">Agenda una llamada de 30 minutos, escríbenos por WhatsApp o envíanos tu solicitud.</p>
  </div>
</section>
<section class="section">
  <div class="container grid grid--2 contact-grid">
    <div>
      <ul class="contact-list">
        <li>${icon('mail')}<div><p class="option-label">Correo</p><a class="link" href="mailto:${esc(contactValue('email'))}">${esc(contactValue('email'))}</a></div></li>
        <li>${icon('whatsapp')}<div><p class="option-label">WhatsApp</p>${config.preview && !hasWhatsapp() ? `<p>${esc(c.whatsapp)}</p>` : `<a class="link" href="${waLink()}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a>`}</div></li>
        <li>${icon('pin')}<div><p class="option-label">Ciudad</p><p>Presencial en ${esc(c.city)} y en línea en todo México.</p></div></li>
        <li>${icon('user')}<div><p class="option-label">Redes sociales</p>${config.preview && !c.social.some((s) => isSet(s.url)) ? '<p>[REDES SOCIALES]</p>' : `<p>${c.social.filter((s) => !config.preview || isSet(s.url)).map((s) => `<a class="link" href="${safeHref(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</p><p class="small muted">[REDES SOCIALES]</p>`}</div></li>
        <li>${icon('format')}<div><p class="option-label">Sitio</p><p>${esc(config.domain)}</p></div></li>
      </ul>
    </div>
    <div id="agenda">${bookingEmbed({ context: 'contacto' })}</div>
  </div>
</section>
<section class="section section--rule" id="propuesta">
  <div class="container narrow">
    <h2 class="h2">Solicita propuesta</h2>
    <p>Cuéntanos qué quieres resolver y te respondemos con una propuesta con precio fijo.</p>
    ${proposalForm({ productOptions: opts })}
  </div>
</section>`;
  return layout({
    path: '/contacto/',
    title: 'Contacto y agenda',
    description: `Agenda una llamada de 30 minutos con Bikrom, consultoría para pymes. Presencial en ${c.city} y en línea en todo México.`,
    body,
  });
}

export function solicitaPropuesta() {
  const opts = products.map((p) => ({ slug: p.slug, name: p.name }));
  const body = `
<section class="page-hero">
  <div class="container narrow">
    <p class="eyebrow">Solicita propuesta</p>
    <h1 class="display-2">Te enviamos alcance, tiempos y precio fijo.</h1>
    <p class="lead">Llena el formulario y te contactamos en [TIEMPO DE RESPUESTA].</p>
  </div>
</section>
<section class="section">
  <div class="container narrow">${proposalForm({ productOptions: opts })}</div>
</section>`;
  return layout({
    path: '/solicita-propuesta/',
    title: 'Solicita propuesta',
    description: 'Solicita una propuesta con alcance, tiempos y precio fijo para tu pyme: finanzas, RH, liderazgo, operación o automatización.',
    body,
  });
}

// ───────────── Carrito y pago ─────────────
const regimenes = [
  ['601', 'General de Ley Personas Morales'],
  ['603', 'Personas Morales con Fines no Lucrativos'],
  ['605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios'],
  ['606', 'Arrendamiento'],
  ['612', 'Personas Físicas con Actividades Empresariales y Profesionales'],
  ['621', 'Incorporación Fiscal'],
  ['625', 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'],
  ['626', 'Régimen Simplificado de Confianza'],
];
const usosCfdi = [
  ['G03', 'Gastos en general'],
  ['G01', 'Adquisición de mercancías'],
  ['S01', 'Sin efectos fiscales'],
  ['CP01', 'Pagos'],
];

export function carrito() {
  const body = `
<section class="page-hero">
  <div class="container"><p class="eyebrow">Carrito y pago</p><h1 class="display-2" data-checkout-title>Tu carrito</h1></div>
</section>
<section class="section">
  <div class="container checkout">
    <div class="checkout-summary">
      <div data-cart-items><p class="muted">Cargando…</p></div>
      <dl class="totals" data-cart-totals hidden>
        <div><dt>Subtotal</dt><dd data-subtotal></dd></div>
        <div><dt>IVA (16%)</dt><dd data-iva></dd></div>
        <div class="totals-total"><dt>Total</dt><dd data-total></dd></div>
      </dl>
      <p class="muted small" data-sub-note hidden>Cargo mensual recurrente. Puedes consultar la política de cancelación en los <a class="link" href="/terminos-y-condiciones/">términos</a>.</p>
    </div>

    <form class="form checkout-form" data-checkout-form novalidate hidden>
      <h2 class="h3">Tus datos</h2>
      <div class="form-grid">
        <div class="field"><label for="co-nombre">Nombre completo</label><input class="input" id="co-nombre" name="nombre" required autocomplete="name"></div>
        <div class="field"><label for="co-correo">Correo</label><input class="input" id="co-correo" name="correo" type="email" required autocomplete="email"><p class="hint">Aquí recibirás tus descargables y accesos.</p></div>
        <div class="field"><label for="co-tel">WhatsApp</label><input class="input" id="co-tel" name="whatsapp" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="co-empresa">Empresa</label><input class="input" id="co-empresa" name="empresa" autocomplete="organization"></div>
      </div>

      <label class="check"><input type="checkbox" name="factura" data-toggle-factura> <span>Necesito factura (CFDI)</span></label>
      <fieldset class="factura" data-factura hidden>
        <legend class="h4">Datos de facturación</legend>
        <div class="form-grid">
          <div class="field"><label for="co-rfc">RFC</label><input class="input" id="co-rfc" name="rfc" maxlength="13" autocapitalize="characters" pattern="[A-Za-zÑñ&]{3,4}[0-9]{6}[A-Za-z0-9]{3}"></div>
          <div class="field"><label for="co-razon">Razón social</label><input class="input" id="co-razon" name="razonSocial"><p class="hint">Tal como aparece en tu constancia de situación fiscal.</p></div>
          <div class="field"><label for="co-regimen">Régimen fiscal</label>
            <select class="input" id="co-regimen" name="regimenFiscal"><option value="">Selecciona</option>${regimenes.map(([k, v]) => `<option value="${k}">${k} · ${v}</option>`).join('')}</select></div>
          <div class="field"><label for="co-cp">Código postal fiscal</label><input class="input" id="co-cp" name="cpFiscal" inputmode="numeric" maxlength="5" pattern="[0-9]{5}"></div>
          <div class="field field--full"><label for="co-uso">Uso del CFDI</label>
            <select class="input" id="co-uso" name="usoCfdi"><option value="">Selecciona</option>${usosCfdi.map(([k, v]) => `<option value="${k}">${k} · ${v}</option>`).join('')}</select></div>
        </div>
        <p class="hint">[VALIDA CON TU CONTADOR LOS REGÍMENES Y USOS DEL CFDI QUE ACEPTAS]</p>
      </fieldset>

      <fieldset class="pay-methods" data-pay-methods>
        <legend class="h4">Forma de pago</legend>
        <label class="radio"><input type="radio" name="metodo" value="tarjeta" checked> <span>Tarjeta de crédito o débito</span></label>
        <label class="radio" data-method-oxxo><input type="radio" name="metodo" value="oxxo"> <span>Efectivo en OXXO</span></label>
        <label class="radio" data-method-transfer><input type="radio" name="metodo" value="transferencia"> <span>Transferencia (SPEI)</span></label>
        <p class="hint" data-method-hint>Con OXXO o transferencia, tus descargables y accesos se envían cuando se acredita el pago.</p>
      </fieldset>

      <label class="check"><input type="checkbox" name="terminos" required> <span>Acepto los <a class="link" href="/terminos-y-condiciones/" target="_blank">términos y condiciones</a>, la <a class="link" href="/politica-de-reembolsos/" target="_blank">política de reembolsos</a> y el <a class="link" href="/aviso-de-privacidad/" target="_blank">aviso de privacidad</a>.</span></label>
      ${config.preview ? `<p class="preview-note" role="note"><strong>Los pagos en línea se activan muy pronto.</strong> Mientras tanto, <a class="link" href="/solicita-propuesta/">solicita tu producto</a> y te contactamos para completar tu compra.</p>` : ''}
      <button class="btn btn--primary btn--lg btn--block" type="submit" data-pay-button${config.preview ? ' disabled' : ''}>Ir a pagar</button>
      <p class="muted small">Pago seguro con Mercado Pago o Stripe. Bikrom no almacena los datos de tu tarjeta.</p>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>`;
  return layout({
    path: '/carrito/',
    title: 'Carrito y pago',
    description: 'Revisa tu carrito y paga con tarjeta, OXXO o transferencia. Precios más IVA. Facturamos.',
    body,
    noindex: true,
    showFinalCta: false,
    scripts: ['/assets/js/checkout.js'],
  });
}

export function gracias() {
  const body = `
<section class="page-hero">
  <div class="container narrow" data-thanks>
    <p class="eyebrow">Pedido <span data-order-id></span></p>
    <h1 class="display-2" data-thanks-title>Gracias por tu compra.</h1>
    <p class="lead" data-thanks-text>Te enviamos un correo con tus descargables, accesos o los siguientes pasos. Si pagaste con OXXO o transferencia, lo recibirás cuando se acredite el pago.</p>
    <div class="btn-row"><a class="btn btn--primary" href="/soluciones/">Seguir explorando</a><a class="btn btn--secondary" href="/contacto/">¿Dudas? Contáctanos</a></div>
  </div>
</section>`;
  return layout({ path: '/gracias/', title: 'Gracias', description: 'Confirmación de tu pedido en Bikrom.', body, noindex: true, scripts: ['/assets/js/thanks.js'] });
}

// ───────────── Legales ─────────────
function legalPage({ path, title, description, sections }) {
  const L = config.legal;
  const body = `
<section class="page-hero">
  <div class="container narrow">
    ${draftBanner('BORRADOR PARA REVISIÓN LEGAL')}
    <h1 class="display-2">${esc(title)}</h1>
    <p class="muted small">Última actualización: ${esc(L.lastUpdate)}</p>
  </div>
</section>
<section class="section">
  <div class="container narrow prose">${sections}</div>
</section>`;
  return layout({ path, title, description, body, showFinalCta: false });
}

export function privacidad() {
  const L = config.legal;
  return legalPage({
    path: '/aviso-de-privacidad/',
    title: 'Aviso de privacidad',
    description: 'Aviso de privacidad de Bikrom: qué datos recabamos, para qué los usamos y cómo ejercer tus derechos.',
    sections: `
<h2>1. Responsable</h2>
<p>${esc(L.businessName)} (“Bikrom”), con domicilio en ${esc(L.address)}, es responsable del tratamiento de tus datos personales. Contacto: ${esc(config.contact.email)}.</p>
<h2>2. Datos que recabamos</h2>
<ul>
  <li>Identificación y contacto: nombre, empresa, correo, WhatsApp y número de empleados.</li>
  <li>Respuestas del Diagnóstico Empresa 360.</li>
  <li>Datos de facturación: RFC, razón social, régimen fiscal, código postal fiscal y uso del CFDI.</li>
  <li>Datos de compra. Los datos de tu tarjeta los procesa directamente el proveedor de pagos (Mercado Pago o Stripe); Bikrom no los almacena.</li>
  <li>Datos de navegación mediante cookies, solo si las aceptas.</li>
</ul>
<h2>3. Finalidades</h2>
<p><strong>Primarias:</strong> enviarte el resultado del diagnóstico, responder tus solicitudes, agendar llamadas, procesar compras y suscripciones, entregar descargables y accesos, y emitir facturas.</p>
<p><strong>Secundarias:</strong> enviarte el boletín y comunicaciones sobre nuestros servicios. Puedes negarte en cualquier momento escribiendo a ${esc(config.contact.email)}. [CONFIRMA FINALIDADES SECUNDARIAS]</p>
<h2>4. Transferencias y encargados</h2>
<p>Compartimos los datos estrictamente necesarios con proveedores que nos ayudan a operar: procesadores de pago (Mercado Pago o Stripe), envío de correo, agenda (Calendly o Cal.com), hospedaje y medición (Google Analytics y Meta, solo con tu consentimiento). [LISTA DEFINITIVA DE PROVEEDORES]</p>
<h2>5. Tus derechos</h2>
<p>Puedes solicitar el acceso, rectificación, cancelación u oposición al tratamiento de tus datos, así como revocar tu consentimiento, escribiendo a ${esc(config.contact.email)}. [PROCEDIMIENTO Y PLAZOS DE RESPUESTA]</p>
<h2 id="cookies">6. Cookies</h2>
<p>Usamos cookies necesarias para el carrito y tus preferencias. Las cookies de medición (Google Analytics 4 y Meta Pixel) solo se activan si las aceptas en el banner. Puedes cambiar tu decisión borrando las cookies de tu navegador.</p>
<h2>7. Cambios</h2>
<p>Publicaremos cualquier cambio a este aviso en esta página.</p>`,
  });
}

export function terminos() {
  const L = config.legal;
  return legalPage({
    path: '/terminos-y-condiciones/',
    title: 'Términos y condiciones',
    description: 'Términos y condiciones de uso del sitio y de compra de productos y servicios de Bikrom.',
    sections: `
<h2>1. Partes</h2>
<p>Estos términos regulan el uso de ${esc(config.domain)} y la compra de productos y servicios de ${esc(L.businessName)} (“Bikrom”), RFC ${esc(L.rfc)}, con domicilio en ${esc(L.address)}.</p>
<h2>2. Precios e impuestos</h2>
<p>Los precios están en pesos mexicanos y no incluyen IVA, que se agrega al pagar. Los precios con rango son de referencia; el precio final de un proyecto es el que aparece en la propuesta aceptada por escrito.</p>
<h2>3. Pagos</h2>
<p>Aceptamos tarjeta, pago en OXXO y transferencia a través de Mercado Pago o Stripe. Los pedidos con OXXO o transferencia se confirman cuando se acredita el pago.</p>
<h2>4. Productos descargables y cursos</h2>
<p>Al confirmarse el pago enviamos al correo registrado un enlace de descarga personal o los datos de acceso al curso. Las licencias son para uso interno de la empresa compradora; no se permite revender ni distribuir los materiales. [DEFINE LOS ALCANCES DE LA LICENCIA]</p>
<h2>5. Servicios y proyectos</h2>
<p>El alcance, los entregables, los tiempos y las condiciones de pago de cada proyecto se definen en la propuesta. [CONDICIONES DE PROYECTOS: anticipos, cambios de alcance, confidencialidad]</p>
<h2>6. Suscripciones</h2>
<p>La Membresía para dueños se cobra de forma mensual recurrente. [DEFINE TU POLÍTICA DE CANCELACIÓN DE LA MEMBRESÍA]</p>
<h2>7. Facturación</h2>
<p>Emitimos CFDI con los datos fiscales capturados al pagar. [PLAZO Y CONDICIONES PARA SOLICITAR FACTURA]</p>
<h2>8. Garantía y reembolsos</h2>
<p>Consulta la <a class="link" href="/politica-de-reembolsos/">política de reembolsos</a>.</p>
<h2>9. Propiedad intelectual</h2>
<p>Los contenidos, marcas y materiales del sitio son propiedad de Bikrom o se usan con autorización.</p>
<h2>10. Legislación y jurisdicción</h2>
<p>[DEFINE LEGISLACIÓN APLICABLE Y JURISDICCIÓN]</p>`,
  });
}

export function reembolsos() {
  return legalPage({
    path: '/politica-de-reembolsos/',
    title: 'Política de reembolsos',
    description: 'Política de reembolsos y garantía de Bikrom para descargables, cursos, proyectos y suscripciones.',
    sections: `
<h2>1. Garantía</h2>
<p>${esc(config.legal.guarantee)}</p>
<h2>2. Descargables</h2>
<p>[DEFINE SI HAY REEMBOLSO EN DESCARGABLES, por ejemplo solo si el archivo está dañado o no corresponde a la descripción]</p>
<h2>3. Cursos en línea</h2>
<p>[DEFINE PLAZO Y CONDICIONES DE REEMBOLSO DE CURSOS]</p>
<h2>4. Proyectos y servicios</h2>
<p>[DEFINE CONDICIONES DE CANCELACIÓN Y REEMBOLSO DE PROYECTOS, por ejemplo según entregables completados]</p>
<h2>5. Suscripciones</h2>
<p>[DEFINE TU POLÍTICA DE CANCELACIÓN DE LA MEMBRESÍA]</p>
<h2>6. Cómo solicitar un reembolso</h2>
<p>Escríbenos a ${esc(config.contact.email)} con tu número de pedido. [PLAZO DE RESPUESTA Y FORMA DE DEVOLUCIÓN]</p>`,
  });
}

// ───────────── Inglés (estructura) y 404 ─────────────
export function enPlaceholder() {
  const body = `
<section class="page-hero">
  <div class="container narrow" lang="en">
    <p class="eyebrow">English</p>
    <h1 class="display-2">English version coming soon.</h1>
    <p class="lead">Bikrom helps Mexican SMEs organize finance, people, processes and technology with clear deliverables and fixed prices. [TRADUCCIÓN AL INGLÉS PENDIENTE]</p>
    <div class="btn-row"><a class="btn btn--primary" href="/" lang="es">Ver el sitio en español</a><a class="btn btn--secondary" href="/contacto/">Contact</a></div>
  </div>
</section>`;
  return layout({ path: '/en/', title: 'Bikrom — English', description: 'Bikrom: consulting for Mexican SMEs. English version coming soon.', body, noindex: true, showFinalCta: false });
}

export function notFound() {
  const body = `
<section class="page-hero">
  <div class="container narrow">
    <p class="eyebrow">Error 404</p>
    <h1 class="display-2">Esta página no existe.</h1>
    <p class="lead">Lo que sí es claro: aquí tienes por dónde seguir.</p>
    <div class="btn-row"><a class="btn btn--primary" href="/">Ir al inicio</a><a class="btn btn--secondary" href="/soluciones/">Ver soluciones</a></div>
  </div>
</section>`;
  return layout({ path: '/404.html', title: 'Página no encontrada', description: 'Página no encontrada.', body, noindex: true });
}
