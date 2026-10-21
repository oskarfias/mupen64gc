import { config, isSet } from '../config.js';

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const abs = (path) => config.siteUrl + path;

// Enlace externo seguro: si el valor sigue siendo un marcador, el enlace no navega.
export const safeHref = (url) => (isSet(url) ? esc(url) : '#pendiente');

export const waLink = (message = config.contact.whatsappMessage) =>
  `https://wa.me/${encodeURIComponent(config.contact.whatsappNumber)}?text=${encodeURIComponent(message)}`;

// Resalta los marcadores [ASÍ] en el texto visible para que no pasen desapercibidos.
// No toca atributos, <script>, <style>, <title>, <option> ni <textarea>.
export function highlightMarkers(html) {
  const parts = html.split(/(<(script|style|title|option|textarea)\b[\s\S]*?<\/\2>)/i);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 3 === 2) continue; // grupo de captura con el nombre de la etiqueta
    if (i % 3 === 1) { out += part; continue; }
    out += part.replace(/>([^<]+)</g, (m, text) =>
      '>' + text.replace(/\[(?=[A-ZÁÉÍÓÚÑ])[^\]<>]+\]/g, (mk) => `<mark class="ph">${mk}</mark>`) + '<');
  }
  return out;
}

export const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
