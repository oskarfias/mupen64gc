// Logo de Bikrom: símbolo (cuadrado dividido en diagonal, mitad negro y mitad blanco, con borde negro)
// + wordmark BIKROM. Nunca lleva color.

export function symbol({ size = 28, inverse = false, label = '' } = {}) {
  const ink = inverse ? '#FFFFFF' : '#0A0A0A';
  const paper = inverse ? '#0A0A0A' : '#FFFFFF';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="logo-symbol" ${a11y} width="${size}" height="${size}" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" fill="${paper}"/><path d="M31 1V31H1Z" fill="${ink}"/><rect x="1" y="1" width="30" height="30" fill="none" stroke="${ink}" stroke-width="2"/></svg>`;
}

export function logo({ inverse = false, href = '/' } = {}) {
  return `<a class="logo${inverse ? ' logo--inverse' : ''}" href="${href}" aria-label="Bikrom, ir al inicio">${symbol({ inverse })}<span class="logo-word">BIKROM</span></a>`;
}

// Archivos SVG independientes (public/): principal, inverso y solo símbolo.
export function logoSvgFile({ inverse = false } = {}) {
  const ink = inverse ? '#FFFFFF' : '#0A0A0A';
  const paper = inverse ? '#0A0A0A' : '#FFFFFF';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="40" viewBox="0 0 220 40" role="img" aria-label="Bikrom">
  <rect width="220" height="40" fill="${paper}"/>
  <g transform="translate(4 4)"><rect x="1" y="1" width="30" height="30" fill="${paper}"/><path d="M31 1V31H1Z" fill="${ink}"/><rect x="1" y="1" width="30" height="30" fill="none" stroke="${ink}" stroke-width="2"/></g>
  <text x="50" y="29" fill="${ink}" font-family="'Space Grotesk', 'Futura', 'Century Gothic', Arial, sans-serif" font-weight="700" font-size="24" letter-spacing="5">BIKROM</text>
</svg>
`;
}

export function symbolSvgFile() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="Bikrom"><rect x="1" y="1" width="30" height="30" fill="#FFFFFF"/><path d="M31 1V31H1Z" fill="#0A0A0A"/><rect x="1" y="1" width="30" height="30" fill="none" stroke="#0A0A0A" stroke-width="2"/></svg>
`;
}
