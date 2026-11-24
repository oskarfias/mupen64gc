// Bikrom/HabitoOS — enrutador. Se monta en /habitoos dentro del servidor de Bikrom.
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { t } from './i18n.mjs';
import { html, json, redirect, send, readForm, parseCookies, cookie, clientIp, limited, SECURITY_HEADERS } from '../photography/lib/http.mjs';
import { sign, safeEqual } from '../photography/lib/security.mjs';
import { isDate, addDays, isTimeZone, localTime } from './lib/tz.mjs';
import * as auth from './domain/auth.mjs';
import * as H from './domain/habits.mjs';
import * as onboarding from './domain/onboarding.mjs';
import * as R from './domain/reflection.mjs';
import * as V from './views/pages.mjs';

const here = (import.meta.url ? dirname(fileURLToPath(import.meta.url)) : '.'); // en Cloudflare no hay rutas de archivo
const STATIC = join(here, 'public');
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const COOKIE = 'hos_s';

export function createHabitoos(options = {}) {
  const app = createApp(options);
  const handle = (req, res) => route(app, req, res).catch((e) => {
    const status = e.status || 500;
    if (status >= 500) { console.error('[habitoos]', e); app.audit(null, 'http_error', 'request', null, { path: req.url.split('?')[0], message: String(e.message).slice(0, 200) }); }
    if (res.headersSent) return;
    if (req.url.includes('/api/')) return json(res, status, { error: e.code || 'generic' });
    return html(res, `<!doctype html><meta charset="utf-8"><p>${t('es').errors.generic}</p>`, { status });
  });
  return { app, handle };
}

const csrfFor = (user) => sign(`hos-csrf:${user.sessionId}`);
const sameOrigin = (req) => {
  const o = req.headers.origin;
  if (!o) return true; // clientes sin navegador; las escrituras con sesión además exigen token CSRF
  try { return new URL(o).host === req.headers.host; } catch { return false; }
};

async function route(app, req, res) {
  const url = new URL(req.url, 'http://localhost');
  let path = url.pathname.slice(app.base.length) || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  const method = req.method;
  const ip = clientIp(req);

  if (path.startsWith('/static/')) return serveStatic(res, path.slice(8));
  if (path === '/manifest.webmanifest') return manifest(app, res);
  if (path === '/sw.js') return serviceWorker(app, res);

  if (method === 'POST' && !sameOrigin(req)) return json(res, 403, { error: 'origin' });

  const user = auth.sessionUser(app, parseCookies(req)[COOKIE]);
  const lang = user?.locale || (url.searchParams.get('lang') === 'en' || path === '/en' ? 'en' : parseCookies(req).hos_lang === 'en' ? 'en' : 'es');
  const tx = t(lang);
  const setSession = (userId) => {
    const s = auth.createSession(app, userId, req.headers['user-agent']);
    return cookie(COOKIE, s.token, { maxAge: s.maxAge, path: app.base, sameSite: 'Lax' });
  };
  const toApp = (u) => (u.onboarding_completed_at || app.db.get('SELECT 1 FROM habits WHERE owner_id = ?', u.id) ? `${app.base}/app/today` : `${app.base}/onboarding`);

  // ───────── API v1 ─────────
  if (path.startsWith('/api/v1/')) return api(app, req, res, path.slice(7), url, user, ip);

  // ───────── Público y acceso ─────────
  if (method === 'GET' && (path === '/' || path === '/en')) {
    if (user) return redirect(res, toApp(user), 302);
    return html(res, V.landing(app, path === '/en' ? 'en' : 'es'), { headers: path === '/en' ? { 'Set-Cookie': cookie('hos_lang', 'en', { path: app.base, maxAge: 31536000 }) } : {} });
  }
  if (path === '/registro') {
    if (method === 'GET') return user ? redirect(res, toApp(user), 302) : html(res, V.registerPage(app, lang), { noindex: true });
    if (method === 'POST') {
      const f = await readForm(req, 5_000);
      const l = f.lang === 'en' ? 'en' : 'es';
      if (limited(`hos-reg:${ip}`, 5, 3600_000)) return html(res, V.registerPage(app, l, { error: 'too_many', email: f.email }), { status: 429, noindex: true });
      if (f.terms !== '1') return html(res, V.registerPage(app, l, { error: 'generic', email: f.email }), { status: 400, noindex: true });
      try {
        const id = auth.register(app, { email: f.email, password: f.password, locale: l, timezone: f.timezone });
        await auth.sendVerification(app, id);
        return redirect(res, `${app.base}/onboarding`, 303, { 'Set-Cookie': setSession(id) });
      } catch (e) {
        if (!e.code) throw e;
        return html(res, V.registerPage(app, l, { error: e.code, email: f.email }), { status: e.status || 400, noindex: true });
      }
    }
  }
  if (path === '/entrar') {
    if (method === 'GET') return user ? redirect(res, toApp(user), 302) : html(res, V.loginPage(app, lang), { noindex: true });
    if (method === 'POST') {
      const f = await readForm(req, 5_000);
      if (limited(`hos-login:${ip}`, 10, 15 * 60_000) || limited(`hos-login-email:${String(f.email).toLowerCase()}`, 10, 15 * 60_000)) return html(res, V.loginPage(app, lang, { error: 'too_many', email: f.email }), { status: 429, noindex: true });
      try {
        const id = auth.login(app, { email: f.email, password: f.password });
        const u = app.db.get('SELECT p.onboarding_completed_at FROM profiles p WHERE p.user_id = ?', id);
        app.audit(id, 'login', 'user', id);
        return redirect(res, toApp({ id, ...u }), 303, { 'Set-Cookie': setSession(id) });
      } catch (e) {
        if (!e.code) throw e;
        return html(res, V.loginPage(app, lang, { error: e.code, email: f.email }), { status: 401, noindex: true });
      }
    }
  }
  if (path === '/salir' && method === 'POST') {
    if (user) {
      const f = await readForm(req, 2_000);
      if (safeEqual(f._csrf || '', csrfFor(user))) auth.revokeSession(app, user.sessionId);
    }
    return redirect(res, `${app.base}/entrar`, 303, { 'Set-Cookie': cookie(COOKIE, '', { maxAge: 0, path: app.base }) });
  }
  if (path === '/recuperar') {
    if (method === 'GET') return html(res, V.forgotPage(app, lang), { noindex: true });
    if (method === 'POST') {
      const f = await readForm(req, 2_000);
      if (!limited(`hos-forgot:${ip}`, 5, 3600_000)) await auth.requestReset(app, f.email);
      return html(res, V.forgotPage(app, lang, { sent: true }), { noindex: true });
    }
  }
  if (path === '/restablecer') {
    if (method === 'GET') return html(res, V.resetPage(app, lang, url.searchParams.get('t') || ''), { noindex: true, headers: { 'Referrer-Policy': 'no-referrer' } });
    if (method === 'POST') {
      const f = await readForm(req, 2_000);
      try {
        auth.resetPassword(app, f.t, f.password);
        return html(res, V.loginPage(app, lang, { notice: tx.settings.saved }), { noindex: true });
      } catch (e) {
        if (!e.code) throw e;
        return html(res, V.resetPage(app, lang, f.t, { error: e.code }), { status: 400, noindex: true });
      }
    }
  }
  if (path === '/verificar' && method === 'GET') {
    const ok = auth.verifyEmail(app, url.searchParams.get('t'));
    return html(res, V.messagePage(app, lang, ok ? tx.auth.verified : tx.auth.invalidLink, '', [user ? `${app.base}/app/today` : `${app.base}/entrar`, user ? tx.nav.today : tx.auth.login]), { noindex: true, headers: { 'Referrer-Policy': 'no-referrer' } });
  }

  // ───────── Área autenticada ─────────
  if (!user) return redirect(res, `${app.base}/entrar`, 302);
  const csrf = csrfFor(user);
  let form = null;
  if (method === 'POST') {
    form = await readForm(req, 50_000);
    if (!safeEqual(form._csrf || '', csrf)) return html(res, V.messagePage(app, lang, tx.errors.generic, '', [`${app.base}/app/today`, tx.nav.today]), { status: 403, noindex: true });
  }
  const page = (body) => html(res, body, { noindex: true });
  const back = (to, msg) => redirect(res, `${app.base}${to}${msg ? (to.includes('?') ? '&' : '?') + 'ok=' + encodeURIComponent(msg) : ''}`);
  const flash = url.searchParams.get('ok');
  let m;

  if (path === '/onboarding' && method === 'GET') return page(V.onboardingPage(app, user, onboarding.getState(app, user.id), csrf));
  if (path === '/app' || path === '/app/') return redirect(res, `${app.base}/app/today`, 302);
  if (path === '/app/today' && method === 'GET') {
    if (!user.onboarding_completed_at && !app.db.get('SELECT 1 FROM habits WHERE owner_id = ?', user.id)) return redirect(res, `${app.base}/onboarding`, 302);
    const td = H.today(app, user);
    const d = isDate(url.searchParams.get('d')) && url.searchParams.get('d') <= td ? url.searchParams.get('d') : td;
    const day = H.daily(app, user, d);
    const hour = Number(localTime(app.now(), user.timezone).slice(0, 2));
    return page(V.todayPage(app, user, day, csrf, { reflection: R.prompt(app, user, day, { localHour: hour }), flash }));
  }
  if (path === '/app/reflexion') {
    const td = H.today(app, user);
    const d = isDate(url.searchParams.get('d') || form?.d) ? (url.searchParams.get('d') || form.d) : td;
    const view = (opts = {}) => V.reflectionPage(app, user, { csrf, day: H.daily(app, user, d), review: R.getReview(app, user, d), barriers: R.BARRIERS, flash, ...opts });
    try {
      if (method === 'GET') {
        if (d > td) throw Object.assign(new Error('invalid_date'), { code: 'invalid_date', status: 400 });
        return page(view());
      }
      if (method === 'POST') {
        if (form.action === 'dismiss') { R.dismissReview(app, user, d); return back(`/app/today${d === td ? '' : '?d=' + d}`); }
        if (form.action === 'delete') { R.deleteReview(app, user, d); return back(`/app/today${d === td ? '' : '?d=' + d}`, tx.reflection.deleted); }
        const obstacles = [].concat(form.ob || []).map((v) => { const [habit_id, key] = String(v).split('|'); return { habit_id: habit_id || null, key }; });
        R.saveReview(app, user, d, { mood: form.mood, note: form.note, intention_if: form.intention_if, intention_then: form.intention_then, obstacles });
        return back(`/app/today${d === td ? '' : '?d=' + d}`, tx.reflection.saved);
      }
    } catch (e) {
      if (!e.code) throw e;
      if (e.code === 'not_found') return html(res, V.messagePage(app, lang, tx.errors.not_found, '', [`${app.base}/app/today`, tx.nav.today]), { status: 404, noindex: true });
      return html(res, V.messagePage(app, lang, tx.errors[e.code] || tx.errors.generic, '', [`${app.base}/app/today`, tx.nav.today]), { status: e.status || 400, noindex: true });
    }
  }
  if (path === '/app/habits' && method === 'GET') {
    const habits = app.db.all('SELECT * FROM habits WHERE owner_id = ? ORDER BY status, sort, created_at', user.id).map((h) => ({ ...h, goal: H.goalAt(app, h.id, H.today(app, user)) }));
    return page(V.habitsPage(app, user, habits, { csrf, pro: H.isPro(app, user.id), flash }));
  }
  if (path === '/app/habits/nuevo' && method === 'GET') return page(V.habitForm(app, user, { csrf }));
  if (path === '/app/habits' && method === 'POST') {
    try {
      const id = H.createHabit(app, user, {
        name: form.name, emoji: form.emoji, kind: form.kind, category: form.category, measure: form.measure, unit: form.unit,
        goal: { comparator: form.comparator, target: form.target, target_max: form.target_max, partial_min: form.partial_min },
        days: form.days, time: form.time, motivation: form.motivation, contingency: form.contingency,
      });
      return back(`/app/habits/${id}`, tx.settings.saved);
    } catch (e) {
      if (!e.code) throw e;
      return html(res, V.habitForm(app, user, { csrf, error: e.code }), { status: e.status || 400, noindex: true });
    }
  }
  if ((m = path.match(/^\/app\/habits\/([0-9a-f-]{36})(?:\/(meta|dias|estado|descanso))?$/))) {
    const [, id, action] = m;
    const td = H.today(app, user);
    const detail = (opts = {}) => {
      const h = H.ownHabit(app, user.id, id);
      return V.habitDetail(app, user, h, { csrf, today: td, goals: app.db.all('SELECT * FROM habit_goal_versions WHERE habit_id = ? ORDER BY valid_from', h.id),
        schedule: app.db.get('SELECT * FROM habit_schedules WHERE habit_id = ? ORDER BY valid_from DESC LIMIT 1', h.id), flash, ...opts });
    };
    try {
      if (method === 'GET' && !action) return page(detail());
      if (method === 'POST') {
        if (!action) H.updateHabit(app, user, id, { name: form.name, emoji: form.emoji, unit: form.unit, motivation: form.motivation, contingency: form.contingency });
        if (action === 'meta') H.changeGoal(app, user, id, { comparator: form.comparator, target: form.target, target_max: form.target_max, partial_min: form.partial_min }, form.from);
        if (action === 'dias') H.changeSchedule(app, user, id, { days: form.days, time: form.time }, form.from);
        if (action === 'estado') H.updateHabit(app, user, id, { status: form.status });
        if (action === 'descanso') H.addRestDay(app, user, id, td);
        return back(`/app/habits/${id}`, tx.settings.saved);
      }
    } catch (e) {
      if (!e.code) throw e;
      if (e.code === 'not_found') return html(res, V.messagePage(app, lang, tx.errors.not_found, '', [`${app.base}/app/habits`, tx.habits.title]), { status: 404, noindex: true });
      return html(res, detail({ error: e.code }), { status: e.status || 400, noindex: true });
    }
  }
  if (path === '/app/insights' && method === 'GET') {
    const pro = H.isPro(app, user.id);
    let range = Number(url.searchParams.get('r')) || 30;
    if (![7, 30, 90, 180, 365].includes(range)) range = 30;
    const clamped = !pro && range > H.FREE_HISTORY_DAYS;
    if (clamped) range = H.FREE_HISTORY_DAYS;
    const td = H.today(app, user);
    const from = addDays(td, -(range - 1));
    return page(V.insightsPage(app, user, H.metrics(app, user, from, td), { csrf, range, pro, clamped, obstacles: R.obstacleStats(app, user, from, td) }));
  }
  if (path === '/app/settings' && method === 'GET') return page(V.settingsPage(app, user, { csrf, pro: H.isPro(app, user.id), flash }));
  if (path === '/app/settings' && method === 'POST') {
    const locale = form.locale === 'en' ? 'en' : 'es';
    const tz = isTimeZone(form.timezone) ? form.timezone : user.timezone;
    app.db.run('UPDATE profiles SET locale = ?, timezone = ?, theme = ?, units = ?, updated_at = ? WHERE user_id = ?', locale, tz,
      ['system', 'light', 'dark'].includes(form.theme) ? form.theme : 'system', form.units === 'imperial' ? 'imperial' : 'metric', app.iso(), user.id);
    return back('/app/settings', t(locale).settings.saved);
  }
  if (path === '/app/settings/password' && method === 'POST') {
    try { auth.changePassword(app, user.id, form.current, form.next, user.sessionId); return back('/app/settings', tx.settings.saved); }
    catch (e) { if (!e.code) throw e; return html(res, V.settingsPage(app, user, { csrf, pro: H.isPro(app, user.id), error: e.code }), { status: 400, noindex: true }); }
  }
  if (path === '/app/settings/sessions' && method === 'POST') { auth.revokeAllSessions(app, user.id, user.sessionId); return back('/app/settings', tx.settings.saved); }
  if (path === '/app/settings/eliminar' && method === 'POST') {
    try {
      auth.deleteAccount(app, user.id, form.password);
      return redirect(res, `${app.base}/`, 303, { 'Set-Cookie': cookie(COOKIE, '', { maxAge: 0, path: app.base }) });
    } catch (e) { if (!e.code) throw e; return html(res, V.settingsPage(app, user, { csrf, pro: H.isPro(app, user.id), error: e.code }), { status: 401, noindex: true }); }
  }
  return html(res, V.messagePage(app, lang, tx.errors.not_found, '', [`${app.base}/app/today`, tx.nav.today]), { status: 404, noindex: true });
}

// ───────── API v1 (JSON). Sesión por cookie + token CSRF en X-CSRF para escrituras ─────────
async function api(app, req, res, p, url, user, ip) {
  const method = req.method;
  if (p === '/auth/register' && method === 'POST') {
    if (limited(`hos-reg:${ip}`, 5, 3600_000)) return json(res, 429, { error: 'too_many' });
    const b = await readForm(req, 5_000);
    const id = auth.register(app, { email: b.email, password: b.password, locale: b.locale, timezone: b.timezone });
    await auth.sendVerification(app, id);
    const s = auth.createSession(app, id, req.headers['user-agent']);
    return json(res, 201, { id }, { 'Set-Cookie': cookie(COOKIE, s.token, { maxAge: s.maxAge, path: app.base, sameSite: 'Lax' }) });
  }
  if (p === '/auth/login' && method === 'POST') {
    const b = await readForm(req, 5_000);
    if (limited(`hos-login:${ip}`, 10, 15 * 60_000)) return json(res, 429, { error: 'too_many' });
    const id = auth.login(app, b);
    const s = auth.createSession(app, id, req.headers['user-agent']);
    return json(res, 200, { id }, { 'Set-Cookie': cookie(COOKIE, s.token, { maxAge: s.maxAge, path: app.base, sameSite: 'Lax' }) });
  }
  if (!user) return json(res, 401, { error: 'unauthenticated' });
  if (method !== 'GET' && !safeEqual(req.headers['x-csrf'] || '', csrfFor(user))) return json(res, 403, { error: 'csrf' });
  if (method !== 'GET' && limited(`hos-write:${user.id}`, 240, 60_000)) return json(res, 429, { error: 'too_many' });
  const body = method === 'GET' ? {} : await readForm(req, 50_000);
  let m;

  if (p === '/auth/logout' && method === 'POST') { auth.revokeSession(app, user.sessionId); return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(COOKIE, '', { maxAge: 0, path: app.base }) }); }
  if (p === '/auth/resend-verification' && method === 'POST') {
    if (!limited(`hos-verify:${user.id}`, 3, 3600_000) && !user.email_verified_at) await auth.sendVerification(app, user.id);
    return json(res, 200, { ok: true });
  }
  if (p === '/me' && method === 'GET') return json(res, 200, { id: user.id, email: user.email, email_verified: Boolean(user.email_verified_at), locale: user.locale, timezone: user.timezone, units: user.units, theme: user.theme, pro: H.isPro(app, user.id), today: H.today(app, user) });
  if (p === '/onboarding' && method === 'GET') return json(res, 200, onboarding.getState(app, user.id));
  if (p === '/onboarding' && method === 'PUT') return json(res, 200, onboarding.saveState(app, user, body));
  if (p === '/onboarding/complete' && method === 'POST') {
    const fresh = auth.sessionUser(app, parseCookies(req)[COOKIE]); // zona/idioma recién guardados
    return json(res, 200, { habits: onboarding.complete(app, fresh, fresh.locale) });
  }
  if (p === '/habits' && method === 'GET') return json(res, 200, { habits: app.db.all('SELECT * FROM habits WHERE owner_id = ? ORDER BY sort, created_at', user.id).map((h) => ({ ...h, barriers: JSON.parse(h.barriers || '[]'), goal: H.goalAt(app, h.id, H.today(app, user)) })) });
  if (p === '/habits' && method === 'POST') return json(res, 201, { id: H.createHabit(app, user, body) });
  if ((m = p.match(/^\/habits\/([0-9a-f-]{36})$/))) {
    if (method === 'GET') return json(res, 200, H.ownHabit(app, user.id, m[1]));
    if (method === 'PATCH') return json(res, 200, H.updateHabit(app, user, m[1], body));
  }
  if ((m = p.match(/^\/habits\/([0-9a-f-]{36})\/goal$/)) && method === 'POST') { H.changeGoal(app, user, m[1], body, body.from); return json(res, 200, { ok: true }); }
  if ((m = p.match(/^\/habits\/([0-9a-f-]{36})\/schedule$/)) && method === 'POST') { H.changeSchedule(app, user, m[1], body, body.from); return json(res, 200, { ok: true }); }
  if ((m = p.match(/^\/habits\/([0-9a-f-]{36})\/log\/(\d{4}-\d{2}-\d{2})$/)) && method === 'PUT') return json(res, 200, H.logOccurrence(app, user, m[1], m[2], { status: body.status, value: body.value, requestId: body.requestId }));
  if ((m = p.match(/^\/habits\/([0-9a-f-]{36})\/log\/(\d{4}-\d{2}-\d{2})\/undo$/)) && method === 'POST') return json(res, 200, H.undoLog(app, user, m[1], m[2]));
  if ((m = p.match(/^\/daily\/(\d{4}-\d{2}-\d{2})$/)) && method === 'GET') return json(res, 200, H.daily(app, user, m[1]));
  if (p === '/analytics/adherence' && method === 'GET') {
    const td = H.today(app, user);
    let from = isDate(url.searchParams.get('from')) ? url.searchParams.get('from') : addDays(td, -29);
    const to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to') : td;
    const pro = H.isPro(app, user.id);
    const minFree = addDays(td, -(H.FREE_HISTORY_DAYS - 1));
    const clamped = !pro && from < minFree;
    if (clamped) from = minFree;
    return json(res, 200, { ...H.metrics(app, user, from, to, { habitId: url.searchParams.get('habit') || null }), history_limited: clamped });
  }
  if ((m = p.match(/^\/reviews\/(\d{4}-\d{2}-\d{2})$/))) {
    if (method === 'GET') return json(res, 200, { review: R.getReview(app, user, m[1]) });
    if (method === 'PUT') return json(res, 200, { review: R.saveReview(app, user, m[1], body) });
    if (method === 'DELETE') return json(res, 200, R.deleteReview(app, user, m[1]));
  }
  if ((m = p.match(/^\/reviews\/(\d{4}-\d{2}-\d{2})\/dismiss$/)) && method === 'POST') return json(res, 200, R.dismissReview(app, user, m[1]));
  if (p === '/analytics/obstacles' && method === 'GET') {
    const td = H.today(app, user);
    let from = isDate(url.searchParams.get('from')) ? url.searchParams.get('from') : addDays(td, -29);
    const to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to') : td;
    const minFree = addDays(td, -(H.FREE_HISTORY_DAYS - 1));
    const clamped = !H.isPro(app, user.id) && from < minFree;
    if (clamped) from = minFree;
    return json(res, 200, { ...R.obstacleStats(app, user, from, to), history_limited: clamped });
  }
  if (p === '/export' && method === 'GET') {
    app.audit(user.id, 'data_exported', 'user', user.id, { format: 'json' });
    return send(res, 200, JSON.stringify({ ...H.exportData(app, user.id), reviews: R.exportReviews(app, user.id) }, null, 2), { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="habitoos-datos.json"', 'Cache-Control': 'no-store' });
  }
  if (p === '/export.csv' && method === 'GET') {
    app.audit(user.id, 'data_exported', 'user', user.id, { format: 'csv' });
    return send(res, 200, H.exportCsv(app, user.id), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="habitoos-registros.csv"', 'Cache-Control': 'no-store' });
  }
  return json(res, 404, { error: 'not_found' });
}

function serveStatic(res, rel) {
  const file = normalize(join(STATIC, rel));
  if (!file.startsWith(STATIC) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'No encontrado');
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
  createReadStream(file).pipe(res);
}

function manifest(app, res) {
  return send(res, 200, JSON.stringify({
    name: 'Bikrom/HabitoOS', short_name: 'HabitoOS', start_url: `${app.base}/app/today`, scope: `${app.base}/`, display: 'standalone',
    background_color: '#FAF9F7', theme_color: '#0E5E6F', icons: [{ src: `${app.base}/static/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }), { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' });
}

// Service worker mínimo: solo guarda recursos estáticos (sin datos personales; sin modo offline en esta fase)
function serviceWorker(app, res) {
  const sw = `const C='hos-static-v1';self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||!u.pathname.startsWith('${app.base}/static/'))return;
e.respondWith(caches.open(C).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(n=>{c.put(e.request,n.clone());return n;}))));});`;
  return send(res, 200, sw, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': `${app.base}/` });
}
