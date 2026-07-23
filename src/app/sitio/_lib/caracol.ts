import { C } from "./data";

/**
 * Genera el SVG de la escalera caracol del hero (marcador de la imagen 360
 * real que aún no existe). Función pura y determinista → segura para SSR.
 *
 * PENDIENTE de producción: reemplazar por la imagen 360 de la escalera
 * caracol, de suelo a techo (ver 00-BRIEF sección 6.1).
 */
export function caracolMarkup(): string {
  const cx = 600;
  const luz = C.marfil;
  let d = "";
  for (let i = 0; i < 26; i++) {
    const y = i * 62 + 14;
    d += `<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="${luz}" stroke-width=".5" opacity="${0.04 + (i % 4 === 0 ? 0.07 : 0)}"/>`;
  }
  const tonos = [C.azul, C.oliva, C.terracota, C.cacao];
  [200, 590, 980, 1370].forEach((y, i) => {
    d += `<ellipse cx="${cx}" cy="${y}" rx="470" ry="86" fill="none" stroke="${tonos[i]}" stroke-width="1.3" opacity=".62"/>`;
    d += `<ellipse cx="${cx}" cy="${y}" rx="300" ry="55" fill="none" stroke="${luz}" stroke-width=".6" opacity=".16"/>`;
    d += `<line x1="130" y1="${y}" x2="1070" y2="${y}" stroke="${luz}" stroke-width=".5" opacity=".1"/>`;
  });
  const turns = 5.2,
    steps = 190,
    r = 210,
    top = 90,
    bot = 1470;
  let pA = "",
    pB = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      ang = t * turns * Math.PI * 2,
      y = top + t * (bot - top);
    const x = cx + Math.cos(ang) * r,
      yy = y + Math.sin(ang) * 44;
    const x2 = cx + Math.cos(ang) * (r * 0.36),
      yy2 = y + Math.sin(ang) * 16;
    pA += (i ? "L" : "M") + x.toFixed(1) + " " + yy.toFixed(1);
    pB += (i ? "L" : "M") + x2.toFixed(1) + " " + yy2.toFixed(1);
    if (i % 4 === 0)
      d += `<line x1="${x2.toFixed(1)}" y1="${yy2.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${luz}" stroke-width=".7" opacity=".26"/>`;
  }
  d += `<path d="${pA}" fill="none" stroke="${luz}" stroke-width="1.5" opacity=".8"/>`;
  d += `<path d="${pB}" fill="none" stroke="${luz}" stroke-width="1" opacity=".4"/>`;
  d += `<line x1="${cx}" y1="${top}" x2="${cx}" y2="${bot}" stroke="${luz}" stroke-width="1" opacity=".26"/>`;
  for (let i = 0; i <= steps; i += 9) {
    const t = i / steps,
      ang = t * turns * Math.PI * 2,
      y = top + t * (bot - top);
    const x = cx + Math.cos(ang) * r,
      yy = y + Math.sin(ang) * 44;
    d += `<line x1="${x.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(yy - 34).toFixed(1)}" stroke="${luz}" stroke-width=".5" opacity=".24"/>`;
  }
  d += `<ellipse cx="${cx}" cy="70" rx="150" ry="34" fill="none" stroke="${luz}" stroke-width="1.2" opacity=".5"/>`;
  d += `<ellipse cx="${cx}" cy="70" rx="80" ry="18" fill="none" stroke="${luz}" stroke-width=".7" opacity=".28"/>`;
  return d;
}
