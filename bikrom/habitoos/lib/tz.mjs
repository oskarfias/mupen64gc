// Fechas locales por zona IANA, sin dependencias.
const cache = new Map();
const fmt = (tz) => {
  if (!cache.has(tz)) cache.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  return cache.get(tz);
};

let zones = null;
export function isTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  zones ||= new Set(Intl.supportedValuesOf?.('timeZone') || []);
  if (zones.has(tz) || tz === 'UTC') return true;
  try { fmt(tz); return true; } catch { return false; }
}

const parts = (ms, tz) => Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));

export const localDate = (ms, tz) => { const p = parts(ms, tz); return `${p.year}-${p.month}-${p.day}`; };
export const localTime = (ms, tz) => { const p = parts(ms, tz); return `${p.hour}:${p.minute}`; };

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Día ISO de la semana: lunes = 1 … domingo = 7
export const isoWeekday = (date) => { const w = new Date(`${date}T00:00:00Z`).getUTCDay(); return w === 0 ? 7 : w; };

export function* eachDate(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function formatLongDate(date, lang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
