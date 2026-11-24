// Identidad: registro, sesiones revocables, verificación de correo, recuperación y eliminación de cuenta.
import { createHash, randomBytes } from 'node:crypto';
import { hashSecret, verifySecret } from '../../photography/lib/security.mjs';
import { isTimeZone } from '../lib/tz.mjs';
import { sendEmail } from './mail.mjs';

const SESSION_DAYS = 30;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const err = (code, status = 400) => Object.assign(new Error(code), { code, status });
const DUMMY_HASH = hashSecret('contraseña-ficticia-para-tiempo-constante');

export const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '')) && String(e).length <= 254;
export const validPassword = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200;

export function register(app, { email, password, locale = 'es', timezone }) {
  email = String(email || '').trim().toLowerCase();
  if (!validEmail(email)) throw err('invalid_email');
  if (!validPassword(password)) throw err('weak_password');
  const tz = isTimeZone(timezone) ? timezone : 'America/Mexico_City';
  const lang = locale === 'en' ? 'en' : 'es';
  const now = app.iso();
  const id = app.id();
  try {
    app.db.tx(() => {
      app.db.run('INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, email, hashSecret(password), now, now);
      app.db.run('INSERT INTO profiles (user_id, locale, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, lang, tz, now, now);
    });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw err('email_taken', 409);
    throw e;
  }
  app.audit(id, 'signup_completed', 'user', id);
  return id;
}

export function login(app, { email, password }) {
  const u = app.db.get("SELECT * FROM users WHERE email = ? COLLATE NOCASE AND status = 'active'", String(email || '').trim());
  // Tiempo constante aunque el correo no exista (evita enumerar cuentas)
  const ok = verifySecret(String(password || ''), u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) throw err('invalid_credentials', 401);
  return u.id;
}

export function createSession(app, userId, userAgent = '') {
  const token = randomBytes(32).toString('base64url');
  const now = app.now();
  app.db.run('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    sha(token), userId, new Date(now).toISOString(), new Date(now + SESSION_DAYS * 864e5).toISOString(), new Date(now).toISOString(), String(userAgent).slice(0, 200));
  return { token, maxAge: SESSION_DAYS * 86400 };
}

// Valida la sesión en cada solicitud; devuelve usuario + perfil o null
export function sessionUser(app, token) {
  if (!token || token.length > 100) return null;
  const s = app.db.get('SELECT * FROM sessions WHERE id = ?', sha(token));
  if (!s || s.revoked_at || s.expires_at <= app.iso()) return null;
  const u = app.db.get("SELECT u.id, u.email, u.email_verified_at, u.role, p.* FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ? AND u.status = 'active'", s.user_id);
  if (!u) return null;
  if (Date.parse(s.last_seen_at) < app.now() - 3600_000) app.db.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', app.iso(), s.id);
  return { ...u, id: s.user_id, sessionId: s.id };
}

export const revokeSession = (app, sessionId) => app.db.run('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', app.iso(), sessionId);
export const revokeAllSessions = (app, userId, exceptId = null) =>
  app.db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id IS NOT ?', app.iso(), userId, exceptId);

function issueToken(app, userId, purpose, hours) {
  const token = randomBytes(32).toString('base64url');
  app.db.run('INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    app.id(), userId, purpose, sha(token), new Date(app.now() + hours * 3600_000).toISOString(), app.iso());
  return token;
}

function consumeToken(app, token, purpose) {
  if (!token || String(token).length > 100) return null;
  return app.db.tx(() => {
    const t = app.db.get('SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = ?', sha(String(token)), purpose);
    if (!t || t.used_at || t.expires_at <= app.iso()) return null;
    app.db.run('UPDATE email_tokens SET used_at = ? WHERE id = ?', app.iso(), t.id);
    return t.user_id;
  });
}

export async function sendVerification(app, userId) {
  const u = app.db.get('SELECT u.email, p.locale FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?', userId);
  if (!u) return null;
  const token = issueToken(app, userId, 'verify', 48);
  const link = app.url(`/verificar?t=${token}`);
  return sendEmail(app, {
    to: u.email, lang: u.locale,
    subject: u.locale === 'en' ? 'Confirm your email — HabitoOS' : 'Confirma tu correo — HabitoOS',
    text: u.locale === 'en' ? `Confirm your email to keep your HabitoOS account secure:\n\n${link}\n\nThis link expires in 48 hours.` : `Confirma tu correo para mantener segura tu cuenta de HabitoOS:\n\n${link}\n\nEste enlace vence en 48 horas.`,
  });
}

export function verifyEmail(app, token) {
  const userId = consumeToken(app, token, 'verify');
  if (!userId) return false;
  app.db.run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?', app.iso(), app.iso(), userId);
  app.audit(userId, 'email_verified', 'user', userId);
  return true;
}

// Siempre responde igual, exista o no la cuenta
export async function requestReset(app, email) {
  const u = app.db.get("SELECT u.id, u.email, p.locale FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.email = ? COLLATE NOCASE AND u.status = 'active'", String(email || '').trim());
  if (!u) return;
  const token = issueToken(app, u.id, 'reset', 1);
  const link = app.url(`/restablecer?t=${token}`);
  await sendEmail(app, {
    to: u.email, lang: u.locale,
    subject: u.locale === 'en' ? 'Reset your password — HabitoOS' : 'Restablece tu contraseña — HabitoOS',
    text: u.locale === 'en' ? `Use this link to choose a new password (valid for 1 hour):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.` : `Usa este enlace para elegir una contraseña nueva (válido 1 hora):\n\n${link}\n\nSi no lo pediste, ignora este correo.`,
  });
  app.audit(u.id, 'password_reset_requested', 'user', u.id);
}

export function resetPassword(app, token, password) {
  if (!validPassword(password)) throw err('weak_password');
  const userId = consumeToken(app, token, 'reset');
  if (!userId) throw err('invalid_token');
  app.db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashSecret(password), app.iso(), userId);
  revokeAllSessions(app, userId); // cierra todas las sesiones abiertas
  app.audit(userId, 'password_reset', 'user', userId);
  return userId;
}

export function changePassword(app, userId, current, next, keepSessionId) {
  const u = app.db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!verifySecret(String(current || ''), u.password_hash)) throw err('invalid_credentials', 401);
  if (!validPassword(next)) throw err('weak_password');
  app.db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashSecret(next), app.iso(), userId);
  revokeAllSessions(app, userId, keepSessionId);
  app.audit(userId, 'password_changed', 'user', userId);
}

// Eliminación: borra datos personales (cascada). La auditoría queda seudonimizada.
export function deleteAccount(app, userId, password) {
  const u = app.db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!u || !verifySecret(String(password || ''), u.password_hash)) throw err('invalid_credentials', 401);
  const pseudo = sha(`deleted:${userId}`).slice(0, 16);
  app.db.tx(() => {
    app.db.run('DELETE FROM users WHERE id = ?', userId);
    app.db.run('UPDATE audit_events SET actor_id = ? WHERE actor_id = ?', `deleted:${pseudo}`, userId);
  });
  app.audit(`deleted:${pseudo}`, 'account_deleted', 'user', null);
}
