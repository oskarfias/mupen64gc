import { certificaciones, DC3_NOTE } from '../data/certificaciones.js';
import { layout } from '../lib/layout.js';
import { esc, abs } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { areaIcon } from '../lib/components.js';

function certCard(c, i) {
  const action = c.available
    ? `<a class="btn btn--primary btn--sm" href="/solicita-propuesta/?producto=${c.slug}">Solicitar inscripción</a>`
    : `<p class="cert-soon" role="note">Inscripción disponible próximamente</p>`;
  return `<article class="card cert-card reveal${c.available ? '' : ' cert-card--soon'}" id="${c.slug}">
  <div class="card-top">
    ${areaIcon(c.icon, 28)}
    ${c.available ? `<span class="card-type">${String(i + 1).padStart(2, '0')}</span>` : '<span class="tag">Próximamente</span>'}
  </div>
  <h2 class="card-title">${esc(c.title)}</h2>
  <p class="cert-norms">${esc(c.norms)}</p>
  <p class="card-text">${esc(c.description)}</p>
  <div class="cert-doc">
    ${icon('doc', { size: 20 })}
    <div><p class="cert-doc-label">Documento que se entrega</p><p>${esc(c.document)}</p></div>
  </div>
  <div class="card-actions">${action}</div>
</article>`;
}

export default function certificacionesPage() {
  const body = `
<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Capacitación y certificación</p>
    <h1 class="display-1">Certificaciones disponibles</h1>
    <p class="lead">Capacitación para tu equipo con el documento que corresponde a cada opción, indicado con claridad desde el principio.</p>
  </div>
</section>
<section class="section">
  <div class="container">
    <p class="legal-note cert-note">${icon('shield', { size: 20 })}<span>${esc(DC3_NOTE)}</span></p>
    <div class="grid grid--3 cert-grid">${certificaciones.map(certCard).join('')}</div>
    <p class="muted small cert-foot">Las opciones marcadas como “Próximamente” abrirán su inscripción cuando contemos con la acreditación o alianza que requieren.</p>
  </div>
</section>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Certificaciones disponibles',
    itemListElement: certificaciones.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(`/certificaciones/#${c.slug}`),
      name: `${c.title} — ${c.norms}`,
    })),
  };

  return layout({
    path: '/certificaciones/',
    title: 'Certificaciones disponibles: NOM-035, seguridad, ergonomía y más',
    description:
      'Capacitación con constancia DC-3 en NOM-035, NOM-019, NOM-030, NOM-002, NOM-036-1, NOM-017 y NOM-037. Próximamente: Lean Six Sigma y competencias CONOCER.',
    body,
    jsonld: [ld],
  });
}
