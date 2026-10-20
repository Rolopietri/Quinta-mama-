import { Header } from "@/components/Header";
import Link from "next/link";
import { BcvRateBanner } from "./BcvRateBanner";

// ── Primeros pasos (onboarding) ──────────────────────────────────────────────
// Lo PRIMERO que ve quien entra a Cocina: una guía clara de 4 pasos para dejar
// la cocina lista, pensada para alguien sin experiencia previa. Los módulos
// completos quedan debajo como referencia.
const pasos: { n: number; href: string; label: string; desc: string }[] = [
  {
    n: 1,
    href: "/cocina/proveedores",
    label: "Agrega tus proveedores",
    desc: "A quién le compras y cómo le pagas (Bs BCV, paralela o dólar).",
  },
  {
    n: 2,
    href: "/cocina/insumos",
    label: "Carga tus insumos",
    desc: "Cada ingrediente con su precio y cuánto tienes en stock.",
  },
  {
    n: 3,
    href: "/cocina/recetas",
    label: "Crea tus recetas",
    desc: "La ficha de cada plato: qué lleva y cuánto rinde.",
  },
  {
    n: 4,
    href: "/cocina/costeo",
    label: "Costea y pon precio",
    desc: "Mira cuánto cuesta cada plato y decide su precio de venta.",
  },
];

const modulos: {
  href: string;
  label: string;
  desc: string;
  index: string;
  disabled?: boolean;
}[] = [
  {
    href: "/cocina/catalogo",
    label: "Insumos e Inventario",
    desc: "Insumos, proveedores, stock, pérdidas, auditoría y alertas.",
    index: "M1",
  },
  {
    href: "/cocina/recetas",
    label: "Recetario y Subrecetas",
    desc: "Fichas técnicas con expansión de subrecetas hasta materia prima.",
    index: "M2",
  },
  {
    href: "/cocina/costeo",
    label: "Costeo",
    desc: "Costo por receta + decisión del precio de venta (editable inline sin / con IVA).",
    index: "M3",
  },
  {
    href: "/cocina/rentabilidad",
    label: "Rentabilidad y Precio de Venta",
    desc: "Margen bruto, margen neto, food cost y semáforo por receta.",
    index: "M4",
  },
  {
    href: "/cocina/inventario",
    label: "Producción, Compras y Ventas",
    desc: "Planes de producción, compras, ventas Xetux y pedido sugerido.",
    index: "M5",
  },
  {
    href: "/cocina/menaje",
    label: "Menaje",
    desc: "Vajilla, cristalería, cubiertos y utensilios — bajas y compras con factura.",
    index: "M6",
  },
];

export default function CocinaHub() {
  return (
    <>
      <Header subtitle="Cocina" />
      <main className="flex-1 mx-auto w-full max-w-4xl px-5 py-10">
        <section className="mb-8">
          <p className="font-display text-[11px] tracking-[0.4em] text-cacao-soft">
            Operación gastronómica
          </p>
          <h1 className="mt-2 font-cinzel text-2xl sm:text-3xl tracking-[0.12em] uppercase text-cacao">
            Cocina
          </h1>
          <p className="mt-3 font-serif italic text-cacao-soft max-w-2xl">
            Sigue estos 4 pasos para dejar tu cocina lista. Hazlos en orden: cada
            uno usa lo del anterior.
          </p>
        </section>

        {/* ── Primeros pasos: lo primero y más visible ─────────────────── */}
        <section aria-label="Primeros pasos" className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pasos.map((p, i) => (
              <Link
                key={p.href}
                href={p.href}
                className="group relative rounded-2xl bg-white ring-1 ring-marfil p-6 flex items-start gap-4 transition-colors duration-300 hover:bg-marfil-soft hover:ring-terracotta/40"
              >
                <span className="shrink-0 grid place-items-center size-11 rounded-full bg-cacao text-white font-cinzel text-lg leading-none">
                  {p.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-lg tracking-tight text-cacao">
                    {p.label}
                  </span>
                  <span className="block mt-1 font-serif italic text-sm text-cacao-soft">
                    {p.desc}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-cacao group-hover:text-terracotta transition-colors">
                    {p.n === 1 ? "Empezar" : "Ir"}
                    <span className="group-hover:translate-x-0.5 transition-transform duration-300">→</span>
                  </span>
                </span>
                {i < pasos.length - 1 && (
                  <span aria-hidden className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 text-marfil text-xl">
                    ·
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        <BcvRateBanner />

        {/* ── Todos los módulos (referencia, secundario) ───────────────── */}
        <section className="mt-10">
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="font-display text-[11px] tracking-[0.35em] uppercase text-cacao-mute">
              Todos los módulos
            </h2>
            <span className="h-px flex-1 bg-marfil" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-marfil sm:border sm:border-marfil">
            {modulos.map((m) =>
              m.disabled ? (
                <div
                  key={m.label}
                  className="bg-white p-7 sm:p-8 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-cinzel text-base text-cacao-mute">
                      {m.index}
                    </span>
                    <span className="font-display text-[10px] tracking-[0.35em] text-cacao-mute">
                      PRÓXIMAMENTE
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-medium tracking-tight text-cacao">
                    {m.label}
                  </h3>
                  <p className="mt-2 font-serif italic text-sm text-cacao-mute">
                    {m.desc}
                  </p>
                </div>
              ) : (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group bg-white p-7 sm:p-8 transition-colors duration-300 hover:bg-marfil-soft"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-cinzel text-base text-cacao-mute">
                      {m.index}
                    </span>
                    <span className="font-display text-[10px] tracking-[0.35em] text-cacao-soft">
                      DISPONIBLE
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-medium tracking-tight text-cacao">
                    {m.label}
                  </h3>
                  <p className="mt-2 font-serif italic text-sm text-cacao-soft">
                    {m.desc}
                  </p>
                  <div className="mt-6 flex justify-end items-center text-cacao group-hover:text-terracotta transition-colors">
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        </section>
      </main>
    </>
  );
}
