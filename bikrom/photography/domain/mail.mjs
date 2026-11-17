// Correos transaccionales con plantillas editables (clave + idioma + tipo de servicio).
// Sin proveedor configurado, el correo se registra como "no enviado (demostración)": nunca se simula un envío.
import { esc } from '../views/html.mjs';

export function pickTemplate(app, key, lang, serviceKind, { specificOnly = false } = {}) {
  const l = lang === 'en' ? 'en' : 'es';
  const q = 'SELECT * FROM email_templates WHERE key = ? AND lang = ? AND active = 1 AND service_kind IS ?';
  const specific = serviceKind ? app.db.get(q, key, l, serviceKind) || app.db.get(q, key, 'es', serviceKind) : null;
  if (specific || specificOnly) return specific;
  return app.db.get(q, key, l, null) || app.db.get(q, key, 'es', null);
}

export const fill = (text, vars) => String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));

export function emailHtml(app, subject, body, lang) {
  const biz = app.setting('business');
  const paragraphs = body.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;line-height:1.65">${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#3B2F27">$1</a>')}</p>`).join('');
  return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#F6F0E7;color:#3B2F27;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFDF9;border:1px solid #E6DACA">
<tr><td style="padding:36px 36px 8px;text-align:center;font-size:22px;letter-spacing:.04em">${esc(biz.name || 'Estefanía Torres Fotografía')}</td></tr>
<tr><td style="padding:0 36px"><hr style="border:0;border-top:1px solid #E6DACA;margin:16px 0 28px"></td></tr>
<tr><td style="padding:0 36px 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;margin:0 0 20px">${esc(subject)}</h1>
${paragraphs}
</td></tr>
<tr><td style="padding:20px 36px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6E625A;border-top:1px solid #E6DACA">
${esc(biz.name || '')} · ${esc((biz.cities || []).join(' · '))}${biz.phone ? ' · WhatsApp ' + esc(biz.phone) : ''}
</td></tr></table></td></tr></table></body></html>`;
}

// Envía (o registra) un correo. dedupeKey impide enviar dos veces el mismo aviso.
export async function sendTemplate(app, { key, lang = 'es', serviceKind = null, to, vars = {}, dedupeKey = null, specificOnly = false }) {
  if (!to) return { status: 'skipped', reason: 'sin destinatario' };
  if (dedupeKey && app.db.get("SELECT 1 FROM email_log WHERE dedupe_key = ? AND status IN ('sent','not_sent_demo')", dedupeKey)) return { status: 'duplicate' };
  const tpl = pickTemplate(app, key, lang, serviceKind, { specificOnly });
  if (!tpl) return { status: 'skipped', reason: 'sin plantilla' };
  const subject = fill(tpl.subject, vars);
  const text = fill(tpl.body, vars);
  return deliver(app, { to, subject, text, html: emailHtml(app, subject, text, lang), templateKey: key, dedupeKey });
}

export async function deliver(app, { to, subject, text, html, templateKey = null, dedupeKey = null }) {
  const now = app.now();
  const record = (status, providerId = null, error = null) => {
    if (dedupeKey) {
      app.db.run(`INSERT INTO email_log (dedupe_key, to_email, template_key, subject, status, provider_id, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dedupe_key) DO UPDATE SET status = excluded.status, provider_id = excluded.provider_id, error = excluded.error, created_at = excluded.created_at`,
        dedupeKey, to, templateKey, subject, status, providerId, error, now);
    } else {
      app.db.run('INSERT INTO email_log (to_email, template_key, subject, status, provider_id, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', to, templateKey, subject, status, providerId, error, now);
    }
  };
  if (!app.mail.configured) {
    record('not_sent_demo');
    return { status: 'not_sent_demo' };
  }
  try {
    const id = await app.mail.send({ to, subject, html, text, replyTo: app.setting('business').email || undefined, idempotencyKey: dedupeKey || undefined });
    record('sent', id);
    return { status: 'sent' };
  } catch (e) {
    record('failed', null, e.message);
    app.log('sistema', 'correo_fallido', { details: `${templateKey || subject}: ${e.message}`, level: 'error' });
    throw e;
  }
}

// Aviso interno para Fani: queda en el panel y, si hay correo configurado, también se envía.
export async function alertAdmin(app, title, details, { dedupeKey = null } = {}) {
  app.log('sistema', 'alerta', { details: `${title}${details ? ' — ' + details : ''}`, level: 'warning' });
  const to = app.setting('business').admin_alert_email;
  if (!to) return;
  await deliver(app, { to, subject: `[Aviso] ${title}`, text: details || title, html: emailHtml(app, title, details || title, 'es'), templateKey: 'admin_alert', dedupeKey }).catch(() => {});
}
