// Revisión del sitio generado: títulos y descripciones únicos, precios con "+ IVA",
// 37 productos y lista de marcadores [PENDIENTES] por llenar. Uso: npm run check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { products } from '../src/data/products.js';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) files.push(p);
  }
})(dist);

const problems = [];
const titles = new Map();
const descs = new Map();
const markers = new Map();

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const page = '/' + relative(dist, f).replace(/index\.html$/, '');
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="(.*?)">/)?.[1];
  if (titles.has(title)) problems.push(`Título repetido: ${page} y ${titles.get(title)}`);
  if (descs.has(desc)) problems.push(`Descripción repetida: ${page} y ${descs.get(desc)}`);
  titles.set(title, page);
  descs.set(desc, page);
  // Todo precio en pesos visible debe llevar "+ IVA" (excepto el carrito, que desglosa el IVA).
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const m of text.matchAll(/\$\d[\d,]*(?:\s(?:a|al|por)\s[^+$.]{0,40}?)?(?=[^$]{0,40})/g)) {
    const after = text.slice(m.index, m.index + 90);
    if (!/\+ IVA|IVA incluido|más IVA/.test(after) && !page.startsWith('/carrito')) problems.push(`Precio sin "+ IVA" en ${page}: "${after.slice(0, 60)}"`);
  }
  for (const m of html.matchAll(/<mark class="ph">\[(.*?)\]<\/mark>/g)) {
    const k = `[${m[1]}]`;
    if (!markers.has(k)) markers.set(k, new Set());
    markers.get(k).add(page);
  }
}

if (products.length !== 37) problems.push(`Se esperaban 37 productos y hay ${products.length}`);

console.log(`${files.length} páginas revisadas.`);
console.log(problems.length ? `\nProblemas:\n- ${problems.join('\n- ')}` : 'Sin problemas de títulos, descripciones ni precios.');
console.log(`\nMarcadores pendientes (${markers.size}):`);
for (const [k, pages] of [...markers].sort((a, b) => a[0].localeCompare(b[0], 'es'))) console.log(`${k}  →  ${pages.size} página(s)`);
process.exitCode = problems.length ? 1 : 0;
