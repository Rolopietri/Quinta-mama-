import { Header } from "@/components/Header";
import Link from "next/link";
import { InventarioClient } from "./InventarioClient";

export default function StockPage() {
  return (
    <>
      <Header subtitle="Inventario · Stock" />
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10">
        <section className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-[11px] tracking-[0.4em] text-cacao-soft">
              Módulo 1 · Stock
            </p>
            <h1 className="mt-2 font-cinzel text-2xl sm:text-3xl tracking-[0.12em] uppercase text-cacao">
              Stock y pérdidas
            </h1>
            <p className="mt-3 font-serif italic text-cacao-soft max-w-2xl">
              Stock por insumo + registro de pérdidas, mermas, mal estado y
              vencimientos. Historial trazable de cada movimiento manual.
            </p>
          </div>
          <Link
            href="/cocina/catalogo"
            className="text-xs uppercase tracking-widest text-cacao-soft hover:text-cacao"
          >
            ← Volver a M1
          </Link>
        </section>
        <InventarioClient />
      </main>
    </>
  );
}
