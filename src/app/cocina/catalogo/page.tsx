import { Header } from "@/components/Header";
import Link from "next/link";
import { SubHubGrid, type SubModulo } from "../_SubHub";

const SUBMODULOS: SubModulo[] = [
  {
    href: "/cocina/insumos",
    label: "Insumos",
    desc: "Ficha de cada materia prima — precio actual, último pedido, mínimo de compra.",
  },
  {
    href: "/cocina/proveedores",
    label: "Proveedores",
    desc: "Contactos y modalidades de pago (Bs BCV, paralela, USD efectivo o divisa).",
  },
  {
    href: "/cocina/compras",
    label: "Compras",
    desc: "Registrar pedidos recibidos — actualiza stock y precio del insumo automáticamente.",
  },
];

export default function CatalogoMateriasPrimasPage() {
  return (
    <>
      <Header subtitle="Cocina · M1" />
      <main className="flex-1 mx-auto w-full max-w-4xl px-5 py-10">
        <section className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-[11px] tracking-[0.4em] text-cacao-soft">
              Cocina · Módulo 1
            </p>
            <h1 className="mt-2 font-cinzel text-2xl sm:text-3xl tracking-[0.12em] uppercase text-cacao">
              Catálogo de Materias Primas
            </h1>
            <p className="mt-3 font-serif italic text-cacao-soft max-w-2xl">
              Datos de cada ingrediente: precio, proveedor, modalidad de pago,
              mínimo de compra. M3 usa estos datos para calcular costos y M5
              para generar alertas y pedidos sugeridos.
            </p>
          </div>
          <Link
            href="/cocina"
            className="text-xs uppercase tracking-widest text-cacao-soft hover:text-cacao"
          >
            ← Cocina
          </Link>
        </section>
        <SubHubGrid modulos={SUBMODULOS} />
      </main>
    </>
  );
}
