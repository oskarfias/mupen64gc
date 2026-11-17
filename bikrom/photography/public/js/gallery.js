/* Galería: visor con teclado y gestos, compartir enlace y descargas por partes. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var grid = document.querySelector('[data-gallery]');
    var viewer = document.querySelector('[data-viewer]');
    var share = document.querySelector('[data-share]');
    if (share) share.addEventListener('click', function () {
      var url = share.getAttribute('data-share');
      if (navigator.share) { navigator.share({ url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { share.textContent = share.getAttribute('data-copied'); });
    });

    // Descargas: marca cada parte al iniciarla; si falla, se puede reintentar con el mismo botón
    document.querySelectorAll('[data-batch]').forEach(function (a) {
      a.addEventListener('click', function () { a.textContent = '✓ ' + a.textContent.replace(/^✓ /, ''); });
    });

    if (!grid || !viewer) return;
    var items = Array.prototype.slice.call(grid.querySelectorAll('a[data-index]'));
    var img = viewer.querySelector('[data-view-img]');
    var dl = viewer.querySelector('[data-view-download]');
    var counter = viewer.querySelector('[data-counter]');
    var current = 0;
    var opener = null;
    function show(i) {
      current = (i + items.length) % items.length;
      var a = items[current];
      img.src = a.getAttribute('href');
      img.alt = a.querySelector('img').alt;
      dl.href = a.getAttribute('data-download');
      counter.textContent = (current + 1) + ' / ' + items.length;
      // Precarga la siguiente
      var next = items[(current + 1) % items.length];
      if (next) { var p = new Image(); p.src = next.getAttribute('href'); }
    }
    function open(i) { opener = document.activeElement; viewer.hidden = false; document.body.style.overflow = 'hidden'; show(i); viewer.querySelector('[data-close]').focus(); }
    function close() { viewer.hidden = true; document.body.style.overflow = ''; img.src = ''; if (opener) opener.focus(); }
    items.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); open(i); }); });
    viewer.querySelector('[data-close]').addEventListener('click', close);
    viewer.querySelector('[data-prev]').addEventListener('click', function () { show(current - 1); });
    viewer.querySelector('[data-next]').addEventListener('click', function () { show(current + 1); });
    document.addEventListener('keydown', function (e) {
      if (viewer.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'Tab') { // mantiene el foco dentro del visor
        var f = viewer.querySelectorAll('button, a[href]');
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    var x0 = null;
    viewer.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  });
})();
