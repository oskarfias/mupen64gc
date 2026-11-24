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
export function todayPage(app, user, data, csrf, { reflection = 'none', flash = null } = {}) {
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
  ${reflectionCard(app, tx, { ...data, csrf }, reflection)}
  <div class="toast" hidden data-toast role="status"><span data-toast-text></span><button type="button" data-toast-undo>${tx.today.undo}</button></div>
  <script type="application/json" id="i18n">${JSON.stringify({ saved: tx.today.saved, error: tx.errors.generic, states: { done: tx.today.done, partial: tx.today.partial, missed: tx.today.missed, skipped: tx.today.skipped, not_applicable: tx.today.not_applicable, pending: tx.today.pendingState, no_data: tx.today.no_data } }).replace(/</g, '\\u003c')}</script>`;
  return appShell(app, user, { title: tx.today.title, path: '/app/today', body, csrf, flash, scripts: ['js/today.js'] });
}

// Tarjeta de reflexión en Today: sugerida solo si el día tuvo tropiezos o sigue abierto por la tarde;
// tras un día cumplido por completo queda como enlace discreto (no insiste).
function reflectionCard(app, tx, data, state) {
  const href = P(app, `/app/reflexion${data.date === data.today ? '' : '?d=' + data.date}`);
  if (state === 'none') return '';
  if (state === 'saved') return `<p class="small" style="margin-top:16px">✓ ${tx.reflection.savedToday} · <a href="${href}">${tx.reflection.edit}</a></p>`;
  if (state === 'optional') return `<p class="small muted" style="margin-top:16px"><a href="${href}">${tx.reflection.addNote}</a></p>`;
  return `<section class="card reflect-cta" style="margin-top:16px"><h2 style="margin-top:0">${tx.reflection.ctaTitle}</h2><p class="muted" style="margin-top:0">${tx.reflection.ctaText}</p>
    <div class="row"><a class="btn btn--primary" href="${href}">${tx.reflection.open}</a>
    <form method="post" action="${P(app, '/app/reflexion')}"><input type="hidden" name="_csrf" value="${esc(data.csrf || '')}"><input type="hidden" name="d" value="${data.date}"><input type="hidden" name="action" value="dismiss"><button class="btn btn--ghost">${tx.reflection.notNow}</button></form></div></section>`;
}

// ───────────── Reflexión diaria ─────────────
export function reflectionPage(app, user, { csrf, day, review, barriers, flash = null }) {
  const tx = t(user.locale);
  const L = user.locale;
  const r = review && !review.dismissed ? review : { mood: null, note: '', intention_if: '', intention_then: '', obstacles: [] };
  const has = (habitId, key) => r.obstacles.some((o) => (o.habit_id || null) === habitId && o.obstacle_key === key);
  const chips = (habitId) => `<div class="chips">${barriers.map(([k, l]) => `<label class="chip"><input type="checkbox" name="ob[]" value="${habitId || ''}|${k}"${has(habitId, k) ? ' checked' : ''}><span>${esc(l[L])}</span></label>`).join('')}</div>`;
  const rough = day.items.filter((i) => ['missed', 'partial', 'skipped', 'no_data', 'pending'].includes(i.status));
  const stateLabel = (s) => ({ missed: tx.today.missed, partial: tx.today.partial, skipped: tx.today.skipped, no_data: tx.today.no_data, pending: tx.today.pendingState }[s]);
  const moods = ['😞', '😕', '😐', '🙂', '😄'];
  const isToday = day.date === day.today;
  const body = `<h1>${tx.reflection.title}</h1>
  <p class="muted" style="margin-top:0">${esc(formatLongDate(day.date, L))} · ${tx.reflection.optionalAll}</p>
  <form method="post" action="${P(app, '/app/reflexion')}" class="form">${csrfField(csrf)}<input type="hidden" name="d" value="${day.date}">
    <fieldset class="field"><legend>${tx.reflection.mood} <span class="muted small">(${tx.common.optional})</span></legend>
      <div class="chips mood">${moods.map((e, i) => `<label class="chip"><input type="radio" name="mood" value="${i + 1}"${r.mood === i + 1 ? ' checked' : ''}><span aria-label="${tx.reflection.moods[i]}" title="${tx.reflection.moods[i]}">${e}</span></label>`).join('')}
      <label class="chip"><input type="radio" name="mood" value=""${r.mood == null ? ' checked' : ''}><span>${tx.reflection.noAnswer}</span></label></div></fieldset>
    ${rough.length ? `<h2>${tx.reflection.obstaclesTitle}</h2><p class="small muted" style="margin-top:0">${tx.reflection.obstaclesHelp}</p>
      ${rough.map((i) => `<fieldset class="field card"><legend>${esc(i.emoji || '•')} ${esc(i.name)} <span class="state state--${i.status}">${esc(stateLabel(i.status))}</span></legend>${chips(i.id)}</fieldset>`).join('')}` : ''}
    <fieldset class="field"><legend>${rough.length ? tx.reflection.generalObstacles : tx.reflection.obstaclesTitle} <span class="muted small">(${tx.common.optional})</span></legend>${chips(null)}</fieldset>
    <label class="field"><span>${tx.reflection.note} <span class="muted small">(${tx.common.optional})</span></span><textarea class="input" name="note" maxlength="1000" placeholder="${esc(tx.reflection.notePlaceholder)}">${esc(r.note)}</textarea>
      <span class="small muted">🔒 ${tx.reflection.private}</span></label>
    <fieldset class="field"><legend>${tx.reflection.intention} <span class="muted small">(${tx.common.optional})</span></legend>
      <div class="ifthen"><span>${tx.reflection.if}</span><input class="input" name="intention_if" maxlength="200" value="${esc(r.intention_if)}" placeholder="${esc(tx.reflection.ifPlaceholder)}">
      <span>${tx.reflection.then}</span><input class="input" name="intention_then" maxlength="200" value="${esc(r.intention_then)}" placeholder="${esc(tx.reflection.thenPlaceholder)}"></div></fieldset>
    <div class="row"><button class="btn btn--primary" name="action" value="save">${tx.reflection.save}</button>
      <a class="btn btn--ghost" href="${P(app, '/app/today' + (isToday ? '' : '?d=' + day.date))}">${tx.common.cancel}</a></div>
  </form>
  ${review && !review.dismissed ? `<form method="post" action="${P(app, '/app/reflexion')}" style="margin-top:20px">${csrfField(csrf)}<input type="hidden" name="d" value="${day.date}"><input type="hidden" name="action" value="delete"><button class="btn btn--ghost small">${tx.reflection.delete}</button></form>` : ''}
  <p class="small muted" style="margin-top:16px">${tx.reflection.noPenalty}</p>`;
  return appShell(app, user, { title: tx.reflection.title, path: '/app/today', body, csrf, flash });
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
  const body = `<div class="today-head"><div><h1>${tx.habits.title}</h1>${pro ? '' : `<p class="muted small" style="margin:0">${tx.habits.freeNote} (${active}/3) · <a href="${P(app, '/app/plan')}">${tx.plan.seePro}</a></p>`}</div>
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
export function insightsPage(app, user, m, { csrf, range, pro, clamped, obstacles = null, trends = null }) {
  const tx = t(user.locale);
  const pct = (v) => (v == null ? '—' : `${v}%`);
  const ranges = pro ? [7, 30, 90, 180, 365] : [7, 30];
  const kpi = (label, value, n, help) => `<div class="kpi"><span class="small muted">${label}</span><strong>${value}</strong><span class="small muted">${tx.insights.n} = ${n}</span><p class="small muted" style="margin:6px 0 0">${help}</p></div>`;
  const body = `<h1>${tx.insights.title}</h1>
  <nav class="chips" aria-label="${tx.insights.range}" style="margin:12px 0">${ranges.map((r) => `<a class="btn${r === range ? ' btn--primary' : ''}" href="?r=${r}">${r} ${tx.insights.days}</a>`).join('')}</nav>
  ${clamped || !pro ? `<p class="small muted">${tx.insights.freeHistory} <a href="${P(app, '/app/plan')}">${tx.plan.seePro}</a></p>` : ''}
  <p class="small muted">${m.from} → ${m.to}</p>
  <h2>${tx.insights.overall}</h2>
  ${trends ? trendChart(tx, user.locale, trends.overall, trends.bucket, tx.insights.adherenceTrend) : ''}
  ${m.overall.adherence_n || m.overall.coverage_n ? `<div class="kpis">${kpi(tx.insights.adherence, pct(m.overall.adherence), m.overall.adherence_n, tx.insights.adherenceHelp)}${kpi(tx.insights.coverage, pct(m.overall.coverage), m.overall.coverage_n, tx.insights.coverageHelp)}</div>
    ${m.overall.adherence_n < 7 ? `<p class="small muted">${tx.insights.fewData}</p>` : ''}` : `<p class="muted">${tx.insights.noData}</p>`}
  ${m.habits.map((h) => `<section class="card" style="margin-top:14px"><h2 style="margin-top:0">${esc(h.emoji || '')} ${esc(h.name)}</h2>
    <div class="kpis">${kpi(tx.insights.adherence, pct(h.adherence), h.adherence_n, '')}${kpi(tx.insights.coverage, pct(h.coverage), h.coverage_n, '')}
      ${kpi(tx.insights.recovery, h.recovery_avg == null ? '—' : `${h.recovery_avg} ${tx.insights.opportunities}`, h.recovery_n, '')}</div>
    ${trends ? habitTrend(tx, user.locale, trends.habits.find((x) => x.habit_id === h.habit_id), trends.bucket) : ''}
    <div class="dots" role="img" aria-label="${tx.insights.calendar}">${h.series.map((d) => `<span class="dot dot--${d.status}" title="${d.date}: ${esc(tx.today[d.status === 'pending' ? 'pendingState' : d.status] || d.status)}${d.value != null ? ' · ' + fmtNum(d.value) : ''}"></span>`).join('')}</div>
  </section>`).join('')}
  <div class="legend"><span><i class="dot dot--done"></i>${tx.today.done}</span><span><i class="dot dot--partial"></i>${tx.today.partial}</span><span><i class="dot dot--missed"></i>${tx.today.missed}</span><span><i class="dot"></i>${tx.today.no_data}</span><span><i class="dot dot--skipped"></i>${tx.today.skipped} / ${tx.today.paused}</span></div>
  <p class="small muted" style="margin-top:16px">${tx.insights.recoveryHelp}</p>
  ${obstacles ? obstaclesSection(tx, user.locale, obstacles) : ''}`;
  return appShell(app, user, { title: tx.insights.title, path: '/app/insights', body, csrf });
}

// Gráfica de barras en SVG (sin librerías): adherencia por semana o mes, con n en cada barra.
const shortDate = (d, L, bucket) => new Intl.DateTimeFormat(L === 'en' ? 'en-US' : 'es-MX', bucket === 'month' ? { month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
function trendChart(tx, L, series, bucket, title, key = 'adherence') {
  if (!series.some((s) => s[key] != null)) return '';
  const W = 44, H = 120, top = 18, w = series.length * W;
  const bars = series.map((s, i) => {
    const x = i * W + 8, v = s[key];
    const h = v == null ? 0 : Math.max(2, Math.round((v / 100) * H));
    return v == null
      ? `<rect x="${x}" y="${top + H - 2}" width="${W - 16}" height="2" class="tc-empty"/><text x="${x + (W - 16) / 2}" y="${top + H - 8}" class="tc-v">—</text>`
      : `<rect x="${x}" y="${top + H - h}" width="${W - 16}" height="${h}" rx="4" class="tc-bar${s[key + '_n'] < 3 ? ' tc-few' : ''}"/><text x="${x + (W - 16) / 2}" y="${top + H - h - 5}" class="tc-v">${Math.round(v)}</text>`;
  }).join('');
  const labels = series.map((s, i) => `<text x="${i * W + W / 2}" y="${top + H + 16}" class="tc-l">${esc(shortDate(s.start, L, bucket))}</text>`).join('');
  const summary = series.map((s) => `${shortDate(s.start, L, bucket)}: ${s[key] == null ? '—' : s[key] + '%'} (n=${s[key + '_n']})`).join('; ');
  return `<figure class="trend"><figcaption class="small muted">${esc(title)} · ${bucket === 'month' ? tx.insights.byMonth : tx.insights.byWeek}</figcaption>
    <div class="trend-scroll"><svg viewBox="0 0 ${w} ${top + H + 24}" width="${w}" height="${top + H + 24}" role="img" aria-label="${esc(title)}: ${esc(summary)}">${bars}${labels}</svg></div>
    <details class="small"><summary>${tx.insights.table}</summary><table class="ttable"><tr><th>${bucket === 'month' ? tx.insights.month : tx.insights.week}</th><th>%</th><th>n</th></tr>${series.map((s) => `<tr><td>${esc(shortDate(s.start, L, bucket))}</td><td>${s[key] == null ? '—' : s[key] + '%'}</td><td>${s[key + '_n']}</td></tr>`).join('')}</table></details></figure>`;
}
function habitTrend(tx, L, h, bucket) {
  if (!h) return '';
  const c = h.comparison;
  const fmt = (d) => esc(new Intl.DateTimeFormat(L === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)));
  const pct = (v) => (v == null ? '—' : `${v}%`);
  const val = (v) => (v == null ? '' : ` · ${tx.insights.avg} ${fmtNum(v)}${h.unit ? ' ' + esc(h.unit) : ''}`);
  const cmp = !c.available ? `<p class="small muted">${tx.insights.baselineWait}</p>`
    : `<div class="compare"><div><span class="small muted">${tx.insights.baseline} (${fmt(c.baseline.from)}–${fmt(c.baseline.to)})</span><strong>${pct(c.baseline.adherence)}</strong><span class="small muted">n = ${c.baseline.adherence_n}${val(c.baseline.value_avg)}</span></div>
      <div><span class="small muted">${tx.insights.recent} (${fmt(c.recent.from)}–${fmt(c.recent.to)})</span><strong>${pct(c.recent.adherence)}</strong><span class="small muted">n = ${c.recent.adherence_n}${val(c.recent.value_avg)}</span></div>
      <div><span class="small muted">${tx.insights.change}</span><strong>${c.adherence_diff == null ? '—' : (c.adherence_diff > 0 ? '+' : '') + fmtNum(c.adherence_diff) + ' ' + tx.insights.points}</strong></div></div>
      ${c.baseline.few || c.recent.few ? `<p class="small muted">${tx.insights.fewData}</p>` : ''}`;
  return trendChart(tx, L, h.series, bucket, tx.insights.adherenceTrend) + cmp;
}

// Obstáculos y ánimo: frecuencias descriptivas con su n; sin conclusiones causales.
function obstaclesSection(tx, L, o) {
  const label = (k) => BARRIERS.find(([x]) => x === k)?.[1][L] || k;
  const max = Math.max(1, ...o.obstacles.map((x) => x.n));
  const bars = (list) => `<ul class="bars">${list.map((x) => `<li><span>${esc(label(x.key))}</span><span class="bar" aria-hidden="true"><i style="width:${Math.round((x.n / max) * 100)}%"></i></span><strong>${x.n}</strong></li>`).join('')}</ul>`;
  return `<h2 style="margin-top:28px">${tx.reflection.insightsTitle}</h2>
  ${o.reviews_n || o.obstacles_n ? `<div class="kpis">
    <div class="kpi"><span class="small muted">${tx.reflection.reviewsCount}</span><strong>${o.reviews_n}</strong></div>
    <div class="kpi"><span class="small muted">${tx.reflection.moodAvg}</span><strong>${o.mood_avg == null ? '—' : o.mood_avg + ' / 5'}</strong><span class="small muted">${tx.insights.n} = ${o.mood_n}</span></div>
    <div class="kpi"><span class="small muted">${tx.reflection.obstaclesCount}</span><strong>${o.obstacles_n}</strong></div></div>
    ${o.obstacles.length ? `<section class="card" style="margin-top:14px"><h3 style="margin-top:0">${tx.reflection.topObstacles}</h3>${bars(o.obstacles)}</section>` : ''}
    ${o.habits.map((h) => `<section class="card" style="margin-top:14px"><h3 style="margin-top:0">${esc(h.emoji || '')} ${esc(h.name)}</h3>${bars(h.keys)}</section>`).join('')}
    ${o.obstacles_n < 5 ? `<p class="small muted">${tx.insights.fewData}</p>` : ''}
    <p class="small muted">${tx.reflection.noCausal}</p>` : `<p class="muted">${tx.reflection.insightsEmpty}</p>`}`;
}

// ───────────── Plan y suscripción ─────────────
const money = (cents, currency, L) => new Intl.NumberFormat(L === 'en' ? 'en-US' : 'es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const longDate = (iso, L) => (iso ? new Intl.DateTimeFormat(L === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—');
export function planPage(app, user, { csrf, status, checkout = null, error = null, flash = null }) {
  const tx = t(user.locale);
  const L = user.locale;
  const p = tx.plan;
  const sub = status.subscription;
  const subActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status) && status.pro;
  const { pro_monthly: mo, pro_yearly: yr } = status.plans;
  const save = Math.round((1 - yr.amount_cents / (mo.amount_cents * 12)) * 100);
  const current = status.pro
    ? `<div class="card"><h2 style="margin-top:0">${p.youArePro} ⭐</h2>
        ${subActive ? `<p>${sub.cancel_at_period_end ? p.endsOn : p.renewsOn} <strong>${longDate(sub.current_period_end, L)}</strong>${sub.amount_cents ? ` · ${money(sub.amount_cents, sub.currency || mo.currency, L)} / ${sub.plan === 'pro_yearly' ? p.year : p.month}` : ''}</p>
          ${sub.status === 'past_due' ? `<p class="notice">${p.pastDue}</p>` : ''}
          <form method="post" action="${P(app, sub.cancel_at_period_end ? '/app/plan/reanudar' : '/app/plan/cancelar')}">${csrfField(csrf)}<button class="btn${sub.cancel_at_period_end ? ' btn--primary' : ''}">${sub.cancel_at_period_end ? p.resume : p.cancel}</button></form>
          ${sub.cancel_at_period_end ? '' : `<p class="small muted">${p.cancelHelp}</p>`}`
        : `<p class="muted">${status.pro_until ? `${p.until} ${longDate(status.pro_until, L)}` : p.granted}</p>`}</div>`
    : `<div class="card"><h2 style="margin-top:0">${p.youAreFree}</h2><p class="muted" style="margin:0">${p.freeIncludes}</p></div>`;
  const features = `<table class="ttable plan-table"><tr><th></th><th>Free</th><th>Pro</th></tr>${p.features.map(([f, a, b]) => `<tr><td>${f}</td><td>${a}</td><td><strong>${b}</strong></td></tr>`).join('')}</table>`;
  const buy = status.pro ? '' : !status.available ? `<p class="notice">${p.soon}</p>`
    : `<form method="post" action="${P(app, '/app/plan/checkout')}" class="form card">${csrfField(csrf)}
      <fieldset class="field"><legend>${p.choose}</legend>
        <label class="plan-opt"><input type="radio" name="plan" value="pro_yearly" checked><span><strong>${money(yr.amount_cents, yr.currency, L)} / ${p.year}</strong>${save > 0 ? ` <em class="state state--done">${p.save} ${save}%</em>` : ''}<br><span class="small muted">${p.yearlyEq} ${money(Math.round(yr.amount_cents / 12), yr.currency, L)} / ${p.month}</span></span></label>
        <label class="plan-opt"><input type="radio" name="plan" value="pro_monthly"><span><strong>${money(mo.amount_cents, mo.currency, L)} / ${p.month}</strong></span></label>
      </fieldset>
      <label class="consent"><input type="checkbox" name="consent" value="1" required><span class="small">${p.consent}</span></label>
      <button class="btn btn--primary btn--block">${p.continue}</button>
      <p class="small muted" style="margin:0">🔒 ${p.secure}</p></form>`;
  const notice = checkout === 'success' ? `<p class="notice" role="status">${status.pro ? p.activated : p.processing}</p>` : checkout === 'cancel' ? `<p class="notice" role="status">${p.checkoutCancelled}</p>` : '';
  const body = `<h1>${p.title}</h1>${notice}${error ? `<p class="notice" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  ${current}<h2>${p.compare}</h2>${features}${buy}
  <p class="small muted" style="margin-top:16px">${p.keepData}</p>`;
  return appShell(app, user, { title: p.title, path: '/app/settings', body, csrf, flash });
}

// ───────────── Cuenta ─────────────
export function settingsPage(app, user, { csrf, pro, flash = null, error = null }) {
  const tx = t(user.locale);
  const listed = Intl.supportedValuesOf?.('timeZone') || [];
  const zones = listed.includes(user.timezone) ? listed : [user.timezone, ...listed]; // p. ej. 'UTC' no viene en la lista y se perdería al guardar
  const body = `<h1>${tx.settings.title}</h1><p class="muted">${esc(user.email)} · ${tx.settings.plan}: <strong>${pro ? tx.settings.pro : tx.settings.free}</strong></p>
  ${pro ? '' : `<p class="small muted">${tx.settings.planNote}</p>`}
  <p><a class="btn" href="${P(app, '/app/plan')}">${tx.plan.manage}</a></p>
  ${error ? `<p class="status error" role="alert">${esc(tx.errors[error] || tx.errors.generic)}</p>` : ''}
  <h2>${tx.settings.prefs}</h2><form class="form card" method="post" action="${P(app, '/app/settings')}">${csrfField(csrf)}
    <div class="grid2"><label class="field"><span>${tx.settings.language}</span><select class="input" name="locale"><option value="es"${user.locale === 'es' ? ' selected' : ''}>Español</option><option value="en"${user.locale === 'en' ? ' selected' : ''}>English</option></select></label>
      <label class="field"><span>${tx.settings.timezone}</span><select class="input" name="timezone">${zones.map((z) => `<option${z === user.timezone ? ' selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
      <label class="field"><span>${tx.settings.theme}</span><select class="input" name="theme">${Object.entries(tx.settings.themes).map(([k, l]) => `<option value="${k}"${user.theme === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>${tx.settings.units}</span><select class="input" name="units">${Object.entries(tx.settings.unitsOpts).map(([k, l]) => `<option value="${k}"${user.units === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <button class="btn btn--primary">${tx.settings.save}</button></form>
  <h2>${tx.reminders.title}</h2><form class="form card" method="post" action="${P(app, '/app/settings/recordatorios')}">${csrfField(csrf)}
    <label class="row"><input type="checkbox" name="enabled" value="1"${user.reminders_email ? ' checked' : ''}${user.email_verified_at ? '' : ' disabled'}><span>${tx.reminders.enable}</span></label>
    ${user.email_verified_at ? '' : `<p class="small muted" style="margin:0">${tx.reminders.verifyFirst}</p>`}
    <label class="field"><span>${tx.reminders.digest} <span class="muted small">(${tx.common.optional})</span></span><input class="input" type="time" name="digest_time" value="${esc(user.reminder_digest_time || '')}"></label>
    <p class="small muted" style="margin:0">${tx.reminders.help}</p>
    <button class="btn">${tx.settings.save}</button></form>
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
