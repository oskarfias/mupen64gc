/* Panel: menú en celular y confirmaciones. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('[data-menu]'), nav = document.getElementById('a-nav');
    if (b && nav) b.addEventListener('click', function () { var o = nav.classList.toggle('open'); b.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-confirm]');
      if (f && !window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    }, true);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-confirm]');
      if (btn && !window.confirm(btn.getAttribute('data-confirm'))) e.preventDefault();
    }, true);
  });
})();
