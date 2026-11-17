// Páginas públicas editoriales.
import { esc, when, list } from '../html.mjs';
import { layout, P, photo, localBusinessLd } from '../layout.mjs';
import { t } from '../../i18n.mjs';
import { json } from '../../db.mjs';
import { mxn } from '../../lib/money.mjs';
import { currentPackages } from '../../domain/quote.mjs';

const tr = (row, field, lang) => (lang === 'en' ? row[`${field}_en`] || row[`${field}_es`] : row[`${field}_es`]) || '';

export function priceLabel(pkg, lang) {
  if (!pkg || pkg.pricing === 'quote' || pkg.price_cents == null) return lang === 'en' ? 'Custom quote' : 'Cotización personalizada';
  if (pkg.pricing === 'per_unit') return `${mxn(pkg.price_cents)} ${lang === 'en' ? pkg.unit_en || '' : pkg.unit_es || ''}`.trim();
  return mxn(pkg.price_cents);
}

export function rich(text) {
  return String(text || '').split(/\n{2,}/).map((block) => {
    const b = block.trim();
    if (!b) return '';
    if (b.startsWith('## ')) return `<h2 class="h3" style="font-size:1.6rem;margin-top:1.6em">${esc(b.slice(3))}</h2>`;
    return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

const services = (app) => app.db.all('SELECT * FROM services WHERE active = 1 ORDER BY sort');
const pipeList = (s) => String(s || '').split('|').map((x) => x.trim()).filter(Boolean);

function testimonialsBlock(app, lang) {
  const rows = app.db.all('SELECT * FROM testimonials WHERE visible = 1 AND authorized = 1 ORDER BY sort');
  if (!rows.length) return '';
  return `<section class="band"><div class="wrap narrow center">
    <p class="eyebrow">${lang === 'en' ? 'Kind words' : 'Palabras'}</p>
    ${rows.map((r) => `<figure style="margin:0 0 40px"><blockquote class="quote-block" style="margin:0">“${esc(tr(r, 'quote', lang))}”</blockquote>${when(r.author, `<figcaption class="muted" style="margin-top:12px">— ${esc(r.author)}</figcaption>`)}</figure>`).join('')}
  </div></section>`;
}

export function home(app, lang) {
  const tx = t(lang);
  const c = (k) => app.content(k, lang);
  const svc = services(app);
  const steps = pipeList(c('how_steps'));
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy fade">
      <p class="eyebrow">${esc(tx.footer.locations)}</p>
      <h1>${esc(c('hero_title'))}</h1>
      <p class="lead">${esc(c('hero_sub'))}</p>
      <div class="btn-row">
        <a class="btn btn--solid" href="${P(app, lang, '/reservar')}">${tx.cta.findSession}</a>
        <a class="btn" href="${P(app, lang, '/servicios')}">${tx.cta.seePackages}</a>
      </div>
    </div>
    ${photo(app, 'hero', lang, { ratio: 'r-hero', eager: true, sizes: '(min-width: 900px) 60vw, 100vw' })}
  </div>
</section>

<section>
  <div class="wrap duo duo--flip">
    <div class="pair fade">${photo(app, 'intro', lang, { ratio: 'r-tall' })}${photo(app, 'about', lang, { ratio: 'r-square' })}</div>
    <div class="fade">
      <p class="eyebrow">${lang === 'en' ? 'The studio' : 'La marca'}</p>
      <h2>${esc(c('intro_title'))}</h2>
      <p class="lead">${esc(c('intro_body'))}</p>
      <a class="link" href="${P(app, lang, '/sobre-mi')}">${tx.nav.about}</a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <p class="eyebrow">${tx.nav.services}</p>
    <h2 style="max-width:14em">${lang === 'en' ? 'Sessions, celebrations and stories worth keeping' : 'Sesiones, celebraciones e historias que vale la pena conservar'}</h2>
    <ul class="services-list" style="margin-top:40px">
      ${svc.map((s) => {
        const pk = currentPackages(app, s.id);
        return `<li class="service-row fade">
          ${photo(app, `service:${s.slug}`, lang, { ratio: 'r-wide', sizes: '300px' })}
          <div><h3>${esc(tr(s, 'name', lang))}</h3><p class="muted">${esc(tr(s, 'summary', lang))}</p></div>
          <div><p class="price">${pk.length > 1 ? `${tx.common.from} ` : ''}${esc(priceLabel(pk[0], lang))}</p><a class="link" href="${P(app, lang, s.kind === 'school' ? '/escuelas' : s.kind === 'business' ? '/negocios' : s.kind === 'tesoro' ? '/tesoro' : '/servicios#' + s.slug)}">${tx.cta.viewMore}</a></div>
        </li>`;
      }).join('')}
    </ul>
    <p style="margin-top:32px"><a class="btn" href="${P(app, lang, '/servicios')}">${tx.cta.seePackages}</a></p>
  </div>
</section>

<section>
  <div class="wrap">
    <p class="eyebrow">${esc(c('how_title'))}</p>
    <ol class="steps">${steps.map((s) => `<li class="fade">${esc(s)}</li>`).join('')}</ol>
    <p style="margin-top:36px"><a class="btn btn--solid" href="${P(app, lang, '/reservar')}">${tx.cta.quote}</a></p>
  </div>
</section>

<section class="band">
  <div class="wrap duo">
    ${photo(app, 'products', lang, { ratio: 'r-wide' })}
    <div class="fade">
      <p class="eyebrow">${tx.nav.products}</p>
      <h2>${esc(c('products_title'))}</h2>
      <p class="lead">${esc(c('products_body'))}</p>
      <a class="link" href="${P(app, lang, '/productos')}">${tx.cta.viewMore}</a>
    </div>
  </div>
</section>

${testimonialsBlock(app, lang)}

<section>
  <div class="wrap duo duo--flip">
    ${photo(app, 'my-session', lang, { ratio: 'r-portrait' })}
    <div class="fade">
      <p class="eyebrow">${tx.nav.mySession}</p>
      <h2>${esc(c('my_session_title'))}</h2>
      <p class="lead">${esc(c('my_session_body'))}</p>
      <a class="btn btn--solid" href="${P(app, lang, '/mi-sesion')}">${tx.nav.mySession}</a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap narrow center">
    <h2>${esc(c('contact_title'))}</h2>
    <p class="lead" style="margin:0 auto 28px">${esc(c('contact_body'))}</p>
    <div class="btn-row" style="justify-content:center">
      <a class="btn btn--solid" href="${esc(app.setting('business').whatsapp)}" target="_blank" rel="noopener">${tx.cta.whatsapp}</a>
      <a class="btn" href="${P(app, lang, '/contacto')}">${tx.nav.contact}</a>
    </div>
  </div>
</section>`;
  return layout(app, {
    lang, path: '/',
    title: lang === 'en' ? 'Estefanía Torres Photography — Querétaro & Irapuato' : 'Estefanía Torres Fotografía — Querétaro e Irapuato',
    description: lang === 'en'
      ? 'Family, couple, event and wedding photography in Irapuato and Querétaro. Editorial, warm photography with careful service from booking to delivery.'
      : 'Fotografía de familias, parejas, eventos y bodas en Irapuato y Querétaro. Fotografía editorial y cálida, con calidad en todo el servicio.',
    body, jsonld: [localBusinessLd(app, lang)],
  });
}

function packageDetails(app, lang, pkg) {
  const tx = t(lang);
  const inc = json(lang === 'en' ? pkg.includes_en : pkg.includes_es, []);
  const notes = lang === 'en' ? pkg.notes_en : pkg.notes_es;
  return `<div>
    <h3>${esc(tr(pkg, 'name', lang))}</h3>
    <p class="price" style="font-family:var(--serif);font-size:1.5rem;margin:0 0 .4em">${esc(priceLabel(pkg, lang))}</p>
    ${when(inc.length, `<ul>${inc.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`)}
    ${when(notes, `<p class="muted small">${esc(notes)}</p>`)}
    <p class="muted small">${tx.common.delivery}: ${pkg.delivery_days ? (lang === 'en' ? `about ${Math.round(pkg.delivery_days / 7)} weeks after the session or event` : `aproximadamente ${Math.round(pkg.delivery_days / 7)} semanas después de la sesión o evento`) : (lang === 'en' ? 'date agreed in the quote' : 'fecha acordada en la cotización')}</p>
  </div>`;
}

export function servicesPage(app, lang) {
  const tx = t(lang);
  const svc = services(app);
  const rows = svc.flatMap((s) => currentPackages(app, s.id).map((p) => ({ s, p })));
  const body = `
<section style="padding-bottom:32px"><div class="wrap narrow">
  <p class="eyebrow">${tx.nav.services}</p>
  <h1>${lang === 'en' ? 'Services and packages' : 'Servicios y paquetes'}</h1>
  <p class="lead">${esc(app.content('travel_note', lang))}</p>
</div></section>
<section style="padding-top:0"><div class="wrap">
  <h2 class="h3">${lang === 'en' ? 'At a glance' : 'Comparación'}</h2>
  <div class="table-scroll"><table class="compare">
    <thead><tr><th>${lang === 'en' ? 'Service' : 'Servicio'}</th><th>${lang === 'en' ? 'Price' : 'Precio'}</th><th>${tx.common.duration}</th><th>${lang === 'en' ? 'Final photos' : 'Fotografías finales'}</th><th>${tx.common.delivery}</th></tr></thead>
    <tbody>${rows.map(({ s, p }) => `<tr><td><a href="#${s.slug}">${esc(tr(p, 'name', lang))}</a></td><td>${esc(priceLabel(p, lang))}</td>
      <td>${p.duration_min ? (p.duration_min >= 120 ? `${p.duration_min / 60} ${tx.common.hours}` : `${p.duration_min} ${tx.common.minutes}`) : p.video_minutes ? (lang === 'en' ? `${p.video_minutes}-minute final video` : `Video final de ${p.video_minutes} min`) : '—'}</td>
      <td>${p.photos_included ?? '—'}</td><td>${p.delivery_days ? (lang === 'en' ? '2 weeks' : '2 semanas') : (lang === 'en' ? 'Agreed' : 'Acordada')}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">${tx.common.mxn}</p>
</div></section>
${svc.map((s, i) => `<section id="${s.slug}" class="${i % 2 ? '' : 'band'}"><div class="wrap duo${i % 2 ? ' duo--flip' : ''}">
  ${photo(app, `service:${s.slug}`, lang, { ratio: 'r-wide' })}
  <div class="fade">
    <p class="eyebrow">${esc(tr(s, 'name', lang))}</p>
    <p class="lead">${esc(tr(s, 'summary', lang))}</p>
    ${currentPackages(app, s.id).map((p) => packageDetails(app, lang, p)).join('<hr class="rule" style="margin:20px 0">')}
    <p style="margin-top:20px"><a class="btn btn--solid" href="${P(app, lang, `/reservar?servicio=${s.slug}`)}">${s.kind === 'business' ? tx.cta.requestQuote : tx.cta.quote}</a></p>
  </div>
</div></section>`).join('')}
<section><div class="wrap narrow">
  <h2 class="h3">${lang === 'en' ? 'General conditions' : 'Condiciones generales'}</h2>
  <ul class="conditions">${pipeList(app.content('general_conditions', lang)).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
  <p class="notice" style="margin-top:28px"><strong>${tx.booking.cancelPolicy}.</strong> ${esc(app.setting('cancellation')[lang] || app.setting('cancellation').es)}</p>
</div></section>`;
  return layout(app, {
    lang, path: '/servicios',
    title: lang === 'en' ? 'Photography services and packages | Estefanía Torres' : 'Servicios y paquetes de fotografía | Estefanía Torres',
    description: lang === 'en' ? 'Express sessions, social events, weddings, schools, business and Tesoro videos in Irapuato and Querétaro. Prices in MXN.' : 'Sesión express, eventos sociales, bodas, escuelas, negocios y videos Tesoro en Irapuato y Querétaro. Precios en MXN.',
    body,
  });
}

function landing(app, lang, { path, slug, slot, titleKey, bodyKey, extra = '', seoTitle, seoDesc }) {
  const tx = t(lang);
  const s = app.db.get('SELECT * FROM services WHERE slug = ?', slug);
  const pkgs = s ? currentPackages(app, s.id) : [];
  const body = `
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy fade">
    <p class="eyebrow">${esc(s ? tr(s, 'name', lang) : '')}</p>
    <h1 style="font-size:clamp(2.1rem,6vw,3.6rem)">${esc(app.content(titleKey, lang))}</h1>
    <p class="lead">${esc(app.content(bodyKey, lang))}</p>
    <a class="btn btn--solid" href="${P(app, lang, `/reservar?servicio=${slug}`)}">${s?.kind === 'business' || s?.kind === 'school' ? tx.cta.requestQuote : tx.cta.quote}</a>
  </div>
  ${photo(app, slot, lang, { ratio: 'r-hero', eager: true })}
</div></section>
${extra}
${when(pkgs.length && s.kind !== 'business', `<section class="band"><div class="wrap"><div class="cols-${Math.min(pkgs.length, 2) === 2 ? '2' : '2'}">${pkgs.map((p) => packageDetails(app, lang, p)).join('')}</div>
  <p class="small muted" style="margin-top:20px">${tx.common.mxn}</p></div></section>`)}`;
  return layout(app, { lang, path, title: seoTitle, description: seoDesc, body });
}

export const schoolsPage = (app, lang) => landing(app, lang, {
  path: '/escuelas', slug: 'escuelas', slot: 'schools', titleKey: 'schools_title', bodyKey: 'schools_body',
  extra: `<section><div class="wrap narrow"><ul class="conditions">${(lang === 'en'
    ? ['Quote by school, group and number of students.', 'Basic or premium package per student.', 'Private delivery by student or family, and a group gallery when appropriate.', 'Delivery date agreed with the school.', 'Children’s names and data are never shown publicly.']
    : ['Cotización por escuela, grupo y cantidad de alumnos.', 'Paquete básico o premium por alumno.', 'Entrega privada por alumno o familia, y galería grupal cuando corresponda.', 'Fecha de entrega acordada con la escuela.', 'Nunca se muestran públicamente nombres ni datos de niñas y niños.']).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`,
  seoTitle: lang === 'en' ? 'School photography in Irapuato and Querétaro' : 'Fotografía escolar en Irapuato y Querétaro',
  seoDesc: lang === 'en' ? 'School photography for private schools: basic and premium packages per student, private delivery by family.' : 'Fotografía para escuelas privadas: paquetes básico y premium por alumno, con entrega privada por familia.',
});

export const businessPage = (app, lang) => landing(app, lang, {
  path: '/negocios', slug: 'negocios', slot: 'business', titleKey: 'business_title', bodyKey: 'business_body',
  seoTitle: lang === 'en' ? 'Business photography and video | Irapuato & Querétaro' : 'Fotografía y video para negocios | Irapuato y Querétaro',
  seoDesc: lang === 'en' ? 'Photography and audiovisual content for small and medium businesses. Tell me what you need and get a custom quote.' : 'Fotografía y contenido audiovisual para pequeños y medianos negocios. Cuéntame qué necesitas y recibe una cotización personalizada.',
});

export const tesoroPage = (app, lang) => landing(app, lang, {
  path: '/tesoro', slug: 'tesoro', slot: 'tesoro', titleKey: 'tesoro_title', bodyKey: 'tesoro_body',
  extra: `<section><div class="wrap narrow center"><p class="quote-block">${lang === 'en' ? 'Their voice, their stories, their way of laughing — kept for the ones who come next.' : 'Su voz, sus historias, su manera de reír: guardadas para quienes vienen después.'}</p>
    <p class="muted" style="margin-top:24px">${lang === 'en' ? 'Through prepared questions and interviews with your loved ones, the final video brings together the memories that matter most to your family.' : 'A través de preguntas preparadas y entrevistas con tus familiares queridos, el video final reúne los recuerdos que más importan a tu familia.'}</p></div></section>`,
  seoTitle: lang === 'en' ? 'Tesoro videos — family memories on video' : 'Videos Tesoro — recuerdos familiares en video',
  seoDesc: lang === 'en' ? 'A 5-minute final video preserving the voices and stories of your loved ones. MXN $6,000.' : 'Video final de 5 minutos que conserva las voces e historias de tus familiares queridos. $6,000 MXN.',
});

export function aboutPage(app, lang) {
  const body = `<section><div class="wrap duo">
    ${photo(app, 'about', lang, { ratio: 'r-portrait', eager: true })}
    <div class="fade"><p class="eyebrow">${t(lang).nav.about}</p><h1 style="font-size:clamp(2.1rem,6vw,3.4rem)">${esc(app.content('about_title', lang))}</h1>${rich(app.content('about_body', lang))}
    <a class="btn btn--solid" href="${P(app, lang, '/reservar')}">${t(lang).cta.findSession}</a></div>
  </div></section>`;
  return layout(app, { lang, path: '/sobre-mi', title: lang === 'en' ? 'About Estefanía Torres' : 'Sobre Estefanía Torres', description: app.content('intro_body', lang).slice(0, 155), body });
}

export function portfolioPage(app, lang, categorySlug) {
  const cats = app.db.all('SELECT * FROM portfolio_categories ORDER BY sort');
  const items = app.db.all(`SELECT i.*, m.id AS mid, m.storage_key, m.width, m.height, m.alt_es, m.alt_en, c.slug AS cat FROM portfolio_items i
    JOIN media m ON m.id = i.media_id LEFT JOIN portfolio_categories c ON c.id = i.category_id
    WHERE i.visible = 1 AND i.authorized = 1 AND m.storage_key IS NOT NULL ORDER BY i.sort, i.id`);
  const shown = categorySlug ? items.filter((i) => i.cat === categorySlug) : items;
  const usedCats = cats.filter((c) => items.some((i) => i.cat === c.slug));
  const body = `<section><div class="wrap">
    <p class="eyebrow">${t(lang).nav.portfolio}</p><h1>${lang === 'en' ? 'Portfolio' : 'Portafolio'}</h1>
    ${items.length ? `<nav aria-label="${lang === 'en' ? 'Categories' : 'Categorías'}" class="btn-row" style="margin:20px 0 32px">
      <a class="link" href="${P(app, lang, '/portafolio')}"${!categorySlug ? ' aria-current="page"' : ''}>${lang === 'en' ? 'All' : 'Todo'}</a>
      ${usedCats.map((c) => `<a class="link" href="${P(app, lang, '/portafolio?c=' + c.slug)}"${categorySlug === c.slug ? ' aria-current="page"' : ''}>${esc(tr(c, 'name', lang))}</a>`).join('')}
    </nav>
    <div class="gallery-grid">${shown.map((i) => `<a href="${app.base}/m/${i.mid}"><img src="${app.base}/m/${i.mid}" alt="${esc(tr(i, 'title', lang) || (lang === 'en' ? i.alt_en : i.alt_es) || '')}" loading="lazy"${i.width ? ` width="${i.width}" height="${i.height}"` : ''}></a>`).join('')}</div>`
    : `<p class="lead">${lang === 'en' ? 'The portfolio is being prepared. Meanwhile, you can follow my recent work on Instagram.' : 'El portafolio está en preparación. Mientras tanto, puedes ver mi trabajo reciente en Instagram.'}</p>
       <a class="btn" href="${esc(app.setting('business').instagram)}" target="_blank" rel="noopener">Instagram</a>`}
  </div></section>`;
  return layout(app, { lang, path: '/portafolio', title: lang === 'en' ? 'Portfolio | Estefanía Torres Photography' : 'Portafolio | Estefanía Torres Fotografía', description: lang === 'en' ? 'Selected work by Estefanía Torres.' : 'Trabajo seleccionado de Estefanía Torres.', body, noindex: !items.length });
}

export function productsPage(app, lang) {
  const tx = t(lang);
  const prods = app.db.all("SELECT * FROM products WHERE status != 'archived' ORDER BY sort");
  const body = `<section class="hero"><div class="wrap hero-grid">
    <div class="hero-copy fade"><p class="eyebrow">${tx.nav.products}</p><h1 style="font-size:clamp(2.1rem,6vw,3.6rem)">${esc(app.content('products_title', lang))}</h1><p class="lead">${esc(app.content('products_body', lang))}</p>
      <a class="btn btn--solid" href="${P(app, lang, '/mi-sesion')}">${tx.nav.mySession}</a></div>
    ${photo(app, 'products', lang, { ratio: 'r-hero', eager: true })}
  </div></section>
  <section class="band"><div class="wrap"><div class="cols-2">
    ${prods.map((p) => `<div class="fade"><h2 class="h3">${esc(tr(p, 'name', lang))}</h2><p class="muted">${esc(tr(p, 'description', lang))}</p>${when(p.requires_design_review, `<p class="small muted">${tx.shop.designReviewNote}</p>`)}</div>`).join('')}
  </div><p class="notice" style="margin-top:36px">${tx.shop.fromGallery}</p></div></section>`;
  return layout(app, { lang, path: '/productos', title: lang === 'en' ? 'Prints, frames and photobooks' : 'Impresiones, cuadros y fotolibros', description: app.content('products_body', lang).slice(0, 155), body });
}

export function contactPage(app, lang, { sent = false } = {}) {
  const tx = t(lang);
  const biz = app.setting('business');
  const faqs = app.db.all('SELECT * FROM faqs WHERE visible = 1 ORDER BY sort');
  const body = `<section><div class="wrap cols-2">
    <div>
      <p class="eyebrow">${tx.nav.contact}</p><h1 style="font-size:clamp(2.1rem,6vw,3.4rem)">${esc(app.content('contact_title', lang))}</h1>
      <p class="lead">${esc(app.content('contact_body', lang))}</p>
      <ul class="conditions">
        <li>WhatsApp: <a href="${esc(biz.whatsapp)}" target="_blank" rel="noopener">${esc(biz.phone)}</a></li>
        <li>${lang === 'en' ? 'Phone' : 'Teléfono'}: <a href="tel:+52${esc(String(biz.phone).replace(/\D/g, ''))}">${esc(biz.phone)}</a></li>
        <li>Instagram: <a href="${esc(biz.instagram)}" target="_blank" rel="noopener">@estefaniatorresfotografia</a></li>
        <li><address style="font-style:normal">${list(biz.address, (l) => esc(l), '<br>')}</address></li>
        ${when(biz.email, `<li><a href="mailto:${esc(biz.email)}">${esc(biz.email)}</a></li>`)}
      </ul>
      <p class="small muted" style="margin-top:16px">${esc(app.content('travel_note', lang))}</p>
    </div>
    <div class="box">
      ${sent ? `<p class="notice" role="status">${tx.forms.sent}</p>` : ''}
      <form class="form" method="post" action="${P(app, lang, '/contacto')}" data-validate novalidate>
        <div class="field"><label for="c-name">${tx.forms.name}</label><input class="input" id="c-name" name="name" required autocomplete="name"></div>
        <div class="field"><label for="c-email">${tx.forms.email}</label><input class="input" id="c-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="c-phone">${tx.forms.phone}</label><input class="input" id="c-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="c-msg">${tx.forms.message}</label><textarea class="input" id="c-msg" name="message" required></textarea></div>
        <label class="check"><input type="checkbox" name="privacy" value="1" required> <span>${tx.booking.privacy} <a href="${P(app, lang, '/politicas/privacidad')}">${tx.footer.privacy}</a></span></label>
        <input type="text" name="website" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">
        <button class="btn btn--solid" type="submit">${tx.cta.send}</button>
        <p class="status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div></section>
  ${when(faqs.length, `<section class="band" id="preguntas"><div class="wrap narrow"><h2>${lang === 'en' ? 'Frequently asked questions' : 'Preguntas frecuentes'}</h2>
    ${faqs.map((f) => `<details style="border-bottom:1px solid var(--line);padding:16px 0"><summary style="cursor:pointer;font-family:var(--serif);font-size:1.3rem">${esc(tr(f, 'q', lang))}</summary><p style="margin-top:10px" class="muted">${esc(tr(f, 'a', lang))}</p></details>`).join('')}
  </div></section>`)}`;
  const ld = faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: tr(f, 'q', lang), acceptedAnswer: { '@type': 'Answer', text: tr(f, 'a', lang) } })) }] : [];
  return layout(app, { lang, path: '/contacto', title: lang === 'en' ? 'Contact & FAQ | Estefanía Torres Photography' : 'Contacto y preguntas frecuentes | Estefanía Torres Fotografía', description: app.content('contact_body', lang), body, jsonld: [localBusinessLd(app, lang), ...ld] });
}

const POLICY_KEYS = { privacidad: ['policy_privacy', 'privacy'], reservas: ['policy_bookings', 'bookings'], compras: ['policy_purchases', 'purchases'], imagen: ['policy_image', 'image'] };
export function policyPage(app, lang, slug) {
  const def = POLICY_KEYS[slug];
  if (!def) return null;
  const title = t(lang).footer[def[1]];
  const text = app.content(def[0], lang);
  const reviewed = app.setting('policies_reviewed')?.[def[0]];
  const body = `<section><div class="wrap narrow">
    <p class="eyebrow">${t(lang).footer.policies}</p><h1 style="font-size:clamp(2rem,5vw,3rem)">${esc(title)}</h1>
    ${when(!reviewed, `<p class="notice small">${lang === 'en' ? 'Preliminary version under review.' : 'Versión preliminar en revisión.'}</p>`)}
    ${rich(text)}
  </div></section>`;
  return layout(app, { lang, path: `/politicas/${slug}`, title: `${title} | Estefanía Torres`, description: title, body });
}

export function notFoundPage(app, lang) {
  const body = `<section><div class="wrap narrow center"><h1>${t(lang).common.notFound}</h1><a class="btn" href="${P(app, lang, '/')}">${t(lang).nav.home}</a></div></section>`;
  return layout(app, { lang, path: '/404', title: t(lang).common.notFound, description: '', body, noindex: true });
}
