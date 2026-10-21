// Generador estático de Bikrom. Sin dependencias: `node build.mjs` → dist/
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './src/config.js';
import { products, productUrl, skus } from './src/data/products.js';
import { posts } from './src/data/posts.js';
import { logoSvgFile, symbolSvgFile } from './src/lib/logo.js';

import home from './src/pages/home.js';
import catalog from './src/pages/catalog.js';
import product from './src/pages/product.js';
import diagnostico from './src/pages/diagnostico.js';
import membresia from './src/pages/membresia.js';
import * as misc from './src/pages/misc.js';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const pages = []; // { path, html, sitemap }
const add = (path, html, sitemap = true) => pages.push({ path, html, sitemap });

add('/', home());
add('/soluciones/', catalog());
for (const p of products) if (!p.href) add(productUrl(p), product(p));
add('/diagnostico-empresa-360/', diagnostico());
add('/membresia/', membresia());
add('/recursos/', misc.recursos());
for (const p of posts) add(`/recursos/${p.slug}/`, misc.post(p), !p.draft);
add('/nosotros/', misc.nosotros());
add('/contacto/', misc.contacto());
add('/solicita-propuesta/', misc.solicitaPropuesta());
add('/carrito/', misc.carrito(), false);
add('/gracias/', misc.gracias(), false);
add('/aviso-de-privacidad/', misc.privacidad());
add('/terminos-y-condiciones/', misc.terminos());
add('/politica-de-reembolsos/', misc.reembolsos());
add('/en/', misc.enPlaceholder(), false);

for (const { path, html } of pages) {
  const file = path.endsWith('/') ? join(dist, path, 'index.html') : join(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
writeFileSync(join(dist, '404.html'), misc.notFound());

// Recursos estáticos
cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
mkdirSync(join(dist, 'img'), { recursive: true });
writeFileSync(join(dist, 'favicon.svg'), symbolSvgFile());
writeFileSync(join(dist, 'img', 'simbolo.svg'), symbolSvgFile());
writeFileSync(join(dist, 'img', 'logo.svg'), logoSvgFile());
writeFileSync(join(dist, 'img', 'logo-blanco.svg'), logoSvgFile({ inverse: true }));
writeFileSync(
  join(dist, 'img', 'og-bikrom.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FFFFFF"/><g transform="translate(96 215) scale(6.25)"><rect x="1" y="1" width="30" height="30" fill="#FFFFFF"/><path d="M31 1V31H1Z" fill="#0A0A0A"/><rect x="1" y="1" width="30" height="30" fill="none" stroke="#0A0A0A" stroke-width="2"/></g><text x="360" y="300" fill="#0A0A0A" font-family="'Space Grotesk', Arial, sans-serif" font-weight="700" font-size="96" letter-spacing="18">BIKROM</text><text x="364" y="380" fill="#0A0A0A" font-family="Inter, Arial, sans-serif" font-size="40">Tu empresa, en blanco y negro.</text></svg>\n`
);
if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), dist, { recursive: true });

// Catálogo para el carrito (el servidor vuelve a validar precios con src/data/products.js).
const catalogJson = Object.fromEntries(
  Object.entries(skus).map(([sku, o]) => [
    sku,
    { sku, product: o.productName, label: o.label, price: o.price, kind: o.kind, delivery: o.delivery || null, url: productUrl(products.find((p) => p.slug === o.productSlug)) },
  ])
);
writeFileSync(join(dist, 'assets', 'catalog.json'), JSON.stringify(catalogJson));

// SEO: sitemap y robots
const today = new Date().toISOString().slice(0, 10);
const urls = pages.filter((p) => p.sitemap).map((p) => `  <url><loc>${config.siteUrl}${p.path}</loc><lastmod>${today}</lastmod></url>`);
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), config.preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /carrito/\nDisallow: /gracias/\nDisallow: /admin\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);

console.log(`Bikrom: ${pages.length + 1} páginas generadas en dist/ (${products.length} productos en catálogo)${config.preview ? ' · VISTA PREVIA' : ''}.`);
