// Panel privado: autenticación, CSRF y despacho de rutas.
import { randomBytes } from 'node:crypto';
import { html, json, redirect, readForm, readBody, signedCookie, readSignedCookie, cookie, clientIp, limited, resetLimit } from '../../lib/http.mjs';
import { hashSecret, verifySecret, sign, safeEqual } from '../../lib/security.mjs';
import { adminLayout, A, esc } from './ui.mjs';
import * as ops from './ops.mjs';
import * as config from './config.mjs';

const SESSION_HOURS = 12;
let passwordHash = null;

function adminPassword(app) {
  const pw = app.env.PHOTO_ADMIN_PASSWORD;
  if (!pw || pw.length < 10) return null;
  if (!passwordHash) passwordHash = hashSecret(pw);
  return passwordHash;
}

function session(app, req) {
  const v = readSignedCookie(req, 'etf_admin');
  if (!v) return null;
  const [who, exp, nonce] = v.split(':');
  if (who !== 'admin' || !(Number(exp) > app.now())) return null;
  return { nonce, csrf: sign(`csrf:${nonce}`) };
}

export const isAdminRequest = (app, req) => Boolean(session(app, req));

export async function adminRoutes(app, req, res, path, url) {
  const sub = path.slice('/admin'.length) || '';
  const method = req.method;

  if (sub === '/entrar') {
    if (!adminPassword(app)) return html(res, loginPage(app, 'El panel está desactivado: define PHOTO_ADMIN_PASSWORD (mínimo 10 caracteres) en las variables de entorno del servidor.'), { status: 503, noindex: true });
    if (method === 'GET') return html(res, loginPage(app), { noindex: true });
    const ip = clientIp(req);
    if (limited(`admin-login:${ip}`, 5, 15 * 60_000)) return html(res, loginPage(app, 'Demasiados intentos. Espera 15 minutos.'), { status: 429, noindex: true });
    const f = await readForm(req, 2_000);
    if (!verifySecret(f.password || '', adminPassword(app))) {
      app.log('admin', 'acceso_fallido', { details: ip, level: 'warning' });
      return html(res, loginPage(app, 'Contraseña incorrecta.'), { status: 401, noindex: true });
    }
    resetLimit(`admin-login:${ip}`);
    const exp = app.now() + SESSION_HOURS * 3600_000;
    const nonce = randomBytes(12).toString('base64url');
    app.log('admin', 'acceso', { details: ip });
    return redirect(res, A(app), 303, { 'Set-Cookie': signedCookie('etf_admin', `admin:${exp}:${nonce}`, { maxAge: SESSION_HOURS * 3600, sameSite: 'Strict' }) });
  }

  const s = session(app, req);
  if (!s) return redirect(res, A(app, '/entrar'), 303);

  // Protección CSRF: toda escritura exige el token de la sesión y mismo origen
  let form = null;
  if (method === 'POST' || method === 'PUT') {
    const origin = req.headers.origin;
    if (origin && !app.siteUrl.startsWith(origin) && !origin.startsWith('http://localhost') && !origin.startsWith('http://127.0.0.1')) return json(res, 403, { error: 'origen no permitido' });
    const isPart = sub.startsWith('/api/uploads/') && sub.endsWith('/parte');
    const headerToken = req.headers['x-csrf'];
    if (isPart) {
      if (!headerToken || !safeEqual(headerToken, s.csrf)) return json(res, 403, { error: 'csrf' });
    } else {
      form = await readForm(req, sub.startsWith('/api/') ? 100_000 : 2_000_000);
      const token = headerToken || form._csrf;
      if (!token || !safeEqual(token, s.csrf)) return html(res, adminLayout(app, { title: 'Sesión vencida', body: `<p>Vuelve a cargar la página e inténtalo de nuevo.</p><p><a class="btn" href="${A(app)}">Volver</a></p>` }), { status: 403, noindex: true });
    }
  }

  if (sub === '/salir' && method === 'POST') {
    return redirect(res, A(app, '/entrar'), 303, { 'Set-Cookie': cookie('etf_admin', '', { maxAge: 0, sameSite: 'Strict' }) });
  }

  const ctx = {
    app, req, res, url, form, csrf: s.csrf, method,
    render: (title, body, opts = {}) => html(res, adminLayout(app, { title, body, path: opts.path ?? sub, csrf: s.csrf, flash: opts.flash ?? url.searchParams.get('ok'), scripts: opts.scripts || [] }), { noindex: true, status: opts.status || 200 }),
    back: (to, msg) => redirect(res, `${A(app, to)}${msg ? (to.includes('?') ? '&' : '?') + 'ok=' + encodeURIComponent(msg) : ''}`),
    json: (status, data) => json(res, status, data),
    body: () => readBody(req, 9 * 1024 * 1024),
  };

  for (const mod of [ops, config]) {
    for (const [pattern, handlers] of mod.routes) {
      const m = sub.match(pattern);
      if (m && handlers[method]) {
        ctx.params = m.slice(1);
        try {
          return await handlers[method](ctx);
        } catch (e) {
          app.log('admin', 'error_panel', { details: `${method} ${sub}: ${e.message}`, level: 'error' });
          if (sub.startsWith('/api/')) return json(res, e.status || 400, { error: e.code || e.message });
          return ctx.render('No se pudo completar', `<p>${esc(e.message)}</p><p><a class="btn" href="javascript:history.back()">Volver</a></p>`, { status: 400 });
        }
      }
    }
  }
  return ctx.render('No encontrado', '<p>Esta sección no existe.</p>', { status: 404 });
}

function loginPage(app, error = null) {
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Entrar · Panel</title><link rel="stylesheet" href="${app.base}/static/css/admin.css"></head><body>
<main class="a-main" style="max-width:380px;padding-top:12vh"><h1>Panel privado</h1>
${error ? `<p class="a-flash" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="${A(app, '/entrar')}" class="a-form">
<label class="a-field"><span>Contraseña</span><input type="password" name="password" required autocomplete="current-password" autofocus></label>
<button class="btn btn--solid">Entrar</button></form></main></body></html>`;
}
