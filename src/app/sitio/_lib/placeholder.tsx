/**
 * Placeholder geométrico en paleta de marca.
 * Determinista a partir de la semilla (mismo texto → mismo dibujo), así que
 * es seguro renderizarlo en el servidor sin desajustes de hidratación.
 *
 * PENDIENTE de producción: reemplazar por fotografía real (next/image) —
 * fachada, escaleras, espacios y aliados. Todo esto son marcadores.
 */
function svgMarkup(seed: string, tono: string): string {
  const s = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (n: number) => {
    const x = Math.sin(s * (n + 1)) * 10000;
    return x - Math.floor(x);
  };
  const t = Math.floor(r(1) * 4);
  let g = "";
  if (t === 0) {
    for (let i = 0; i < 10; i++) {
      const y = 8 + i * 24;
      g += `<line x1="${6 + r(i) * 44}" y1="${y}" x2="${194 - r(i + 9) * 44}" y2="${y}" stroke="${tono}" stroke-width="${0.6 + r(i + 3) * 3}" opacity=".5"/>`;
    }
  } else if (t === 1) {
    g += `<circle cx="100" cy="124" r="${46 + r(2) * 28}" fill="none" stroke="${tono}" stroke-width="1.1" opacity=".62"/>`;
    g += `<circle cx="100" cy="124" r="${20 + r(3) * 20}" fill="${tono}" opacity=".2"/>`;
    g += `<line x1="0" y1="124" x2="200" y2="124" stroke="${tono}" stroke-width=".6" opacity=".3"/>`;
  } else if (t === 2) {
    for (let i = 0; i < 4; i++) {
      g += `<rect x="${14 + r(i) * 112}" y="${14 + r(i + 2) * 142}" width="${26 + r(i + 4) * 54}" height="${26 + r(i + 8) * 74}" fill="none" stroke="${tono}" stroke-width="1.1" opacity=".55"/>`;
    }
    g += `<rect x="70" y="95" width="60" height="60" fill="${tono}" opacity=".16"/>`;
  } else {
    g += `<path d="M12 238 L100 ${32 + r(5) * 72} L188 238 Z" fill="none" stroke="${tono}" stroke-width="1.1" opacity=".6"/>`;
    for (let i = 0; i < 6; i++)
      g += `<line x1="12" y1="${238 - i * 32}" x2="188" y2="${238 - i * 32}" stroke="${tono}" stroke-width=".6" opacity=".2"/>`;
  }
  return `<rect width="200" height="250" fill="#F4EFE8"/>${g}`;
}

export function Placeholder({ seed, tono }: { seed: string; tono: string }) {
  return (
    <svg
      viewBox="0 0 200 250"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgMarkup(seed, tono) }}
    />
  );
}
