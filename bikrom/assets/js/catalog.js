/* Filtros del catálogo: área, tipo y buscador. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-filters]');
    if (!root) return;
    var state = { area: '', type: '', q: '' };
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-product]'));
    var groups = document.querySelectorAll('[data-group]');
    var count = root.querySelector('[data-filter-count]');
    var empty = document.querySelector('[data-filter-empty]');
    var search = root.querySelector('[data-filter-search]');

    function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    function apply() {
      var q = norm(state.q);
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!state.area || c.dataset.area === state.area) &&
          (!state.type || (' ' + c.dataset.types + ' ').indexOf(' ' + state.type + ' ') > -1) &&
          (!q || norm(c.dataset.search).indexOf(q) > -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector('[data-product]:not([hidden])'); });
      count.textContent = shown + (shown === 1 ? ' solución' : ' soluciones');
      empty.hidden = shown > 0;
      var params = new URLSearchParams();
      if (state.area) params.set('area', state.area);
      if (state.type) params.set('tipo', state.type);
      if (state.q) params.set('q', state.q);
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }

    function setChip(attr, value) {
      root.querySelectorAll('[' + attr + ']').forEach(function (b) {
        var on = b.getAttribute(attr) === value;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }

    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-filter-area]');
      var t = e.target.closest('[data-filter-type]');
      if (a) { state.area = a.getAttribute('data-filter-area'); setChip('data-filter-area', state.area); apply(); }
      if (t) { state.type = t.getAttribute('data-filter-type'); setChip('data-filter-type', state.type); apply(); }
    });
    search.addEventListener('input', function () { state.q = search.value.trim(); apply(); });

    var p = new URLSearchParams(location.search);
    state.area = p.get('area') || '';
    state.type = p.get('tipo') || '';
    state.q = p.get('q') || '';
    search.value = state.q;
    setChip('data-filter-area', state.area);
    setChip('data-filter-type', state.type);
    apply();
    if (state.area) {
      var g = document.getElementById(state.area);
      if (g) setTimeout(function () { root.scrollIntoView({ block: 'start' }); }, 0);
    }
  });
})();
