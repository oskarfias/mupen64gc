/* Tienda de la galería: producto → tamaño → foto → encuadre → cantidad → pedido.
   El encuadre lo ajusta la persona; no se recorta nada automáticamente. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-shop]');
    if (!root) return;
    var D = JSON.parse(document.getElementById('shop-data').textContent);
    var $ = function (s) { return document.querySelector(s); };
    var KEY = 'etf_cart_' + location.pathname;
    var state = { product: null, variant: null, photos: [], crop: null, fit: false, landscape: false };
    var cart = [];
    try { cart = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) {}
    var photoById = {};
    D.photos.forEach(function (p) { photoById[p.id] = p; });

    var selP = $('[data-product]'), selV = $('[data-variant]'), picker = $('[data-picker]');
    selP.innerHTML = D.products.map(function (p) { return '<option value="' + p.id + '">' + p.name + '</option>'; }).join('');
    picker.innerHTML = D.photos.map(function (p) {
      return '<label><input type="checkbox" value="' + p.id + '" aria-label="Foto ' + p.id + '"><img src="' + p.thumb + '" alt="" loading="lazy"></label>';
    }).join('');

    function product() { return D.products.find(function (p) { return String(p.id) === selP.value; }); }
    function variant() { var p = product(); return p && p.variants.find(function (v) { return String(v.id) === selV.value; }); }
    function isBook() { var p = product(); return p && p.max > 1; }

    function syncProduct() {
      var p = product();
      selV.innerHTML = p.variants.map(function (v) { return '<option value="' + v.id + '">' + v.label + ' — ' + v.priceLabel + '</option>'; }).join('');
      $('[data-book-note]').hidden = !isBook();
      $('[data-crop-area]').hidden = isBook();
      $('[data-book-order]').hidden = !isBook();
      $('[data-review]').hidden = !p.review;
      state.photos = state.photos.slice(0, isBook() ? p.max : 1);
      syncPicker();
      update();
    }
    function syncPicker() {
      picker.querySelectorAll('input').forEach(function (c) { c.checked = state.photos.indexOf(Number(c.value)) > -1; });
      renderBookOrder();
    }
    picker.addEventListener('change', function (e) {
      var id = Number(e.target.value);
      if (!isBook()) { state.photos = e.target.checked ? [id] : []; state.crop = null; }
      else if (e.target.checked) { if (state.photos.length < product().max) state.photos.push(id); }
      else state.photos = state.photos.filter(function (x) { return x !== id; });
      syncPicker();
      update();
    });
    function renderBookOrder() {
      var ul = $('[data-book-order]');
      ul.innerHTML = state.photos.map(function (id, i) {
        return '<li><img src="' + photoById[id].thumb + '" alt=""><span>' + (i + 1) + '</span>' +
          '<button type="button" class="link" data-up="' + i + '" style="background:none;border:0;cursor:pointer">' + D.msgs.up + '</button>' +
          '<button type="button" class="link" data-down="' + i + '" style="background:none;border:0;cursor:pointer">' + D.msgs.down + '</button></li>';
      }).join('');
    }
    $('[data-book-order]').addEventListener('click', function (e) {
      var up = e.target.getAttribute('data-up'), down = e.target.getAttribute('data-down');
      var i = Number(up != null ? up : down), j = up != null ? i - 1 : i + 1;
      if ((up == null && down == null) || j < 0 || j >= state.photos.length) return;
      var t = state.photos[i]; state.photos[i] = state.photos[j]; state.photos[j] = t;
      renderBookOrder();
    });

    // ── Encuadre ──
    var stage = $('[data-crop-stage]'), img = $('[data-crop-img]');
    var drag = null, offset = { x: 0, y: 0 }, scale = 1;
    function ratio() {
      var v = variant();
      var w = v && v.w ? v.w : 4, h = v && v.h ? v.h : 5;
      var portrait = Math.max(w, h) === h ? [w, h] : [h, w];
      return state.landscape ? portrait[1] / portrait[0] : portrait[0] / portrait[1];
    }
    function layoutCrop() {
      var p = photoById[state.photos[0]];
      if (!p || isBook()) { stage.style.display = 'none'; return; }
      stage.style.display = '';
      var W = Math.min(stage.parentElement.clientWidth, 520);
      var H = W / ratio();
      stage.style.width = W + 'px'; stage.style.height = H + 'px';
      if (img.getAttribute('data-src') !== p.preview) { img.src = p.preview; img.setAttribute('data-src', p.preview); offset = { x: 0, y: 0 }; }
      var iw = p.w || 1000, ih = p.h || 1000;
      scale = state.fit ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
      var dw = iw * scale, dh = ih * scale;
      var maxX = Math.max(0, (dw - W) / 2), maxY = Math.max(0, (dh - H) / 2);
      offset.x = Math.max(-maxX, Math.min(maxX, offset.x));
      offset.y = Math.max(-maxY, Math.min(maxY, offset.y));
      img.style.width = dw + 'px'; img.style.height = dh + 'px';
      img.style.left = ((W - dw) / 2 + offset.x) + 'px'; img.style.top = ((H - dh) / 2 + offset.y) + 'px';
      // Recorte normalizado sobre la imagen original
      var left = -((W - dw) / 2 + offset.x) / dw, top = -((H - dh) / 2 + offset.y) / dh;
      state.crop = state.fit ? { x: 0, y: 0, w: 1, h: 1 } : { x: Math.max(0, left), y: Math.max(0, top), w: Math.min(1, W / dw), h: Math.min(1, H / dh) };
    }
    stage.addEventListener('pointerdown', function (e) { if (state.fit) return; drag = { x: e.clientX - offset.x, y: e.clientY - offset.y }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) { if (!drag) return; offset = { x: e.clientX - drag.x, y: e.clientY - drag.y }; layoutCrop(); });
    stage.addEventListener('pointerup', function () { drag = null; });
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', 'Encuadre: usa las flechas para mover');
    stage.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
      if (!d) return; e.preventDefault(); offset.x += d[0]; offset.y += d[1]; layoutCrop();
    });
    $('[data-fit]').addEventListener('change', function (e) { state.fit = e.target.checked; layoutCrop(); });
    $('[data-orient]').addEventListener('click', function () { state.landscape = !state.landscape; offset = { x: 0, y: 0 }; layoutCrop(); });
    window.addEventListener('resize', layoutCrop);

    function lowRes() {
      var v = variant(), warn = $('[data-lowres]');
      warn.hidden = true;
      if (!v || !v.w || !v.h) return;
      var low = state.photos.some(function (id) {
        var p = photoById[id]; if (!p || !p.w) return false;
        var longPx = Math.max(p.w, p.h), longCm = Math.max(v.w, v.h);
        return longPx / (longCm / 2.54) < (D.shop.dpi_min || 150);
      });
      if (low) { warn.textContent = D.msgs.lowRes; warn.hidden = false; }
    }
    function update() {
      var v = variant(), q = Math.max(1, Math.min(50, Number($('[data-qty]').value) || 1));
      $('[data-price]').textContent = v ? new Intl.NumberFormat('en-US').format((v.price * q) / 100).replace(/^/, '$') + ' MXN' : '—';
      layoutCrop(); lowRes();
    }
    selP.addEventListener('change', syncProduct);
    selV.addEventListener('change', function () { offset = { x: 0, y: 0 }; update(); });
    $('[data-qty]').addEventListener('input', update);

    // ── Pedido ──
    function saveCart() { try { sessionStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} renderCart(); }
    function renderCart() {
      var ul = $('[data-cart]');
      if (!cart.length) { ul.innerHTML = '<li class="muted">' + D.msgs.empty + '</li>'; $('[data-subtotal]').textContent = ''; return; }
      var total = 0;
      ul.innerHTML = cart.map(function (it, i) {
        total += it.price * it.qty;
        return '<li><img src="' + photoById[it.photos[0].file_id].thumb + '" alt=""><span style="flex:1">' + it.label + ' × ' + it.qty +
          (it.photos.length > 1 ? ' (' + it.photos.length + ')' : '') + '</span><button type="button" class="link" data-remove="' + i + '" style="background:none;border:0;cursor:pointer">' + D.msgs.remove + '</button></li>';
      }).join('');
      $('[data-subtotal]').textContent = 'Subtotal: $' + new Intl.NumberFormat('en-US').format(total / 100) + ' MXN';
    }
    $('[data-cart]').addEventListener('click', function (e) { var i = e.target.getAttribute('data-remove'); if (i != null) { cart.splice(Number(i), 1); saveCart(); } });
    $('[data-add]').addEventListener('click', function () {
      var p = product(), v = variant();
      if (!v || state.photos.length < p.min) { $('[data-status]').textContent = D.msgs.invalid; return; }
      var orient = state.landscape ? 'landscape' : 'portrait';
      cart.push({
        variantId: v.id, qty: Math.max(1, Math.min(50, Number($('[data-qty]').value) || 1)), price: v.price, label: p.name + ' · ' + v.label,
        photos: state.photos.map(function (id) { return { file_id: id, crop: isBook() ? null : state.crop, fit: state.fit ? 'fit' : 'crop', orientation: orient }; }),
        instructions: $('[data-instructions]').value,
      });
      saveCart();
      $('[data-cart]').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    var form = $('[data-checkout]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('[data-status]');
      var bad = null;
      form.querySelectorAll('input').forEach(function (el) { var ok = el.checkValidity(); el.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = el; });
      if (bad || !cart.length) { st.textContent = cart.length ? D.msgs.invalid : D.msgs.empty; if (bad) bad.focus(); return; }
      var fd = new FormData(form), f = {}; fd.forEach(function (v, k) { f[k] = v; });
      var btn = form.querySelector('[type=submit]'); btn.disabled = true;
      fetch(D.order, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        lang: D.lang, items: cart.map(function (c) { return { variantId: c.variantId, qty: c.qty, photos: c.photos, instructions: c.instructions }; }),
        contact: { name: f.name, email: f.email, phone: f.phone }, address: { street: f.street, neighborhood: f.neighborhood, city: f.city, state: f.state, zip: f.zip, country: f.country },
      }) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function (j) { cart = []; saveCart(); location.href = j.redirect; })
        .catch(function (j) { st.textContent = (j && j.message) || D.msgs.error; btn.disabled = false; });
    });

    syncProduct();
    renderCart();
  });
})();
