// Fechas en la zona de la agenda (America/Mexico_City) sin dependencias.
export const TZ = 'America/Mexico_City';
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const fmtParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function partsAt(ms) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

// Diferencia (ms) entre la hora local de la zona y UTC en un instante dado.
function offsetAt(ms) {
  const p = partsAt(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

// 'YYYY-MM-DD' + 'HH:MM' (hora local de la agenda) → instante UTC en ms.
export function zonedToUtc(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - offsetAt(guess);
  ms = guess - offsetAt(ms); // segunda pasada por si cambia el desfase
  return ms;
}

export function localDate(ms) {
  const p = partsAt(ms);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function localTime(ms) {
  const p = partsAt(ms);
  return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
}

export const minutesOfDay = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
export const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

const longFmt = {
  es: new Intl.DateTimeFormat('es-MX', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }),
  en: new Intl.DateTimeFormat('en-US', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }),
};
const dayFmt = {
  es: new Intl.DateTimeFormat('es-MX', { timeZone: TZ, dateStyle: 'long' }),
  en: new Intl.DateTimeFormat('en-US', { timeZone: TZ, dateStyle: 'long' }),
};

export const formatDateTime = (ms, lang = 'es') => (ms ? longFmt[lang].format(new Date(ms)) : '');
export const formatDay = (msOrDate, lang = 'es') => {
  if (!msOrDate) return '';
  const ms = typeof msOrDate === 'string' ? zonedToUtc(msOrDate, '12:00') : msOrDate;
  return dayFmt[lang].format(new Date(ms));
};
