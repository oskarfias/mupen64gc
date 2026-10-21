// Formato de precios. Todos los precios del catálogo son antes de IVA.

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

const IVA = ' + IVA';

export function optionPrice(o) {
  switch (o.kind) {
    case 'buy':
      return money(o.price) + IVA;
    case 'subscription':
      return `${money(o.price)} al mes${IVA}`;
    case 'range':
      return `${money(o.min)} a ${money(o.max)}${o.unit ? ' ' + o.unit : ''}${IVA}`;
    case 'percent':
      return o.text + IVA;
    case 'quote':
      return 'A cotizar';
    case 'free':
      return 'Gratis';
    default:
      return '';
  }
}

export function cardPrice(p) {
  const opts = p.pricing.options;
  if (opts.length === 1 && opts[0].kind !== 'range') return optionPrice(opts[0]);
  const numeric = opts
    .filter((o) => ['buy', 'subscription', 'range'].includes(o.kind))
    .map((o) => ({ value: o.kind === 'range' ? o.min : o.price, unit: o.kind === 'subscription' ? 'al mes' : o.unit || '' }))
    .sort((a, b) => a.value - b.value);
  const min = numeric[0];
  return `Desde ${money(min.value)}${min.unit ? ' ' + min.unit : ''}${IVA}`;
}

// Rango numérico (para datos estructurados).
export function priceBounds(p) {
  const vals = [];
  for (const o of p.pricing.options) {
    if (o.kind === 'range') vals.push(o.min, o.max);
    if (o.kind === 'buy' || o.kind === 'subscription') vals.push(o.price);
  }
  return vals.length ? { low: Math.min(...vals), high: Math.max(...vals) } : null;
}
