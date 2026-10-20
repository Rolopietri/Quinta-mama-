import Link from "next/link";

/**
 * Banner de "continuar al siguiente paso" para la guía de primeros pasos de
 * Cocina. Va al final de una página-paso: el usuario puede seguir trabajando en
 * el paso actual (el formulario sigue arriba) o avanzar al siguiente sin tener
 * que devolverse al menú. Pensado para alguien sin experiencia previa.
 */
export function PasoSiguiente({
  paso,
  total = 4,
  seguirTexto,
  siguiente,
}: {
  paso: number;
  total?: number;
  /** Qué puede seguir haciendo en este paso (p. ej. "seguir agregando proveedores"). */
  seguirTexto: string;
  /** El siguiente paso: a dónde ir y cómo se llama. */
  siguiente: { href: string; label: string };
}) {
  return (
    <section className="mt-10 rounded-2xl bg-cacao text-[#EDE7E0] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
      <div className="min-w-0">
        <p className="font-display text-[10px] tracking-[0.35em] uppercase text-[#C9A24B]">
          Paso {paso} de {total}
        </p>
        <p className="mt-1 text-sm text-[#EDE7E0]/90">
          Puedes {seguirTexto} aquí arriba, o continuar con el siguiente paso.
        </p>
      </div>
      <Link
        href={siguiente.href}
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#EDE7E0] text-cacao px-5 py-2.5 text-xs uppercase tracking-widest font-medium hover:bg-white transition-colors"
      >
        Siguiente: {siguiente.label}
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
