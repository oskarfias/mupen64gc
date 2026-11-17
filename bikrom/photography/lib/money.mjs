// Importes en centavos de MXN. No se agregan impuestos ni cargos no definidos.
const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const mxn = (cents) => (cents == null ? '—' : `$${fmt.format(cents / 100)} MXN`);

export const pesosToCents = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export const centsToPesos = (c) => (c == null ? '' : String(c / 100));

// Anticipo: porcentaje entero sobre el total, redondeado al peso. El saldo es el resto exacto.
export function split(totalCents, depositPercent) {
  const deposit = Math.round((totalCents * depositPercent) / 100 / 100) * 100;
  return { deposit, balance: totalCents - deposit };
}
