// Operación diaria: indicadores, reservas, cotizaciones, agenda, galerías, pedidos, mensajes, registros y exportación.
import { json as jparse } from '../../db.mjs';
import { A, table, csrfField, pesos, input, textarea, select, checkbox, statusTag, STATUS, mxn, esc, when, waLink } from './ui.mjs';
import { pesosToCents } from '../../lib/money.mjs';
import { formatDateTime, localDate, localTime, zonedToUtc, isDate, isTime, addDays, DAY } from '../../lib/time.mjs';
import { adminUpdateQuote, quoteSnapshot } from '../../domain/quote.mjs';
import { bookingBalance, cancelBooking, rescheduleBooking, slotsFor, scheduleBookingJobs } from '../../domain/booking.mjs';
import { recordManualPayment, demoPending, demoConfirm } from '../../domain/payments.mjs';
import { saveConnection, disconnect } from '../../domain/calendar.mjs';
import { schedule, cancelJobs } from '../../domain/jobs.mjs';
import {
  createGallery, storageUsage, galleryUsage, startFileUpload, startDerivedUpload, startMediaUpload, uploadStatus, putUploadPart, completeUpload,
  deleteFile, publishCheck, publishGallery, releaseGallery, createAccess, revokeAccess, extendGallery, purgeGallery, sendDeliveryEmail, galleryFiles,
} from '../../domain/gallery.mjs';
import { setShipping, updateOrder, orderFiles } from '../../domain/shop.mjs';
import { sign, token } from '../../lib/security.mjs';

const dt = (ms) => (ms ? formatDateTime(ms) : '—');
const gb = (b) => `${(b / 1024 ** 3).toFixed(2)} GB`;
const mb = (b) => `${(b / 1024 ** 2).toFixed(1)} MB`;
const svcName = (app, quote) => app.db.get('SELECT name_es FROM services WHERE id = ?', quote.service_id)?.name_es || '';

// ───────────── Inicio: indicadores a partir de registros reales (excluye demostración) ─────────────
function dashboard({ app, render }) {
  const now = app.now();
  const real = 'is_demo = 0';
  const upcoming = app.db.all(`SELECT b.*, c.name FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.status = 'confirmed' AND b.start_at > ? AND b.${real} ORDER BY b.start_at LIMIT 8`, now);
  const holds = app.db.all(`SELECT b.*, c.name FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.status = 'held' AND b.hold_expires_at > ? AND b.${real} ORDER BY b.hold_expires_at LIMIT 8`, now);
  const deposits30 = app.db.get(`SELECT COALESCE(SUM(amount_cents),0) s, COUNT(*) n FROM payments WHERE purpose = 'deposit' AND status = 'succeeded' AND ${real} AND created_at > ?`, now - 30 * DAY);
  const confirmed = app.db.all(`SELECT * FROM bookings WHERE status IN ('confirmed','completed') AND ${real}`);
  const outstanding = confirmed.reduce((s, b) => s + bookingBalance(app, b).outstanding, 0);
  const deliveries = app.db.all(`SELECT b.*, c.name FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.status IN ('confirmed','completed') AND b.delivery_due_date <= ? AND b.${real}
    AND NOT EXISTS (SELECT 1 FROM galleries g WHERE g.booking_id = b.id AND g.status IN ('scheduled','released','expired')) ORDER BY b.delivery_due_date LIMIT 8`, addDays(localDate(now), 7));
  const expiring = app.db.all(`SELECT * FROM galleries WHERE status = 'released' AND expires_at < ? AND ${real} ORDER BY expires_at`, now + 7 * DAY);
  const orders = app.db.get(`SELECT COUNT(*) n FROM orders WHERE status IN ('awaiting_shipping_quote','paid','design_review','in_production') AND ${real}`).n;
  const quotes = app.db.get("SELECT COUNT(*) n FROM quotes WHERE status = 'pending_admin'").n;
  const st = storageUsage(app);
  const errors = app.db.get("SELECT COUNT(*) n FROM activity_log WHERE level = 'error' AND at > ?", now - 7 * DAY).n;
  const kpi = (label, value, href) => `<div class="a-kpi"><a href="${href}"><small>${label}</small><strong>${value}</strong></a></div>`;
  const body = `<div class="a-grid">
    ${kpi('Próximas sesiones', upcoming.length, A(app, '/agenda'))}
    ${kpi('Apartados vigentes', holds.length, A(app, '/reservas?estado=held'))}
    ${kpi('Anticipos (30 días)', mxn(deposits30.s), A(app, '/reservas'))}
    ${kpi('Saldos pendientes', mxn(outstanding), A(app, '/reservas?estado=confirmed'))}
    ${kpi('Entregas próximas sin publicar', deliveries.length, A(app, '/galerias'))}
    ${kpi('Galerías por vencer (7 días)', expiring.length, A(app, '/galerias'))}
    ${kpi('Pedidos pendientes', orders, A(app, '/pedidos'))}
    ${kpi('Cotizaciones por completar', quotes, A(app, '/cotizaciones'))}
    ${kpi('Almacenamiento disponible', gb(st.free), A(app, '/galerias'))}
    ${kpi('Errores (7 días)', errors, A(app, '/registros'))}
  </div>
  <div class="a-cols">
    <div class="a-card"><h2>Apartados por vencer</h2>${table([['Cliente', (b) => `<a href="${A(app, '/reservas/' + b.id)}">${esc(b.name)}</a>`], ['Fecha', (b) => dt(b.start_at)], ['Vence', (b) => dt(b.hold_expires_at)]], holds, { empty: 'Ninguno.' })}</div>
    <div class="a-card"><h2>Próximas sesiones</h2>${table([['Cliente', (b) => `<a href="${A(app, '/reservas/' + b.id)}">${esc(b.name)}</a>`], ['Fecha', (b) => dt(b.start_at)]], upcoming, { empty: 'Ninguna.' })}</div>
    <div class="a-card"><h2>Entregas próximas sin publicar</h2>${table([['Cliente', (b) => `<a href="${A(app, '/reservas/' + b.id)}">${esc(b.name)}</a>`], ['Entrega prevista', (b) => esc(b.delivery_due_date)]], deliveries, { empty: 'Al día.' })}</div>
    <div class="a-card"><h2>Almacenamiento</h2><p>${gb(st.used)} usados de ${gb(st.quota)} (${st.percent}%)</p><div class="bar"><span style="width:${Math.min(100, st.percent)}%"></span></div></div>
  </div>
  <p class="muted small">Los indicadores excluyen los registros de demostración.</p>`;
  return render('Inicio', body);
}

// ───────────── Reservas ─────────────
function bookingsList({ app, render, url }) {
  const estado = url.searchParams.get('estado');
  const rows = app.db.all(`SELECT b.*, c.name, c.phone, q.service_id FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN quotes q ON q.id = b.quote_id
    ${estado ? 'WHERE b.status = ?' : ''} ORDER BY b.start_at DESC LIMIT 300`, ...(estado ? [estado] : []));
  const filters = ['', 'held', 'confirmed', 'conflict', 'expired', 'cancelled', 'completed'].map((s) => `<a class="btn${estado === s || (!estado && !s) ? ' btn--solid' : ''}" href="${A(app, '/reservas' + (s ? '?estado=' + s : ''))}">${s ? STATUS[s] : 'Todas'}</a>`).join('');
  return render('Reservas', `<p class="a-row">${filters}</p>
  ${table([
    ['Fecha', (b) => `<a href="${A(app, '/reservas/' + b.id)}">${dt(b.start_at)}</a>`],
    ['Cliente', (b) => esc(b.name)],
    ['Servicio', (b) => esc(app.db.get('SELECT name_es FROM services WHERE id = ?', b.service_id).name_es)],
    ['Reserva', (b) => statusTag(b.status, STATUS) + (b.is_demo ? ' <span class="tag">DEMO</span>' : '')],
    ['Pagado / saldo', (b) => { const x = bookingBalance(app, b); return `${mxn(x.paid)} / ${mxn(x.outstanding)}`; }],
  ], rows)}
  <p><a class="btn" href="${A(app, '/exportar/reservas.csv')}">Exportar reservas (CSV)</a> <a class="btn" href="${A(app, '/exportar/pagos.csv')}">Exportar pagos (CSV)</a></p>`);
}

function bookingDetail({ app, render, params, csrf }) {
  const b = app.db.get('SELECT * FROM bookings WHERE id = ?', Number(params[0]));
  if (!b) return render('No encontrada', '');
  const c = app.db.get('SELECT * FROM customers WHERE id = ?', b.customer_id);
  const bal = bookingBalance(app, b);
  const q = bal.quote;
  const snap = bal.snapshot;
  const answers = jparse(q.answers, {});
  const payments = app.db.all('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at', b.id);
  const galleries = app.db.all('SELECT * FROM galleries WHERE booking_id = ?', b.id);
  const lang = q.lang;
  const wa = [
    ['Saludo y seguimiento', lang === 'en' ? `Hi ${c.name.split(' ')[0]}, this is Estefanía. Thank you for booking your ${snap?.service?.name_en} on ${formatDateTime(b.start_at, 'en')}.` : `Hola ${c.name.split(' ')[0]}, soy Estefanía. Gracias por reservar tu ${snap?.service?.name_es} el ${formatDateTime(b.start_at)}.`],
    ['Recordatorio de saldo', lang === 'en' ? `Hi ${c.name.split(' ')[0]}, a reminder that the remaining balance is ${mxn(bal.outstanding)}.` : `Hola ${c.name.split(' ')[0]}, te recuerdo que el saldo pendiente es de ${mxn(bal.outstanding)}.`],
    ['Logística', lang === 'en' ? `Hi ${c.name.split(' ')[0]}, I'm confirming the details for ${formatDateTime(b.start_at, 'en')} at ${answers.location || answers.city || ''}.` : `Hola ${c.name.split(' ')[0]}, te confirmo los detalles para el ${formatDateTime(b.start_at)} en ${answers.location || answers.city || ''}.`],
  ];
  const body = `<p>${statusTag(b.status, STATUS)} ${b.is_demo ? '<span class="tag">DEMO</span>' : ''} · ${esc(svcName(app, q))} · <strong>${dt(b.start_at)}</strong> → ${localTime(b.end_at)}</p>
  ${when(b.status === 'held', `<p class="a-flash">Apartado vigente hasta ${dt(b.hold_expires_at)}.</p>`)}
  ${when(b.status === 'conflict', `<p class="a-flash">Se recibió un pago después de vencer el apartado y el horario ya no estaba libre. Reprograma la reserva o registra la resolución.</p>`)}
  ${when(bal.needsReacceptance, `<p class="a-flash">La cotización cambió y espera nueva aceptación del cliente. Los pagos en línea se habilitan al aceptarla.</p>`)}
  <div class="a-cols">
    <div class="a-card"><h2>Cliente</h2><p>${esc(c.name)}<br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>${esc(c.phone || '')}</p>
      <h3 class="small">WhatsApp con mensaje preparado (lo envías tú)</h3><p class="a-row">${wa.map(([l, msg]) => `<a class="btn" target="_blank" rel="noopener" href="${waLink(c.phone, msg)}">${esc(l)}</a>`).join('')}</p>
      <h3 class="small">Respuestas</h3><dl>${Object.entries(answers).filter(([k]) => k !== 'groups').map(([k, v]) => `<dt class="muted small">${esc(k)}</dt><dd style="margin:0 0 6px">${esc(Array.isArray(v) ? v.join(', ') : String(v))}</dd>`).join('')}</dl>
      ${when(answers.groups?.length, table([['Grupo', (g) => esc(g.name)], ['Alumnos', (g) => g.students], ['Paquete', (g) => esc(g.package_key)]], answers.groups || []))}
    </div>
    <div class="a-card"><h2>Pagos</h2>
      <p>Total aceptado: <strong>${mxn(bal.total)}</strong> · Pagado: <strong>${mxn(bal.paid)}</strong> · Saldo: <strong>${mxn(bal.outstanding)}</strong></p>
      ${table([['Fecha', (p) => dt(p.created_at)], ['Concepto', (p) => esc({ deposit: 'Anticipo', balance: 'Saldo', adjustment: 'Ajuste', order: 'Pedido' }[p.purpose])], ['Método', (p) => esc(p.method) + (p.is_demo ? ' <span class="tag">DEMO</span>' : '')], ['Importe', (p) => mxn(p.amount_cents)], ['Estado', (p) => statusTag(p.status, STATUS)], ['Nota', (p) => esc(p.note || '')]], payments)}
      <h3 class="small">Registrar efectivo o ajuste</h3>
      <form method="post" action="${A(app, `/reservas/${b.id}/pago`)}" class="a-form">${csrfField(csrf)}
        <div class="a-inline">${select('method', 'cash', [['cash', 'Efectivo'], ['adjustment', 'Ajuste (+/−)']], { label: 'Tipo' })}
        ${select('purpose', b.status === 'held' ? 'deposit' : 'balance', [['balance', 'Saldo'], ['deposit', 'Anticipo']], { label: 'Concepto' })}
        ${input('amount', '', { label: 'Importe (MXN)', required: true, attrs: 'inputmode="decimal"' })}</div>
        ${input('note', '', { label: 'Nota (obligatoria en ajustes)' })}
        <button class="btn btn--solid">Registrar</button></form>
      ${when(app.demo() && ['held', 'confirmed'].includes(b.status) && bal.outstanding > 0, `<form method="post" action="${A(app, `/reservas/${b.id}/demo`)}" style="margin-top:10px">${csrfField(csrf)}<button class="btn">Simular confirmación del proveedor (DEMO)</button></form>`)}
    </div>
  </div>
  <div class="a-cols">
    <div class="a-card"><h2>Cotización aceptada</h2>
      ${snap ? table([['Concepto', (l) => esc(l.label.es) + (l.qty > 1 ? ` × ${l.qty}` : '')], ['Importe', (l) => mxn(l.amount_cents)]], snap.lines) + `<p class="small muted">Aceptada el ${dt(snap.accepted_at)} (revisión ${snap.revision}). Duración: ${snap.duration_min} min. Esta copia no cambia aunque modifiques los precios.</p>` : '<p>Sin aceptación.</p>'}
      <p><a href="${A(app, '/cotizaciones/' + q.id)}">Ver o modificar la cotización</a></p>
    </div>
    <div class="a-card"><h2>Fecha y entrega</h2>
      <form method="post" action="${A(app, `/reservas/${b.id}/reprogramar`)}" class="a-form">${csrfField(csrf)}
        <div class="a-inline">${input('date', localDate(b.start_at), { label: 'Fecha', type: 'date' })}${input('time', localTime(b.start_at), { label: 'Hora', type: 'time' })}</div>
        <button class="btn">Reprogramar (verifica disponibilidad)</button></form>
      <form method="post" action="${A(app, `/reservas/${b.id}/entrega`)}" class="a-form" style="margin-top:14px">${csrfField(csrf)}
        ${input('due', b.delivery_due_date || '', { label: 'Fecha prevista de entrega', type: 'date', help: 'Para escuelas, la fecha acordada.' })}<button class="btn">Guardar fecha de entrega</button></form>
      <h3 class="small" style="margin-top:16px">Galerías</h3>
      <p>${galleries.map((g) => `<a href="${A(app, '/galerias/' + g.id)}">${esc(g.title)}</a> ${statusTag(g.status, STATUS)}`).join('<br>') || 'Sin galería.'}</p>
      <p><a class="btn" href="${A(app, `/galerias/nueva?reserva=${b.id}`)}">Crear galería</a></p>
    </div>
  </div>
  ${when(!['cancelled', 'expired', 'completed'].includes(b.status), `<div class="a-card"><h2>Cancelación</h2>
    <p class="small muted">Política vigente: ${esc(app.setting('cancellation').es)} No se generan reembolsos ni penalizaciones automáticas: registra aquí la resolución acordada.</p>
    <form method="post" action="${A(app, `/reservas/${b.id}/cancelar`)}" class="a-form" data-confirm="¿Cancelar esta reserva y liberar la fecha?">${csrfField(csrf)}${textarea('note', '', { label: 'Resolución acordada', rows: 2 })}<button class="btn btn--danger">Cancelar reserva</button></form></div>`)}
  ${when(b.status === 'confirmed' && b.end_at < app.now(), `<form method="post" action="${A(app, `/reservas/${b.id}/realizada`)}">${csrfField(csrf)}<button class="btn">Marcar como realizada</button></form>`)}`;
  return render(`Reserva de ${c.name}`, body, { path: '/reservas' });
}

async function bookingPayment({ app, form, params, back }) {
  const cents = pesosToCents(String(form.amount || '').replace('-', ''));
  if (!cents) throw new Error('Importe inválido.');
  const negative = String(form.amount).trim().startsWith('-');
  if (form.method === 'adjustment' && !form.note) throw new Error('Los ajustes requieren una nota.');
  await recordManualPayment(app, { bookingId: Number(params[0]), amountCents: negative ? -cents : cents, method: form.method === 'adjustment' ? 'adjustment' : 'cash', purpose: form.purpose === 'deposit' ? 'deposit' : 'balance', note: form.note });
  return back(`/reservas/${params[0]}`, 'Pago registrado.');
}

// ───────────── Cotizaciones ─────────────
function quotesList({ app, render, url }) {
  const estado = url.searchParams.get('estado') || 'pending_admin';
  const rows = app.db.all('SELECT q.*, c.name FROM quotes q JOIN customers c ON c.id = q.customer_id WHERE q.status = ? ORDER BY q.created_at DESC LIMIT 300', estado);
  return render('Cotizaciones', `<p class="a-row">${['pending_admin', 'ready', 'accepted', 'cancelled'].map((s) => `<a class="btn${estado === s ? ' btn--solid' : ''}" href="${A(app, '/cotizaciones?estado=' + s)}">${STATUS[s]}</a>`).join('')}</p>
  ${table([['Recibida', (q) => `<a href="${A(app, '/cotizaciones/' + q.id)}">${dt(q.created_at)}</a>`], ['Cliente', (q) => esc(q.name)], ['Servicio', (q) => esc(svcName(app, q))],
    ['Pendiente', (q) => esc(jparse(q.pending_reasons, []).map((r) => r.es).join(' · '))], ['Total', (q) => mxn(q.total_cents)]], rows)}`);
}

function quoteDetail({ app, render, params, csrf }) {
  const q = app.db.get('SELECT * FROM quotes WHERE id = ?', Number(params[0]));
  if (!q) return render('No encontrada', '');
  const c = app.db.get('SELECT * FROM customers WHERE id = ?', q.customer_id);
  const lines = jparse(q.lines, []);
  const answers = jparse(q.answers, {});
  const reasons = jparse(q.pending_reasons, []);
  const editable = lines.filter((l) => l.kind !== 'custom');
  const custom = lines.filter((l) => l.kind === 'custom');
  const body = `<p>${statusTag(q.status, STATUS)} · Revisión ${q.revision} · ${esc(svcName(app, q))} · ${esc(c.name)} (${esc(c.email)}, ${esc(c.phone || '')}) · Idioma: ${q.lang.toUpperCase()}</p>
  ${when(reasons.length, `<p class="a-flash">Pendiente: ${esc(reasons.map((r) => r.es).join(' · '))}</p>`)}
  ${when(q.accepted_revision, `<p class="small muted">El cliente aceptó la revisión ${q.accepted_revision}. Si cambias algo, deberá aceptar de nuevo; la copia aceptada anterior se conserva.</p>`)}
  <div class="a-cols">
    <div class="a-card"><h2>Respuestas del cuestionario</h2><dl>${Object.entries(answers).map(([k, v]) => `<dt class="muted small">${esc(k)}</dt><dd style="margin:0 0 6px">${esc(k === 'groups' ? (v || []).map((g) => `${g.name}: ${g.students} (${g.package_key})`).join('; ') : Array.isArray(v) ? v.join(', ') : String(v))}</dd>`).join('')}</dl></div>
    <div class="a-card"><h2>Completar o ajustar</h2>
      <form method="post" action="${A(app, `/cotizaciones/${q.id}`)}" class="a-form">${csrfField(csrf)}
        ${editable.map((l) => l.amount_cents == null || l.set_by_admin
          ? pesos(`override:${l.key}`, l.set_by_admin ? l.amount_cents : null, { label: `${l.label.es}${l.qty > 1 ? ` (× ${l.qty})` : ''} — importe total`, help: 'Importe para este concepto en esta cotización. No cambia los precios generales.' })
          : `<p class="small">${esc(l.label.es)}${l.qty > 1 ? ` × ${l.qty}` : ''}: <strong>${mxn(l.amount_cents)}</strong></p>`).join('')}
        <fieldset class="a-card"><legend>Conceptos adicionales</legend>
          ${[...custom, {}, {}].map((l, i) => `<div class="a-inline">${input(`custom_label_${i}`, l.label?.es || '', { label: 'Concepto' })}${input(`custom_label_en_${i}`, l.label?.en || '', { label: 'Concepto (inglés)' })}${pesos(`custom_amount_${i}`, l.amount_cents ?? null, { label: 'Importe' })}</div>`).join('')}
        </fieldset>
        ${input('duration', q.duration_min || '', { label: 'Duración del servicio (minutos)', type: 'number', help: 'Necesaria para buscar disponibilidad.' })}
        ${input('discount_code', answers.discount_code || '', { label: 'Código de promoción' })}
        ${textarea('note', q.admin_note || '', { label: 'Nota visible para el cliente', rows: 2 })}
        ${checkbox('notify', true, { label: 'Enviar la cotización por correo al quedar completa' })}
        <button class="btn btn--solid">Guardar cotización</button></form></div>
  </div>
  <p><a class="btn" href="${app.base}${q.lang === 'en' ? '/en' : ''}/cotizacion/${q.token}" target="_blank">Ver como cliente ↗</a>
  ${when(q.status !== 'cancelled', `<form method="post" action="${A(app, `/cotizaciones/${q.id}/cancelar`)}" style="display:inline" data-confirm="¿Cancelar la cotización?">${csrfField(csrf)}<button class="btn btn--danger">Cancelar</button></form>`)}</p>`;
  return render('Cotización', body, { path: '/cotizaciones' });
}

function quoteSave({ app, form, params, back }) {
  const id = Number(params[0]);
  const overrides = {};
  for (const [k, v] of Object.entries(form)) if (k.startsWith('override:')) { const c = pesosToCents(v); if (c != null) overrides[k.slice(9)] = c; }
  const customLines = [];
  for (let i = 0; i < 20; i++) {
    const label = String(form[`custom_label_${i}`] || '').trim();
    const amount = pesosToCents(form[`custom_amount_${i}`]);
    if (label && amount != null) customLines.push({ id: i, label, label_en: String(form[`custom_label_en_${i}`] || '').trim(), amount_cents: amount });
  }
  const r = adminUpdateQuote(app, id, { overrides, customLines, duration: Number(form.duration) || null, note: String(form.note || '').trim() || null, discountCode: String(form.discount_code || '').trim() });
  if (r.complete && form.notify === '1') {
    const q = app.db.get('SELECT revision FROM quotes WHERE id = ?', id);
    schedule(app, 'email', app.now(), { kind: 'quote_ready', quoteId: id, revision: q.revision }, `mail:quote_ready:${id}:${q.revision}`);
  }
  return back(`/cotizaciones/${id}`, r.complete ? 'Cotización completa' + (form.notify === '1' ? ' y enviada.' : '.') : 'Guardada. Aún falta: ' + r.reasons.map((x) => x.es).join(' · '));
}

// ───────────── Agenda ─────────────
function agenda({ app, render, csrf, url }) {
  const now = app.now();
  const integ = app.integrations();
  const google = app.setting('google');
  const rows = app.db.all(`SELECT b.*, c.name FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.block_end > ? AND (b.status IN ('confirmed','conflict') OR (b.status = 'held' AND b.hold_expires_at > ?)) ORDER BY b.start_at`, now, now);
  const blocks = app.db.all('SELECT * FROM calendar_blocks WHERE end_at > ? ORDER BY start_at', now);
  const s = app.setting('booking');
  const body = `<div class="a-card"><h2>Google Calendar</h2>
    ${!integ.calendarConfigured ? '<p>No configurado: faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor. Mientras tanto la disponibilidad solo considera reservas, apartados y bloqueos de este panel.</p>'
      : integ.calendar ? `<p>Conectado desde ${dt(google.connected_at)}. Se consultan los ocupados y se crean eventos de reservas confirmadas.</p><form method="post" action="${A(app, '/agenda/google/desconectar')}">${csrfField(csrf)}<button class="btn">Desconectar</button></form>`
      : `<p>${google.last_error ? 'Se desconectó: ' + esc(google.last_error) + '. ' : ''}Sin conectar.</p><a class="btn btn--solid" href="${A(app, '/agenda/google/conectar')}">Conectar Google Calendar</a>`}
  </div>
  <div class="a-card"><h2>Horario de sesiones</h2><p>${esc(s.session_window?.start)}–${esc(s.session_window?.end)}, de lunes a domingo. Preparación: ${s.prep_min || 0} min · Traslado: ${s.travel_min || 0} min antes y después. Los eventos usan su horario real. <a href="${A(app, '/ajustes')}">Cambiar</a></p></div>
  <h2>Próximos compromisos</h2>
  ${table([['Inicio', (b) => `<a href="${A(app, '/reservas/' + b.id)}">${dt(b.start_at)}</a>`], ['Fin', (b) => localTime(b.end_at)], ['Cliente', (b) => esc(b.name)], ['Estado', (b) => statusTag(b.status, STATUS)]], rows, { empty: 'Sin compromisos.' })}
  <h2>Bloqueos manuales</h2>
  ${table([['Desde', (x) => dt(x.start_at)], ['Hasta', (x) => dt(x.end_at)], ['Motivo', (x) => esc(x.reason || '')], ['', (x) => `<form method="post" action="${A(app, `/agenda/bloqueos/${x.id}/borrar`)}">${csrfField(csrf)}<button class="btn btn--danger">Quitar</button></form>`]], blocks, { empty: 'Sin bloqueos.' })}
  <form method="post" action="${A(app, '/agenda/bloqueos')}" class="a-card a-form">${csrfField(csrf)}<h3>Bloquear fechas</h3>
    <div class="a-inline">${input('from_date', '', { label: 'Desde (fecha)', type: 'date', required: true })}${input('from_time', '00:00', { label: 'Hora', type: 'time' })}
    ${input('to_date', '', { label: 'Hasta (fecha)', type: 'date', required: true })}${input('to_time', '23:59', { label: 'Hora', type: 'time' })}</div>
    ${input('reason', '', { label: 'Motivo (privado)' })}<button class="btn btn--solid">Bloquear</button></form>`;
  return render('Agenda', body);
}

function blockCreate({ app, form, back }) {
  if (!isDate(form.from_date) || !isDate(form.to_date)) throw new Error('Fechas inválidas.');
  const start = zonedToUtc(form.from_date, isTime(form.from_time) ? form.from_time : '00:00');
  const end = zonedToUtc(form.to_date, isTime(form.to_time) ? form.to_time : '23:59');
  if (end <= start) throw new Error('El final debe ser posterior al inicio.');
  app.db.run('INSERT INTO calendar_blocks (start_at, end_at, reason, created_at) VALUES (?, ?, ?, ?)', start, end, String(form.reason || '').slice(0, 200), app.now());
  app.log('admin', 'bloqueo_creado', { details: `${dt(start)} – ${dt(end)}` });
  return back('/agenda', 'Fechas bloqueadas.');
}

function googleConnect({ app, res, csrf }) {
  if (!app.google.configured) throw new Error('Google Calendar no está configurado en el servidor.');
  const state = sign(`google:${csrf}`).slice(0, 32);
  return res.writeHead(303, { Location: app.google.authUrl(app.url('/admin/agenda/google/retorno'), state) }).end();
}

async function googleCallback({ app, url, csrf, back }) {
  if (url.searchParams.get('state') !== sign(`google:${csrf}`).slice(0, 32)) throw new Error('Solicitud de conexión inválida. Inténtalo de nuevo.');
  if (url.searchParams.get('error')) throw new Error(`Google rechazó la conexión: ${url.searchParams.get('error')}`);
  const refresh = await app.google.exchange(url.searchParams.get('code'), app.url('/admin/agenda/google/retorno'));
  saveConnection(app, refresh);
  return back('/agenda', 'Google Calendar conectado.');
}

// ───────────── Galerías ─────────────
function galleriesList({ app, render }) {
  const st = storageUsage(app);
  const rows = app.db.all('SELECT * FROM galleries WHERE status != ? ORDER BY created_at DESC LIMIT 300', 'deleted');
  const body = `<div class="a-card"><h2>Almacenamiento</h2><p>${gb(st.used)} usados · ${gb(st.reserved)} en cargas en curso · ${gb(st.free)} disponibles de ${gb(st.quota)} (${st.percent}%)</p><div class="bar"><span style="width:${Math.min(100, st.percent)}%"></span></div>
    <p class="small muted">Incluye originales, videos y vistas previas. Las descargas ZIP se generan al momento y no ocupan espacio. Capacidad configurable en Ajustes; ampliarla puede tener costo en tu proveedor de almacenamiento.</p></div>
  <p><a class="btn btn--solid" href="${A(app, '/galerias/nueva')}">Nueva galería</a></p>
  ${table([['Galería', (g) => `<a href="${A(app, '/galerias/' + g.id)}">${esc(g.title)}</a>${g.is_demo ? ' <span class="tag">DEMO</span>' : ''}`], ['Estado', (g) => statusTag(g.status, STATUS)],
    ['Archivos', (g) => { const u = galleryUsage(app, g.id); return `${u.files} · ${mb(u.originals + u.derived)}`; }], ['Vence', (g) => dt(g.expires_at)]], rows)}`;
  return render('Galerías', body);
}

function galleryNew({ app, render, csrf, url }) {
  const bookings = app.db.all(`SELECT b.id, b.start_at, c.name FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.status IN ('confirmed','completed') ORDER BY b.start_at DESC LIMIT 200`);
  const pre = url.searchParams.get('reserva');
  const body = `<form method="post" action="${A(app, '/galerias')}" class="a-form a-card">${csrfField(csrf)}
    ${select('booking_id', pre || '', [['', 'Sin reserva'], ...bookings.map((b) => [b.id, `${b.name} · ${formatDateTime(b.start_at)}`])], { label: 'Reserva' })}
    ${checkbox('without_booking', false, { label: 'Confirmo que esta galería no corresponde a una reserva (no se revisará saldo).' })}
    ${input('title', '', { label: 'Título de la sesión', required: true })}
    ${textarea('message', '', { label: 'Mensaje personal', rows: 3 })}
    ${select('audience', 'client', [['client', 'Cliente'], ['family', 'Alumno o familia (escuelas)'], ['group', 'Galería grupal (escuelas)']], { label: 'Tipo de entrega' })}
    ${select('lang', 'es', [['es', 'Español'], ['en', 'Inglés']], { label: 'Idioma de la galería y el correo' })}
    <p class="small muted">En escuelas crea una galería por alumno o familia para que nadie vea fotografías de otros alumnos, y una grupal si corresponde. No uses nombres completos de menores en el título.</p>
    <button class="btn btn--solid">Crear</button></form>`;
  return render('Nueva galería', body, { path: '/galerias' });
}

function galleryCreate({ app, form, back }) {
  const bookingId = Number(form.booking_id) || null;
  const lang = form.lang === 'en' ? 'en' : 'es';
  const id = createGallery(app, { bookingId, title: String(form.title || '').slice(0, 120), message: String(form.message || '').slice(0, 2000), audience: ['family', 'group'].includes(form.audience) ? form.audience : 'client', lang, withoutBookingConfirmed: form.without_booking === '1' });
  return back(`/galerias/${id}`, 'Galería creada. Sube los archivos.');
}

function galleryDetail({ app, render, params, csrf, url }) {
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', Number(params[0]));
  if (!g) return render('No encontrada', '');
  const files = app.db.all("SELECT * FROM gallery_files WHERE gallery_id = ? AND status != 'deleted' ORDER BY sort, id", g.id);
  const check = publishCheck(app, g.id);
  const access = app.db.all('SELECT * FROM gallery_access WHERE gallery_id = ? ORDER BY created_at DESC', g.id);
  const usage = galleryUsage(app, g.id);
  const newCode = url.searchParams.get('codigo');
  const thumbsBase = `${app.base}/g/${g.slug}/f`;
  const canEdit = ['draft', 'scheduled', 'released'].includes(g.status);
  const body = `<p>${statusTag(g.status, STATUS)} ${g.is_demo ? '<span class="tag">DEMO</span>' : ''} · ${usage.files} archivos · ${mb(usage.originals)} originales + ${mb(usage.derived)} vistas previas
    ${g.booking_id ? ` · <a href="${A(app, '/reservas/' + g.booking_id)}">Reserva</a>` : ' · Sin reserva'} · Vigencia: ${g.expires_at ? dt(g.expires_at) : 'empieza al liberar (' + (app.setting('gallery').validity_days || 21) + ' días)'}</p>
  ${when(newCode, `<div class="a-card"><h2>Código generado</h2><p class="code">${esc(newCode)}</p><p class="small">Cópialo ahora: por seguridad no se vuelve a mostrar. Quien tenga el enlace y este código podrá ver y descargar la galería mientras esté vigente.</p>
    <p>Enlace: <code>${esc(app.url(`${g.lang === 'en' ? '/en' : ''}/galeria/${g.slug}`))}</code></p></div>`)}
  ${when(canEdit && g.status !== 'released', `<div class="a-card"><h2>Subir archivos</h2>
    <p class="small muted">Se suben los originales sin recompresión. El navegador genera miniaturas para mostrar la galería. Las cargas grandes se reanudan si se interrumpen.</p>
    <input type="file" multiple accept="image/*,video/*" data-upload-input data-gallery="${g.id}">
    <ul class="upload-list" data-upload-list></ul></div>`)}
  <div class="a-card"><h2>Archivos</h2>
    <div class="thumbs">${files.map((f) => `<figure>${f.thumb_key || f.preview_key ? `<img src="${thumbsBase}/${f.id}/thumb" alt="" loading="lazy">` : `<div style="aspect-ratio:1;display:grid;place-items:center">${f.kind === 'video' ? 'Video' : '…'}</div>`}
      <figcaption>${esc(f.filename)}<br>${mb(f.original_size || 0)} ${f.status === 'uploading' ? '· cargando' : ''}${f.retained_for_orders ? ' · conservado para pedido' : ''}
      ${when(canEdit, `<form method="post" action="${A(app, `/galerias/${g.id}/archivos/${f.id}/portada`)}">${csrfField(csrf)}<button class="a-link">${g.cover_file_id === f.id ? '★ Portada' : 'Portada'}</button></form>
      <form method="post" action="${A(app, `/galerias/${g.id}/archivos/${f.id}/borrar`)}" data-confirm="¿Eliminar este archivo?">${csrfField(csrf)}<button class="a-link">Eliminar</button></form>`)}</figcaption></figure>`).join('') || '<p class="muted">Sin archivos.</p>'}</div></div>
  ${when(['draft', 'scheduled'].includes(g.status), `<div class="a-card"><h2>Publicar</h2>
    ${g.booking_id ? `<p>Saldo de la reserva: <strong>${mxn(check.outstanding)}</strong>${check.outstanding > 0 ? ' — la galería solo se libera con el saldo liquidado.' : ' — liquidado.'}</p>` : ''}
    ${when(check.outstanding > 0, `<form method="post" action="${A(app, `/reservas/${g.booking_id}/pago`)}" class="a-form">${csrfField(csrf)}<input type="hidden" name="method" value="cash"><input type="hidden" name="purpose" value="balance">
      <p class="small">Si el saldo se pagó en efectivo, regístralo explícitamente:</p><div class="a-inline">${input('amount', (check.outstanding / 100).toString(), { label: 'Efectivo recibido (MXN)' })}${input('note', 'Saldo en efectivo', { label: 'Nota' })}</div>
      <button class="btn">Registrar efectivo</button></form>`)}
    ${when(check.uploading, `<p class="a-flash">Hay ${check.uploading} archivo(s) cargándose.</p>`)}
    <form method="post" action="${A(app, `/galerias/${g.id}/publicar`)}" class="a-form" style="margin-top:12px">${csrfField(csrf)}
      ${input('release_date', '', { label: 'Liberar el (opcional)', type: 'date', help: 'Vacío = ahora. El correo de acceso se envía en la fecha de liberación.' })}${input('release_time', '09:00', { label: 'Hora', type: 'time' })}
      <button class="btn btn--solid"${check.outstanding > 0 || !check.files || check.uploading ? ' disabled' : ''}>Publicar</button></form>
    ${when(g.status === 'scheduled', `<p class="small">Programada para ${dt(g.release_at)}.</p>`)}</div>`)}
  ${when(g.status === 'released', `<div class="a-card"><h2>Vigencia</h2><p>Disponible hasta <strong>${dt(g.expires_at)}</strong></p>
    <form method="post" action="${A(app, `/galerias/${g.id}/ampliar`)}" class="a-inline">${csrfField(csrf)}${input('date', localDate(g.expires_at + 7 * DAY), { label: 'Nueva fecha', type: 'date' })}<button class="btn">Ampliar vigencia</button></form>
    <form method="post" action="${A(app, `/galerias/${g.id}/reenviar`)}" style="margin-top:10px">${csrfField(csrf)}<button class="btn">Reenviar correo de entrega con un código nuevo</button></form></div>`)}
  <div class="a-card"><h2>Accesos</h2>
    ${table([['Creado', (a) => dt(a.created_at)], ['Etiqueta', (a) => esc(a.label || '')], ['Último uso', (a) => dt(a.last_used_at)], ['Estado', (a) => a.revoked_at ? 'Revocado' : 'Vigente'],
      ['', (a) => a.revoked_at ? '' : `<form method="post" action="${A(app, `/galerias/${g.id}/accesos/${a.id}/revocar`)}">${csrfField(csrf)}<button class="btn btn--danger">Revocar</button></form>`]], access, { empty: 'Sin accesos. Se genera uno al liberar la galería.' })}
    <form method="post" action="${A(app, `/galerias/${g.id}/accesos`)}" class="a-inline" style="margin-top:10px">${csrfField(csrf)}${input('label', '', { label: 'Etiqueta (p. ej. “Abuelos”)' })}<button class="btn">Generar código</button></form>
    <p><a href="${app.base}${g.lang === 'en' ? '/en' : ''}/galeria/${g.slug}" target="_blank">Abrir enlace de la galería ↗</a></p></div>
  <div class="a-card"><h2>Eliminar</h2><form method="post" action="${A(app, `/galerias/${g.id}/eliminar`)}" data-confirm="Se eliminarán los archivos y se revocarán los accesos. Los originales usados en pedidos en curso se conservan. ¿Continuar?">${csrfField(csrf)}<button class="btn btn--danger">Eliminar galería y archivos</button></form></div>`;
  return render(g.title, body, { path: '/galerias', scripts: ['js/admin-upload.js'] });
}

async function galleryPublish({ app, form, params, back }) {
  const id = Number(params[0]);
  const releaseAt = isDate(form.release_date) ? zonedToUtc(form.release_date, isTime(form.release_time) ? form.release_time : '09:00') : null;
  try {
    const when = publishGallery(app, id, { releaseAt });
    if (when <= app.now()) await releaseGallery(app, id, when); // publicar ahora: se libera y envía el acceso de inmediato
  } catch (e) {
    const msg = { balance_due: 'Hay saldo pendiente. Regístralo antes de publicar.', empty_gallery: 'La galería no tiene archivos listos.', uploads_in_progress: 'Espera a que terminen las cargas.', invalid_status: 'La galería no se puede publicar en su estado actual.' }[e.code];
    throw new Error(msg || e.message);
  }
  return back(`/galerias/${id}`, releaseAt && releaseAt > app.now() ? 'Publicación programada.' : 'Publicada y liberada. El acceso se envió al cliente.');
}

// API de cargas (JSON)
async function uploadStart({ app, form, json }) {
  const galleryId = Number(form.gallery);
  if (form.variant) return json(200, await startDerivedUpload(app, Number(form.fileId), form.variant, Number(form.size)));
  if (form.media) return json(200, await startMediaUpload(app, Number(form.media), { size: Number(form.size), mime: String(form.mime || '') }));
  try {
    return json(200, await startFileUpload(app, galleryId, { filename: String(form.filename || 'archivo'), size: Number(form.size), mime: String(form.mime || ''), width: Number(form.width) || null, height: Number(form.height) || null }));
  } catch (e) {
    if (e.code === 'quota_exceeded') return json(413, { error: 'quota_exceeded', message: `No hay espacio suficiente (${gb(e.usage.free)} disponibles).` });
    throw e;
  }
}

async function uploadPart({ app, params, url, body, json }) {
  const buf = await body();
  try {
    return json(200, await putUploadPart(app, params[0], Number(url.searchParams.get('n')), buf));
  } catch (e) {
    return json(409, { error: e.code || e.message, next_part: e.next_part });
  }
}

async function uploadDone({ app, params, form, json }) {
  const u = await completeUpload(app, params[0]);
  if (form.width && u.gallery_file_id) app.db.run('UPDATE gallery_files SET width = COALESCE(width, ?), height = COALESCE(height, ?) WHERE id = ?', Number(form.width), Number(form.height), u.gallery_file_id);
  if (form.width && u.media_id) app.db.run('UPDATE media SET width = ?, height = ?, mime = COALESCE(?, mime) WHERE id = ?', Number(form.width), Number(form.height), form.mime || null, u.media_id);
  return json(200, { ok: true });
}

// ───────────── Pedidos ─────────────
function ordersList({ app, render }) {
  const rows = app.db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300');
  return render('Pedidos', `${table([['Fecha', (o) => `<a href="${A(app, '/pedidos/' + o.id)}">${dt(o.created_at)}</a>`], ['Cliente', (o) => esc(o.customer_name)], ['Estado', (o) => statusTag(o.status, STATUS) + (o.is_demo ? ' <span class="tag">DEMO</span>' : '')], ['Total', (o) => mxn(o.total_cents)]], rows, { empty: 'Sin pedidos.' })}
  <p><a class="btn" href="${A(app, '/exportar/pedidos.csv')}">Exportar pedidos (CSV)</a></p>`);
}

function orderDetail({ app, render, params, csrf }) {
  const o = app.db.get('SELECT * FROM orders WHERE id = ?', Number(params[0]));
  if (!o) return render('No encontrado', '');
  const g = app.db.get('SELECT * FROM galleries WHERE id = ?', o.gallery_id);
  const items = orderFiles(app, o.id);
  const payments = app.db.all('SELECT * FROM payments WHERE order_id = ?', o.id);
  const addr = jparse(o.address, {});
  const next = { paid: ['design_review', 'in_production', 'cancelled'], design_review: ['in_production', 'cancelled'], in_production: ['shipped', 'delivered'], shipped: ['delivered'], awaiting_shipping_quote: ['cancelled'], awaiting_payment: ['cancelled'] }[o.status] || [];
  const body = `<p>${statusTag(o.status, STATUS)} · Pedido ${esc(o.token.slice(0, 8).toUpperCase())} · Galería: <a href="${A(app, '/galerias/' + g.id)}">${esc(g.title)}</a> (${STATUS[g.status]})</p>
  <div class="a-cols"><div class="a-card"><h2>Cliente y envío</h2><p>${esc(o.customer_name)} · <a href="mailto:${esc(o.email)}">${esc(o.email)}</a> · ${esc(o.phone || '')}</p>
    <p>${esc([addr.street, addr.neighborhood, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', '))}</p>
    <p>Subtotal ${mxn(o.subtotal_cents)} · Envío ${o.shipping_cents == null ? '<strong>por cotizar</strong>' : mxn(o.shipping_cents)} · Total ${mxn(o.total_cents)}</p>
    ${when(['awaiting_shipping_quote', 'awaiting_payment'].includes(o.status), `<form method="post" action="${A(app, `/pedidos/${o.id}/envio`)}" class="a-inline">${csrfField(csrf)}${pesos('shipping', o.shipping_cents, { label: 'Costo de envío', required: true })}${input('carrier', o.carrier || '', { label: 'Paquetería' })}<button class="btn btn--solid">Guardar y avisar al cliente</button></form>`)}
    ${table([['Fecha', (p) => dt(p.created_at)], ['Importe', (p) => mxn(p.amount_cents)], ['Estado', (p) => statusTag(p.status, STATUS) + (p.is_demo ? ' DEMO' : '')], ['Proveedor', (p) => esc(p.provider || '')]], payments, { empty: 'Sin pagos.' })}
    ${when(app.demo() && o.status === 'awaiting_payment', `<form method="post" action="${A(app, `/pedidos/${o.id}/demo`)}">${csrfField(csrf)}<button class="btn">Simular confirmación del proveedor (DEMO)</button></form>`)}</div>
  <div class="a-card"><h2>Producción y envío</h2>
    <p class="small muted">Cobrar no inicia la producción ni el envío: actualízalos aquí. El cliente recibe un aviso en cada cambio relevante.</p>
    <form method="post" action="${A(app, `/pedidos/${o.id}`)}" class="a-form">${csrfField(csrf)}
      ${select('status', '', [['', 'Sin cambio de estado'], ...next.map((s) => [s, STATUS[s]])], { label: 'Nuevo estado' })}
      <div class="a-inline">${input('carrier', o.carrier || '', { label: 'Paquetería' })}${input('tracking', o.tracking || '', { label: 'Número de rastreo' })}</div>
      ${textarea('note', o.admin_note || '', { label: 'Nota interna', rows: 2 })}<button class="btn btn--solid">Guardar</button></form></div></div>
  <div class="a-card"><h2>Productos y fotografías</h2>${items.map((it) => `<h3 class="small">${esc(it.description)} × ${it.qty} — ${mxn(it.unit_price_cents * it.qty)}</h3>
    ${when(it.instructions, `<p class="small">Instrucciones: ${esc(it.instructions)}</p>`)}
    <div class="thumbs">${it.photos.map((ph, i) => `<figure>${ph.file?.original_key ? `<a href="${A(app, `/pedidos/${o.id}/archivo/${ph.file_id}`)}">Original ${i + 1}</a>` : 'Archivo no disponible'}
      <figcaption>${esc(ph.file?.filename || '')}<br>${ph.fit === 'fit' ? 'Sin recorte' : ph.crop ? `Recorte x${(ph.crop.x * 100).toFixed(0)}% y${(ph.crop.y * 100).toFixed(0)}% · ${(ph.crop.w * 100).toFixed(0)}×${(ph.crop.h * 100).toFixed(0)}%` : ''} · ${ph.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}</figcaption></figure>`).join('')}</div>`).join('')}</div>`;
  return render(`Pedido de ${o.customer_name}`, body, { path: '/pedidos' });
}

// Descarga de originales para producción (acceso restringido al panel, aunque la galería haya vencido)
async function orderFile({ app, params, res }) {
  const used = orderFiles(app, Number(params[0])).some((it) => it.photos.some((ph) => ph.file_id === Number(params[1])));
  const f = app.db.get('SELECT * FROM gallery_files WHERE id = ?', Number(params[1]));
  if (!used || !f?.original_key) throw new Error('Archivo no disponible.');
  const signed = app.storage.signedUrl(f.original_key, { expiresSec: 300, filename: f.filename });
  if (signed) return res.writeHead(302, { Location: signed }).end();
  const s = await app.storage.stream(f.original_key);
  res.writeHead(200, { 'Content-Type': f.mime || 'application/octet-stream', 'Content-Length': s.size, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`, 'Cache-Control': 'no-store' });
  s.body.pipe(res);
}

// ───────────── Mensajes y registros ─────────────
function messages({ app, render, csrf }) {
  const rows = app.db.all('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200');
  return render('Mensajes', table([['Fecha', (m) => dt(m.created_at)], ['De', (m) => `${esc(m.name)}<br><a href="mailto:${esc(m.email)}">${esc(m.email)}</a> ${esc(m.phone || '')}`],
    ['Mensaje', (m) => esc(m.message)], ['', (m) => `${m.phone ? `<a class="btn" target="_blank" rel="noopener" href="${waLink(m.phone, m.lang === 'en' ? `Hi ${m.name.split(' ')[0]}, this is Estefanía.` : `Hola ${m.name.split(' ')[0]}, soy Estefanía.`)}">WhatsApp</a>` : ''}
      ${m.handled ? 'Atendido' : `<form method="post" action="${A(app, `/mensajes/${m.id}`)}">${csrfField(csrf)}<button class="btn">Marcar atendido</button></form>`}`]], rows, { empty: 'Sin mensajes.' }));
}

function logs({ app, render, url }) {
  const level = url.searchParams.get('nivel');
  const integ = app.integrations();
  const rows = app.db.all(`SELECT * FROM activity_log ${level ? 'WHERE level = ?' : ''} ORDER BY at DESC LIMIT 300`, ...(level ? [level] : []));
  const failedJobs = app.db.all("SELECT * FROM jobs WHERE status IN ('failed') OR (status = 'pending' AND attempts > 0) ORDER BY updated_at DESC LIMIT 50");
  const emails = app.db.all('SELECT * FROM email_log ORDER BY created_at DESC LIMIT 100');
  const yes = (v, extra = '') => (v ? `Conectado${extra}` : 'Pendiente');
  const body = `<div class="a-card" id="integraciones"><h2>Integraciones</h2><ul>
    <li>Pagos con tarjeta (Stripe): ${yes(integ.card)}</li><li>PayPal: ${yes(integ.paypal)}</li><li>Correo (Resend): ${yes(integ.email)}</li>
    <li>Google Calendar: ${integ.calendar ? 'Conectado' : integ.calendarConfigured ? 'Configurado, sin conectar (Agenda)' : 'Pendiente'}</li>
    <li>Almacenamiento: ${integ.storage === 's3' ? 'Nube (S3 compatible)' : 'Disco local del servidor'}</li></ul>
    <p class="small muted">Lo que está pendiente no se simula: sin pagos no se cobra, sin correo los mensajes quedan registrados como “no enviados”.</p></div>
  <h2>Tareas con fallos o reintentos</h2>${table([['Tipo', (j) => esc(j.type)], ['Intentos', (j) => j.attempts], ['Estado', (j) => esc(j.status)], ['Error', (j) => esc(j.last_error || '')], ['Próximo intento', (j) => j.status === 'pending' ? dt(j.run_at) : '—']], failedJobs, { empty: 'Sin fallos.' })}
  <h2>Correos</h2>${table([['Fecha', (e) => dt(e.created_at)], ['Para', (e) => esc(e.to_email)], ['Asunto', (e) => esc(e.subject)], ['Estado', (e) => esc({ sent: 'Enviado', failed: 'Falló', not_sent_demo: 'No enviado (correo sin conectar)' }[e.status] || e.status) + (e.error ? `<br><small>${esc(e.error)}</small>` : '')]], emails, { empty: 'Sin correos.' })}
  <h2>Actividad</h2><p class="a-row">${['', 'error', 'warning', 'info'].map((l) => `<a class="btn${(level || '') === l ? ' btn--solid' : ''}" href="${A(app, '/registros' + (l ? '?nivel=' + l : ''))}">${{ '': 'Todo', error: 'Errores', warning: 'Avisos', info: 'Información' }[l]}</a>`).join('')}</p>
  ${table([['Fecha', (r) => dt(r.at)], ['Quién', (r) => esc(r.actor)], ['Acción', (r) => `${r.level !== 'info' ? `<span class="tag tag--${r.level === 'error' ? 'error' : 'pending'}">${r.level}</span> ` : ''}${esc(r.action)}`], ['Detalle', (r) => esc(r.details || '')]], rows)}`;
  return render('Registros', body);
}

// ───────────── Exportación CSV ─────────────
function csv(rows, cols) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [cols.map((c) => cell(c[0])).join(','), ...rows.map((r) => cols.map((c) => cell(c[1](r))).join(','))].join('\r\n');
}

function exportCsv({ app, params, res }) {
  const kind = params[0];
  const cents = (c) => (c == null ? '' : (c / 100).toFixed(2));
  let out;
  if (kind === 'reservas') {
    const rows = app.db.all('SELECT b.*, c.name, c.email, c.phone, q.service_id FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN quotes q ON q.id = b.quote_id ORDER BY b.start_at');
    out = csv(rows, [['Inicio', (r) => formatDateTime(r.start_at)], ['Cliente', (r) => r.name], ['Correo', (r) => r.email], ['Teléfono', (r) => r.phone], ['Servicio', (r) => app.db.get('SELECT name_es FROM services WHERE id = ?', r.service_id).name_es],
      ['Estado', (r) => STATUS[r.status]], ['Total', (r) => cents(bookingBalance(app, r).total)], ['Pagado', (r) => cents(bookingBalance(app, r).paid)], ['Saldo', (r) => cents(bookingBalance(app, r).outstanding)], ['Entrega prevista', (r) => r.delivery_due_date], ['Demo', (r) => (r.is_demo ? 'sí' : '')]]);
  } else if (kind === 'pagos') {
    const rows = app.db.all('SELECT * FROM payments ORDER BY created_at');
    out = csv(rows, [['Fecha', (r) => formatDateTime(r.created_at)], ['Tipo', (r) => (r.order_id ? 'Producto' : 'Servicio')], ['Concepto', (r) => r.purpose], ['Método', (r) => r.method], ['Proveedor', (r) => r.provider], ['Referencia', (r) => r.provider_payment_ref], ['Importe', (r) => cents(r.amount_cents)], ['Estado', (r) => STATUS[r.status]], ['Nota', (r) => r.note], ['Demo', (r) => (r.is_demo ? 'sí' : '')]]);
  } else if (kind === 'pedidos') {
    const rows = app.db.all('SELECT * FROM orders ORDER BY created_at');
    out = csv(rows, [['Fecha', (r) => formatDateTime(r.created_at)], ['Pedido', (r) => r.token.slice(0, 8).toUpperCase()], ['Cliente', (r) => r.customer_name], ['Correo', (r) => r.email], ['Estado', (r) => STATUS[r.status]], ['Subtotal', (r) => cents(r.subtotal_cents)], ['Envío', (r) => cents(r.shipping_cents)], ['Total', (r) => cents(r.total_cents)], ['Paquetería', (r) => r.carrier], ['Rastreo', (r) => r.tracking], ['Demo', (r) => (r.is_demo ? 'sí' : '')]]);
  } else throw new Error('Exportación desconocida');
  app.log('admin', 'exportacion', { details: kind });
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}.csv"`, 'Cache-Control': 'no-store' });
  res.end(out);
}

const R = (re, h) => [re, h];
export const routes = [
  R(/^$/, { GET: dashboard }),
  R(/^\/reservas$/, { GET: bookingsList }),
  R(/^\/reservas\/(\d+)$/, { GET: bookingDetail }),
  R(/^\/reservas\/(\d+)\/pago$/, { POST: bookingPayment }),
  R(/^\/reservas\/(\d+)\/demo$/, { POST: async ({ app, params, back }) => { const b = app.db.get('SELECT * FROM bookings WHERE id = ?', Number(params[0])); await demoConfirm(app, demoPending(app, { booking: b })); return back(`/reservas/${params[0]}`, 'Confirmación DEMO registrada.'); } }),
  R(/^\/reservas\/(\d+)\/cancelar$/, { POST: ({ app, form, params, back }) => { cancelBooking(app, Number(params[0]), String(form.note || '').slice(0, 1000)); return back(`/reservas/${params[0]}`, 'Reserva cancelada.'); } }),
  R(/^\/reservas\/(\d+)\/realizada$/, { POST: ({ app, params, back }) => { app.db.run("UPDATE bookings SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'confirmed'", app.now(), Number(params[0])); app.log('admin', 'reserva_realizada', { entity: 'booking', id: Number(params[0]) }); return back(`/reservas/${params[0]}`, 'Marcada como realizada.'); } }),
  R(/^\/reservas\/(\d+)\/reprogramar$/, { POST: async ({ app, form, params, back }) => { if (!isDate(form.date) || !isTime(form.time)) throw new Error('Fecha u hora inválida.'); await rescheduleBooking(app, Number(params[0]), zonedToUtc(form.date, form.time)); return back(`/reservas/${params[0]}`, 'Reserva reprogramada.'); } }),
  R(/^\/reservas\/(\d+)\/entrega$/, { POST: ({ app, form, params, back }) => { if (form.due && !isDate(form.due)) throw new Error('Fecha inválida.'); const id = Number(params[0]); app.db.run('UPDATE bookings SET delivery_due_date = ?, updated_at = ? WHERE id = ?', form.due || null, app.now(), id); cancelJobs(app, `delivery_check:${id}:%`); scheduleBookingJobs(app, id); app.log('admin', 'entrega_actualizada', { entity: 'booking', id, details: form.due }); return back(`/reservas/${id}`, 'Fecha de entrega guardada.'); } }),
  R(/^\/cotizaciones$/, { GET: quotesList }),
  R(/^\/cotizaciones\/(\d+)$/, { GET: quoteDetail, POST: quoteSave }),
  R(/^\/cotizaciones\/(\d+)\/cancelar$/, { POST: ({ app, params, back }) => { app.db.run("UPDATE quotes SET status = 'cancelled', updated_at = ? WHERE id = ?", app.now(), Number(params[0])); app.log('admin', 'cotizacion_cancelada', { entity: 'quote', id: Number(params[0]) }); return back('/cotizaciones', 'Cotización cancelada.'); } }),
  R(/^\/agenda$/, { GET: agenda }),
  R(/^\/agenda\/bloqueos$/, { POST: blockCreate }),
  R(/^\/agenda\/bloqueos\/(\d+)\/borrar$/, { POST: ({ app, params, back }) => { app.db.run('DELETE FROM calendar_blocks WHERE id = ?', Number(params[0])); app.log('admin', 'bloqueo_eliminado'); return back('/agenda', 'Bloqueo eliminado.'); } }),
  R(/^\/agenda\/google\/conectar$/, { GET: googleConnect }),
  R(/^\/agenda\/google\/retorno$/, { GET: googleCallback }),
  R(/^\/agenda\/google\/desconectar$/, { POST: ({ app, back }) => { disconnect(app); return back('/agenda', 'Google Calendar desconectado.'); } }),
  R(/^\/galerias$/, { GET: galleriesList, POST: galleryCreate }),
  R(/^\/galerias\/nueva$/, { GET: galleryNew }),
  R(/^\/galerias\/(\d+)$/, { GET: galleryDetail }),
  R(/^\/galerias\/(\d+)\/publicar$/, { POST: galleryPublish }),
  R(/^\/galerias\/(\d+)\/ampliar$/, { POST: ({ app, form, params, back }) => { if (!isDate(form.date)) throw new Error('Fecha inválida.'); extendGallery(app, Number(params[0]), zonedToUtc(form.date, '23:59')); return back(`/galerias/${params[0]}`, 'Vigencia ampliada.'); } }),
  R(/^\/galerias\/(\d+)\/reenviar$/, { POST: async ({ app, params, back }) => { app.db.run("DELETE FROM email_log WHERE dedupe_key LIKE ?", `mail:gallery_delivery:${Number(params[0])}:%`); const r = await sendDeliveryEmail(app, Number(params[0])); return back(`/galerias/${params[0]}`, { sent: 'Correo enviado.', not_sent_demo: 'Correo registrado, pero no enviado: el correo no está conectado.', no_recipient: 'La galería no tiene destinatario.' }[r] || `Resultado: ${r}`); } }),
  R(/^\/galerias\/(\d+)\/accesos$/, { POST: ({ app, form, params, back }) => { const { code } = createAccess(app, Number(params[0]), String(form.label || '').slice(0, 60) || null); return back(`/galerias/${params[0]}?codigo=${encodeURIComponent(code)}`, 'Código generado.'); } }),
  R(/^\/galerias\/(\d+)\/accesos\/(\d+)\/revocar$/, { POST: ({ app, params, back }) => { const a = app.db.get('SELECT * FROM gallery_access WHERE id = ? AND gallery_id = ?', Number(params[1]), Number(params[0])); if (a) revokeAccess(app, a.id); return back(`/galerias/${params[0]}`, 'Acceso revocado.'); } }),
  R(/^\/galerias\/(\d+)\/archivos\/(\d+)\/borrar$/, { POST: async ({ app, params, back }) => { const f = app.db.get('SELECT * FROM gallery_files WHERE id = ? AND gallery_id = ?', Number(params[1]), Number(params[0])); if (f) { await deleteFile(app, f.id); app.log('admin', 'archivo_eliminado', { entity: 'gallery', id: f.gallery_id, details: f.filename }); } return back(`/galerias/${params[0]}`, 'Archivo eliminado.'); } }),
  R(/^\/galerias\/(\d+)\/archivos\/(\d+)\/portada$/, { POST: ({ app, params, back }) => { app.db.run('UPDATE galleries SET cover_file_id = ? WHERE id = ?', Number(params[1]), Number(params[0])); return back(`/galerias/${params[0]}`, 'Portada actualizada.'); } }),
  R(/^\/galerias\/(\d+)\/eliminar$/, { POST: async ({ app, params, back }) => { await purgeGallery(app, Number(params[0]), { force: true }); return back('/galerias', 'Galería eliminada.'); } }),
  R(/^\/api\/uploads$/, { POST: uploadStart }),
  R(/^\/api\/uploads\/([\w-]+)$/, { GET: ({ app, params, json }) => json(200, uploadStatus(app, params[0]) || { error: 'not_found' }) }),
  R(/^\/api\/uploads\/([\w-]+)\/parte$/, { POST: uploadPart, PUT: uploadPart }),
  R(/^\/api\/uploads\/([\w-]+)\/completar$/, { POST: uploadDone }),
  R(/^\/pedidos$/, { GET: ordersList }),
  R(/^\/pedidos\/(\d+)$/, { GET: orderDetail, POST: ({ app, form, params, back }) => { updateOrder(app, Number(params[0]), { status: form.status || null, carrier: form.carrier, tracking: form.tracking, note: form.note }); return back(`/pedidos/${params[0]}`, 'Pedido actualizado.'); } }),
  R(/^\/pedidos\/(\d+)\/envio$/, { POST: ({ app, form, params, back }) => { const c = pesosToCents(form.shipping); if (c == null) throw new Error('Indica el costo de envío.'); setShipping(app, Number(params[0]), c, form.carrier || null); return back(`/pedidos/${params[0]}`, 'Envío guardado; se avisó al cliente.'); } }),
  R(/^\/pedidos\/(\d+)\/demo$/, { POST: async ({ app, params, back }) => { const o = app.db.get('SELECT * FROM orders WHERE id = ?', Number(params[0])); await demoConfirm(app, demoPending(app, { order: o })); return back(`/pedidos/${params[0]}`, 'Confirmación DEMO registrada.'); } }),
  R(/^\/pedidos\/(\d+)\/archivo\/(\d+)$/, { GET: orderFile }),
  R(/^\/mensajes$/, { GET: messages }),
  R(/^\/mensajes\/(\d+)$/, { POST: ({ app, params, back }) => { app.db.run('UPDATE messages SET handled = 1 WHERE id = ?', Number(params[0])); return back('/mensajes'); } }),
  R(/^\/registros$/, { GET: logs }),
  R(/^\/exportar\/(reservas|pagos|pedidos)\.csv$/, { GET: exportCsv }),
];

export { token };
