// Contraseñas, códigos de acceso, firmas y cifrado. Solo módulos de Node.
import { scryptSync, randomBytes, randomInt, timingSafeEqual, createHmac, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const SECRET = () => {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET (32+ caracteres) es obligatorio en producción.');
  return 'demo-secret-solo-para-desarrollo-no-usar-en-produccion';
};

export const token = (bytes = 24) => randomBytes(bytes).toString('base64url');

export function hashSecret(secret) {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifySecret(secret, stored) {
  const [alg, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const got = scryptSync(String(secret), Buffer.from(saltB64, 'base64url'), expected.length, { N: 16384, r: 8, p: 1 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Código de galería: XXXX-XXXX-XXXX. Los 4 primeros caracteres localizan el acceso; los 8 restantes son el secreto.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O, 1/I/L
const randChars = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export function newAccessCode() {
  const lookup = randChars(4);
  const secret = randChars(8);
  return { lookup, secret, code: `${lookup}-${secret.slice(0, 4)}-${secret.slice(4)}` };
}

export function parseAccessCode(input) {
  const clean = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 12) return null;
  if ([...clean].some((c) => !ALPHABET.includes(c))) return null;
  return { lookup: clean.slice(0, 4), secret: clean.slice(4) };
}

export const sign = (value) => createHmac('sha256', SECRET()).update(value).digest('base64url');

export function signedValue(value) {
  return `${value}.${sign(value)}`;
}

export function readSigned(signed) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const mac = Buffer.from(signed.slice(i + 1));
  const expected = Buffer.from(sign(value));
  return mac.length === expected.length && timingSafeEqual(mac, expected) ? value : null;
}

// Cifrado simétrico para secretos guardados en la base (p. ej. token de Google).
const key32 = () => createHash('sha256').update(SECRET()).digest();

export function encrypt(text) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key32(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, enc] = String(payload).split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key32(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
