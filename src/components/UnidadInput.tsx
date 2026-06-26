"use client";

// Orden de los chips solicitado por el equipo (el valor guardado es el de acá;
// se muestra en mayúsculas vía CSS).
const UNIDADES_CHIPS = ["kg", "g", "mg", "L", "ml", "unidad", "porción"];

/**
 * Input de unidad: campo de texto LIBRE + chips de unidades comunes.
 *
 * Reemplaza al `<input list="...">` con datalist, que en Safari de iPad se
 * comporta como selector y bloquea escribir libre. Acá el input es texto plano
 * (se puede escribir cualquier cosa en cualquier dispositivo) y los chips son
 * un atajo para las unidades frecuentes (g, kg, ml, L, unidad, porción).
 */
export function UnidadInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        className={className}
      />
      <div className="mt-1 flex flex-wrap gap-1">
        {UNIDADES_CHIPS.map((u) => {
          const activa = value.trim().toLowerCase() === u.toLowerCase();
          return (
            <button
              key={u}
              type="button"
              onClick={() => onChange(u)}
              className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 ring-1 transition-colors ${
                activa
                  ? "bg-cacao text-white ring-cacao"
                  : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
              }`}
            >
              {u}
            </button>
          );
        })}
      </div>
    </>
  );
}
