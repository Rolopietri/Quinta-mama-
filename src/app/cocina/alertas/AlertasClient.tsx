"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Insumo, Proveedor } from "@/lib/types";
import { stockLibre } from "@/lib/types";
import { displayCantidad } from "@/lib/units";
import { listInsumos, listProveedores } from "@/lib/data/cocina";

export function AlertasClient() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ins, prov] = await Promise.all([
          listInsumos(),
          listProveedores(),
        ]);
        if (!cancelled) {
          setInsumos(ins);
          setProveedores(prov);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error cargando");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { agotados, bajos, sinMinimo } = useMemo(() => {
    const ag: Insumo[] = [];
    const bj: Insumo[] = [];
    const sm: Insumo[] = [];
    insumos.forEach((i) => {
      if (!i.activo) return;
      if (i.stockMinimo === null || i.stockMinimo === 0) {
        sm.push(i);
        return;
      }
      // Las alertas trabajan SIEMPRE sobre stockLibre (= total - comprometido).
      // Si el stock total es 10kg pero hay 8kg reservados, en realidad solo
      // tenés 2kg disponibles — ese es el número que se compara contra el mínimo.
      const libre = stockLibre(i);
      if (libre <= 0) ag.push(i);
      else if (libre < i.stockMinimo) bj.push(i);
    });
    return { agotados: ag, bajos: bj, sinMinimo: sm };
  }, [insumos]);

  const provMap = new Map(proveedores.map((p) => [p.id, p]));

  if (loading) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft">
        Cargando...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard label="🔴 Agotados" value={agotados.length} accent="bg-red-50 ring-red-200" />
        <StatCard label="🟡 Bajos" value={bajos.length} accent="bg-amber-50 ring-amber-200" />
        <StatCard label="⚪ Sin mínimo" value={sinMinimo.length} accent="bg-stone-50 ring-stone-200" />
      </section>

      {agotados.length === 0 && bajos.length === 0 ? (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-8 text-center">
          <div className="text-3xl mb-2">🟢</div>
          <h2 className="font-display tracking-widest uppercase text-cacao text-sm">
            Todo en orden
          </h2>
          <p className="mt-2 font-serif italic text-cacao-soft">
            Ningún insumo tiene stock bajo o agotado.
          </p>
        </div>
      ) : (
        <>
          {agotados.length > 0 && (
            <Section
              titulo="🔴 Agotados"
              insumos={agotados}
              provMap={provMap}
              danger
            />
          )}
          {bajos.length > 0 && (
            <Section
              titulo="🟡 Stock bajo"
              insumos={bajos}
              provMap={provMap}
            />
          )}
        </>
      )}

      {sinMinimo.length > 0 && (
        <details className="rounded-2xl bg-white ring-1 ring-marfil p-5">
          <summary className="cursor-pointer font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">
            {sinMinimo.length} insumos sin mínimo configurado
          </summary>
          <p className="text-xs text-cacao-soft italic font-serif mt-2 mb-3">
            Estos no entran en alertas. Ve al insumo y define el "Stock mínimo"
            para activarlas.
          </p>
          <ul className="text-sm text-cacao-soft space-y-1">
            {sinMinimo.map((i) => (
              <li key={i.id}>
                <Link
                  href="/cocina/insumos"
                  className="hover:underline"
                >
                  {i.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Link
          href="/cocina/pedido"
          className="rounded-xl bg-cacao text-white px-5 py-2.5 font-medium hover:bg-terracotta transition-colors text-sm"
        >
          + Generar pedido sugerido
        </Link>
        <Link
          href="/cocina/compras"
          className="rounded-xl ring-1 ring-cacao px-5 py-2.5 text-cacao hover:bg-marfil-soft text-sm"
        >
          Registrar compra
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${accent}`}>
      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">
        {label}
      </div>
      <div className="text-3xl font-cinzel text-cacao mt-1">{value}</div>
    </div>
  );
}

function Section({
  titulo,
  insumos,
  provMap,
  danger,
}: {
  titulo: string;
  insumos: Insumo[];
  provMap: Map<string, Proveedor>;
  danger?: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
      <h2
        className={`font-display text-xs tracking-[0.3em] uppercase p-5 border-b border-marfil ${
          danger ? "text-terracotta" : "text-cacao-mute"
        }`}
      >
        {titulo}
      </h2>
      <ul className="divide-y divide-marfil">
        {insumos.map((i) => {
          const prov = i.proveedorId ? provMap.get(i.proveedorId) : null;
          return (
            <li key={i.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-cacao">{i.nombre}</div>
                <div className="text-xs text-cacao-soft mt-0.5">
                  {prov ? `Proveedor: ${prov.nombre}` : "Sin proveedor"}
                  {prov?.contactoTelefono && ` · ${prov.contactoTelefono}`}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${danger ? "text-terracotta" : "text-cacao"}`}>
                  {displayCantidad(stockLibre(i), i.unidadBase)}
                  <span className="text-[10px] text-cacao-mute ml-1">libre</span>
                </div>
                {i.stockComprometido > 0 && (
                  <div className="text-[10px] text-cacao-mute">
                    {displayCantidad(i.stockTotal, i.unidadBase)} total ·{" "}
                    {displayCantidad(i.stockComprometido, i.unidadBase)} comp.
                  </div>
                )}
                <div className="text-xs text-cacao-mute">
                  mínimo:{" "}
                  {i.stockMinimo != null
                    ? displayCantidad(i.stockMinimo, i.unidadBase)
                    : "—"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
