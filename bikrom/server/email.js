// Envío de correos con Resend (API HTTP). Sin RESEND_API_KEY, el correo se guarda en la colección "correos"
// para revisarlo en el panel, y no se envía.

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function emailLayout(title, inner) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#FFFFFF;color:#0A0A0A;font-family:Inter,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid #0A0A0A;">
<tr><td style="padding:24px 28px;border-bottom:1px solid #0A0A0A;font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;letter-spacing:6px;font-size:20px;">◩ BIKROM</td></tr>
<tr><td style="padding:28px;">
<h1 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:26px;line-height:1.15;margin:0 0 16px;">${esc(title)}</h1>
${inner}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #E6E6E6;color:#5C5C5C;font-size:13px;">Bikrom · Tu empresa, en blanco y negro.</td></tr>
</table></td></tr></table></body></html>`;
}

export const button = (href, label) =>
  `<p style="margin:24px 0;"><a href="${esc(href)}" style="display:inline-block;background:#0A0A0A;color:#FFFFFF;text-decoration:none;padding:14px 22px;font-weight:600;border-radius:4px;">${esc(label)}</a></p>`;

export { esc };

export function createMailer({ apiKey, from, store }) {
  return async function send({ to, subject, html, tipo = 'general' }) {
    const record = { para: to, asunto: subject, tipo, html };
    if (!apiKey) {
      store.insert('correos', { ...record, estado: 'no enviado (falta RESEND_API_KEY)' });
      return false;
    }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      const ok = r.ok;
      store.insert('correos', { ...record, estado: ok ? 'enviado' : `error ${r.status}: ${(await r.text()).slice(0, 200)}` });
      return ok;
    } catch (e) {
      store.insert('correos', { ...record, estado: 'error: ' + e.message });
      return false;
    }
  };
}
