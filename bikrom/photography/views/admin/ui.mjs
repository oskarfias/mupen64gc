// Componentes del panel de administración (adaptable a celular).
import { esc, when } from '../html.mjs';
import { asset } from '../layout.mjs';
import { mxn, centsToPesos } from '../../lib/money.mjs';

export const A = (app, path = '') => `${app.base}/admin${path}`;

const NAV = [
  ['', 'Inicio'], ['/reservas', 'Reservas'], ['/cotizaciones', 'Cotizaciones'], ['/agenda', 'Agenda'], ['/galerias', 'Galerías'],
  ['/pedidos', 'Pedidos'], ['/catalogo', 'Servicios y precios'], ['/tienda', 'Tienda'], ['/contenido', 'Contenido'], ['/correos', 'Correos'],
  ['/mensajes', 'Mensajes'], ['/registros', 'Registros'], ['/ajustes', 'Ajustes'],
];

export function adminLayout(app, { title, body, path = '', csrf = '', flash = null, scripts = [] }) {
  const integ = app.integrations();
  const pending = app.db.get("SELECT COUNT(*) AS n FROM quotes WHERE status = 'pending_admin'").n;
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)} · Panel</title>
<link rel="stylesheet" href="${asset(app, 'css/admin.css')}">
<script src="${asset(app, 'js/admin.js')}" defer></script>${scripts.map((s) => `<script src="${asset(app, s)}" defer></script>`).join('')}
</head><body data-csrf="${esc(csrf)}" data-base="${esc(app.base)}">
<header class="a-head"><a class="a-brand" href="${A(app)}">Estefanía Torres · Panel</a>
  <button class="a-menu" type="button" aria-expanded="false" aria-controls="a-nav" data-menu>Menú</button>
  <nav id="a-nav" class="a-nav" aria-label="Panel"><ul>${NAV.map(([p, l]) => `<li><a href="${A(app, p)}"${path === p || (p && path.startsWith(p)) ? ' aria-current="page"' : ''}>${l}${p === '/cotizaciones' && pending ? ` <span class="badge">${pending}</span>` : ''}</a></li>`).join('')}
  <li><a href="${app.base}/" target="_blank" rel="noopener">Ver sitio ↗</a></li>
  <li><form method="post" action="${A(app, '/salir')}"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="a-link">Salir</button></form></li></ul></nav>
</header>
${when(app.demo() || !integ.email || !integ.calendar, `<div class="a-demo" role="note"><strong>${app.demo() ? 'Modo demostración' : 'Conexiones pendientes'}:</strong>
  ${[!integ.payments && 'pagos', !integ.email && 'correo', !integ.calendar && 'Google Calendar', integ.storage === 'local' && 'almacenamiento en la nube'].filter(Boolean).join(', ')} sin conectar. <a href="${A(app, '/registros#integraciones')}">Ver estado</a></div>`)}
<main class="a-main" id="main">
${when(flash, `<p class="a-flash" role="status">${esc(flash)}</p>`)}
<h1>${esc(title)}</h1>
${body}
</main></body></html>`;
}

export const csrfField = (csrf) => `<input type="hidden" name="_csrf" value="${esc(csrf)}">`;

export function table(cols, rows, { empty = 'Sin registros.' } = {}) {
  if (!rows.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<div class="a-table"><table><thead><tr>${cols.map((c) => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((r) => `<tr>${cols.map((c) => `<td data-label="${esc(c[0])}">${c[1](r) ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export const pesos = (name, cents, { label, required = false, help = '' } = {}) =>
  `<label class="a-field"><span>${esc(label)}</span><input type="text" inputmode="decimal" name="${name}" value="${esc(centsToPesos(cents))}"${required ? ' required' : ''} placeholder="Sin definir"><small>${esc(help || 'En pesos MXN. Déjalo vacío si aún no está definido.')}</small></label>`;

export const input = (name, value, { label, type = 'text', required = false, help = '', attrs = '' } = {}) =>
  `<label class="a-field"><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(value ?? '')}"${required ? ' required' : ''} ${attrs}>${help ? `<small>${esc(help)}</small>` : ''}</label>`;

export const textarea = (name, value, { label, rows = 4, help = '' } = {}) =>
  `<label class="a-field"><span>${esc(label)}</span><textarea name="${name}" rows="${rows}">${esc(value ?? '')}</textarea>${help ? `<small>${esc(help)}</small>` : ''}</label>`;

export const select = (name, value, options, { label } = {}) =>
  `<label class="a-field"><span>${esc(label)}</span><select name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

export const checkbox = (name, checked, { label, help = '' } = {}) =>
  `<label class="a-check"><input type="checkbox" name="${name}" value="1"${checked ? ' checked' : ''}> <span>${esc(label)}${help ? ` <small class="muted">${esc(help)}</small>` : ''}</span></label>`;

export const statusTag = (s, labels) => `<span class="tag tag--${esc(s)}">${esc(labels[s] || s)}</span>`;
export { mxn, esc, when };

export const STATUS = {
  pending_admin: 'Por completar', ready: 'Enviada', accepted: 'Aceptada', cancelled: 'Cancelada',
  held: 'Apartada', confirmed: 'Confirmada', expired: 'Vencida', completed: 'Realizada', conflict: 'Conflicto',
  pending: 'Pendiente', succeeded: 'Pagado', failed: 'Fallido', refunded: 'Reembolsado',
  draft: 'Borrador', scheduled: 'Programada', released: 'Publicada', deleted: 'Eliminada', active: 'Activo', archived: 'Archivado',
  awaiting_shipping_quote: 'Envío por cotizar', awaiting_payment: 'Pendiente de pago', paid: 'Pagado', design_review: 'Revisión de diseño',
  in_production: 'En producción', shipped: 'Enviado', delivered: 'Entregado',
};

export function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
