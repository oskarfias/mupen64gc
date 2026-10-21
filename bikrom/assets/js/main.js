/* Bikrom — funciones comunes del sitio. Sin dependencias. */
(function () {
  'use strict';
  var CFG = window.BIKROM || {};
  document.documentElement.classList.add('js');

  // ───────── Almacenamiento seguro ─────────
  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  // ───────── Medición (GA4 + Meta Pixel), solo con consentimiento ─────────
  var queue = [];
  var analyticsReady = false;
  var META_EVENTS = {
    diagnostico_completado: 'Lead',
    llamada_agendada: 'Schedule',
    compra: 'Purchase',
    suscripcion: 'Subscribe',
    solicitud_propuesta: 'Contact',
  };

  function loadAnalytics() {
    if (analyticsReady) return;
    analyticsReady = true;
    if (CFG.ga4Id) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga4Id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', CFG.ga4Id);
    }
    if (CFG.metaPixelId) {
      /* Código base de Meta Pixel */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CFG.metaPixelId);
      window.fbq('track', 'PageView');
    }
    queue.splice(0).forEach(function (e) { send(e[0], e[1]); });
  }

  function send(name, params) {
    params = params || {};
    if (window.gtag) window.gtag('event', name, params);
    if (window.fbq) {
      var meta = META_EVENTS[name];
      var data = {};
      if (params.value != null) { data.value = params.value; data.currency = params.currency || 'MXN'; }
      if (meta) window.fbq('track', meta, data); else window.fbq('trackCustom', name, params);
    }
  }

  // API pública: Bikrom.track('compra', { value: 1490, currency: 'MXN' })
  function track(name, params) {
    if (analyticsReady) send(name, params);
    else queue.push([name, params]);
  }

  // ───────── Consentimiento de cookies ─────────
  function initCookies() {
    var banner = document.querySelector('[data-cookie-banner]');
    var consent = store('bk_consent');
    if (consent === 'accept') loadAnalytics();
    if (!consent && banner) banner.hidden = false;
    document.querySelectorAll('[data-cookie]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-cookie');
        store('bk_consent', v);
        banner.hidden = true;
        if (v === 'accept') loadAnalytics();
        else queue.length = 0;
      });
    });
  }

  // ───────── Carrito ─────────
  var catalogPromise = null;
  function catalog() {
    if (!catalogPromise) catalogPromise = fetch('/assets/catalog.json?v=' + (CFG.v || '')).then(function (r) { return r.json(); });
    return catalogPromise;
  }
  function getCart() { return store('bk_cart') || []; }
  function setCart(items) { store('bk_cart', items); updateCount(); }
  function updateCount() {
    var n = getCart().reduce(function (s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      el.hidden = n === 0;
    });
  }
  function addToCart(sku) {
    var items = getCart();
    var found = items.filter(function (i) { return i.sku === sku; })[0];
    if (found) found.qty += 1; else items.push({ sku: sku, qty: 1 });
    setCart(items);
  }

  function initAddToCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-add-to-cart]');
      if (!btn) return;
      e.preventDefault();
      addToCart(btn.getAttribute('data-add-to-cart'));
      window.location.href = '/carrito/';
    });
  }

  // ───────── Menú móvil ─────────
  function initMenu() {
    var toggle = document.querySelector('[data-menu-toggle]');
    var nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;
    function close() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      if (open) { var first = nav.querySelector('a'); if (first) first.focus(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { close(); toggle.focus(); } });
  }

  // ───────── Aparición al hacer scroll ─────────
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ───────── Botón fijo en celular (página de producto) ─────────
  function initSticky() {
    var bar = document.querySelector('[data-sticky-cta]');
    var hero = document.querySelector('.price-box');
    if (!bar || !hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-visible', !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0);
    }).observe(hero);
  }

  // ───────── Agenda (Calendly / Cal.com) ─────────
  function initBooking() {
    var url = CFG.bookingUrl;
    document.querySelectorAll('[data-booking-frame]').forEach(function (box) {
      if (!url) return;
      var ctx = box.parentElement.getAttribute('data-context') || '';
      var src = url;
      if (/calendly\.com/.test(url)) src += (url.indexOf('?') > -1 ? '&' : '?') + 'hide_gdpr_banner=1&utm_content=' + encodeURIComponent(ctx) + '&embed_domain=' + location.hostname + '&embed_type=Inline';
      else src += (url.indexOf('?') > -1 ? '&' : '?') + 'embed=true&metadata[producto]=' + encodeURIComponent(ctx);
      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = 'Agenda una llamada';
      iframe.loading = 'lazy';
      box.innerHTML = '';
      box.appendChild(iframe);
    });
    // Evento "llamada agendada": Calendly y Cal.com notifican por postMessage.
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      var calendly = d.event === 'calendly.event_scheduled';
      var cal = (d.type === 'bookingSuccessful' || d.type === 'bookingSuccessfulV2') || (d.fullType && /bookingSuccessful/.test(d.fullType));
      if (calendly || cal) {
        track('llamada_agendada', { origen: location.pathname });
        fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'llamada_agendada', pagina: location.pathname }) }).catch(function () {});
      }
    });
  }

  // ───────── Formularios genéricos (boletín, propuesta) ─────────
  function formData(form) {
    var out = {};
    new FormData(form).forEach(function (v, k) { out[k] = typeof v === 'string' ? v.trim() : v; });
    form.querySelectorAll('input[type=checkbox]').forEach(function (c) { out[c.name] = c.checked; });
    return out;
  }
  function validate(form) {
    var ok = true;
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      var valid = el.checkValidity();
      el.setAttribute('aria-invalid', String(!valid));
      if (!valid && ok) { el.focus(); ok = false; }
    });
    return ok;
  }
  function status(form, msg, kind) {
    var s = form.querySelector('.form-status');
    if (!s) return;
    s.textContent = msg;
    s.className = 'form-status' + (kind ? ' is-' + kind : '');
  }
  function postJSON(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Error'); return j; }); });
  }

  function initForms() {
    document.querySelectorAll('[data-api-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(form)) { status(form, 'Revisa los campos marcados.', 'error'); return; }
        var btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        status(form, 'Enviando…');
        var data = formData(form);
        data.pagina = location.pathname;
        postJSON(form.getAttribute('data-api-form'), data)
          .then(function () {
            status(form, form.getAttribute('data-api-form') === '/api/boletin' ? '¡Listo! Ya estás suscrito.' : '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.', 'ok');
            var ev = form.getAttribute('data-event');
            if (ev) track(ev, { producto: data.producto || '' });
            form.reset();
          })
          .catch(function () { status(form, 'No pudimos enviar el formulario. Intenta de nuevo o escríbenos por WhatsApp.', 'error'); })
          .then(function () { btn.disabled = false; });
      });
    });
    // Preselecciona el producto de interés desde ?producto=
    var p = new URLSearchParams(location.search).get('producto');
    if (p) document.querySelectorAll('select[name=producto]').forEach(function (s) { s.value = p; });
  }

  window.Bikrom = { track: track, getCart: getCart, setCart: setCart, addToCart: addToCart, catalog: catalog, postJSON: postJSON, validate: validate, status: status, formData: formData, store: store };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
    updateCount();
    initMenu();
    initReveal();
    initCookies();
    initAddToCart();
    initSticky();
    initBooking();
    initForms();
  });
})();
