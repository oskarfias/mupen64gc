import { config, isSet } from '../config.js';
import { mockText, mockConfig } from '../data/mock.js';

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const abs = (path) => config.siteUrl + path;

// Enlace externo seguro: si el valor sigue siendo un marcador, el enlace no navega.
export const safeHref = (url) => (isSet(url) ? esc(url) : '#pendiente');

export const hasWhatsapp = () => isSet(config.contact.whatsappNumber);

// En vista previa sin número, el WhatsApp lleva a Contacto en lugar de a un número inexistente.
export const waLink = (message = config.contact.whatsappMessage) =>
  config.preview && !hasWhatsapp()
    ? '/contacto/'
    : `https://wa.me/${encodeURIComponent(config.contact.whatsappNumber)}?text=${encodeURIComponent(message)}`;

// Valor de contacto para mostrar y enlazar (en vista previa usa el dato de ejemplo si falta el real).
export const contactValue = (key) => {
  const v = config.contact[key];
  return config.preview && !isSet(v) && mockConfig[key] ? mockConfig[key] : v;
};

const MARKER = /\[(?=[A-ZÁÉÍÓÚÑ])[^\]<>]+\]/g;
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

// Resalta los marcadores [ASÍ] en el texto visible para que no pasen desapercibidos.
// En vista previa los sustituye por el texto de ejemplo de src/data/mock.js (si existe).
// No toca atributos, <script>, <style>, <title>, <option> ni <textarea>.
export function highlightMarkers(html) {
  const parts = html.split(/(<(script|style|title|option|textarea)\b[\s\S]*?<\/\2>)/i);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 3 === 2) continue; // grupo de captura con el nombre de la etiqueta
    if (i % 3 === 1) { out += part; continue; }
    out += part.replace(/>([^<]+)</g, (m, text) =>
      '>' + text.replace(MARKER, (mk) => {
        const key = unesc(mk);
        if (config.preview && key in mockText) return esc(mockText[key]);
        return `<mark class="ph">${mk}</mark>`;
      }) + '<');
  }
  // Vista previa: también en metadatos, títulos y datos estructurados.
  if (config.preview) out = out.replace(MARKER, (mk) => (mk in mockText ? mockText[mk] : mk));
  return out;
}

export const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
