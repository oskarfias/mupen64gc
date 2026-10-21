/* Carrito y pago: resumen con IVA, datos de facturación y envío al proveedor de pagos. */
(function () {
  'use strict';
  var fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  function money(n) { return fmt.format(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  document.addEventListener('DOMContentLoaded', function () {
    var B = window.Bikrom;
    var rate = (window.BIKROM && window.BIKROM.ivaRate) || 0.16;
    var $ = function (s) { return document.querySelector(s); };
    var itemsBox = $('[data-cart-items]');
    var totals = $('[data-cart-totals]');
    var form = $('[data-checkout-form]');
    var subSku = new URLSearchParams(location.search).get('suscripcion');

    B.catalog().then(function (cat) {
      function lines() {
        if (subSku) return cat[subSku] && cat[subSku].kind === 'subscription' ? [{ sku: subSku, qty: 1 }] : [];
        return B.getCart().filter(function (i) { return cat[i.sku] && cat[i.sku].kind === 'buy'; });
      }

      function render() {
        var items = lines();
        if (subSku) {
          $('[data-checkout-title]').textContent = 'Tu suscripción';
          $('[data-sub-note]').hidden = false;
          // Las suscripciones se cobran con tarjeta de forma recurrente.
          form.querySelector('[data-method-oxxo]').hidden = true;
          form.querySelector('[data-method-transfer]').hidden = true;
          $('[data-pay-button]').textContent = 'Suscribirme';
        }
        if (!items.length) {
          itemsBox.innerHTML = '<p class="lead">Tu carrito está vacío.</p><a class="btn btn--primary" href="/soluciones/">Ver soluciones</a>';
          totals.hidden = true;
          form.hidden = true;
          return;
        }
        var subtotal = 0;
        itemsBox.innerHTML = items.map(function (i) {
          var p = cat[i.sku];
          var line = p.price * i.qty;
          subtotal += line;
          var canQty = p.delivery === 'course' && !subSku;
          return '<div class="cart-item">' +
            '<div><p class="cart-item-name"><a class="link" href="' + p.url + '">' + esc(p.product) + '</a></p><p class="muted">' + esc(p.label) + (subSku ? ' · mensual' : '') + '</p></div>' +
            '<p class="cart-item-price">' + money(line) + '<br><span class="muted small">+ IVA</span></p>' +
            '<div>' + (canQty
              ? '<span class="qty"><button type="button" data-qty="-1" data-sku="' + i.sku + '" aria-label="Quitar uno">−</button><span aria-live="polite">' + i.qty + '</span><button type="button" data-qty="1" data-sku="' + i.sku + '" aria-label="Agregar uno">+</button></span>'
              : '') + '</div>' +
            (subSku ? '' : '<div><button type="button" class="remove" data-remove="' + i.sku + '">Quitar</button></div>') +
            '</div>';
        }).join('');
        var iva = Math.round(subtotal * rate * 100) / 100;
        $('[data-subtotal]').textContent = money(subtotal) + (subSku ? ' al mes' : '');
        $('[data-iva]').textContent = money(iva);
        $('[data-total]').textContent = money(subtotal + iva) + (subSku ? ' al mes' : '');
        totals.hidden = false;
        form.hidden = false;
      }

      itemsBox.addEventListener('click', function (e) {
        var q = e.target.closest('[data-qty]');
        var r = e.target.closest('[data-remove]');
        var cart = B.getCart();
        if (q) {
          cart.forEach(function (i) { if (i.sku === q.dataset.sku) i.qty = Math.max(1, Math.min(50, i.qty + Number(q.dataset.qty))); });
          B.setCart(cart); render();
        }
        if (r) { B.setCart(cart.filter(function (i) { return i.sku !== r.dataset.remove; })); render(); }
      });

      var factToggle = form.querySelector('[data-toggle-factura]');
      var factBox = form.querySelector('[data-factura]');
      factToggle.addEventListener('change', function () {
        factBox.hidden = !factToggle.checked;
        factBox.querySelectorAll('input, select').forEach(function (el) { el.required = factToggle.checked; });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!B.validate(form)) { B.status(form, 'Revisa los campos marcados.', 'error'); return; }
        var d = B.formData(form);
        var btn = $('[data-pay-button]');
        btn.disabled = true;
        B.status(form, 'Preparando tu pago seguro…');
        B.postJSON('/api/checkout', {
          items: lines(),
          suscripcion: subSku || null,
          metodo: subSku ? 'tarjeta' : d.metodo,
          cliente: { nombre: d.nombre, correo: d.correo, whatsapp: d.whatsapp, empresa: d.empresa },
          facturacion: d.factura ? { rfc: (d.rfc || '').toUpperCase(), razonSocial: d.razonSocial, regimenFiscal: d.regimenFiscal, cpFiscal: d.cpFiscal, usoCfdi: d.usoCfdi } : null,
        })
          .then(function (r) { window.location.href = r.url; })
          .catch(function (err) {
            btn.disabled = false;
            B.status(form, err.message && err.message !== 'Error' ? err.message : 'No pudimos iniciar el pago. Intenta de nuevo o escríbenos por WhatsApp.', 'error');
          });
      });

      render();
    });
  });
})();
