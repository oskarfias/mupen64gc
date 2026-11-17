// Reserva: servicio → cuestionario → cotización → disponibilidad → apartado → anticipo → confirmación.
import { esc, when } from '../html.mjs';
import { layout, P } from '../layout.mjs';
import { t } from '../../i18n.mjs';
import { json } from '../../db.mjs';
import { mxn } from '../../lib/money.mjs';
import { formatDateTime, localDate, addDays } from '../../lib/time.mjs';
import { currentPackages, currentQuestionnaire, quoteSnapshot } from '../../domain/quote.mjs';
import { bookingBalance } from '../../domain/booking.mjs';
import { priceLabel } from './public.mjs';

const lbl = (f, lang) => (lang === 'en' ? f.label_en : f.label_es);
const opt = (o, lang) => (lang === 'en' ? o[2] : o[1]);

function fieldHtml(f, lang, prefix) {
  const id = `${prefix}-${f.name}`;
  const req = f.required ? ' required' : '';
  const show = f.showIf ? ` data-show-if="${esc(f.showIf[0])}=${esc(f.showIf[1])}"` : '';
  const label = `<label for="${id}">${esc(lbl(f, lang))}${f.required ? '' : ` <span class="muted">(${t(lang).common.optional})</span>`}</label>`;
  switch (f.type) {
    case 'textarea': return `<div class="field"${show}>${label}<textarea class="input" id="${id}" name="${f.name}"${req}></textarea></div>`;
    case 'number': return `<div class="field"${show}>${label}<input class="input" id="${id}" name="${f.name}" type="number" inputmode="numeric" min="${f.min ?? 0}"${f.default != null ? ` value="${f.default}"` : ''}${req}></div>`;
    case 'date': return `<div class="field"${show}>${label}<input class="input" id="${id}" name="${f.name}" type="date"${req}></div>`;
    case 'time': return `<div class="field"${show}>${label}<input class="input" id="${id}" name="${f.name}" type="time" step="900"${req}></div>`;
    case 'select': return `<div class="field"${show}>${label}<select class="input" id="${id}" name="${f.name}"${req}>${(f.options || []).map((o) => `<option value="${esc(o[0])}">${esc(opt(o, lang))}</option>`).join('')}</select></div>`;
    case 'checkboxes': return `<fieldset class="field"${show}><legend>${esc(lbl(f, lang))}</legend>${(f.options || []).map((o) => `<label class="check"><input type="checkbox" name="${f.name}[]" value="${esc(o[0])}"> <span>${esc(opt(o, lang))}</span></label>`).join('')}</fieldset>`;
    case 'groups': return `<fieldset class="field" data-groups><legend>${esc(lbl(f, lang))}</legend><div class="groups-table" data-group-rows></div>
      <button type="button" class="link" data-add-group style="justify-self:start;background:none;border:0;cursor:pointer">${lang === 'en' ? '+ Add group' : '+ Agregar grupo'}</button></fieldset>`;
    default: return `<div class="field"${show}>${label}<input class="input" id="${id}" name="${f.name}"${req}></div>`;
  }
}

export function bookingForm(app, lang, { preselect = null } = {}) {
  const tx = t(lang);
  const svc = app.db.all('SELECT * FROM services WHERE active = 1 ORDER BY sort');
  const groupsTpl = {};
  const body = `<section style="padding-top:40px"><div class="wrap narrow">
  <p class="eyebrow">${tx.nav.book}</p>
  <h1 style="font-size:clamp(2rem,6vw,3.2rem)">${tx.booking.title}</h1>
  <ol class="progress" aria-hidden="true">${tx.booking.steps.map((_, i) => `<li${i === 0 ? ' class="current"' : ''}></li>`).join('')}</ol>
  <p class="progress-label" data-progress-label aria-live="polite">1 / 3 · ${tx.booking.steps[0]}</p>
  <form class="form" data-booking-form novalidate>
    <div class="step" data-step="1">
      <fieldset class="field"><legend>${tx.booking.chooseService}</legend><div class="service-pick">
      ${svc.map((s) => {
        const pk = currentPackages(app, s.id);
        return `<label><span><input type="radio" name="service" value="${s.slug}" required${preselect === s.slug ? ' checked' : ''}> ${esc(lang === 'en' ? s.name_en : s.name_es)}</span><span class="muted small">${pk.length > 1 ? tx.common.from + ' ' : ''}${esc(priceLabel(pk[0], lang))}</span></label>`;
      }).join('')}
      </div></fieldset>
      <div class="btn-row"><button type="button" class="btn btn--solid" data-next>${tx.cta.next}</button></div>
    </div>
    <div class="step" data-step="2" hidden>
      ${svc.map((s) => {
        const q = currentQuestionnaire(app, s.id);
        const pk = currentPackages(app, s.id);
        if (s.kind === 'school') groupsTpl[s.slug] = pk.map((p) => [p.package_key, lang === 'en' ? p.name_en : p.name_es, priceLabel(p, lang)]);
        return `<div data-service-fields="${s.slug}" hidden>
          ${when(pk.length > 1 && s.kind !== 'school', `<div class="field"><label for="${s.slug}-pk">${tx.booking.package}</label><select class="input" id="${s.slug}-pk" name="package_key">${pk.map((p) => `<option value="${p.package_key}">${esc(lang === 'en' ? p.name_en : p.name_es)} — ${esc(priceLabel(p, lang))}</option>`).join('')}</select></div>`)}
          ${(q?.fields || []).map((f) => fieldHtml(f, lang, s.slug)).join('')}
        </div>`;
      }).join('')}
      <div class="grid-2">
        <div class="field"><label for="b-city">${tx.booking.city}</label><input class="input" id="b-city" name="city" required list="cities" autocomplete="address-level2"><datalist id="cities"><option value="Querétaro"><option value="Irapuato"></datalist></div>
        <div class="field"><label for="b-loc">${tx.booking.location} <span class="muted">(${tx.common.optional})</span></label><input class="input" id="b-loc" name="location"></div>
      </div>
      <p class="small muted">${esc(app.content('travel_note', lang))}</p>
      <div class="btn-row"><button type="button" class="btn" data-prev>${tx.cta.back}</button><button type="button" class="btn btn--solid" data-next>${tx.cta.next}</button></div>
    </div>
    <div class="step" data-step="3" hidden>
      <div class="field"><label for="b-name">${tx.booking.name}</label><input class="input" id="b-name" name="name" required autocomplete="name"></div>
      <div class="grid-2">
        <div class="field"><label for="b-phone">${tx.booking.phone}</label><input class="input" id="b-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel"></div>
        <div class="field"><label for="b-email">${tx.booking.email}</label><input class="input" id="b-email" name="email" type="email" required autocomplete="email"></div>
      </div>
      <div class="field"><label for="b-code">${tx.booking.discount}</label><input class="input" id="b-code" name="discount_code" autocomplete="off"></div>
      <label class="check"><input type="checkbox" name="privacy" value="1" required> <span>${tx.booking.privacy} <a href="${P(app, lang, '/politicas/privacidad')}" target="_blank">${tx.footer.privacy}</a></span></label>
      <label class="check"><input type="checkbox" name="portfolio_consent" value="1"> <span>${tx.booking.portfolioConsent}</span></label>
      <div class="btn-row"><button type="button" class="btn" data-prev>${tx.cta.back}</button><button type="submit" class="btn btn--solid">${tx.booking.submit}</button></div>
    </div>
    <p class="status" role="status" aria-live="polite" data-status></p>
  </form>
  <noscript><p class="notice">${lang === 'en' ? 'This form needs JavaScript. You can also message me on WhatsApp.' : 'Este formulario necesita JavaScript. También puedes escribirme por WhatsApp.'}</p></noscript>
  <script type="application/json" id="booking-data">${JSON.stringify({ lang, groups: groupsTpl, steps: tx.booking.steps, api: P(app, lang, '/api/cotizar'), msgs: { invalid: tx.forms.invalid, error: tx.common.error, saving: tx.booking.saving, student: lang === 'en' ? 'Students' : 'Alumnos', group: lang === 'en' ? 'Group' : 'Grupo', remove: lang === 'en' ? 'Remove' : 'Quitar' } }).replace(/</g, '\\u003c')}</script>
</div></section>`;
  return layout(app, { lang, path: '/reservar', title: lang === 'en' ? 'Book your session | Estefanía Torres' : 'Reserva tu sesión | Estefanía Torres', description: lang === 'en' ? 'Choose your service, get a quote and hold your date.' : 'Elige tu servicio, recibe tu cotización y aparta tu fecha.', body, scripts: ['js/booking.js'] });
}

const lineLabel = (l, lang) => (lang === 'en' ? l.label.en : l.label.es);

function breakdown(lines, q, lang, tx) {
  return `<table class="breakdown"><tbody>
    ${lines.map((l) => `<tr><td>${esc(lineLabel(l, lang))}${l.qty > 1 ? ` <span class="muted">× ${l.qty}</span>` : ''}</td><td>${l.amount_cents == null ? `<em>${tx.common.pending}</em>` : mxn(l.amount_cents)}</td></tr>`).join('')}
    ${when(q.discount_cents, `<tr><td>${tx.booking.discountLine}</td><td>− ${mxn(q.discount_cents)}</td></tr>`)}
    ${when(q.total_cents != null, `<tr class="total"><td>${tx.booking.total}</td><td>${mxn(q.total_cents)}</td></tr>
      <tr><td>${tx.booking.deposit}</td><td>${mxn(q.deposit_cents)}</td></tr>
      <tr><td>${tx.booking.balance}</td><td>${mxn(q.balance_cents)}</td></tr>`)}
  </tbody></table>`;
}

export function quotePage(app, lang, quote, { error = null } = {}) {
  const tx = t(lang);
  const service = app.db.get('SELECT * FROM services WHERE id = ?', quote.service_id);
  const lines = json(quote.lines, []);
  const answers = json(quote.answers, {});
  const snapshot = quoteSnapshot(quote);
  const accepted = quote.status === 'accepted' && quote.accepted_revision === quote.revision;
  const changed = quote.status === 'ready' && quote.accepted_revision != null;
  const activeBooking = app.db.get("SELECT * FROM bookings WHERE quote_id = ? AND status IN ('held','confirmed','conflict') ORDER BY id DESC", quote.id);
  const minDate = localDate(app.now());
  let main;
  if (quote.status === 'pending_admin') {
    main = `<h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.booking.pendingTitle}</h1><p class="lead">${tx.booking.pendingText}</p>${breakdown(lines, quote, lang, tx)}`;
  } else if (quote.status === 'cancelled') {
    main = `<h1>${tx.status.cancelled}</h1>`;
  } else {
    main = `<h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.booking.quoteTitle}</h1>
      <p class="muted">${esc(lang === 'en' ? service.name_en : service.name_es)}${answers.city ? ' · ' + esc(answers.city) : ''}</p>
      ${when(changed, `<p class="notice">${tx.booking.changed}</p>`)}
      ${breakdown(lines, quote, lang, tx)}
      <p class="small muted" style="margin-top:12px">${tx.common.mxn} ${tx.booking.balanceNote}</p>
      ${when(quote.admin_note, `<p class="notice">${esc(quote.admin_note)}</p>`)}
      <details style="margin:20px 0"><summary>${lang === 'en' ? 'Service conditions' : 'Condiciones del servicio'}</summary>
        <ul class="conditions">${String(app.content('general_conditions', lang)).split('|').map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <p class="notice" style="margin-top:12px"><strong>${tx.booking.cancelPolicy}.</strong> ${esc(app.setting('cancellation')[lang] || app.setting('cancellation').es)}</p>
      </details>
      ${accepted ? '' : `<form method="post" action="${P(app, lang, `/cotizacion/${quote.token}/aceptar`)}" class="form">
        <input type="hidden" name="revision" value="${quote.revision}">
        <label class="check"><input type="checkbox" name="terms" value="1" required> <span>${tx.booking.terms} <a href="${P(app, lang, '/politicas/reservas')}" target="_blank">${tx.footer.bookings}</a></span></label>
        <button class="btn btn--solid" type="submit">${tx.cta.accept}</button>
      </form>`}
      ${when(accepted && activeBooking, `<p class="notice">${lang === 'en' ? 'You already have a booking for this quote.' : 'Ya tienes una reserva para esta cotización.'} <a href="${P(app, lang, `/reserva/${activeBooking?.token}`)}">${lang === 'en' ? 'See booking' : 'Ver reserva'}</a></p>`)}
      ${when(accepted && (!activeBooking || activeBooking.status === 'held'), `<div class="box" style="margin-top:28px" data-availability
          data-api="${P(app, lang, '/api/disponibilidad')}" data-hold="${P(app, lang, '/api/apartar')}" data-token="${quote.token}" data-event="${['event', 'wedding'].includes(service.kind) ? '1' : ''}">
        <h2 class="h3">${tx.booking.pickDate}</h2>
        <div class="grid-2">
          <div class="field"><label for="av-date">${tx.booking.date}</label><input class="input" id="av-date" type="date" min="${minDate}" max="${addDays(minDate, app.setting('booking').horizon_days || 365)}" value="${esc(answers.date && answers.date >= minDate ? answers.date : '')}"></div>
          ${['event', 'wedding'].includes(service.kind) ? `<div class="field"><label for="av-time">${tx.booking.eventTime}</label><input class="input" id="av-time" type="time" step="900" value="${esc(answers.start_time || '')}"></div>` : ''}
        </div>
        <button type="button" class="btn" data-check style="margin:14px 0">${tx.booking.checkAvailability}</button>
        <div class="slots" data-slots role="radiogroup" aria-label="${tx.booking.time}"></div>
        <p class="status" role="status" aria-live="polite" data-av-status></p>
        <button type="button" class="btn btn--solid" data-hold-btn hidden>${tx.cta.hold}</button>
        <script type="application/json" id="av-msgs">${JSON.stringify({ noSlots: tx.booking.noSlots, calendar: tx.booking.calendarError, taken: tx.booking.slotTaken, error: tx.common.error, loading: tx.common.loading }).replace(/</g, '\\u003c')}</script>
      </div>`)}`;
  }
  const body = `<section style="padding-top:40px"><div class="wrap narrow">
    <ol class="progress" aria-hidden="true">${tx.booking.steps.map((_, i) => `<li class="${i < (accepted ? 4 : 3) ? 'done' : i === (accepted ? 4 : 3) ? 'current' : ''}"></li>`).join('')}</ol>
    ${when(error, `<p class="notice" role="alert">${esc(error)}</p>`)}
    ${main}
  </div></section>`;
  return layout(app, { lang, path: `/cotizacion/${quote.token}`, title: tx.booking.quoteTitle, description: '', body, noindex: true, scripts: accepted ? ['js/booking.js'] : [] });
}

export function bookingPage(app, lang, booking, { flash = null, isAdmin = false } = {}) {
  const tx = t(lang);
  const bal = bookingBalance(app, booking);
  const snapshot = bal.snapshot;
  const integ = app.integrations();
  const service = snapshot?.service;
  const payButtons = (label) => `${integ.payments
    ? `<form method="post" action="${P(app, lang, '/pago/iniciar')}" class="btn-row">
        <input type="hidden" name="booking" value="${booking.token}">
        ${when(integ.card, `<button class="btn btn--solid" name="method" value="card">${tx.cta.payCard}</button>`)}
        ${when(integ.paypal, `<button class="btn" name="method" value="paypal">${tx.cta.payPaypal}</button>`)}
      </form>`
    : `<p class="notice">${tx.booking.paymentsUnavailable}</p><a class="btn" href="${esc(app.setting('business').whatsapp)}" target="_blank" rel="noopener">${tx.cta.whatsapp}</a>
       ${when(isAdmin && app.demo(), `<form method="post" action="${P(app, lang, '/pago/demo')}" style="margin-top:16px"><input type="hidden" name="booking" value="${booking.token}"><button class="btn">${lang === 'en' ? 'Simulate provider confirmation (DEMO)' : 'Simular confirmación del proveedor (DEMO)'}</button><p class="small muted">${lang === 'en' ? 'Visible only to the admin in demo mode. Marked as DEMO.' : 'Solo visible para administración en modo demostración. Queda marcado como DEMO.'}</p></form>`)}`}`;
  let main = '';
  const when2 = `<p class="lead">${esc(service ? (lang === 'en' ? service.name_en : service.name_es) : '')} · ${esc(formatDateTime(booking.start_at, lang))}</p>`;
  if (booking.status === 'held' && booking.hold_expires_at > app.now()) {
    const pending = app.db.get("SELECT 1 FROM payments WHERE booking_id = ? AND status = 'pending' AND purpose = 'deposit' AND provider != 'demo' AND created_at > ?", booking.id, app.now() - 3600_000);
    main = `<h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.booking.holdTitle}</h1>${when2}
      <p>${tx.booking.holdText} <strong>${esc(formatDateTime(booking.hold_expires_at, lang))}</strong>.</p>
      <p class="muted">${tx.booking.holdPay}</p>
      <table class="breakdown"><tbody><tr><td>${tx.booking.total}</td><td>${mxn(bal.total)}</td></tr><tr class="total"><td>${tx.booking.deposit}</td><td>${mxn(bal.deposit - bal.depositPaid)}</td></tr></tbody></table>
      ${when(flash === 'procesando' || pending, `<p class="notice" data-refresh>${tx.booking.waitingPayment}</p>`)}
      ${when(!bal.needsReacceptance, payButtons(tx.cta.pay))}
      <p class="small muted" style="margin-top:20px"><strong>${tx.booking.cancelPolicy}.</strong> ${esc(snapshot?.cancellation || '')}</p>`;
  } else if (booking.status === 'held' || booking.status === 'expired') {
    const q = app.db.get('SELECT token FROM quotes WHERE id = ?', booking.quote_id);
    main = `<h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.booking.expiredTitle}</h1><p class="lead">${tx.booking.expiredText}</p><a class="btn btn--solid" href="${P(app, lang, `/cotizacion/${q.token}`)}">${tx.booking.pickDate}</a>`;
  } else if (booking.status === 'confirmed' || booking.status === 'completed') {
    main = `<h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.booking.confirmedTitle}</h1>${when2}
      <table class="breakdown"><tbody><tr><td>${tx.booking.total}</td><td>${mxn(bal.total)}</td></tr><tr><td>${lang === 'en' ? 'Paid' : 'Pagado'}</td><td>${mxn(bal.paid)}</td></tr><tr class="total"><td>${tx.booking.balance}</td><td>${mxn(bal.outstanding)}</td></tr></tbody></table>
      ${when(flash === 'procesando', `<p class="notice" data-refresh>${tx.booking.waitingPayment}</p>`)}
      ${when(bal.needsReacceptance, `<p class="notice">${tx.booking.changed} <a href="${P(app, lang, `/cotizacion/${bal.quote.token}`)}">${tx.booking.quoteTitle}</a></p>`)}
      ${when(bal.outstanding > 0 && !bal.needsReacceptance && booking.status === 'confirmed', `<p class="muted">${tx.booking.balanceNote}</p>${payButtons(lang === 'en' ? 'Pay balance' : 'Pagar saldo')}`)}
      ${when(booking.delivery_due_date, `<p class="muted" style="margin-top:20px">${tx.common.delivery}: ${lang === 'en' ? 'expected' : 'prevista'} ${esc(booking.delivery_due_date)}</p>`)}`;
  } else if (booking.status === 'conflict') {
    main = `<h1 style="font-size:clamp(2rem,6vw,3rem)">${tx.status.conflict}</h1><p class="lead">${tx.booking.conflictText}</p>`;
  } else {
    main = `<h1>${tx.status[booking.status] || booking.status}</h1>`;
  }
  const body = `<section style="padding-top:40px"><div class="wrap narrow">
    ${when(flash === 'cancelado', `<p class="notice">${lang === 'en' ? 'The payment was cancelled. You can try again.' : 'El pago se canceló. Puedes intentarlo de nuevo.'}</p>`)}
    ${when(flash === 'error', `<p class="notice" role="alert">${tx.common.error}</p>`)}
    <div class="box">${main}</div>
  </div></section>`;
  return layout(app, { lang, path: `/reserva/${booking.token}`, title: tx.booking.title, description: '', body, noindex: true });
}
