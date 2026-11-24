// Recordatorios por correo (PRD B18). Opt-in, solo con correo verificado, según la zona horaria de cada usuario.
// - A la hora configurada de cada hábito (si sigue pendiente).
// - Resumen diario opcional con lo que siga pendiente.
// Un envío por franja y día (reminder_log); ventana de 60 min para tolerar el intervalo del programador.
import { sign, safeEqual } from '../../photography/lib/security.mjs';
import { localTime, isTime } from '../lib/tz.mjs';
import { today, daily, scheduleAt } from './habits.mjs';
import { sendEmail } from './mail.mjs';
import { t } from '../i18n.mjs';

const WINDOW_MIN = 60;
const mins = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export const unsubscribeSig = (userId) => sign(`hos-unsub:${userId}`);
export const unsubscribeUrl = (app, userId) => app.url(`/recordatorios/baja?u=${encodeURIComponent(userId)}&s=${encodeURIComponent(unsubscribeSig(userId))}`);

export function setPreferences(app, user, { enabled, digestTime }) {
  const on = enabled === true || enabled === '1' || enabled === 'on';
  if (on && !user.email_verified_at) throw Object.assign(new Error('email_unverified'), { code: 'email_unverified', status: 400 });
  app.db.run('UPDATE profiles SET reminders_email = ?, reminder_digest_time = ?, updated_at = ? WHERE user_id = ?', on ? 1 : 0, isTime(digestTime) ? digestTime : null, app.iso(), user.id);
  app.audit(user.id, on ? 'reminders_enabled' : 'reminders_disabled', 'profile', user.id);
}

export function unsubscribe(app, userId, sig) {
  if (!userId || !sig || !safeEqual(sig, unsubscribeSig(userId))) return false;
  const r = app.db.run('UPDATE profiles SET reminders_email = 0, updated_at = ? WHERE user_id = ?', app.iso(), userId);
  if (r.changes) app.audit(userId, 'reminders_unsubscribed', 'profile', userId);
  return Boolean(r.changes);
}

// Qué toca enviar ahora a un usuario: [{ slot, items }]
export function dueFor(app, user) {
  const date = today(app, user);
  const now = mins(localTime(app.now(), user.timezone));
  const inWindow = (hm) => now >= mins(hm) && now - mins(hm) <= WINDOW_MIN;
  const pending = daily(app, user, date).items.filter((i) => i.status === 'pending');
  const slots = new Map();
  for (const i of pending) {
    const time = scheduleAt(app, i.id, date)?.local_time;
    if (time && isTime(time) && inWindow(time)) (slots.get(time) || slots.set(time, []).get(time)).push(i);
  }
  const out = [...slots].map(([slot, items]) => ({ slot, items }));
  if (user.reminder_digest_time && inWindow(user.reminder_digest_time) && pending.length) out.push({ slot: 'digest', items: pending });
  const sent = new Set(app.db.all('SELECT slot FROM reminder_log WHERE owner_id = ? AND local_date = ?', user.id, date).map((r) => r.slot));
  return { date, due: out.filter((s) => !sent.has(s.slot)) };
}

export async function runReminders(app) {
  const users = app.db.all("SELECT u.id, u.email, u.email_verified_at, p.* FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.status = 'active' AND p.reminders_email = 1 AND u.email_verified_at IS NOT NULL");
  let sent = 0;
  for (const user of users) {
    const { date, due } = dueFor(app, { ...user, id: user.id });
    for (const { slot, items } of due) {
      // Se reserva la franja antes de enviar: dos ejecuciones simultáneas no duplican el correo.
      const claimed = app.db.run('INSERT OR IGNORE INTO reminder_log (owner_id, local_date, slot, habits, result, sent_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, date, slot, items.length, 'pending', app.iso());
      if (!claimed.changes) continue;
      const tx = t(user.locale).reminders;
      const list = items.map((i) => `• ${i.emoji ? i.emoji + ' ' : ''}${i.name}`).join('\n');
      const subject = slot === 'digest' ? tx.digestSubject.replace('{n}', items.length) : items.length === 1 ? tx.oneSubject.replace('{name}', items[0].name) : tx.manySubject.replace('{n}', items.length);
      const text = `${slot === 'digest' ? tx.digestIntro : tx.intro}\n\n${list}\n\n${tx.cta} ${app.url('/app/today')}\n\n${tx.noGuilt}\n\n${tx.unsubscribe} ${unsubscribeUrl(app, user.id)}`;
      const result = await sendEmail(app, { to: user.email, subject, text, lang: user.locale });
      app.db.run('UPDATE reminder_log SET result = ? WHERE owner_id = ? AND local_date = ? AND slot = ?', result, user.id, date, slot);
      if (result === 'sent') sent++;
    }
  }
  return sent;
}
