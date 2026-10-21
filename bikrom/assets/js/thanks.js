/* Página de gracias: confirma el estado del pedido y registra compra o suscripción una sola vez. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var B = window.Bikrom;
    var id = new URLSearchParams(location.search).get('pedido');
    if (!id) return;
    document.querySelector('[data-order-id]').textContent = id;
    fetch('/api/pedido/' + encodeURIComponent(id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) {
        if (!o) return;
        var title = document.querySelector('[data-thanks-title]');
        var text = document.querySelector('[data-thanks-text]');
        if (o.tipo === 'suscripcion') title.textContent = 'Te damos la bienvenida a la Membresía.';
        if (o.estado === 'pendiente') {
          text.textContent = 'Tu pedido está registrado y en espera de pago. Si elegiste OXXO o transferencia, sigue las instrucciones que te dio el proveedor de pagos; al acreditarse, te enviamos todo por correo.';
          return;
        }
        if (o.estado !== 'pagado' && o.estado !== 'activa') return;
        if (!o.tipo || o.tipo !== 'suscripcion') B.setCart([]);
        var key = 'bk_tracked_' + id;
        if (B.store(key)) return;
        B.store(key, true);
        B.track(o.tipo === 'suscripcion' ? 'suscripcion' : 'compra', { value: o.total, currency: 'MXN', transaction_id: id });
      })
      .catch(function () {});
  });
})();
