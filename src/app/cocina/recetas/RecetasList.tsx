"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CATEGORIAS_RECETA,
  SECCIONES,
  precioConIva,
  type Receta,
  type Insumo,
  type Seccion,
  type CategoriaReceta,
} from "@/lib/types";
import { listRecetas, calcularCostoReceta } from "@/lib/data/recetas";
import { listInsumos } from "@/lib/data/cocina";
import { getCocinaConfig } from "@/lib/data/cocinaConfig";

export function RecetasList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get("highlight");

  const [items, setItems] = useState<Receta[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  /** % de IVA configurado (default 16). Lo usamos para mostrar el precio
   *  con IVA al lado del precio sin IVA. */
  const [ivaPorc, setIvaPorc] = useState(16);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterSec, setFilterSec] = useState<Seccion | "todas">("todas");
  /** "subreceta" es una categoría virtual — no es CategoriaReceta del enum,
   *  pero filtra las recetas con esSubreceta=true. */
  const [filterCat, setFilterCat] = useState<CategoriaReceta | "todas" | "subreceta">(
    "todas",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rec, ins, cfg] = await Promise.all([
          listRecetas(),
          listInsumos(),
          getCocinaConfig(),
        ]);
        if (!cancelled) {
          setItems(rec);
          setInsumos(ins);
          setIvaPorc(cfg.ivaPorc);
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

  /**
   * Después de crear una receta (o cuando alguien comparte el link con
   * ?highlight=...), hacemos scroll suave a esa card y un highlight visual
   * por 2 segundos. Después limpiamos el query param para que no quede en
   * la URL si recargás.
   */
  useEffect(() => {
    if (!highlightId || loading || items.length === 0) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-receta-id="${highlightId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-terracotta");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-terracotta");
        }, 2000);
      }
      // Limpiar el query param para que la URL quede limpia
      router.replace("/cocina/recetas", { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length, highlightId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((r) => {
      if (
        filterSec !== "todas" &&
        r.seccion !== filterSec &&
        r.seccion !== "ambos"
      )
        return false;
      if (filterCat === "subreceta") {
        if (!r.esSubreceta) return false;
      } else if (filterCat !== "todas") {
        // Para categorías normales, excluir subrecetas (tienen su propia "categoría")
        if (r.esSubreceta) return false;
        if (r.categoria !== filterCat) return false;
      }
      if (qq) {
        const txt = `${r.nombre} ${r.perfil ?? ""} ${r.ingredientes.map((i) => i.nombre).join(" ")}`.toLowerCase();
        if (!txt.includes(qq)) return false;
      }
      return true;
    });
  }, [items, q, filterSec, filterCat]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft">
        Cargando recetas...
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
    <div>
      <div className="space-y-3 mb-5">
        <input
          type="text"
          placeholder="Buscar receta o ingrediente..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg ring-1 ring-marfil px-3 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterSec("todas")}
            className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
              filterSec === "todas"
                ? "bg-cacao text-white ring-cacao"
                : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
            }`}
          >
            Todas las secciones
          </button>
          {SECCIONES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterSec(s.value)}
              className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
                filterSec === s.value
                  ? "bg-cacao text-white ring-cacao"
                  : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat("todas")}
            className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
              filterCat === "todas"
                ? "bg-cacao text-white ring-cacao"
                : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
            }`}
          >
            Todas
          </button>
          {CATEGORIAS_RECETA.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCat(c.value)}
              className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
                filterCat === c.value
                  ? "bg-cacao text-white ring-cacao"
                  : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            onClick={() => setFilterCat("subreceta")}
            className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
              filterCat === "subreceta"
                ? "bg-cacao text-white ring-cacao"
                : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
            }`}
          >
            Sub-recetas
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center">
          <p className="font-serif italic text-cacao-soft mb-4">
            {items.length === 0
              ? "Aún no hay recetas. Crea la primera."
              : "Sin resultados en esta búsqueda."}
          </p>
          {items.length === 0 && (
            <Link
              href="/cocina/recetas/nuevo"
              className="inline-block rounded-xl bg-cacao text-white px-5 py-2.5 font-medium hover:bg-terracotta transition-colors"
            >
              + Nueva receta
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r) => {
            const { total, porPorcion } = calcularCostoReceta(r, insumos, items);
            const margen =
              r.precioSugeridoUsd && r.precioSugeridoUsd > 0 && porPorcion > 0
                ? ((r.precioSugeridoUsd - porPorcion) / r.precioSugeridoUsd) *
                  100
                : null;
            return (
              <Link
                key={r.id}
                data-receta-id={r.id}
                href={`/cocina/recetas/${r.id}`}
                className={`block rounded-2xl ring-1 p-5 transition-all ${
                  r.esSubreceta
                    ? "bg-marfil-light ring-marfil hover:bg-marfil"
                    : "bg-white ring-marfil hover:bg-marfil-soft"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-display text-[10px] tracking-[0.3em] uppercase text-cacao-mute">
                    {r.esSubreceta
                      ? "Sub-receta"
                      : `${r.categoria ?? "receta"} · ${r.seccion}`}
                  </div>
                  <div className="text-xs text-cacao-soft">
                    {r.esSubreceta && r.rendimiento
                      ? `rinde ${r.rendimiento} ${r.rendimientoUnidad ?? ""}`
                      : `${r.porciones} porc.`}
                  </div>
                </div>
                <h2 className="mt-2 font-cinzel text-lg text-cacao">
                  {r.nombre}
                </h2>
                {r.perfil && (
                  <p className="mt-1 font-serif italic text-sm text-cacao-soft">
                    {r.perfil}
                  </p>
                )}
                <div className="mt-3 text-xs text-cacao-mute">
                  {r.ingredientes.length} ingrediente
                  {r.ingredientes.length !== 1 && "s"}
                </div>
                <div className="mt-3 border-t border-marfil pt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-cacao-mute uppercase tracking-widest">
                      Costo
                    </div>
                    <div className="text-cacao font-medium">
                      ${porPorcion.toFixed(2)}
                      <span className="text-cacao-mute"> /porc.</span>
                    </div>
                    {r.porciones > 1 && (
                      <div className="text-cacao-mute">
                        ${total.toFixed(2)} total
                      </div>
                    )}
                  </div>
                  <div>
                    {r.precioSugeridoUsd ? (
                      <>
                        <div className="text-cacao-mute uppercase tracking-widest">
                          P. sugerido
                        </div>
                        <div className="text-cacao font-medium">
                          ${r.precioSugeridoUsd.toFixed(2)}
                          <span className="text-[10px] text-cacao-mute ml-1">
                            s/IVA
                          </span>
                        </div>
                        <div className="text-[10px] text-cacao-soft">
                          ${precioConIva(r.precioSugeridoUsd, ivaPorc).toFixed(2)}{" "}
                          c/IVA
                        </div>
                        {margen !== null && (
                          <div
                            className={`text-[10px] mt-0.5 ${margen > 70 ? "text-[#15803D]" : margen > 50 ? "text-[#A16207]" : "text-terracotta"}`}
                          >
                            margen {margen.toFixed(0)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-cacao-mute text-[10px]">
                        Sin precio definido
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
