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
    href: "/cocina/inventario/stock",
    label: "Stock y pérdidas",
    desc: "Stock por insumo + registro de pérdidas, mermas, mal estado y vencimientos.",
  },
  {
    href: "/cocina/inventario/auditoria",
    label: "Auditoría de stock",
    desc: "Historial automático de cada cambio de stock: cuándo, cuánto y de dónde vino.",
  },
  {
    href: "/cocina/alertas",
    label: "Alertas de stock",
    desc: "Insumos agotados o por debajo del mínimo de compra.",
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
              Insumos e Inventario
            </h1>
            <p className="mt-3 font-serif italic text-cacao-soft max-w-2xl">
              Tus ingredientes y proveedores + el estado del inventario: stock,
              pérdidas, auditoría y alertas. M3 usa estos datos para costear y
              M5 mueve el inventario con producción, compras y ventas.
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
