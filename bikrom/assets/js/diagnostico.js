/* Diagnóstico Empresa 360: una afirmación por pantalla, datos del prospecto y resultado. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var dataEl = document.getElementById('diag-data');
    if (!dataEl) return;
    var D = JSON.parse(dataEl.textContent);
    var B = window.Bikrom;
    var $ = function (s) { return document.querySelector(s); };

    var intro = $('[data-diag-intro]');
    var quiz = $('[data-diag]');
    var qForm = $('[data-diag-question]');
    var lead = $('[data-diag-lead]');
    var result = $('[data-diag-result]');
    var faq = $('[data-diag-faq]');
    var areaByKey = {};
    D.areas.forEach(function (a) { areaByKey[a.key] = a; });

    var saved = B.store('bk_diag') || {};
    var answers = saved.answers || {};
    var index = 0;
    var total = D.questions.length;

    function setProgress(n) {
      $('[data-diag-bar]').style.width = (n / total) * 100 + '%';
      $('[data-diag-progress]').setAttribute('aria-valuenow', String(n));
      $('[data-diag-count]').textContent = String(Math.min(n + 1, total));
    }

    function renderQuestion() {
      var q = D.questions[index];
      var a = areaByKey[q.area];
      $('[data-diag-area]').innerHTML = a.icon + '<span>' + a.name + '</span>';
      var legend = $('[data-diag-text]');
      legend.textContent = q.text;
      var scale = $('[data-diag-scale]');
      scale.innerHTML = '';
      D.scale.forEach(function (s) {
        var id = 'q-' + q.id + '-' + s.value;
        var label = document.createElement('label');
        label.className = 'scale-option' + (Number(answers[q.id]) === s.value ? ' is-checked' : '');
        label.setAttribute('for', id);
        label.innerHTML = '<input type="radio" name="answer" id="' + id + '" value="' + s.value + '"' + (Number(answers[q.id]) === s.value ? ' checked' : '') + '><span class="scale-num">' + s.value + '</span><span>' + s.label + '</span>';
        scale.appendChild(label);
      });
      $('[data-diag-prev]').hidden = index === 0;
      setProgress(index);
      legend.focus({ preventScroll: true });
    }

    function show(step) {
      intro.hidden = step !== 'intro';
      quiz.hidden = step !== 'quiz' && step !== 'lead';
      qForm.hidden = step !== 'quiz';
      lead.hidden = step !== 'lead';
      result.hidden = step !== 'result';
      faq.hidden = step === 'result';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    $('[data-diag-start]').addEventListener('click', function () {
      // Retoma donde se quedó
      index = 0;
      while (index < total - 1 && answers[D.questions[index].id]) index++;
      show('quiz');
      renderQuestion();
    });

    qForm.addEventListener('change', function (e) {
      if (e.target.name !== 'answer') return;
      var q = D.questions[index];
      answers[q.id] = Number(e.target.value);
      B.store('bk_diag', { answers: answers });
      qForm.querySelectorAll('.scale-option').forEach(function (l) { l.classList.toggle('is-checked', l.contains(e.target)); });
      setTimeout(next, 220);
    });
    qForm.addEventListener('submit', function (e) { e.preventDefault(); });

    function next() {
      if (index < total - 1) { index++; renderQuestion(); }
      else { setProgress(total); $('[data-diag-count]').textContent = String(total); show('lead'); lead.querySelector('h2').focus(); }
    }

    $('[data-diag-prev]').addEventListener('click', function () { if (index > 0) { index--; renderQuestion(); } });
    $('[data-diag-back]').addEventListener('click', function () { index = total - 1; show('quiz'); renderQuestion(); });

    // Cálculo local (respaldo si el servidor no responde). El servidor recalcula con la misma regla.
    function score() {
      var areas = D.areas.map(function (a) {
        var vals = D.questions.filter(function (q) { return q.area === a.key; }).map(function (q) { return Number(answers[q.id]) || 1; });
        var avg = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
        return { key: a.key, name: a.name, score: Math.round(((avg - 1) / 4) * 100) };
      });
      var overall = Math.round(areas.reduce(function (s, a) { return s + a.score; }, 0) / areas.length);
      var order = D.areas.map(function (a) { return a.key; });
      var sorted = areas.slice().sort(function (x, y) { return x.score - y.score || order.indexOf(x.key) - order.indexOf(y.key); });
      var recs = areaByKey[sorted[0].key].recommendations.slice(0, 2).map(function (r) { return { area: sorted[0].key, r: r }; });
      recs.push({ area: sorted[1].key, r: areaByKey[sorted[1].key].recommendations[0] });
      return {
        overall: overall,
        areas: areas,
        recommendations: recs.map(function (x) { return { area: x.area, name: x.r.name, promise: x.r.promise, url: x.r.url }; }),
      };
    }

    function renderResult(res, email, saved) {
      $('[data-result-overall]').textContent = res.overall;
      $('[data-result-email]').textContent = saved
        ? 'También te enviamos este resultado a ' + email + '.'
        : 'No pudimos enviar el resultado a tu correo; guarda esta página o escríbenos por WhatsApp.';
      var bars = $('[data-result-bars]');
      bars.setAttribute('aria-label', 'Puntaje por área: ' + res.areas.map(function (a) { return a.name + ' ' + a.score; }).join(', '));
      bars.innerHTML = res.areas.map(function (a) {
        return '<div class="bar-row"><div class="bar-label">' + areaByKey[a.key].icon + '<span>' + a.name + '</span></div>' +
          '<div class="bar-track"><div class="bar-fill" data-w="' + a.score + '"></div></div><div class="bar-value">' + a.score + '</div></div>';
      }).join('');
      $('[data-result-recs]').innerHTML = res.recommendations.map(function (r, i) {
        var a = areaByKey[r.area];
        return '<li class="card"><div class="card-top">' + a.icon + '<span class="card-type">' + a.name + '</span></div>' +
          '<h4 class="card-title">' + (i + 1) + '. ' + r.name + '</h4><p class="card-text">' + r.promise + '</p>' +
          '<a class="btn btn--secondary btn--sm" href="' + r.url + '">Ver solución</a></li>';
      }).join('');
      show('result');
      requestAnimationFrame(function () {
        bars.querySelectorAll('.bar-fill').forEach(function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
      });
      $('#result-title').focus({ preventScroll: true });
    }

    lead.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!B.validate(lead)) { B.status(lead, 'Revisa los campos marcados.', 'error'); return; }
      var btn = lead.querySelector('[type=submit]');
      btn.disabled = true;
      B.status(lead, 'Calculando tu resultado…');
      var data = B.formData(lead);
      B.postJSON('/api/diagnostico', { lead: data, answers: answers })
        .then(function (r) { renderResult(r.result, data.correo, r.emailSent !== false); })
        .catch(function () { renderResult(score(), data.correo, false); })
        .then(function () {
          btn.disabled = false;
          B.track('diagnostico_completado', { empleados: data.empleados });
          B.store('bk_diag', null);
        });
    });
  });
})();
