// Panel de administración: prospectos del diagnóstico, solicitudes, compras, suscripciones, boletín y eventos.
import { COLLECTIONS } from './store.js';
import { esc } from './email.js';

const money = (n) => (n == null ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const date = (s) => (s ? new Date(s).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : '');
const items = (r) => (r.items || []).map((i) => `${i.producto} — ${i.opcion} ×${i.cantidad}`).join('; ');
const factura = (r) => (r.facturacion ? `${r.facturacion.rfc} · ${r.facturacion.razonSocial} · ${r.facturacion.regimenFiscal} · CP ${r.facturacion.cpFiscal} · ${r.facturacion.usoCfdi}` : '');

export const columns = {
  diagnosticos: [
    ['Fecha', (r) => date(r.creado)], ['Nombre', (r) => r.nombre], ['Empresa', (r) => r.empresa], ['Correo', (r) => r.correo],
    ['WhatsApp', (r) => r.whatsapp], ['Empleados', (r) => r.empleados], ['General', (r) => r.resultado?.overall],
    ['Finanzas', (r) => r.resultado?.areas?.find((a) => a.key === 'finanzas')?.score],
    ['Personas', (r) => r.resultado?.areas?.find((a) => a.key === 'personas')?.score],
    ['Procesos', (r) => r.resultado?.areas?.find((a) => a.key === 'procesos')?.score],
    ['Tecnología', (r) => r.resultado?.areas?.find((a) => a.key === 'tecnologia')?.score],
    ['Recomendaciones', (r) => (r.resultado?.recommendations || []).map((x) => x.name).join('; ')],
    ['Correo enviado', (r) => (r.correoEnviado ? 'Sí' : 'No')],
  ],
  solicitudes: [
    ['Fecha', (r) => date(r.creado)], ['Nombre', (r) => r.nombre], ['Empresa', (r) => r.empresa], ['Correo', (r) => r.correo],
    ['WhatsApp', (r) => r.whatsapp], ['Empleados', (r) => r.empleados], ['Producto', (r) => r.producto], ['Mensaje', (r) => r.mensaje], ['Página', (r) => r.pagina],
  ],
  pedidos: [
    ['Fecha', (r) => date(r.creado)], ['Pedido', (r) => r.id], ['Estado', (r) => r.estado], ['Proveedor', (r) => r.proveedor], ['Método', (r) => r.metodo],
    ['Cliente', (r) => `${r.cliente?.nombre} <${r.cliente?.correo}>`], ['Empresa', (r) => r.cliente?.empresa], ['Productos', items],
    ['Subtotal', (r) => money(r.subtotal)], ['IVA', (r) => money(r.iva)], ['Total', (r) => money(r.total)], ['Facturación', factura], ['Entregado', (r) => (r.entregado ? 'Sí' : 'No')],
  ],
  suscripciones: [
    ['Fecha', (r) => date(r.creado)], ['Pedido', (r) => r.id], ['Estado', (r) => r.estado], ['Plan', items], ['Proveedor', (r) => r.proveedor],
    ['Cliente', (r) => `${r.cliente?.nombre} <${r.cliente?.correo}>`], ['Mensual con IVA', (r) => money(r.total)], ['Facturación', factura], ['ID externo', (r) => r.externoId],
  ],
  boletin: [['Fecha', (r) => date(r.creado)], ['Correo', (r) => r.correo], ['Página', (r) => r.pagina]],
  eventos: [['Fecha', (r) => date(r.creado)], ['Evento', (r) => r.tipo], ['Página', (r) => r.pagina]],
  correos: [['Fecha', (r) => date(r.creado)], ['Para', (r) => r.para], ['Asunto', (r) => r.asunto], ['Tipo', (r) => r.tipo], ['Estado', (r) => r.estado]],
};

export function toCsv(view, rows) {
  const cols = columns[view];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [cols.map((c) => cell(c[0])).join(','), ...rows.map((r) => cols.map((c) => cell(c[1](r))).join(','))].join('\r\n');
}

export function renderAdmin(view, rows, counts) {
  const cols = columns[view];
  const tabs = Object.entries(COLLECTIONS)
    .map(([k, label]) => `<a href="/admin?vista=${k}"${k === view ? ' aria-current="page"' : ''}>${label} <span>${counts[k]}</span></a>`)
    .join('');
  const actions = (r) =>
    view === 'pedidos' && r.estado !== 'pagado'
      ? `<form method="post" action="/admin/pedidos/${esc(r.id)}/pagado" onsubmit="return confirm('¿Marcar el pedido ${esc(r.id)} como pagado y enviar los entregables?')"><button>Marcar pagado</button></form>`
      : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Panel | Bikrom</title>
<style>
body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:#FFFFFF;color:#0A0A0A;font-size:14px}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid #0A0A0A}
header strong{font-family:'Space Grotesk',Arial,sans-serif;letter-spacing:.25em}
nav{display:flex;flex-wrap:wrap;gap:8px;padding:16px 24px;border-bottom:1px solid #E6E6E6}
nav a{border:1px solid #0A0A0A;padding:6px 12px;text-decoration:none;color:#0A0A0A;border-radius:4px}
nav a[aria-current],nav a:hover{background:#0A0A0A;color:#FFFFFF}
main{padding:24px;overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:900px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #E6E6E6;vertical-align:top}
th{border-bottom:1px solid #0A0A0A;font-weight:600;white-space:nowrap}
.muted{color:#5C5C5C}
a.btn,button{border:1px solid #0A0A0A;background:#0A0A0A;color:#FFFFFF;padding:6px 12px;border-radius:4px;cursor:pointer;text-decoration:none;font:inherit}
a.btn:hover,button:hover{background:#FFFFFF;color:#0A0A0A}
</style></head><body>
<header><strong>BIKROM · PANEL</strong><a class="btn" href="/admin/export.csv?vista=${view}">Exportar CSV</a></header>
<nav aria-label="Colecciones">${tabs}</nav>
<main>
<h1 style="font-family:'Space Grotesk',Arial,sans-serif">${COLLECTIONS[view]}</h1>
${rows.length ? `<table><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}${view === 'pedidos' ? '<th></th>' : ''}</tr></thead><tbody>
${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(c[1](r) ?? '')}</td>`).join('')}${view === 'pedidos' ? `<td>${actions(r)}</td>` : ''}</tr>`).join('')}
</tbody></table>` : '<p class="muted">Sin registros todavía.</p>'}
</main></body></html>`;
}
