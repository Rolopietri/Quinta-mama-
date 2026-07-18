"use client";

import { useState } from "react";

// Orden solicitado por el equipo (el valor guardado es el de acá).
const UNIDADES = ["kg", "g", "mg", "L", "ml", "unidad", "porción"];
const OTRA = "__otra__";

/**
 * Selector de unidad: desplegable nativo (`<select>`).
 *
 * A diferencia del `<input list="...">` con datalist (que en Safari de iPad
 * FILTRABA y escondía opciones cuando el campo ya tenía un valor), un `<select>`
 * muestra SIEMPRE todas las opciones. El iPad lo abre como su ruedita nativa.
 *
 * - `permitirOtra`: agrega la opción "Otra…", que abre un campo de texto para
 *   escribir unidades libres (ej. "botella", "paq 12", "saco"). Se usa en la
 *   "unidad de compra" de insumos, que no siempre es una unidad estándar.
 * - Sin `permitirOtra`: desplegable puro. Si el valor actual es una unidad
 *   custom de data vieja (ej. "taza"), se agrega como opción para no perderla.
 */
export function UnidadSelect({
  value,
  onChange,
  className,
  permitirOtra = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  permitirOtra?: boolean;
}) {
  const v = value?.trim() ?? "";
  const esEstandar = UNIDADES.some((u) => u.toLowerCase() === v.toLowerCase());
  // Recordamos si el usuario eligió "Otra…" (para quedarnos en modo texto
  // aunque el valor esté momentáneamente vacío mientras escribe).
  const [otraElegida, setOtraElegida] = useState(false);

  // Modo "otra" (campo de texto visible): solo si se permite, y hay un valor
  // custom o el usuario eligió "Otra…".
  const enOtra = permitirOtra && (otraElegida || (v !== "" && !esEstandar));

  // Sin permitirOtra, preservamos el valor custom como opción para no perderlo.
  const extraCustom = !permitirOtra && v !== "" && !esEstandar ? value : null;

  return (
    <div className="w-full">
      <select
        value={enOtra ? OTRA : value}
        onChange={(e) => {
          if (e.target.value === OTRA) {
            setOtraElegida(true);
            onChange(""); // limpiar para que escriba la unidad libre
          } else {
            setOtraElegida(false);
            onChange(e.target.value);
          }
        }}
        className={className}
      >
        {v === "" && !enOtra && (
          <option value="" disabled>
            Unidad…
          </option>
        )}
        {extraCustom && <option value={extraCustom}>{extraCustom}</option>}
        {UNIDADES.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        {permitirOtra && <option value={OTRA}>Otra…</option>}
      </select>
      {enOtra && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe la unidad (ej: botella, paq 12)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={(className ?? "") + " mt-1"}
        />
      )}
    </div>
  );
}
