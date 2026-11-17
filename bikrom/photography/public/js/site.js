/* Funciones comunes del sitio público. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    var btn = document.querySelector('[data-menu]');
    var nav = document.getElementById('nav');
    if (btn && nav) {
      btn.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
    }

    // Preferencia de idioma: se recuerda al usar el selector
    document.querySelectorAll('[data-lang]').forEach(function (a) {
      a.addEventListener('click', function () {
        document.cookie = 'etf_lang=' + a.getAttribute('data-lang') + '; Path=/photography; Max-Age=31536000; SameSite=Lax';
      });
    });

    // Aparición suave
    var els = document.querySelectorAll('.fade');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -6% 0px' });
      els.forEach(function (el) { io.observe(el); });
    } else els.forEach(function (el) { el.classList.add('in'); });

    // Validación accesible de formularios simples
    document.querySelectorAll('form[data-validate]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        var first = null;
        f.querySelectorAll('input, select, textarea').forEach(function (el) {
          var ok = el.checkValidity();
          el.setAttribute('aria-invalid', String(!ok));
          if (!ok && !first) first = el;
        });
        if (first) { e.preventDefault(); first.focus(); }
      });
    });

    // Espera de confirmación del proveedor de pago
    if (document.querySelector('[data-refresh]')) {
      var n = 0;
      var t = setInterval(function () {
        if (++n > 24) return clearInterval(t);
        fetch(location.pathname, { headers: { 'X-Refresh': '1' } }).then(function (r) { return r.text(); }).then(function (html) {
          if (html.indexOf('data-refresh') === -1) location.replace(location.pathname);
        }).catch(function () {});
      }, 5000);
    }
  });
})();
