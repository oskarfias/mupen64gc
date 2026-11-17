// Utilidades de plantillas HTML.
export const esc = (s = '') =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const attr = (v) => esc(v);
export const when = (cond, html) => (cond ? html : '');
export const list = (items, fn, sep = '') => (items || []).map(fn).join(sep);
