/* Común en la app: token CSRF, confirmaciones, reenvío de verificación y registro del service worker. */
window.HOS = (function () {
  var csrf = (document.querySelector('meta[name=csrf]') || {}).content || '';
  var base = location.pathname.slice(0, location.pathname.indexOf('/habitoos') + 9);
  function api(method, path, body) {
    return fetch(base + '/api/v1' + path, {
      method: method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'error'); e.code = j.error; throw e; } return j; }); });
  }
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-confirm]');
    if (f && !window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
  }, true);
  document.addEventListener('DOMContentLoaded', function () {
    var r = document.querySelector('[data-resend]');
    if (r) r.addEventListener('click', function () { r.disabled = true; api('POST', '/auth/resend-verification').then(function () { r.textContent = '✓'; }, function () { r.disabled = false; }); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' }).catch(function () {});
  });
  return { api: api, base: base };
})();
