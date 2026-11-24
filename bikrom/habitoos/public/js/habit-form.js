/* Formulario de hábito: muestra unidad y meta solo cuando la medición es numérica. */
document.addEventListener('DOMContentLoaded', function () {
  var sel = document.querySelector('[data-measure]');
  if (!sel) return;
  function sync() {
    var numeric = sel.value !== 'binary';
    document.querySelector('[data-unit-field]').hidden = !numeric;
    document.querySelector('[data-goal-fields]').hidden = !numeric;
  }
  sel.addEventListener('change', sync); sync();
});
