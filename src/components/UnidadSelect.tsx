"use client";

// Orden solicitado por el equipo (el valor guardado es el de acá).
const UNIDADES = ["kg", "g", "mg", "L", "ml", "unidad", "porción"];

/**
 * Selector de unidad: desplegable nativo (`<select>`).
 *
 * A diferencia del `<input list="...">` con datalist (que en Safari de iPad se
 * comportaba raro), un `<select>` es un control nativo de primera clase: el iPad
 * lo muestra como su ruedita, limpio y de un toque. Más ordenado que los chips
 * cuando hay muchas líneas de ingredientes.
 *
 * Si el valor actual es una unidad "custom" que no está en la lista (ej. "taza"
 * en data vieja), se agrega como opción para no perderla.
 */
export function UnidadSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const v = value?.trim() ?? "";
  const esCustom =
    v !== "" && !UNIDADES.some((u) => u.toLowerCase() === v.toLowerCase());
  const opciones = esCustom ? [value, ...UNIDADES] : UNIDADES;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {/* Placeholder solo si aún no hay unidad elegida */}
      {v === "" && (
        <option value="" disabled>
          Unidad…
        </option>
      )}
      {opciones.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}
