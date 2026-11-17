/* Cargas reanudables: los originales se suben por partes de 8 MB, en orden, sin recompresión.
   Si una parte falla se reintenta; si se interrumpe la conexión, se reanuda desde la última parte confirmada.
   Las miniaturas (vista previa y thumb) se generan en el navegador; nunca reemplazan al original. */
(function () {
  'use strict';
  var base = document.body.getAttribute('data-base') + '/admin';
  var csrf = document.body.getAttribute('data-csrf');
  function api(path, body) {
    return fetch(base + path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function putParts(uploadId, blob, partSize, onProgress) {
    var total = Math.ceil(blob.size / partSize) || 1;
    function send(n, attempt) {
      if (n >= total) return Promise.resolve();
      var chunk = blob.slice(n * partSize, Math.min(blob.size, (n + 1) * partSize));
      return fetch(base + '/api/uploads/' + uploadId + '/parte?n=' + n, { method: 'PUT', credentials: 'same-origin', headers: { 'X-CSRF': csrf, 'Content-Type': 'application/octet-stream' }, body: chunk })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function (j) { onProgress(Math.min(blob.size, (n + 1) * partSize)); return send(j.next_part, 0); })
        .catch(function (err) {
          if (err && typeof err.next_part === 'number') return send(err.next_part, attempt); // reanuda desde lo confirmado
          if (attempt >= 5) throw new Error('No se pudo subir la parte ' + (n + 1));
          return sleep(1000 * Math.pow(2, attempt)).then(function () {
            return fetch(base + '/api/uploads/' + uploadId, { credentials: 'same-origin' }).then(function (r) { return r.json(); })
              .then(function (st) { return send(typeof st.next_part === 'number' ? st.next_part : n, attempt + 1); }, function () { return send(n, attempt + 1); });
          });
        });
    }
    return send(0, 0);
  }

  // Imagen → { w, h, preview(Blob), thumb(Blob) } sin deformar
  function derive(file) {
    return new Promise(function (resolve) {
      if (file.type.indexOf('video/') === 0) {
        var v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(file);
        v.onloadeddata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
        v.onseeked = function () { draw(v, v.videoWidth, v.videoHeight, true).then(resolve); };
        v.onerror = function () { resolve({}); };
        return;
      }
      var img = new Image();
      img.onload = function () { draw(img, img.naturalWidth, img.naturalHeight, false).then(resolve); };
      img.onerror = function () { resolve({}); };
      img.src = URL.createObjectURL(file);
    });
    function draw(src, w, h, video) {
      function make(max, q) {
        var s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        return new Promise(function (r) { c.toBlob(r, 'image/jpeg', q); });
      }
      return Promise.all([video ? Promise.resolve(null) : make(2048, 0.86), make(480, 0.8)]).then(function (b) { return { w: w, h: h, preview: b[0], thumb: b[1] }; });
    }
  }

  function row(list, name) {
    var li = document.createElement('li');
    li.innerHTML = '<span></span><span class="small" data-st>En espera</span><div class="bar"><span style="width:0"></span></div>';
    li.firstChild.textContent = name;
    list.appendChild(li);
    return {
      st: function (t) { li.querySelector('[data-st]').textContent = t; },
      pct: function (p) { li.querySelector('.bar span').style.width = Math.round(p * 100) + '%'; },
    };
  }

  function uploadToGallery(galleryId, file, ui) {
    return derive(file).then(function (d) {
      ui.st('Preparando');
      return api('/api/uploads', { gallery: galleryId, filename: file.name, size: file.size, mime: file.type, width: d.w, height: d.h }).then(function (s) {
        if (s.warning === 'storage_high') ui.st('Atención: el almacenamiento está casi lleno');
        return putParts(s.uploadId, file, s.partSize, function (done) { ui.pct(done / file.size); ui.st(Math.round((done / file.size) * 100) + '%'); })
          .then(function () { return api('/api/uploads/' + s.uploadId + '/completar', { width: d.w, height: d.h }); })
          .then(function () {
            var jobs = [['preview', d.preview], ['thumb', d.thumb]].filter(function (x) { return x[1]; }).map(function (x) {
              return api('/api/uploads', { fileId: s.fileId, variant: x[0], size: x[1].size }).then(function (u) {
                return putParts(u.id, x[1], u.partSize, function () {}).then(function () { return api('/api/uploads/' + u.id + '/completar', {}); });
              });
            });
            return Promise.all(jobs);
          });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var input = document.querySelector('[data-upload-input]');
    if (input) {
      var list = document.querySelector('[data-upload-list]');
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files);
        var queue = files.map(function (f) { return { f: f, ui: row(list, f.name) }; });
        var failed = 0;
        (function next(i) {
          if (i >= queue.length) {
            if (!failed) setTimeout(function () { location.reload(); }, 600);
            return;
          }
          var q = queue[i];
          uploadToGallery(input.getAttribute('data-gallery'), q.f, q.ui).then(function () { q.ui.pct(1); q.ui.st('Listo'); }, function (e) {
            failed++; q.ui.st('Error: ' + ((e && (e.message || e.error)) || 'reintenta seleccionando el archivo de nuevo'));
          }).then(function () { next(i + 1); });
        })(0);
      });
    }
    // Imágenes del sitio (logo, espacios, portafolio)
    document.querySelectorAll('[data-media-upload]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var file = inp.files[0];
        if (!file) return;
        var status = document.createElement('span');
        status.className = 'small'; status.textContent = ' Subiendo…';
        inp.after(status);
        var mediaId = inp.getAttribute('data-media');
        var keep = inp.getAttribute('data-keep-original') === '1' || file.type === 'image/svg+xml';
        var create = mediaId ? Promise.resolve({ id: Number(mediaId) }) : api('/api/media', { slot: inp.getAttribute('data-slot'), mime: file.type });
        Promise.all([create, keep ? Promise.resolve({}) : derive(file)]).then(function (r) {
          var id = r[0].id, d = r[1];
          // Para el sitio se sube una versión optimizada (máx. 2048 px); el logo se conserva tal cual
          var blob = keep || !d.preview ? file : d.preview;
          return api('/api/uploads', { media: id, size: blob.size, mime: keep ? file.type : 'image/jpeg' }).then(function (u) {
            return putParts(u.id, blob, u.partSize, function () {}).then(function () { return api('/api/uploads/' + u.id + '/completar', { width: d.w, height: d.h, mime: keep ? file.type : 'image/jpeg' }); });
          });
        }).then(function () { status.textContent = ' Listo'; setTimeout(function () { location.reload(); }, 500); }, function (e) { status.textContent = ' Error: ' + ((e && (e.message || e.error)) || 'intenta de nuevo'); });
      });
    });
  });
})();
