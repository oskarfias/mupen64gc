// Pantallas de Bikrom/HabitoOS (HTML renderizado en servidor + JS mínimo para interacciones rápidas).
import { t } from '../i18n.mjs';
import { CATEGORIES, TEMPLATES, BARRIERS, SAFETY, templateByKey } from '../domain/catalog.mjs';
import { formatLongDate, addDays } from '../lib/tz.mjs';
import { json } from '../../photography/db.mjs';

export const esc = (s = '') => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const V = (process.env.ASSET_VERSION || process.env.RENDER_GIT_COMMIT || process.env.WORKERS_CI_COMMIT_SHA || String(Date.now())).slice(0, 8);
const asset = (app, f) => `${app.base}/static/${f}?v=${V}`;
const P = (app, p = '') => `${app.base}${p}`;

const fmtNum = (n) => (n == null ? '—' : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
export function goalLabel(goal, unit, tx) {
  if (!goal || goal.comparator === 'done') return tx.habits.comparators.done;
  const u = unit ? ` ${unit}` : '';
  if (goal.comparator === 'range') return `${tx.habits.comparators.range} ${fmtNum(goal.target)}–${fmtNum(goal.target_max)}${u}`;
  return `${tx.habits.comparators[goal.comparator]} ${fmtNum(goal.target)}${u}`;
}

function head(app, { title, lang, theme = 'system' }) {
  return `<!doctype html><html lang="${lang === 'en' ? 'en' : 'es'}"${theme !== 'system' ? ` data-theme="${theme}"` : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title><meta name="theme-color" content="#0E5E6F">
<link rel="manifest" href="${P(app, '/manifest.webmanifest')}"><link rel="icon" href="${asset(app, 'icon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${asset(app, 'css/app.css')}">`;
}

// ───────────── Página pública ─────────────
export function landing(app, lang) {
  const tx = t(lang);
  return `${head(app, { title: `Bikrom/HabitoOS — ${tx.tagline}`, lang })}
<meta name="description" content="${esc(tx.landing.sub)}">
<link rel="alternate" hreflang="es" href="${app.siteUrl}${P(app)}"><link rel="alternate" hreflang="en" href="${app.siteUrl}${P(app, '/en')}">
</head><body><a class="skip" href="#main">${lang === 'en' ? 'Skip to content' : 'Saltar al contenido'}</a>
<header class="wrap topbar"><a class="brand" href="${P(app, lang === 'en' ? '/en' : '')}">${tx.brand}<small>${tx.by}</small></a>
<nav class="row"><a href="${P(app, lang === 'en' ? '' : '/en')}" hreflang="${lang === 'en' ? 'es' : 'en'}">${lang === 'en' ? 'ES' : 'EN'}</a> <a class="btn" href="${P(app, '/entrar')}">${tx.auth.login}</a></nav></header>
<main id="main" class="wrap">
  <section class="hero"><h1>${esc(tx.landing.h1)}</h1><p class="muted" style="font-size:1.1rem;margin-top:12px">${esc(tx.landing.sub)}</p>
    <div class="row" style="margin-top:20px"><a class="btn btn--primary" href="${P(app, `/registro?lang=${lang}`)}">${tx.landing.cta}</a><a class="btn" href="${P(app, '/entrar')}">${tx.landing.login}</a></div></section>
  <section class="points">${tx.landing.points.map(([h, p]) => `<div class="card"><h2 style="margin-top:0">${esc(h)}</h2><p class="muted">${esc(p)}</p></div>`).join('')}</section>
</main>
<footer class="wrap foot"><p>${esc(tx.landing.note)}</p><p>© Bikrom · <a href="/">bikrom.com</a></p></footer></body></html>`;
}

// ───────────── Acceso ─────────────
function authShell(app, lang, title, body) {
  const tx = t(lang);
  return `${head(app, { title: `${title} · HabitoOS`, lang })}<meta name="robots" content="noindex"></head><body>
<main id="main" class="center"><div class="auth"><a class="brand" href="${P(app)}">${tx.brand}<small>${tx.by}</small></a><h1 style="margin-top:16px">${esc(title)}</h1>${body}</div></main>
<script src="${asset(app, 'js/auth.js')}" defer></script></body></html>`;
}

export function registerPage(app, lang, { error = null, email = '' } = {}) {
  const tx = t(lang);
  return authShell(app, lang, tx.auth.register, `<p class="muted">${esc(tx.welcome)} ${esc(tx.tagline)}</p>
<form class="form" method="post" action="${P(app, '/registro')}" data-tz>
  <input type="hidden" name="lang" value="${lang}"><input type="hidden" name="timezone" value="">
  <label class="field"><span>${tx.auth.email}</span><input class="input" type="email" name="email" value="${esc(email)}" required autocomplete="email"></label>
  <label class="field"><span>${tx.auth.password}</span><input class="input" type="password" name="password" minlength="10" required autocomplete="new-password"><small class="muted">${tx.auth.passwordHint}</small></label>
  <label class="check"><input type="checkbox" name="terms" value="1" required> <span>${tx.auth.terms}</span></label>
  ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  <button class="btn btn--primary btn--block">${tx.auth.register}</button>
  <p class="small">${tx.auth.haveAccount} <a href="${P(app, '/entrar')}">${tx.auth.login}</a></p>
</form>`);
}

export function loginPage(app, lang, { error = null, email = '', notice = null } = {}) {
  const tx = t(lang);
  return authShell(app, lang, tx.auth.login, `${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
<form class="form" method="post" action="${P(app, '/entrar')}">
  <label class="field"><span>${tx.auth.email}</span><input class="input" type="email" name="email" value="${esc(email)}" required autocomplete="email"></label>
  <label class="field"><span>${tx.auth.password}</span><input class="input" type="password" name="password" required autocomplete="current-password"></label>
  ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  <button class="btn btn--primary btn--block">${tx.auth.login}</button>
  <p class="small"><a href="${P(app, '/recuperar')}">${tx.auth.forgot}</a></p>
  <p class="small">${tx.auth.noAccount} <a href="${P(app, '/registro')}">${tx.auth.register}</a></p>
</form>`);
}

export function forgotPage(app, lang, { sent = false } = {}) {
  const tx = t(lang);
  return authShell(app, lang, tx.auth.forgotTitle, sent ? `<p class="notice" role="status">${tx.auth.forgotSent}</p><p><a href="${P(app, '/entrar')}">${tx.auth.login}</a></p>` : `
<form class="form" method="post" action="${P(app, '/recuperar')}">
  <label class="field"><span>${tx.auth.email}</span><input class="input" type="email" name="email" required autocomplete="email"></label>
  <button class="btn btn--primary btn--block">${tx.auth.sendLink}</button></form>`);
}

export function resetPage(app, lang, token, { error = null } = {}) {
  const tx = t(lang);
  return authShell(app, lang, tx.auth.resetTitle, `<form class="form" method="post" action="${P(app, '/restablecer')}">
  <input type="hidden" name="t" value="${esc(token)}">
  <label class="field"><span>${tx.auth.password}</span><input class="input" type="password" name="password" minlength="10" required autocomplete="new-password"><small class="muted">${tx.auth.passwordHint}</small></label>
  ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  <button class="btn btn--primary btn--block">${tx.auth.save}</button></form>`);
}

// ───────────── Marco de la app autenticada ─────────────
export function appShell(app, user, { title, path, body, csrf, scripts = [], flash = null }) {
  const tx = t(user.locale);
  const tabs = [['/app/today', '☀️', tx.nav.today], ['/app/habits', '🧩', tx.nav.habits], ['/app/insights', '📈', tx.nav.insights], ['/app/settings', '⚙️', tx.nav.settings]];
  return `${head(app, { title: `${title} · HabitoOS`, lang: user.locale, theme: user.theme })}<meta name="robots" content="noindex"><meta name="csrf" content="${esc(csrf)}"></head>
<body><a class="skip" href="#main">${user.locale === 'en' ? 'Skip to content' : 'Saltar al contenido'}</a>
<div class="app"><header class="topbar"><a class="brand" href="${P(app, '/app/today')}">${tx.brand}<small>${tx.by}</small></a></header>
<nav class="tabbar" aria-label="${user.locale === 'en' ? 'Main' : 'Principal'}">${tabs.map(([p, i, l]) => `<a href="${P(app, p)}"${path.startsWith(p) ? ' aria-current="page"' : ''}><span aria-hidden="true">${i}</span>${esc(l)}</a>`).join('')}</nav>
<main id="main" class="wrap" tabindex="-1">
${!user.email_verified_at ? `<p class="notice" role="note">${tx.auth.verifyBanner} <button class="btn btn--ghost small" data-resend style="min-height:32px;padding:4px 8px">${tx.auth.resend}</button></p>` : ''}
${flash ? `<p class="notice" role="status">${esc(flash)}</p>` : ''}
${body}
</main></div>
<script src="${asset(app, 'js/app.js')}" defer></script>${scripts.map((s) => `<script src="${asset(app, s)}" defer></script>`).join('')}
</body></html>`;
}

const csrfField = (csrf) => `<input type="hidden" name="_csrf" value="${esc(csrf)}">`;

// ───────────── Today ─────────────
export function todayPage(app, user, data, csrf) {
  const tx = t(user.locale);
  const s = data.summary;
  const isToday = data.date === data.today;
  const card = (i) => {
    const goal = goalLabel(i.goal, i.unit, tx);
    const stateLabel = { done: tx.today.done, partial: tx.today.partial, missed: tx.today.missed, skipped: tx.today.skipped, not_applicable: tx.today.not_applicable, pending: tx.today.pendingState, no_data: tx.today.no_data, paused: tx.today.paused }[i.status];
    const pct = i.goal && i.goal.target > 0 && i.value != null && ['>=', 'range'].includes(i.goal.comparator) ? Math.min(100, Math.round((i.value / i.goal.target) * 100)) : null;
    const step = i.measure === 'duration' ? 5 : 1;
    const controls = i.status === 'paused' ? '' : i.measure === 'binary'
      ? `<button class="btn${i.status === 'done' ? ' btn--primary' : ''}" data-log="done" aria-pressed="${i.status === 'done'}">✓ ${tx.today.yes}</button>
         <button class="btn" data-log="missed" aria-pressed="${i.status === 'missed'}">${tx.today.no}</button>`
      : `<div class="stepper"><button type="button" data-step="-${step}" aria-label="−${step}">−</button>
           <input type="number" inputmode="decimal" min="0" step="any" value="${i.value ?? ''}" placeholder="0" aria-label="${esc(i.name)}${i.unit ? ' (' + esc(i.unit) + ')' : ''}" data-value>
           <button type="button" data-step="${step}" aria-label="+${step}">+</button></div>${i.unit ? `<span class="muted small">${esc(i.unit)}</span>` : ''}`;
    return `<li class="habit" data-habit="${i.id}" data-status="${i.status}" data-measure="${i.measure}">
      <div class="habit-top"><span class="habit-emoji" aria-hidden="true">${esc(i.emoji || '•')}</span>
        <div><div class="habit-name">${esc(i.name)}</div><div class="habit-goal">${esc(goal)}${i.value != null && i.measure !== 'binary' ? ` · <strong>${fmtNum(i.value)}${i.unit ? ' ' + esc(i.unit) : ''}</strong>` : ''}</div></div>
        <span class="state state--${i.status}" data-state>${esc(stateLabel)}</span></div>
      ${pct != null ? `<div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>` : ''}
      <div class="controls">${controls}</div>
      ${i.status !== 'paused' ? `<details class="more"><summary>${tx.today.more}</summary><div class="controls" style="margin-top:8px">
        ${i.measure !== 'binary' ? `<button class="btn" data-log="missed">${tx.today.missed}</button>` : ''}
        <button class="btn" data-log="skipped">${tx.today.skipped}</button><button class="btn" data-log="not_applicable">${tx.today.not_applicable}</button>
        ${['done', 'partial', 'missed', 'skipped', 'not_applicable'].includes(i.status) ? `<button class="btn btn--ghost" data-undo>${tx.today.undo}</button>` : ''}</div></details>` : ''}
      ${i.contingency && ['missed', 'pending'].includes(i.status) ? `<p class="small muted" style="margin:0">${tx.today.ifThen} ${esc(i.contingency)}</p>` : ''}
    </li>`;
  };
  const body = `<div class="today-head"><div><h1>${isToday ? tx.today.title : esc(formatLongDate(data.date, user.locale))}</h1><p class="muted" style="margin:0">${esc(formatLongDate(data.date, user.locale))}</p></div>
    <nav class="daynav" aria-label="Días"><a href="?d=${addDays(data.date, -1)}" aria-label="${tx.today.prevDay}">‹</a>${!isToday ? `<a href="?" aria-label="${tx.today.backToday}">•</a><a href="?d=${addDays(data.date, 1)}" aria-label="${tx.today.nextDay}">›</a>` : ''}</nav></div>
  ${data.items.length ? `<div class="summary" aria-live="polite"><div><strong data-sum="evaluated">${s.evaluated}</strong><span class="small muted">${tx.today.evaluated}</span></div>
    <div><strong data-sum="pending">${s.pending + s.no_data}</strong><span class="small muted">${tx.today.pending}</span></div>
    <div><strong data-sum="coverage">${s.coverage == null ? '—' : s.coverage + '%'}</strong><span class="small muted">${tx.today.coverage}</span></div></div>
  <ul class="list" data-day="${data.date}">${data.items.map(card).join('')}</ul>`
    : `<div class="card"><p>${tx.today.empty}</p><a class="btn btn--primary" href="${P(app, '/app/habits/nuevo')}">${tx.today.addFirst}</a></div>`}
  <div class="toast" hidden data-toast role="status"><span data-toast-text></span><button type="button" data-toast-undo>${tx.today.undo}</button></div>
  <script type="application/json" id="i18n">${JSON.stringify({ saved: tx.today.saved, error: tx.errors.generic, states: { done: tx.today.done, partial: tx.today.partial, missed: tx.today.missed, skipped: tx.today.skipped, not_applicable: tx.today.not_applicable, pending: tx.today.pendingState, no_data: tx.today.no_data } }).replace(/</g, '\\u003c')}</script>`;
  return appShell(app, user, { title: tx.today.title, path: '/app/today', body, csrf, scripts: ['js/today.js'] });
}

// ───────────── Hábitos ─────────────
const daysField = (tx, selected = [1, 2, 3, 4, 5, 6, 7]) => `<fieldset class="field"><legend>${tx.habits.days}</legend><div class="days">${tx.habits.weekdays.map((d, i) => `<label class="chip"><input type="checkbox" name="days[]" value="${i + 1}"${selected.includes(i + 1) ? ' checked' : ''}><span aria-label="${tx.habits.weekdayNames[i]}">${d}</span></label>`).join('')}</div></fieldset>`;

function goalFields(tx, goal = {}, measure = 'count') {
  return `<div class="grid2" data-goal-fields${measure === 'binary' ? ' hidden' : ''}>
    <label class="field"><span>${tx.habits.comparator}</span><select class="input" name="comparator">${['>=', '<=', '=', 'range'].map((c) => `<option value="${esc(c)}"${goal.comparator === c ? ' selected' : ''}>${tx.habits.comparators[c]}</option>`).join('')}</select></label>
    <label class="field"><span>${tx.habits.target}</span><input class="input" name="target" inputmode="decimal" value="${goal.target ?? ''}"></label>
    <label class="field"><span>${tx.habits.targetMax}</span><input class="input" name="target_max" inputmode="decimal" value="${goal.target_max ?? ''}"></label>
    <label class="field"><span>${tx.habits.partialMin}</span><input class="input" name="partial_min" inputmode="decimal" value="${goal.partial_min ?? ''}"></label>
  </div>`;
}

export function habitsPage(app, user, habits, { csrf, pro, flash }) {
  const tx = t(user.locale);
  const active = habits.filter((h) => h.status === 'active').length;
  const body = `<div class="today-head"><div><h1>${tx.habits.title}</h1>${pro ? '' : `<p class="muted small" style="margin:0">${tx.habits.freeNote} (${active}/3)</p>`}</div>
    <a class="btn btn--primary" href="${P(app, '/app/habits/nuevo')}">+ ${tx.habits.new}</a></div>
  <ul class="list">${habits.map((h) => `<li class="habit"><div class="habit-top"><span class="habit-emoji" aria-hidden="true">${esc(h.emoji || '•')}</span>
    <div><a class="habit-name" href="${P(app, `/app/habits/${h.id}`)}">${esc(h.name)}</a><div class="habit-goal">${esc(tx.habits.kinds[h.kind])} · ${esc(goalLabel(h.goal, h.unit, tx))}</div></div>
    <span class="state">${esc(tx.habits.status[h.status])}</span></div></li>`).join('') || `<li class="card">${tx.today.empty}</li>`}</ul>`;
  return appShell(app, user, { title: tx.habits.title, path: '/app/habits', body, csrf, flash });
}

export function habitForm(app, user, { csrf, error = null }) {
  const tx = t(user.locale);
  const body = `<h1>${tx.habits.new}</h1>
  <form class="form card" method="post" action="${P(app, '/app/habits')}" data-habit-form>${csrfField(csrf)}
    <div class="grid2"><label class="field"><span>${tx.habits.name}</span><input class="input" name="name" required maxlength="80"></label>
      <label class="field"><span>${tx.habits.emoji}</span><input class="input" name="emoji" maxlength="8" placeholder="✨"></label></div>
    <div class="grid2"><label class="field"><span>${tx.habits.kind}</span><select class="input" name="kind">${Object.entries(tx.habits.kinds).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="field"><span>${tx.habits.category}</span><select class="input" name="category">${CATEGORIES.map(([k, l, e]) => `<option value="${k}">${e} ${l[user.locale]}</option>`).join('')}</select></label></div>
    <div class="grid2"><label class="field"><span>${tx.habits.measure}</span><select class="input" name="measure" data-measure>${Object.entries(tx.habits.measures).map(([k, l]) => `<option value="${k}"${k === 'binary' ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field" data-unit-field hidden><span>${tx.habits.unit}</span><input class="input" name="unit" maxlength="20"></label></div>
    ${goalFields(tx, { comparator: '>=' }, 'binary')}
    ${daysField(tx)}
    <label class="field"><span>${tx.habits.time}</span><input class="input" type="time" name="time"></label>
    <label class="field"><span>${tx.habits.contingency}</span><input class="input" name="contingency" maxlength="300"></label>
    <label class="field"><span>${tx.habits.motivation}</span><input class="input" name="motivation" maxlength="500"></label>
    ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
    <button class="btn btn--primary">${tx.habits.create}</button></form>`;
  return appShell(app, user, { title: tx.habits.new, path: '/app/habits', body, csrf, scripts: ['js/habit-form.js'] });
}

export function habitDetail(app, user, h, { csrf, goals, schedule, error = null, flash = null, today }) {
  const tx = t(user.locale);
  const current = goals.find((g) => !g.valid_to) || goals[goals.length - 1];
  const tpl = templateByKey[String(h.template_key || '').replace(/^tpl:/, '')];
  const body = `<p><a href="${P(app, '/app/habits')}">← ${tx.habits.title}</a></p>
  <h1>${esc(h.emoji || '')} ${esc(h.name)}</h1><p class="muted">${esc(tx.habits.kinds[h.kind])} · ${esc(goalLabel(current, h.unit, tx))} · ${esc(tx.habits.status[h.status])}</p>
  ${tpl?.safety ? `<p class="notice" role="note">${esc(SAFETY[tpl.safety][user.locale])}</p>` : ''}
  ${tpl?.hint ? `<p class="small muted">${esc(tpl.hint[user.locale])}</p>` : ''}
  ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  <form class="form card" method="post" action="${P(app, `/app/habits/${h.id}`)}">${csrfField(csrf)}
    <div class="grid2"><label class="field"><span>${tx.habits.name}</span><input class="input" name="name" value="${esc(h.name)}" required maxlength="80"></label>
      <label class="field"><span>${tx.habits.emoji}</span><input class="input" name="emoji" value="${esc(h.emoji || '')}" maxlength="8"></label></div>
    ${h.measure !== 'binary' ? `<label class="field"><span>${tx.habits.unit}</span><input class="input" name="unit" value="${esc(h.unit || '')}" maxlength="20"></label>` : ''}
    <label class="field"><span>${tx.habits.contingency}</span><input class="input" name="contingency" value="${esc(h.contingency || '')}" maxlength="300"></label>
    <label class="field"><span>${tx.habits.motivation}</span><input class="input" name="motivation" value="${esc(h.motivation || '')}" maxlength="500"></label>
    <button class="btn btn--primary">${tx.habits.save}</button></form>
  ${h.measure !== 'binary' ? `<h2>${tx.habits.changeGoal}</h2><form class="form card" method="post" action="${P(app, `/app/habits/${h.id}/meta`)}">${csrfField(csrf)}
    ${goalFields(tx, current, h.measure)}
    <label class="field"><span>${tx.habits.from}</span><input class="input" type="date" name="from" value="${today}" min="${h.start_date}"></label>
    <p class="small muted">${tx.habits.goalNote}</p><button class="btn">${tx.habits.changeGoal}</button></form>` : ''}
  <h2>${tx.habits.changeSchedule}</h2><form class="form card" method="post" action="${P(app, `/app/habits/${h.id}/dias`)}">${csrfField(csrf)}
    ${daysField(tx, json(schedule?.days, []))}
    <label class="field"><span>${tx.habits.time}</span><input class="input" type="time" name="time" value="${esc(schedule?.local_time || '')}"></label>
    <input type="hidden" name="from" value="${today}"><button class="btn">${tx.habits.changeSchedule}</button></form>
  <h2>${tx.habits.history}</h2><div class="card"><ul class="small" style="margin:0;padding-left:18px">${goals.map((g) => `<li>${esc(g.valid_from)} → ${esc(g.valid_to || '…')}: ${esc(goalLabel(g, h.unit, tx))}</li>`).join('')}</ul></div>
  <div class="row" style="margin:20px 0">
    ${h.status === 'active' ? `<form method="post" action="${P(app, `/app/habits/${h.id}/estado`)}">${csrfField(csrf)}<input type="hidden" name="status" value="paused"><button class="btn">${tx.habits.pause}</button></form>
      <form method="post" action="${P(app, `/app/habits/${h.id}/descanso`)}">${csrfField(csrf)}<button class="btn">${tx.habits.restDay}</button></form>`
      : `<form method="post" action="${P(app, `/app/habits/${h.id}/estado`)}">${csrfField(csrf)}<input type="hidden" name="status" value="active"><button class="btn btn--primary">${tx.habits.resume}</button></form>`}
    ${h.status !== 'archived' ? `<form method="post" action="${P(app, `/app/habits/${h.id}/estado`)}" data-confirm="${esc(tx.common.confirm)}">${csrfField(csrf)}<input type="hidden" name="status" value="archived"><button class="btn btn--danger">${tx.habits.archive}</button></form>` : ''}
  </div>`;
  return appShell(app, user, { title: h.name, path: '/app/habits', body, csrf, flash });
}

// ───────────── Indicadores ─────────────
export function insightsPage(app, user, m, { csrf, range, pro, clamped }) {
  const tx = t(user.locale);
  const pct = (v) => (v == null ? '—' : `${v}%`);
  const ranges = pro ? [7, 30, 90, 180, 365] : [7, 30];
  const kpi = (label, value, n, help) => `<div class="kpi"><span class="small muted">${label}</span><strong>${value}</strong><span class="small muted">${tx.insights.n} = ${n}</span><p class="small muted" style="margin:6px 0 0">${help}</p></div>`;
  const body = `<h1>${tx.insights.title}</h1>
  <nav class="chips" aria-label="${tx.insights.range}" style="margin:12px 0">${ranges.map((r) => `<a class="btn${r === range ? ' btn--primary' : ''}" href="?r=${r}">${r} ${tx.insights.days}</a>`).join('')}</nav>
  ${clamped || !pro ? `<p class="small muted">${tx.insights.freeHistory}</p>` : ''}
  <p class="small muted">${m.from} → ${m.to}</p>
  <h2>${tx.insights.overall}</h2>
  ${m.overall.adherence_n || m.overall.coverage_n ? `<div class="kpis">${kpi(tx.insights.adherence, pct(m.overall.adherence), m.overall.adherence_n, tx.insights.adherenceHelp)}${kpi(tx.insights.coverage, pct(m.overall.coverage), m.overall.coverage_n, tx.insights.coverageHelp)}</div>
    ${m.overall.adherence_n < 7 ? `<p class="small muted">${tx.insights.fewData}</p>` : ''}` : `<p class="muted">${tx.insights.noData}</p>`}
  ${m.habits.map((h) => `<section class="card" style="margin-top:14px"><h2 style="margin-top:0">${esc(h.emoji || '')} ${esc(h.name)}</h2>
    <div class="kpis">${kpi(tx.insights.adherence, pct(h.adherence), h.adherence_n, '')}${kpi(tx.insights.coverage, pct(h.coverage), h.coverage_n, '')}
      ${kpi(tx.insights.recovery, h.recovery_avg == null ? '—' : `${h.recovery_avg} ${tx.insights.opportunities}`, h.recovery_n, '')}</div>
    <div class="dots" role="img" aria-label="${tx.insights.calendar}">${h.series.map((d) => `<span class="dot dot--${d.status}" title="${d.date}: ${esc(tx.today[d.status === 'pending' ? 'pendingState' : d.status] || d.status)}${d.value != null ? ' · ' + fmtNum(d.value) : ''}"></span>`).join('')}</div>
  </section>`).join('')}
  <div class="legend"><span><i class="dot dot--done"></i>${tx.today.done}</span><span><i class="dot dot--partial"></i>${tx.today.partial}</span><span><i class="dot dot--missed"></i>${tx.today.missed}</span><span><i class="dot"></i>${tx.today.no_data}</span><span><i class="dot dot--skipped"></i>${tx.today.skipped} / ${tx.today.paused}</span></div>
  <p class="small muted" style="margin-top:16px">${tx.insights.recoveryHelp}</p>`;
  return appShell(app, user, { title: tx.insights.title, path: '/app/insights', body, csrf });
}

// ───────────── Cuenta ─────────────
export function settingsPage(app, user, { csrf, pro, flash = null, error = null }) {
  const tx = t(user.locale);
  const zones = Intl.supportedValuesOf?.('timeZone') || [user.timezone];
  const body = `<h1>${tx.settings.title}</h1><p class="muted">${esc(user.email)} · ${tx.settings.plan}: <strong>${pro ? tx.settings.pro : tx.settings.free}</strong></p>
  ${pro ? '' : `<p class="small muted">${tx.settings.planNote}</p>`}
  ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  <h2>${tx.settings.prefs}</h2><form class="form card" method="post" action="${P(app, '/app/settings')}">${csrfField(csrf)}
    <div class="grid2"><label class="field"><span>${tx.settings.language}</span><select class="input" name="locale"><option value="es"${user.locale === 'es' ? ' selected' : ''}>Español</option><option value="en"${user.locale === 'en' ? ' selected' : ''}>English</option></select></label>
      <label class="field"><span>${tx.settings.timezone}</span><select class="input" name="timezone">${zones.map((z) => `<option${z === user.timezone ? ' selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
      <label class="field"><span>${tx.settings.theme}</span><select class="input" name="theme">${Object.entries(tx.settings.themes).map(([k, l]) => `<option value="${k}"${user.theme === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>${tx.settings.units}</span><select class="input" name="units">${Object.entries(tx.settings.unitsOpts).map(([k, l]) => `<option value="${k}"${user.units === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <button class="btn btn--primary">${tx.settings.save}</button></form>
  <h2>${tx.settings.security}</h2><form class="form card" method="post" action="${P(app, '/app/settings/password')}">${csrfField(csrf)}
    <div class="grid2"><label class="field"><span>${tx.settings.currentPassword}</span><input class="input" type="password" name="current" required autocomplete="current-password"></label>
      <label class="field"><span>${tx.settings.newPassword}</span><input class="input" type="password" name="next" minlength="10" required autocomplete="new-password"></label></div>
    <button class="btn">${tx.settings.changePassword}</button></form>
  <div class="row" style="margin-top:12px"><form method="post" action="${P(app, '/app/settings/sessions')}">${csrfField(csrf)}<button class="btn">${tx.settings.logoutAll}</button></form>
    <form method="post" action="${P(app, '/salir')}">${csrfField(csrf)}<button class="btn">${tx.nav.logout}</button></form></div>
  <h2>${tx.settings.data}</h2><div class="row"><a class="btn" href="${P(app, '/api/v1/export')}" download>${tx.settings.exportJson}</a><a class="btn" href="${P(app, '/api/v1/export.csv')}" download>${tx.settings.exportCsv}</a></div>
  <form class="form card" method="post" action="${P(app, '/app/settings/eliminar')}" style="margin-top:16px" data-confirm="${esc(tx.common.confirm)}">${csrfField(csrf)}
    <p class="small">${tx.settings.deleteHelp}</p><label class="field"><span>${tx.auth.password}</span><input class="input" type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn btn--danger">${tx.settings.delete}</button></form>`;
  return appShell(app, user, { title: tx.settings.title, path: '/app/settings', body, csrf, flash });
}

// ───────────── Onboarding ─────────────
export function onboardingPage(app, user, state, csrf) {
  const tx = t(user.locale);
  const L = user.locale;
  const data = {
    lang: L, state, api: P(app, '/api/v1/onboarding'), done: P(app, '/app/today'),
    categories: CATEGORIES.map(([k, l, e]) => ({ key: k, label: l[L], emoji: e })),
    templates: TEMPLATES.map((x) => ({ key: x.key, kind: x.kind, category: x.category, emoji: x.emoji, name: x.name[L], measure: x.measure, unit: x.unit?.[L] || '', comparator: x.comparator, target: x.target ?? null, safety: x.safety ? SAFETY[x.safety][L] : null, hint: x.hint?.[L] || null })),
    barriers: BARRIERS.map(([k, l]) => ({ key: k, label: l[L] })),
    tx: { ...tx.onboarding, weekdays: tx.habits.weekdays, weekdayNames: tx.habits.weekdayNames, comparators: tx.habits.comparators, errors: tx.errors, kinds: tx.habits.kinds },
  };
  const body = `<h1>${tx.onboarding.title}</h1>
  <div class="steps-bar" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<span data-bar="${i + 1}"></span>`).join('')}</div>
  <p class="muted small" data-step-label aria-live="polite"></p>
  <div data-onboarding></div>
  <p class="status" role="status" aria-live="polite" data-ob-status></p>
  <script type="application/json" id="ob-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  return appShell(app, user, { title: tx.onboarding.title, path: '/onboarding', body, csrf, scripts: ['js/onboarding.js'] });
}

export function messagePage(app, lang, title, text, link) {
  return authShell(app, lang, title, `<p>${esc(text)}</p>${link ? `<p><a class="btn btn--primary" href="${link[0]}">${esc(link[1])}</a></p>` : ''}`);
}
