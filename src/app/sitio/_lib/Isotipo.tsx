import { ISOTIPO_INNER } from "./isotipo-paths";

/**
 * Isotipo de Quinta Mamá (flor de cuatro pétalos).
 * SVG en línea para que herede `currentColor` — el color se controla
 * desde el contenedor, en positivo o negativo, sin duplicar archivos.
 */
export function Isotipo({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 105.25 105.25"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ fill: "currentColor", display: "block", width: "100%", height: "auto" }}
      dangerouslySetInnerHTML={{ __html: ISOTIPO_INNER }}
    />
  );
}
