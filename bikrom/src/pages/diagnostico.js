import { productBySlug, productUrl } from '../data/products.js';
import { questions, scale, diagAreas, employeeRanges } from '../data/diagnostico.js';
import { layout } from '../lib/layout.js';
import { icon } from '../lib/icons.js';
import { areaIcon, bookingEmbed, faqList, faqLd } from '../lib/components.js';

const faqs = [
  { q: '¿Cuánto tiempo toma?', a: 'Menos de 10 minutos. Son 20 afirmaciones, una por pantalla, que calificas del 1 al 5.' },
  { q: '¿Tiene costo?', a: 'No. El diagnóstico y la llamada de 30 minutos para revisar tu resultado son gratuitos.' },
  { q: '¿Qué hacen con mis datos?', a: 'Los usamos para enviarte tu resultado y darle seguimiento a tu diagnóstico, como se explica en el aviso de privacidad.' },
];

export default function diagnostico() {
  // Datos para el cuestionario en el navegador.
  const data = {
    questions,
    scale,
    areas: diagAreas.map((a) => ({
      key: a.key,
      name: a.name,
      icon: areaIcon(a.iconArea, 28),
      recommendations: a.recommendations.map((slug) => ({
        slug,
        name: productBySlug[slug].name,
        promise: productBySlug[slug].promise,
        url: productUrl(productBySlug[slug]),
      })),
    })),
  };

  const body = `
<section class="page-hero" data-diag-intro>
  <div class="container diag-intro">
    <div>
      <p class="eyebrow">Gratis · menos de 10 minutos</p>
      <h1 class="display-1">Diagnóstico Empresa 360</h1>
      <p class="lead">20 afirmaciones sobre lo que hoy pasa en tu empresa, en cuatro áreas. Al final recibes tu puntaje general y por área, tres recomendaciones concretas y una llamada gratuita de 30 minutos para revisarlo.</p>
      <button type="button" class="btn btn--primary btn--lg" data-diag-start>Empezar diagnóstico</button>
      <noscript><p class="muted">Para hacer el diagnóstico necesitas activar JavaScript en tu navegador.</p></noscript>
    </div>
    <ul class="diag-areas diag-areas--stack" aria-label="Áreas del diagnóstico">
      ${diagAreas.map((a) => `<li>${areaIcon(a.iconArea, 32)}<span>${a.name}</span><span class="muted">5 afirmaciones</span></li>`).join('')}
    </ul>
  </div>
</section>

<section class="section diag" data-diag hidden aria-live="polite">
  <div class="container narrow">
    <div class="progress" role="progressbar" aria-label="Avance del diagnóstico" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="0" data-diag-progress>
      <div class="progress-bar" data-diag-bar></div>
    </div>
    <p class="progress-text"><span data-diag-count>1</span> de ${questions.length}</p>

    <form data-diag-question class="diag-question" novalidate>
      <div class="diag-area" data-diag-area></div>
      <fieldset>
        <legend class="display-3" data-diag-text tabindex="-1"></legend>
        <div class="scale" data-diag-scale></div>
      </fieldset>
      <div class="btn-row diag-nav">
        <button type="button" class="btn btn--secondary" data-diag-prev>${icon('arrow', { size: 18, cls: 'flip' })} Anterior</button>
      </div>
    </form>

    <form class="form diag-lead" data-diag-lead hidden novalidate>
      <h2 class="display-3" tabindex="-1">Último paso: ¿a quién le enviamos tu resultado?</h2>
      <div class="form-grid">
        <div class="field"><label for="dl-nombre">Nombre</label><input class="input" id="dl-nombre" name="nombre" required autocomplete="name"></div>
        <div class="field"><label for="dl-empresa">Empresa</label><input class="input" id="dl-empresa" name="empresa" required autocomplete="organization"></div>
        <div class="field"><label for="dl-correo">Correo</label><input class="input" id="dl-correo" name="correo" type="email" required autocomplete="email"></div>
        <div class="field"><label for="dl-whatsapp">WhatsApp</label><input class="input" id="dl-whatsapp" name="whatsapp" type="tel" required autocomplete="tel" inputmode="tel" placeholder="10 dígitos"></div>
        <div class="field field--full"><label for="dl-empleados">Número de empleados</label>
          <select class="input" id="dl-empleados" name="empleados" required><option value="">Selecciona</option>${employeeRanges.map((r) => `<option>${r}</option>`).join('')}</select></div>
      </div>
      <label class="check"><input type="checkbox" name="privacidad" required> <span>He leído y acepto el <a class="link" href="/aviso-de-privacidad/" target="_blank">aviso de privacidad</a>.</span></label>
      <div class="btn-row">
        <button type="button" class="btn btn--secondary" data-diag-back>Revisar respuestas</button>
        <button type="submit" class="btn btn--primary">Ver mi resultado</button>
      </div>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>

<section class="section diag-result" data-diag-result hidden aria-labelledby="result-title">
  <div class="container">
    <p class="eyebrow">Tu resultado</p>
    <h2 id="result-title" class="display-2" tabindex="-1">Puntaje general: <span data-result-overall></span><span class="muted"> / 100</span></h2>
    <p class="lead" data-result-email></p>
    <div class="bars" data-result-bars role="img" aria-label="Puntaje por área"></div>
    <h3 class="h2 mt-xl">Tus tres recomendaciones</h3>
    <ol class="recs" data-result-recs></ol>
    <div class="mt-xl" id="agenda">
      ${bookingEmbed({ title: 'Agenda tu llamada gratuita de 30 minutos', context: 'diagnostico-empresa-360' })}
    </div>
  </div>
</section>

<section class="section section--rule" data-diag-faq>
  <div class="container narrow">
    <h2 class="h2">Preguntas frecuentes</h2>
    ${faqList(faqs, 'faq-diag')}
  </div>
</section>

<script type="application/json" id="diag-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
`;

  return layout({
    path: '/diagnostico-empresa-360/',
    title: 'Diagnóstico Empresa 360 gratis para pymes',
    description:
      'Evalúa gratis tu empresa en finanzas, personas, procesos y tecnología en menos de 10 minutos. Recibe tu puntaje, tres recomendaciones y una llamada de 30 minutos.',
    body,
    scripts: ['/assets/js/diagnostico.js'],
    jsonld: [faqLd(faqs)],
  });
}

