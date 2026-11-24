// Servidor de Bikrom en Node (Render o local): sirve el sitio (dist/) y las funciones del negocio.
// Sin dependencias. Uso: `npm run build && npm start`. En Cloudflare se usa cloudflare/worker.mjs.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream, readdirSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(root, '.env')) && process.loadEnvFile) process.loadEnvFile(join(root, '.env'));

const { config } = await import('./src/config.js');
const { createStore } = await import('./server/store.js');
const { createSite } = await import('./server/site.mjs');
// Sección Bikrom Photography (Estefanía Torres Fotografía): app propia montada en /photography
const { createPhotography } = await import('./photography/index.mjs');
const photography = createPhotography({ env: process.env });
// Bikrom/HabitoOS: app propia montada en /habitoos
const { createHabitoos } = await import('./habitoos/index.mjs');
const habitoos = createHabitoos({ env: process.env });

const env = process.env;
const PORT = Number(env.PORT || 3000);
const dist = join(root, 'dist');
const store = createStore(env.DATA_DIR || join(root, 'data'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.zip': 'application/zip', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.mp4': 'video/mp4' };
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

// ───────────── Archivos estáticos ─────────────
function serveStatic(req, res, pathname) {
  let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, rel);
  if (!file.startsWith(dist)) return notFound(req, res);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }); return res.end(); }
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) return notFound(req, res);
  const ext = extname(file);
  const cache = ext === '.html' ? 'no-cache' : pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SECURITY });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}
function notFound(req, res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY });
  res.end(existsSync(join(dist, '404.html')) ? readFileSync(join(dist, '404.html')) : 'No encontrado');
}

// Descargas privadas de productos digitales: private/descargas/<sku>.<ext>
function download(res, sku) {
  const dir = join(root, 'private', 'descargas');
  const fileName = existsSync(dir) ? readdirSync(dir).find((f) => f.startsWith(sku + '.') || f === sku) : null;
  if (!fileName) return false;
  res.writeHead(200, { 'Content-Type': TYPES[extname(fileName)] || 'application/octet-stream', 'Content-Disposition': `attachment; filename="bikrom-${fileName}"`, 'Cache-Control': 'private, no-store', ...SECURITY });
  createReadStream(join(dir, fileName)).pipe(res);
  return true;
}

const site = createSite({ env, store, photography, habitoos, files: { serveStatic, notFound, download } });
const server = createServer((req, res) => site.handle(req, res));

if (!existsSync(dist)) console.warn('Aviso: no existe dist/. Ejecuta `npm run build` primero.');
server.listen(PORT, () => {
  console.log(`Bikrom en http://localhost:${PORT}${config.preview ? ' · VISTA PREVIA' : ''} · pagos: ${site.providerFor()} · correo: ${env.RESEND_API_KEY ? 'Resend' : 'sin enviar (se guarda en el panel)'} · ${site.products.length} productos`);
});
