// Mi sesión, galería privada, tienda de la galería y seguimiento de pedidos.
import { esc, when } from '../html.mjs';
import { layout, P } from '../layout.mjs';
import { t } from '../../i18n.mjs';
import { json } from '../../db.mjs';
import { mxn } from '../../lib/money.mjs';
import { formatDateTime } from '../../lib/time.mjs';
import { batches } from '../../lib/zip.mjs';
import { galleryFiles } from '../../domain/gallery.mjs';
import { catalog } from '../../domain/shop.mjs';

export function mySessionPage(app, lang, { error = null, slug = null } = {}) {
  const tx = t(lang);
  const action = slug ? P(app, lang, `/galeria/${slug}`) : P(app, lang, '/mi-sesion');
  const body = `<section><div class="wrap narrow center">
    <p class="eyebrow">${tx.gallery.title}</p>
    <h1 style="font-size:clamp(2rem,6vw,3.2rem)">${esc(app.content('my_session_title', lang))}</h1>
    <p class="lead" style="margin:0 auto 28px">${tx.gallery.intro}</p>
    <form method="post" action="${action}" class="form" style="max-width:420px;margin:0 auto;text-align:left">
      <div class="field"><label for="code">${tx.gallery.code}</label>
        <input class="input" id="code" name="code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" style="letter-spacing:.12em;font-size:1.15rem"${error ? ' aria-invalid="true" aria-describedby="code-err"' : ''}></div>
      ${when(error, `<p class="status error" id="code-err" role="alert">${esc(error)}</p>`)}
      <button class="btn btn--solid btn--block" type="submit">${tx.cta.enter}</button>
    </form>
  </div></section>`;
  return layout(app, { lang, path: slug ? `/galeria/${slug}` : '/mi-sesion', title: `${tx.gallery.title} | Estefanía Torres`, description: tx.gallery.intro, body, noindex: Boolean(slug) });
}

export function galleryPage(app, lang, g) {
  const tx = t(lang);
  const files = galleryFiles(app, g.id);
  const photos = files.filter((f) => f.kind === 'photo');
  const videos = files.filter((f) => f.kind === 'video');
  const maxBatch = Math.min(3500, app.setting('gallery').zip_batch_mb || 2048) * 1024 * 1024;
  const parts = batches(files, maxBatch);
  const big = files.filter((f) => f.original_size >= 0xffffffff - 1024);
  const cover = files.find((f) => f.id === g.cover_file_id) || photos[0];
  const base = `${app.base}/g/${g.slug}`;
  const shop = catalog(app).length > 0;
  const body = `
<section class="gallery-head" style="padding-bottom:0">
  ${cover ? `<figure class="ph r-hero" style="max-height:78vh"><img src="${base}/f/${cover.id}/preview" alt="" fetchpriority="high"></figure>` : ''}
  <div class="wrap narrow center" style="padding-top:40px">
    <p class="eyebrow">${tx.gallery.title}</p>
    <h1 style="font-size:clamp(2.1rem,6vw,3.4rem)">${esc(g.title)}</h1>
    ${when(g.message, `<p class="lead" style="margin:0 auto">${esc(g.message)}</p>`)}
    <p class="muted" style="margin-top:16px">${tx.gallery.expiresOn} <strong>${esc(formatDateTime(g.expires_at, lang))}</strong></p>
    <p class="small muted">${tx.gallery.keepNote}</p>
    <div class="btn-row" style="justify-content:center;margin-top:20px">
      <a class="btn btn--solid" href="#descargas">${tx.cta.downloadAll}</a>
      <button class="btn" type="button" data-share="${esc(app.siteUrl + P(app, lang, `/galeria/${g.slug}`))}" data-copied="${esc(tx.gallery.copied)}">${tx.cta.share}</button>
      ${when(shop, `<a class="btn" href="${P(app, lang, `/galeria/${g.slug}/tienda`)}">${tx.cta.buy}</a>`)}
    </div>
    <p class="small muted" style="margin-top:12px">${tx.gallery.shareNote}</p>
  </div>
</section>
<section style="padding-top:40px"><div class="wrap">
  ${when(photos.length, `<h2 class="sr-only">${tx.gallery.photos}</h2><div class="gallery-grid" data-gallery>
    ${photos.map((f, i) => `<a href="${base}/f/${f.id}/preview" data-index="${i}" data-id="${f.id}" data-download="${base}/f/${f.id}/original">
      <img src="${base}/f/${f.id}/thumb" alt="${esc(`${tx.gallery.photos} ${i + 1}`)}" loading="lazy" decoding="async"${f.width ? ` width="${f.width}" height="${f.height}"` : ''}></a>`).join('')}
  </div>`)}
  ${when(videos.length, `<h2 class="h3" style="margin-top:48px">${tx.gallery.videos}</h2><div class="cols-2">
    ${videos.map((v) => `<figure style="margin:0"><video controls preload="none" playsinline style="width:100%;background:var(--sand)"${v.thumb_key ? ` poster="${base}/f/${v.id}/thumb"` : ''}><source src="${base}/f/${v.id}/stream" type="${esc(v.mime || 'video/mp4')}"></video>
      <figcaption class="small"><a href="${base}/f/${v.id}/original">${tx.cta.download} ${esc(v.filename)}</a></figcaption></figure>`).join('')}
  </div>`)}
</div></section>
<section class="band" id="descargas"><div class="wrap narrow">
  <h2 class="h3">${tx.cta.downloadAll}</h2>
  ${parts.length > 1 ? `<p class="muted">${tx.gallery.batchNote}</p>` : ''}
  <ul class="batches" data-batches>
    ${parts.map((p, i) => {
      const size = p.reduce((s, f) => s + f.original_size, 0);
      return `<li><span>${parts.length > 1 ? `${tx.gallery.part} ${i + 1} ${tx.gallery.of} ${parts.length}` : esc(g.title)} · ${p.length} ${lang === 'en' ? 'files' : 'archivos'} · ${(size / 1048576).toFixed(0)} MB</span>
        <a class="btn" href="${base}/zip/${i + 1}" download data-batch>${tx.cta.download}</a></li>`;
    }).join('')}
    ${big.map((f) => `<li><span>${tx.gallery.bigFile}: ${esc(f.filename)}</span><a class="btn" href="${base}/f/${f.id}/original">${tx.cta.download}</a></li>`).join('')}
  </ul>
  <p class="small muted" style="margin-top:16px">${lang === 'en' ? 'On a phone, you can also open each photo and download it individually.' : 'En celular también puedes abrir cada fotografía y descargarla de forma individual.'}</p>
  <form method="post" action="${P(app, lang, `/galeria/${g.slug}/salir`)}" style="margin-top:24px"><button class="link" style="background:none;border:0;cursor:pointer">${tx.gallery.logout}</button></form>
</div></section>
<div class="viewer" hidden data-viewer role="dialog" aria-modal="true" aria-label="${tx.gallery.photos}">
  <div class="viewer-top"><span data-counter class="small muted"></span><button class="btn" type="button" data-close>${tx.gallery.closeViewer}</button></div>
  <div class="viewer-stage"><img alt="" data-view-img></div>
  <div class="viewer-bottom"><button class="btn" type="button" data-prev>${tx.gallery.prev}</button><a class="btn btn--solid" data-view-download href="#">${tx.cta.download}</a><button class="btn" type="button" data-next>${tx.gallery.nextPhoto}</button></div>
</div>`;
  return layout(app, { lang, path: `/galeria/${g.slug}`, title: `${g.title} | ${tx.gallery.title}`, description: '', body, noindex: true, scripts: ['js/gallery.js'], showWhatsapp: false });
}

export function expiredPage(app, lang) {
  const tx = t(lang);
  const body = `<section><div class="wrap narrow center"><h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.gallery.expired}</h1><p class="lead" style="margin:0 auto 24px">${tx.gallery.expiredText}</p>
    <a class="btn" href="${esc(app.setting('business').whatsapp)}" target="_blank" rel="noopener">${tx.cta.whatsapp}</a></div></section>`;
  return layout(app, { lang, path: '/mi-sesion', title: tx.gallery.expired, description: '', body, noindex: true });
}

export function shopPage(app, lang, g) {
  const tx = t(lang);
  const products = catalog(app);
  const photos = galleryFiles(app, g.id).filter((f) => f.kind === 'photo');
  const base = `${app.base}/g/${g.slug}`;
  const data = {
    lang, order: P(app, lang, `/galeria/${g.slug}/pedido`), shop: app.setting('shop'),
    products: products.map((p) => ({ id: p.id, kind: p.kind, name: lang === 'en' ? p.name_en : p.name_es, min: p.min_photos, max: p.max_photos, review: !!p.requires_design_review,
      variants: p.variants.map((v) => ({ id: v.id, label: `${v.size_label}${(lang === 'en' ? v.finish_en : v.finish_es) ? ' · ' + (lang === 'en' ? v.finish_en : v.finish_es) : ''}`, w: v.width_cm, h: v.height_cm, price: v.price_cents, priceLabel: mxn(v.price_cents) })) })),
    photos: photos.map((f) => ({ id: f.id, thumb: `${base}/f/${f.id}/thumb`, preview: `${base}/f/${f.id}/preview`, w: f.width, h: f.height })),
    msgs: { lowRes: tx.shop.lowRes, empty: tx.shop.empty, error: tx.common.error, invalid: tx.forms.invalid, remove: lang === 'en' ? 'Remove' : 'Quitar', up: lang === 'en' ? 'Move up' : 'Subir', down: lang === 'en' ? 'Move down' : 'Bajar', shippingPending: tx.shop.shippingPending },
  };
  const body = `<section style="padding-top:40px"><div class="wrap">
    <p class="eyebrow"><a href="${P(app, lang, `/galeria/${g.slug}`)}">${esc(g.title)}</a></p>
    <h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.shop.title}</h1>
    ${!products.length ? `<p class="lead">${tx.shop.soon}</p>` : `
    <div class="cols-2" data-shop>
      <div>
        <div class="field"><label for="s-product">${tx.shop.product}</label><select class="input" id="s-product" data-product></select></div>
        <div class="field" style="margin-top:14px"><label for="s-variant">${tx.shop.size}</label><select class="input" id="s-variant" data-variant></select></div>
        <fieldset class="field" style="margin-top:14px"><legend>${tx.shop.choosePhoto}</legend><p class="small muted" data-book-note hidden>${tx.shop.bookOrder}</p><div class="photo-picker" data-picker></div></fieldset>
      </div>
      <div>
        <div data-crop-area>
          <p class="field" style="margin:0"><span class="small muted" style="letter-spacing:.08em;text-transform:uppercase">${tx.shop.crop}</span></p>
          <div class="crop-stage" data-crop-stage><img alt="" data-crop-img><div class="crop-frame"></div></div>
          <div class="btn-row" style="margin-top:10px">
            <label class="check"><input type="checkbox" data-fit> <span>${tx.shop.fit}</span></label>
            <button type="button" class="btn" data-orient>${tx.shop.orientation}</button>
          </div>
          <p class="small muted">${lang === 'en' ? 'Drag the photo to adjust the framing. Nothing is cropped automatically.' : 'Arrastra la fotografía para ajustar el encuadre. Nada se recorta automáticamente.'}</p>
          <p class="notice small" data-lowres hidden></p>
        </div>
        <ul class="order-list" data-book-order hidden></ul>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label for="s-qty">${tx.shop.qty}</label><input class="input" id="s-qty" type="number" min="1" max="50" value="1" data-qty></div>
          <div class="field"><span class="small muted" style="letter-spacing:.08em;text-transform:uppercase">${lang === 'en' ? 'Price' : 'Precio'}</span><p class="price" style="font-family:var(--serif);font-size:1.6rem;margin:6px 0 0" data-price>—</p></div>
        </div>
        <div class="field" style="margin-top:14px"><label for="s-ins">${tx.shop.instructions}</label><textarea class="input" id="s-ins" data-instructions></textarea></div>
        <p class="small muted" data-review hidden>${tx.shop.designReviewNote}</p>
        <button type="button" class="btn btn--solid" data-add style="margin-top:14px">${tx.cta.addToCart}</button>
      </div>
    </div>
    <hr class="rule" style="margin:48px 0 32px">
    <div class="cols-2">
      <div><h2 class="h3">${tx.shop.cart}</h2><ul class="order-list" data-cart></ul><p class="price" style="font-family:var(--serif);font-size:1.4rem" data-subtotal></p><p class="small muted">${tx.common.mxn}</p></div>
      <form class="form" data-checkout novalidate>
        <h2 class="h3">${tx.shop.address}</h2>
        <div class="field"><label for="o-name">${tx.forms.name}</label><input class="input" id="o-name" name="name" required autocomplete="name"></div>
        <div class="grid-2"><div class="field"><label for="o-email">${tx.forms.email}</label><input class="input" id="o-email" name="email" type="email" required autocomplete="email"></div>
          <div class="field"><label for="o-phone">${tx.forms.phone}</label><input class="input" id="o-phone" name="phone" type="tel" autocomplete="tel"></div></div>
        <div class="field"><label for="o-street">${tx.shop.street}</label><input class="input" id="o-street" name="street" required autocomplete="address-line1"></div>
        <div class="field"><label for="o-nb">${tx.shop.neighborhood}</label><input class="input" id="o-nb" name="neighborhood" autocomplete="address-line2"></div>
        <div class="grid-2"><div class="field"><label for="o-city">${tx.shop.cityField}</label><input class="input" id="o-city" name="city" required autocomplete="address-level2"></div>
          <div class="field"><label for="o-state">${tx.shop.state}</label><input class="input" id="o-state" name="state" required autocomplete="address-level1"></div></div>
        <div class="grid-2"><div class="field"><label for="o-zip">${tx.shop.zip}</label><input class="input" id="o-zip" name="zip" required inputmode="numeric" autocomplete="postal-code"></div>
          <div class="field"><label for="o-country">${tx.shop.country}</label><input class="input" id="o-country" name="country" value="México" autocomplete="country-name"></div></div>
        <label class="check"><input type="checkbox" name="terms" value="1" required> <span>${lang === 'en' ? 'I accept the' : 'Acepto la'} <a href="${P(app, lang, '/politicas/compras')}" target="_blank">${tx.footer.purchases}</a></span></label>
        <button class="btn btn--solid" type="submit">${tx.shop.placeOrder}</button>
        <p class="status" role="status" aria-live="polite" data-status></p>
      </form>
    </div>
    <script type="application/json" id="shop-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`}
  </div></section>`;
  return layout(app, { lang, path: `/galeria/${g.slug}/tienda`, title: tx.shop.title, description: '', body, noindex: true, scripts: ['js/shop.js'], showWhatsapp: false });
}

export function orderPage(app, lang, order, { flash = null, isAdmin = false } = {}) {
  const tx = t(lang);
  const items = app.db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
  const integ = app.integrations();
  const payable = order.status === 'awaiting_payment' && order.total_cents != null;
  const body = `<section style="padding-top:40px"><div class="wrap narrow"><div class="box">
    <p class="eyebrow">${tx.shop.orderTitle} ${esc(order.token.slice(0, 8).toUpperCase())}</p>
    <h1 style="font-size:clamp(1.8rem,5vw,2.6rem)">${esc(tx.status[order.status] || order.status)}</h1>
    ${when(flash === 'procesando', `<p class="notice" data-refresh>${tx.booking.waitingPayment}</p>`)}
    ${when(flash === 'cancelado', `<p class="notice">${lang === 'en' ? 'The payment was cancelled.' : 'El pago se canceló.'}</p>`)}
    ${when(order.status === 'awaiting_shipping_quote', `<p class="notice">${tx.shop.shippingPending}</p>`)}
    <table class="breakdown"><tbody>
      ${items.map((i) => `<tr><td>${esc(i.description)} <span class="muted">× ${i.qty}</span></td><td>${mxn(i.unit_price_cents * i.qty)}</td></tr>`).join('')}
      <tr><td>${tx.shop.shipping}</td><td>${order.shipping_cents == null ? `<em>${tx.common.pending}</em>` : mxn(order.shipping_cents)}</td></tr>
      ${when(order.total_cents != null, `<tr class="total"><td>${tx.booking.total}</td><td>${mxn(order.total_cents)}</td></tr>`)}
    </tbody></table>
    ${when(order.tracking, `<p style="margin-top:16px">${lang === 'en' ? 'Tracking' : 'Rastreo'}: ${esc(order.carrier || '')} <strong>${esc(order.tracking)}</strong></p>`)}
    ${when(payable, integ.payments ? `<form method="post" action="${P(app, lang, '/pago/iniciar')}" class="btn-row" style="margin-top:20px"><input type="hidden" name="order" value="${order.token}">
        ${when(integ.card, `<button class="btn btn--solid" name="method" value="card">${tx.cta.payCard}</button>`)}${when(integ.paypal, `<button class="btn" name="method" value="paypal">${tx.cta.payPaypal}</button>`)}</form>`
      : `<p class="notice" style="margin-top:20px">${tx.booking.paymentsUnavailable}</p>${when(isAdmin && app.demo(), `<form method="post" action="${P(app, lang, '/pago/demo')}"><input type="hidden" name="order" value="${order.token}"><button class="btn">${lang === 'en' ? 'Simulate provider confirmation (DEMO)' : 'Simular confirmación del proveedor (DEMO)'}</button></form>`)}`)}
    <p class="small muted" style="margin-top:20px">${tx.shop.receipt}: ${esc(formatDateTime(order.created_at, lang))} · ${tx.common.mxn}</p>
  </div></div></section>`;
  return layout(app, { lang, path: `/pedido/${order.token}`, title: tx.shop.orderTitle, description: '', body, noindex: true });
}

export const orderAddress = (o) => json(o.address, {});
