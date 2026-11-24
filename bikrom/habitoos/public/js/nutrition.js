/* Alimentación por equivalentes: tocar un emoji marca una porción; tocar la última marcada la quita.
   Guardado inmediato e idempotente (requestId); la pantalla se actualiza con la respuesta del servidor. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-food]');
    if (!root) return;
    var date = root.getAttribute('data-date');
    var T = JSON.parse(document.getElementById('food-i18n').textContent);
    var toast = document.querySelector('[data-toast]'), toastText = document.querySelector('[data-toast-text]'), timer;
    var busy = false;
    function rid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 64); }
    function fmt(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); }
    function show(msg) { toastText.textContent = msg; toast.hidden = false; clearTimeout(timer); timer = setTimeout(function () { toast.hidden = true; }, 2500); }
    function render(d) {
      d.meals.forEach(function (m) {
        m.items.forEach(function (it) {
          var row = root.querySelector('[data-item][data-slot="' + m.slot + '"][data-group="' + it.group_id + '"]');
          if (!row) return;
          var btns = row.querySelectorAll('.pt');
          btns.forEach(function (b, k) {
            var half = b.classList.contains('pt--half');
            var on = it.done >= (half ? k + 0.5 : k + 1);
            b.classList.toggle('pt--on', on); b.setAttribute('aria-pressed', String(on));
          });
          row.querySelector('[data-count]').textContent = fmt(it.done) + '/' + fmt(it.planned);
        });
      });
      root.querySelectorAll('[data-extra]').forEach(function (el) {
        el.querySelector('[data-extra-count]').textContent = fmt(d.extra[el.getAttribute('data-group')] || 0);
      });
      var s = d.summary;
      var set = function (k, v) { var el = document.querySelector('[data-sum=' + k + ']'); if (el) el.textContent = v; };
      set('covered', fmt(s.covered) + '/' + fmt(s.planned)); set('pct', s.adherence == null ? '—' : Math.round(s.adherence) + '%'); set('extra', fmt(s.extra));
      var bar = document.querySelector('[data-sum-bar]'); if (bar) bar.style.width = (s.planned ? Math.min(100, Math.round(s.covered / s.planned * 100)) : 0) + '%';
      d.totals.forEach(function (x) { var el = document.querySelector('[data-total="' + x.group_id + '"]'); if (el) el.textContent = fmt(x.in_plan) + '/' + fmt(x.planned) + (x.extra ? ' +' + fmt(x.extra) : ''); });
    }
    function send(action, body, msg) {
      if (busy) return; busy = true;
      if (action === 'add') body.requestId = rid();
      HOS.api('POST', '/nutrition/day/' + date + '/' + action, body)
        .then(function (d) { render(d); show(msg); }, function () { show(T.error); })
        .then(function () { busy = false; });
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-add],[data-remove]');
      if (!b) return;
      var body = { meal_slot: b.getAttribute('data-slot') || null, group_id: b.getAttribute('data-group'), portions: Number(b.getAttribute('data-portions') || 1) };
      var inPlan = b.closest('[data-item]');
      if (b.hasAttribute('data-remove') || (inPlan && b.classList.contains('pt--on'))) send('remove', body, T.removed);
      else send('add', body, T.saved);
    });
  });
})();
