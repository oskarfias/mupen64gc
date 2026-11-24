/* Detecta la zona horaria del navegador al registrarse. */
document.addEventListener('DOMContentLoaded', function () {
  var f = document.querySelector('[data-tz] input[name=timezone]');
  try { if (f) f.value = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
});
