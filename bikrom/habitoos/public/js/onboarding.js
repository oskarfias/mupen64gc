/* Onboarding en 8 pasos. Cada paso se guarda en el servidor: se puede cerrar y reanudar. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-onboarding]');
    if (!root) return;
    var D = JSON.parse(document.getElementById('ob-data').textContent);
    var X = D.tx;
    var S = Object.assign({ step: 1, categories: [], build: [], reduce: [], custom: [], priority: [], plans: {}, barriers: [], motivation: '' }, D.state || {});
    var status = document.querySelector('[data-ob-status]');
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    var tpl = {};
    D.templates.forEach(function (t) { tpl[t.key] = t; });

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function chips(name, items, selected, multi) {
      return '<div class="chips">' + items.map(function (i) {
        return '<label class="chip"><input type="' + (multi === false ? 'radio' : 'checkbox') + '" name="' + name + '" value="' + esc(i.key) + '"' + (selected.indexOf(i.key) > -1 ? ' checked' : '') + '><span>' + (i.emoji ? esc(i.emoji) + ' ' : '') + esc(i.label || i.name) + '</span></label>';
      }).join('') + '</div>';
    }
    function picked(name) { return Array.prototype.map.call(root.querySelectorAll('input[name="' + name + '"]:checked'), function (c) { return c.value; }); }
    function info(key) {
      if (key.indexOf('custom:') === 0) { var c = S.custom[Number(key.slice(7))] || {}; return { key: key, name: c.name, emoji: '✨', kind: c.kind, measure: 'binary', unit: '' }; }
      return tpl[key];
    }
    function candidates() { return S.build.concat(S.reduce).concat(S.custom.map(function (_, i) { return 'custom:' + i; })); }

    var steps = {
      1: function () {
        return '<h2>' + X.s1 + '</h2><div class="grid2"><label class="field"><span>Idioma / Language</span><select class="input" name="locale"><option value="es"' + (D.lang === 'es' ? ' selected' : '') + '>Español</option><option value="en"' + (D.lang === 'en' ? ' selected' : '') + '>English</option></select></label>' +
          '<label class="field"><span>' + X.s1.split(' ').pop() + '</span><input class="input" name="timezone" value="' + esc(tz) + '" readonly></label></div>';
      },
      2: function () { return '<h2>' + X.s2 + '</h2>' + chips('cat', D.categories, S.categories); },
      3: function () {
        var list = D.templates.filter(function (t) { return t.kind === 'build'; });
        return '<h2>' + X.s3 + '</h2>' + chips('build', list, S.build) + customBox('build');
      },
      4: function () {
        var list = D.templates.filter(function (t) { return t.kind !== 'build'; });
        return '<h2>' + X.s4 + '</h2>' + chips('reduce', list, S.reduce) + customBox('reduce');
      },
      5: function () {
        var items = candidates().map(function (k) { var i = info(k); return { key: k, name: i.name, emoji: i.emoji }; });
        return '<h2>' + X.s5 + '</h2><p class="muted small">' + X.s5help + '</p>' + chips('priority', items, S.priority);
      },
      6: function () {
        return '<h2>' + X.s6 + '</h2>' + S.priority.map(function (k) {
          var i = info(k), p = S.plans[k] || {};
          var numeric = i.measure !== 'binary';
          var days = p.days || [1, 2, 3, 4, 5, 6, 7];
          return '<fieldset class="card plan-card" data-plan="' + esc(k) + '"><legend><strong>' + esc(i.emoji) + ' ' + esc(i.name) + '</strong></legend>' +
            (i.safety ? '<p class="notice" role="note">' + esc(i.safety) + '</p>' : '') + (i.hint ? '<p class="small muted">' + esc(i.hint) + '</p>' : '') +
            (numeric ? '<div class="grid2"><label class="field"><span>' + X.baseline + (i.unit ? ' (' + esc(i.unit) + ')' : '') + '</span><input class="input" name="baseline" inputmode="decimal" value="' + esc(p.baseline == null ? '' : p.baseline) + '"></label>' +
              '<label class="field"><span>' + X.target + ' — ' + esc(X.comparators[i.comparator] || '') + (i.unit ? ' (' + esc(i.unit) + ')' : '') + '</span><input class="input" name="target" inputmode="decimal" value="' + esc(p.target == null ? (i.target == null ? '' : i.target) : p.target) + '"></label></div>' +
              '<label class="check"><input type="checkbox" name="unknown"' + (p.baseline_unknown ? ' checked' : '') + '> <span>' + X.unknown + '</span></label>' : '') +
            '<div class="field"><span>' + X.days + '</span><div class="days">' + X.weekdays.map(function (d, n) { return '<label class="chip"><input type="checkbox" name="d" value="' + (n + 1) + '"' + (days.indexOf(n + 1) > -1 ? ' checked' : '') + '><span aria-label="' + esc(X.weekdayNames[n]) + '">' + d + '</span></label>'; }).join('') + '</div></div>' +
            '<div class="grid2"><label class="field"><span>' + X.time + '</span><input class="input" type="time" name="time" value="' + esc(p.time || '') + '"></label>' +
            '<label class="field"><span>' + X.contingency + '</span><input class="input" name="contingency" maxlength="300" value="' + esc(p.contingency || '') + '"></label></div></fieldset>';
        }).join('');
      },
      7: function () {
        return '<h2>' + X.s7 + '</h2><p class="muted small">' + X.s7help + '</p>' + chips('barrier', D.barriers, S.barriers) +
          '<label class="field" style="margin-top:14px"><span>' + X.motivation + '</span><textarea class="input" name="motivation" maxlength="500">' + esc(S.motivation) + '</textarea></label>';
      },
      8: function () {
        return '<h2>' + X.s8 + '</h2><ul class="list">' + S.priority.map(function (k) {
          var i = info(k), p = S.plans[k] || {};
          return '<li class="habit"><div class="habit-top"><span class="habit-emoji" aria-hidden="true">' + esc(i.emoji) + '</span><div><div class="habit-name">' + esc(i.name) + '</div><div class="habit-goal">' +
            (i.measure === 'binary' ? esc(X.comparators.done) : esc(X.comparators[i.comparator]) + ' ' + esc(p.target == null ? i.target : p.target) + ' ' + esc(i.unit)) + ' · ' +
            (p.days || [1, 2, 3, 4, 5, 6, 7]).map(function (d) { return X.weekdays[d - 1]; }).join(' ') + '</div></div></div></li>';
        }).join('') + '</ul>';
      },
    };
    function customBox(kind) {
      var mine = S.custom.filter(function (c) { return (kind === 'build') === (c.kind === 'build'); }).map(function (c) { return '<span class="chip"><span>✨ ' + esc(c.name) + '</span></span>'; }).join('');
      return '<div class="row" style="margin-top:12px"><input class="input" style="flex:1;min-width:180px" data-custom="' + kind + '" maxlength="80" placeholder="' + esc(X.custom) + '" aria-label="' + esc(X.custom) + '"><button type="button" class="btn" data-add-custom="' + kind + '">' + X.add + '</button></div><div class="chips" style="margin-top:8px">' + mine + '</div>';
    }

    function collect() {
      var n = S.step;
      if (n === 2) S.categories = picked('cat');
      if (n === 3) S.build = picked('build');
      if (n === 4) S.reduce = picked('reduce');
      if (n === 5) S.priority = picked('priority').slice(0, 3);
      if (n === 6) root.querySelectorAll('[data-plan]').forEach(function (fs) {
        var k = fs.getAttribute('data-plan'), g = function (s) { var el = fs.querySelector(s); return el ? el.value : ''; };
        var unknown = fs.querySelector('[name=unknown]');
        S.plans[k] = {
          baseline: g('[name=baseline]') === '' ? null : Number(g('[name=baseline]')), baseline_unknown: Boolean(unknown && unknown.checked),
          target: g('[name=target]') === '' ? undefined : Number(g('[name=target]')),
          days: Array.prototype.map.call(fs.querySelectorAll('[name=d]:checked'), function (c) { return Number(c.value); }),
          time: g('[name=time]'), contingency: g('[name=contingency]'),
        };
      });
      if (n === 7) { S.barriers = picked('barrier'); S.motivation = (root.querySelector('[name=motivation]') || {}).value || ''; }
    }
    function validate() {
      if (S.step === 5 && !S.priority.length) return X.errors.no_priority;
      if (S.step === 5 && picked('priority').length > 3) return X.s5;
      if (S.step === 6) for (var k in S.plans) if (S.priority.indexOf(k) > -1 && !(S.plans[k].days || []).length) return X.errors.invalid_schedule;
      return null;
    }
    function save(extra) { return HOS.api('PUT', '/onboarding', Object.assign({}, S, extra || {})); }

    function render() {
      document.querySelectorAll('[data-bar]').forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-bar')) <= S.step); });
      document.querySelector('[data-step-label]').textContent = X.step + ' ' + S.step + ' ' + X.of + ' 8';
      root.innerHTML = '<div class="card" style="display:grid;gap:12px">' + steps[S.step]() + '<div class="row">' +
        (S.step > 1 ? '<button type="button" class="btn" data-back>' + X.back + '</button>' : '') +
        '<button type="button" class="btn btn--primary" data-next>' + (S.step === 8 ? X.finish : X.next) + '</button>' +
        (S.step === 7 ? '<button type="button" class="btn btn--ghost" data-skip>' + X.skip + '</button>' : '') + '</div></div>';
      var h = root.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: false }); }
    }

    root.addEventListener('click', function (e) {
      var add = e.target.closest('[data-add-custom]');
      if (add) {
        var kind = add.getAttribute('data-add-custom'), inp = root.querySelector('[data-custom="' + kind + '"]');
        if (inp.value.trim() && S.custom.length < 5) { collect(); S.custom.push({ name: inp.value.trim(), kind: kind === 'build' ? 'build' : 'reduce' }); render(); }
        return;
      }
      if (e.target.closest('[data-back]')) { collect(); S.step--; save().then(render, render); return; }
      if (e.target.closest('[data-skip]')) { S.barriers = []; S.step = 8; save().then(render); return; }
      if (!e.target.closest('[data-next]')) return;
      collect();
      var problem = validate();
      if (problem) { status.textContent = problem; status.className = 'status error'; return; }
      status.textContent = '';
      if (S.step === 1) {
        var loc = root.querySelector('[name=locale]').value;
        var changed = loc !== D.lang;
        S.step = 2;
        return save({ locale: loc, timezone: tz }).then(function () { if (changed) location.reload(); else render(); }, function () { status.textContent = X.errors.generic; });
      }
      if (S.step === 8) {
        e.target.disabled = true;
        return save().then(function () { return HOS.api('POST', '/onboarding/complete'); }).then(function () { location.href = D.done; }, function (err) {
          e.target.disabled = false; status.className = 'status error'; status.textContent = X.errors[err.code] || X.errors.generic;
        });
      }
      S.step++;
      save().then(render, function () { status.textContent = X.errors.generic; });
    });
    render();
  });
})();
