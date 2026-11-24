/* Today: registro en 1–2 toques con autoguardado idempotente y deshacer. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var list = document.querySelector('[data-day]');
    if (!list) return;
    var day = list.getAttribute('data-day');
    var T = JSON.parse(document.getElementById('i18n').textContent);
    var toast = document.querySelector('[data-toast]'), toastText = document.querySelector('[data-toast-text]');
    var lastHabit = null, timer = null;
    function rid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 64); }
    function show(msg, undo) {
      toastText.textContent = msg; toast.hidden = false;
      document.querySelector('[data-toast-undo]').hidden = !undo;
      clearTimeout(timer); timer = setTimeout(function () { toast.hidden = true; }, 5000);
    }
    function apply(li, occ) {
      li.setAttribute('data-status', occ.status);
      var st = li.querySelector('[data-state]');
      st.textContent = T.states[occ.status] || occ.status;
      st.className = 'state state--' + occ.status;
      var input = li.querySelector('[data-value]');
      if (input && document.activeElement !== input) input.value = occ.value == null ? '' : occ.value;
      li.querySelectorAll('[data-log]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-log') === occ.status)); });
    }
    function send(li, body) {
      var id = li.getAttribute('data-habit');
      body.requestId = rid();
      return HOS.api('PUT', '/habits/' + id + '/log/' + day, body).then(function (occ) { apply(li, occ); lastHabit = li; show(T.saved, true); refreshSummary(); })
        .catch(function (e) { show(T.error, false); });
    }
    function refreshSummary() {
      HOS.api('GET', '/daily/' + day).then(function (d) {
        var s = d.summary;
        var set = function (k, v) { var el = document.querySelector('[data-sum=' + k + ']'); if (el) el.textContent = v; };
        set('evaluated', s.evaluated); set('pending', s.pending + s.no_data); set('coverage', s.coverage == null ? '—' : s.coverage + '%');
      }).catch(function () {});
    }
    list.addEventListener('click', function (e) {
      var li = e.target.closest('[data-habit]');
      if (!li) return;
      var log = e.target.closest('[data-log]');
      if (log) { send(li, { status: log.getAttribute('data-log') }); return; }
      if (e.target.closest('[data-undo]')) { undo(li); return; }
      var step = e.target.closest('[data-step]');
      if (step) {
        var input = li.querySelector('[data-value]');
        var v = Math.max(0, (Number(input.value) || 0) + Number(step.getAttribute('data-step')));
        input.value = v;
        clearTimeout(li._t); li._t = setTimeout(function () { send(li, { value: v }); }, 500); // agrupa toques seguidos
      }
    });
    list.addEventListener('change', function (e) {
      if (!e.target.matches('[data-value]')) return;
      var li = e.target.closest('[data-habit]');
      if (e.target.value === '') return;
      send(li, { value: Number(e.target.value) });
    });
    function undo(li) {
      HOS.api('POST', '/habits/' + li.getAttribute('data-habit') + '/log/' + day + '/undo').then(function (occ) { apply(li, occ); toast.hidden = true; refreshSummary(); }).catch(function () { show(T.error, false); });
    }
    document.querySelector('[data-toast-undo]').addEventListener('click', function () { if (lastHabit) undo(lastHabit); });
  });
})();
