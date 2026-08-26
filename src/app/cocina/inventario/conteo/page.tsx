import { Header } from "@/components/Header";
import Link from "next/link";
import { ConteoFisicoClient } from "./ConteoFisicoClient";

export default function ConteoFisicoPage() {
  return (
    <>
      <Header subtitle="Cocina · Inventario" />
      <main className="flex-1 mx-auto w-full max-w-4xl px-5 py-10">
        <section className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-[11px] tracking-[0.4em] text-cacao-soft">
              Cocina · Inventario
            </p>
            <h1 className="mt-2 font-cinzel text-2xl sm:text-3xl tracking-[0.12em] uppercase text-cacao">
              Conteo físico
            </h1>
            <p className="mt-3 font-serif italic text-cacao-soft max-w-2xl">
              Cuadrá el inventario con la realidad: escribí cuánto tenés
              físicamente de cada insumo y el sistema fija ese número como
              stock, registrando la diferencia como un ajuste. Hacelo cada
              cierto tiempo para que el descuento por ventas no se desvíe.
            </p>
          </div>
          <Link
            href="/cocina/inventario"
            className="text-xs uppercase tracking-widest text-cacao-soft hover:text-cacao"
          >
            ← Inventario
          </Link>
        </section>
        <ConteoFisicoClient />
      </main>
    </>
  );
}
