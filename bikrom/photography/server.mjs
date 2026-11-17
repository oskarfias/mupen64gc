// Servidor independiente para desarrollo o para publicar la sección por separado.
// En bikrom.com se monta dentro de ../server.mjs bajo /photography.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(here, '.env')) && process.loadEnvFile) process.loadEnvFile(join(here, '.env'));
const { createPhotography } = await import('./index.mjs');
const { app, handle } = createPhotography();
const port = Number(process.env.PORT || 3100);
createServer((req, res) => {
  if (req.url === '/' ) { res.writeHead(302, { Location: app.base + '/' }); return res.end(); }
  if (!req.url.startsWith(app.base)) { res.writeHead(404); return res.end(); }
  handle(req, res);
}).listen(port, () => {
  const i = app.integrations();
  console.log(`Estefanía Torres Fotografía en http://localhost:${port}${app.base}/ · pagos: ${i.payments ? 'conectados' : 'DEMO'} · correo: ${i.email ? 'Resend' : 'sin conectar'} · calendario: ${i.calendar ? 'Google' : 'sin conectar'} · archivos: ${i.storage}`);
});
