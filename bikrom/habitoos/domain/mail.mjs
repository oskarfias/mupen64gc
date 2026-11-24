// Correo transaccional de HabitoOS. Sin Resend configurado no se envía nada ni se simula:
// en desarrollo, el enlace queda en el registro del servidor para poder probar el flujo.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendEmail(app, { to, subject, text, lang = 'es' }) {
  if (!app.mail.configured) {
    if (app.env.NODE_ENV !== 'production') console.log(`[habitoos] correo no enviado (sin proveedor) a ${to}: ${subject}\n${text}`);
    app.audit(null, 'email_not_sent', 'email', null, { subject });
    return 'not_configured';
  }
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#FAF9F7;font-family:Arial,Helvetica,sans-serif;color:#1F2328">
<table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="520" style="max-width:520px;background:#fff;border:1px solid #E4E2DD;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-weight:700;font-size:18px">HabitoOS <span style="font-weight:400;color:#5F6368">by Bikrom</span></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6">${text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/(https?:\/\/\S+)/g, '<a href="$1" style="color:#0E5E6F">$1</a>')}</p>`).join('')}</td></tr>
</table></td></tr></table></body></html>`;
  try {
    await app.mail.send({ to, subject, text, html });
    return 'sent';
  } catch (e) {
    app.audit(null, 'email_failed', 'email', null, { subject, error: String(e.message).slice(0, 200) });
    return 'failed';
  }
}
