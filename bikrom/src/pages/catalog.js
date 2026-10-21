import { catalogGroups, types } from '../data/areas.js';
import { products } from '../data/products.js';
import { layout } from '../lib/layout.js';
import { esc, abs } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { areaIcon, productCard } from '../lib/components.js';

export default function catalog() {
  const filters = `
<div class="filters" data-filters>
  <div class="search">
    <label class="sr-only" for="catalog-search">Buscar soluciones</label>
    ${icon('search', { size: 20 })}
    <input id="catalog-search" class="input search-input" type="search" placeholder="Buscar: NOM-035, flujo, líderes…" data-filter-search autocomplete="off">
  </div>
  <fieldset class="chip-group">
    <legend class="filter-label">Área</legend>
    <button type="button" class="chip is-active" data-filter-area="" aria-pressed="true">Todas</button>
    ${catalogGroups
      .map((a) => `<button type="button" class="chip" data-filter-area="${a.key}" aria-pressed="false">${areaIcon(a.key, 18)}<span>${esc(a.name)}</span></button>`)
      .join('')}
  </fieldset>
  <fieldset class="chip-group">
    <legend class="filter-label">Tipo</legend>
    <button type="button" class="chip is-active" data-filter-type="" aria-pressed="true">Todos</button>
    ${types.map((tp) => `<button type="button" class="chip" data-filter-type="${tp.key}" aria-pressed="false">${tp.name}</button>`).join('')}
  </fieldset>
  <p class="filter-count" role="status" aria-live="polite" data-filter-count></p>
</div>`;

  const sections = catalogGroups
    .map((g) => {
      const items = products.filter((p) => p.group === g.key && !p.featured);
      const featured = products.filter((p) => p.group === g.key && p.featured);
      const all = [...featured, ...items];
      return `<section class="catalog-group" id="${g.key}" data-group="${g.key}" aria-labelledby="g-${g.key}">
  <div class="group-head">${areaIcon(g.key, 32)}<h2 id="g-${g.key}" class="h2">${esc(g.name)}</h2></div>
  <div class="grid grid--3">${all.map((p) => productCard(p)).join('')}</div>
</section>`;
    })
    .join('');

  const body = `
<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Soluciones</p>
    <h1 class="display-1">Todo con precio a la vista.</h1>
    <p class="lead">${products.length} soluciones en seis áreas: descargables, cursos, proyectos y servicios mensuales. Todos los precios son más IVA.</p>
  </div>
</section>
<div class="container catalog">
  ${filters}
  <div data-catalog>${sections}</div>
  <p class="empty" data-filter-empty hidden>No encontramos soluciones con esos filtros. <a class="link" href="/solicita-propuesta/">Cuéntanos qué necesitas</a>.</p>
</div>`;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Soluciones Bikrom',
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(p.href || `/soluciones/${p.slug}/`), name: p.name })),
  };

  return layout({
    path: '/soluciones/',
    title: 'Soluciones para pymes: finanzas, RH, liderazgo, operación e IA',
    description:
      'Catálogo de soluciones Bikrom para pymes: flujo de efectivo, CFO externo, NOM-035, Ruta 40 horas, formación de líderes, procesos y automatización para empresas. Precios + IVA.',
    body,
    jsonld: [itemList],
    scripts: ['/assets/js/catalog.js'],
  });
}
