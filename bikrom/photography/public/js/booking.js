/* Reserva por pasos y selección de fecha. Conserva respuestas al retroceder (sin guardar datos sensibles). */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function setupForm() {
    var form = $('[data-booking-form]');
    if (!form) return;
    var D = JSON.parse($('#booking-data').textContent);
    var step = 1;
    var status = $('[data-status]');
    var KEY = 'etf_booking_draft';

    function service() { var r = $('input[name=service]:checked', form); return r ? r.value : null; }
    function activeFields() {
      var s = service();
      $$('[data-service-fields]', form).forEach(function (box) {
        var on = box.getAttribute('data-service-fields') === s;
        box.hidden = !on;
        $$('input, select, textarea', box).forEach(function (el) { el.disabled = !on; });
      });
      applyShowIf();
    }
    function applyShowIf() {
      $$('[data-show-if]', form).forEach(function (el) {
        var parts = el.getAttribute('data-show-if').split('=');
        var box = el.closest('[data-service-fields]');
        var src = box && box.querySelector('[name="' + parts[0] + '"]');
        var on = src && src.value === parts[1];
        el.hidden = !on;
        $$('input, select, textarea', el).forEach(function (x) { x.disabled = !on || (box && box.hidden); });
      });
    }
    function show(n) {
      step = n;
      $$('[data-step]', form).forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
      $$('.progress li').forEach(function (li, i) { li.className = i < n - 1 ? 'done' : i === n - 1 ? 'current' : ''; });
      var lbl = $('[data-progress-label]');
      if (lbl) lbl.textContent = n + ' / 3 · ' + D.steps[n - 1];
      var first = $('[data-step="' + n + '"] input:not([disabled]), [data-step="' + n + '"] select:not([disabled]), [data-step="' + n + '"] textarea:not([disabled])', form);
      if (first) first.focus({ preventScroll: true });
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
    }
    function valid(n) {
      var box = $('[data-step="' + n + '"]', form);
      var bad = null;
      $$('input, select, textarea', box).forEach(function (el) {
        if (el.disabled || el.closest('[hidden]')) return;
        var ok = el.checkValidity();
        el.setAttribute('aria-invalid', String(!ok));
        if (!ok && !bad) bad = el;
      });
      if (n === 2 && service() === 'escuelas' && !$$('[data-group-row]', form).length) bad = bad || $('[data-add-group]', form);
      if (bad) { status.textContent = D.msgs.invalid; status.className = 'status error'; bad.focus(); return false; }
      status.textContent = '';
      return true;
    }

    // Grupos escolares
    function addGroup(values) {
      var rows = $('[data-group-rows]', form);
      if (!rows) return;
      var opts = (D.groups.escuelas || []).map(function (p) { return '<option value="' + p[0] + '">' + p[1] + ' — ' + p[2] + '</option>'; }).join('');
      var div = document.createElement('div');
      div.className = 'group-row';
      div.setAttribute('data-group-row', '');
      div.innerHTML = '<input class="input" aria-label="' + D.msgs.group + '" placeholder="' + D.msgs.group + '" required data-g="name">' +
        '<input class="input" type="number" min="1" aria-label="' + D.msgs.student + '" placeholder="' + D.msgs.student + '" required data-g="students">' +
        '<select class="input" data-g="package_key">' + opts + '</select>' +
        '<button type="button" class="link" style="background:none;border:0;cursor:pointer">' + D.msgs.remove + '</button>';
      div.querySelector('button').addEventListener('click', function () { div.remove(); });
      if (values) { div.querySelector('[data-g=name]').value = values.name || ''; div.querySelector('[data-g=students]').value = values.students || ''; if (values.package_key) div.querySelector('[data-g=package_key]').value = values.package_key; }
      rows.appendChild(div);
    }
    var addBtn = $('[data-add-group]', form);
    if (addBtn) addBtn.addEventListener('click', function () { addGroup(); });

    function collect() {
      var data = { answers: {} };
      var fd = new FormData(form);
      fd.forEach(function (v, k) {
        if (['service', 'name', 'phone', 'email', 'privacy', 'portfolio_consent'].indexOf(k) > -1) { data[k] = v; return; }
        if (k.slice(-2) === '[]') { var kk = k.slice(0, -2); (data.answers[kk] = data.answers[kk] || []).push(v); return; }
        data.answers[k] = v;
      });
      data.answers.groups = $$('[data-group-row]', form).filter(function (r) { return !r.closest('[hidden]'); }).map(function (r) {
        return { name: r.querySelector('[data-g=name]').value, students: r.querySelector('[data-g=students]').value, package_key: r.querySelector('[data-g=package_key]').value };
      });
      data.lang = D.lang;
      return data;
    }
    // Borrador en la sesión del navegador (sin datos de contacto)
    function saveDraft() {
      try { var d = collect(); sessionStorage.setItem(KEY, JSON.stringify({ service: d.service, answers: d.answers, step: step })); } catch (e) {}
    }
    function restoreDraft() {
      try {
        var d = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        if (!d) return;
        if (d.service && !service()) { var r = $('input[name=service][value="' + d.service + '"]', form); if (r) r.checked = true; }
        activeFields();
        var box = $('[data-service-fields="' + service() + '"]', form);
        Object.keys(d.answers || {}).forEach(function (k) {
          if (k === 'groups') { (d.answers.groups || []).forEach(addGroup); return; }
          var v = d.answers[k];
          var el = (box && box.querySelector('[name="' + k + '"]')) || form.querySelector('[name="' + k + '"]:not([disabled])');
          if (Array.isArray(v)) $$('[name="' + k + '[]"]', box || form).forEach(function (c) { c.checked = v.indexOf(c.value) > -1; });
          else if (el && el.type !== 'radio') el.value = v;
        });
        applyShowIf();
      } catch (e) {}
    }

    form.addEventListener('change', function (e) { if (e.target.name === 'service') activeFields(); applyShowIf(); saveDraft(); });
    form.addEventListener('input', saveDraft);
    $$('[data-next]', form).forEach(function (b) { b.addEventListener('click', function () {
      if (!valid(step)) return;
      if (step === 1 && service() === 'escuelas' && !$$('[data-group-row]', form).length) addGroup();
      show(step + 1);
    }); });
    $$('[data-prev]', form).forEach(function (b) { b.addEventListener('click', function () { show(step - 1); }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid(3)) return;
      var btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      status.textContent = D.msgs.saving; status.className = 'status';
      fetch(D.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || D.msgs.error); return j; }); })
        .then(function (j) { try { sessionStorage.removeItem(KEY); } catch (e) {} location.href = j.redirect; })
        .catch(function (err) { status.textContent = err.message || D.msgs.error; status.className = 'status error'; btn.disabled = false; });
    });

    activeFields();
    restoreDraft();
    if (service()) activeFields();
  }

  function setupAvailability() {
    var box = $('[data-availability]');
    if (!box) return;
    var M = JSON.parse($('#av-msgs').textContent);
    var date = $('#av-date');
    var time = $('#av-time');
    var slots = $('[data-slots]', box);
    var st = $('[data-av-status]', box);
    var hold = $('[data-hold-btn]', box);
    function check() {
      if (!date.value) { date.focus(); return; }
      st.textContent = M.loading; slots.innerHTML = ''; hold.hidden = true;
      var q = '?cotizacion=' + encodeURIComponent(box.getAttribute('data-token')) + '&fecha=' + date.value + (time && time.value ? '&hora=' + time.value : '');
      fetch(box.getAttribute('data-api') + q).then(function (r) { return r.json(); }).then(function (j) {
        if (j.error === 'calendar_unavailable') { st.textContent = M.calendar; return; }
        if (!j.slots || !j.slots.length) { st.textContent = j.message || M.noSlots; return; }
        st.textContent = '';
        slots.innerHTML = j.slots.map(function (s, i) {
          return '<label><input type="radio" name="slot" value="' + s.start + '"' + (j.slots.length === 1 ? ' checked' : '') + '>' + s.label + '</label>';
        }).join('');
        hold.hidden = false;
      }).catch(function () { st.textContent = M.error; });
    }
    $('[data-check]', box).addEventListener('click', check);
    date.addEventListener('change', check);
    if (time) time.addEventListener('change', check);
    hold.addEventListener('click', function () {
      var sel = $('input[name=slot]:checked', box);
      if (!sel) { st.textContent = M.noSlots; return; }
      hold.disabled = true;
      fetch(box.getAttribute('data-hold'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: box.getAttribute('data-token'), start: Number(sel.value) }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function (j) { location.href = j.redirect; })
        .catch(function (j) { st.textContent = (j && j.error === 'slot_taken') ? M.taken : (j && j.message) || M.error; hold.disabled = false; check(); });
    });
    if (date.value) check();
  }

  document.addEventListener('DOMContentLoaded', function () { setupForm(); setupAvailability(); });
})();
