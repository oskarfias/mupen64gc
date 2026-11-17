// Utilidades HTTP: cuerpo, cookies, respuestas, límite de intentos.
import { signedValue, readSigned } from './security.mjs';

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

export const html = (res, body, { status = 200, noindex = false, headers = {} } = {}) =>
  send(res, status, body, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(noindex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
    ...headers,
  });

export const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

export const redirect = (res, location, status = 303, headers = {}) => send(res, status, '', { Location: location, ...headers });

export function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readForm(req, limit) {
  const buf = await readBody(req, limit);
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { return {}; }
  }
  const out = {};
  for (const [k, v] of new URLSearchParams(buf.toString('utf8'))) {
    if (k.endsWith('[]')) (out[k.slice(0, -2)] ||= []).push(v);
    else out[k] = v;
  }
  return out;
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, path = '/photography', httpOnly = true, sameSite = 'Lax' } = {}) {
  const secure = process.env.NODE_ENV === 'production' || (process.env.SITE_URL || '').startsWith('https://');
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    maxAge != null ? `Max-Age=${Math.floor(maxAge)}` : '',
    httpOnly ? 'HttpOnly' : '',
    `SameSite=${sameSite}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export const signedCookie = (name, value, opts) => cookie(name, signedValue(value), opts);
export const readSignedCookie = (req, name) => readSigned(parseCookies(req)[name]);

export const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

// Límite de intentos en memoria (por proceso). Suficiente para una sola instancia.
const buckets = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return list.length > max;
}
export const resetLimit = (key) => buckets.delete(key);

export const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const int = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));
