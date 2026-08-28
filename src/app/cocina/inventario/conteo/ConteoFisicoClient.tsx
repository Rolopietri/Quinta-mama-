"use client";

// Conteo físico (reconciliación de inventario). Lista todos los insumos activos
// con su stock actual y un campo para el conteo real. Al guardar, fija el stock
// de cada uno al valor contado (RPC ajustar_stock_conteo, registra el ajuste).

import { useEffect, useMemo, useState } from "react";
import type { Insumo, Seccion } from "@/lib/types";
import { SECCIONES, stockLibre } from "@/lib/types";
import { listInsumos } from "@/lib/data/cocina";
import { ajustarStockConteo } from "@/lib/data/stock-movimientos";
import { ErrorBanner } from "@/components/ErrorBanner";

// Formatea una cantidad de stock: entero si aplica, si no hasta 2 decimales.
function fNum(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function parse(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const seccionLabel = (s: Seccion) => SECCIONES.find((x) => x.value === s)?.label ?? s;

export function ConteoFisicoClient() {
  const [items, setItems] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSec, setFilterSec] = useState<Seccion | "todas">("todas");
  const [soloDif, setSoloDif] = useState(false);
  // Conteos escritos por el usuario: insumoId -> texto del input.
  const [conteos, setConteos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ins = await listInsumos();
        if (!cancel) setItems(ins.filter((i) => i.activo));
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Error cargando insumos");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Diferencia (nuevo - actual) para un insumo, o null si no hay conteo válido.
  function delta(ins: Insumo): number | null {
    const n = parse(conteos[ins.id] ?? "");
    if (n === null) return null;
    return n - ins.stockTotal;
  }

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => filterSec === "todas" || i.seccion === filterSec || i.seccion === "ambos")
      .filter((i) => (q ? i.nombre.toLowerCase().includes(q) : true))
      .filter((i) => {
        if (!soloDif) return true;
        const d = delta(i);
        return d !== null && Math.abs(d) > 0.0001;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, filterSec, soloDif, conteos]);

  // Agrupar por sección para contar estante por estante.
  const grupos = useMemo(() => {
    const m = new Map<Seccion, Insumo[]>();
    filtrados.forEach((i) => {
      if (!m.has(i.seccion)) m.set(i.seccion, []);
      m.get(i.seccion)!.push(i);
    });
    return Array.from(m.entries());
  }, [filtrados]);

  // Resumen: cuántos tienen conteo y cuántos difieren del stock actual.
  const resumen = useMemo(() => {
    let conConteo = 0, conDif = 0;
    for (const i of items) {
      const n = parse(conteos[i.id] ?? "");
      if (n === null) continue;
      conConteo++;
      if (Math.abs(n - i.stockTotal) > 0.0001) conDif++;
    }
    return { conConteo, conDif };
  }, [items, conteos]);

  async function guardar() {
    setError(null);
    setResultado(null);
    // Solo los que tienen conteo válido Y difieren del stock actual.
    const cambios = items
      .map((i) => ({ ins: i, nuevo: parse(conteos[i.id] ?? "") }))
      .filter((c): c is { ins: Insumo; nuevo: number } => c.nuevo !== null)
      .filter((c) => Math.abs(c.nuevo - c.ins.stockTotal) > 0.0001);

    if (cambios.length === 0) {
      setResultado("No hay diferencias que guardar.");
      return;
    }
    setGuardando(true);
    let ok = 0;
    const fallidos: string[] = [];
    for (const c of cambios) {
      try {
        const nuevoStock = await ajustarStockConteo(c.ins.id, c.nuevo);
        ok++;
        setItems((prev) => prev.map((x) => (x.id === c.ins.id ? { ...x, stockTotal: nuevoStock } : x)));
        setConteos((prev) => { const n = { ...prev }; delete n[c.ins.id]; return n; });
      } catch {
        fallidos.push(c.ins.nombre);
      }
    }
    setGuardando(false);
    setResultado(
      `${ok} insumo${ok === 1 ? "" : "s"} ajustado${ok === 1 ? "" : "s"} al conteo.` +
        (fallidos.length ? ` No se pudo con: ${fallidos.join(", ")}.` : ""),
    );
  }

  if (loading) {
    return <div className="rounded-2xl bg-white ring-1 ring-marfil p-10 text-center text-cacao-soft">Cargando insumos…</div>;
  }

  const selCls = "rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white";

  return (
    <div className="space-y-4">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Controles + resumen (sticky) */}
      <div className="sticky top-0 z-10 rounded-2xl bg-white/95 backdrop-blur ring-1 ring-marfil p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumo…"
            className="flex-1 min-w-[160px] rounded-lg ring-1 ring-marfil px-3 py-2 text-sm"
          />
          <select value={filterSec} onChange={(e) => setFilterSec(e.target.value as Seccion | "todas")} className={selCls}>
            <option value="todas">Todas las secciones</option>
            {SECCIONES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-cacao-soft cursor-pointer">
            <input type="checkbox" checked={soloDif} onChange={(e) => setSoloDif(e.target.checked)} className="accent-cacao" />
            Solo con diferencia
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-cacao-soft">
            <span className="text-cacao font-medium">{resumen.conConteo}</span> con conteo ·{" "}
            <span className={resumen.conDif > 0 ? "text-terracotta font-medium" : "text-cacao-soft"}>{resumen.conDif}</span> con diferencia
          </p>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || resumen.conDif === 0}
            className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:opacity-40"
          >
            {guardando ? "Guardando…" : `Guardar conteo${resumen.conDif > 0 ? ` (${resumen.conDif})` : ""}`}
          </button>
        </div>
        {resultado && (
          <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] px-3 py-2 text-sm text-[#2F4A1F]">{resultado}</div>
        )}
      </div>

      <p className="text-[11px] text-cacao-mute px-1">
        Escribí lo que tenés físicamente (en la unidad indicada). Deja en blanco lo
        que no cuentes — solo se ajustan los que escribas y difieran del actual.
        El comprometido (reservado por planes) no se toca.
      </p>

      {grupos.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-10 text-center font-serif italic text-cacao-soft">
          {soloDif ? "Ningún insumo con diferencia." : "Sin insumos que coincidan."}
        </div>
      ) : (
        grupos.map(([sec, list]) => (
          <section key={sec} className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
            <header className="px-4 py-2.5 border-b border-marfil bg-marfil-soft/50">
              <span className="font-display text-xs tracking-[0.3em] uppercase text-cacao">{seccionLabel(sec)}</span>
              <span className="text-[11px] text-cacao-mute ml-2">{list.length}</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-cacao-mute uppercase tracking-widest text-[10px] text-left">
                    <th className="py-2 px-3 font-normal">Insumo</th>
                    <th className="py-2 px-3 font-normal text-right">Físico (app)</th>
                    <th className="py-2 px-3 font-normal">Conteo real</th>
                    <th className="py-2 px-3 font-normal text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((ins) => {
                    const d = delta(ins);
                    const libre = stockLibre(ins);
                    return (
                      <tr key={ins.id} className="border-t border-marfil">
                        <td className="py-1.5 px-3 text-cacao">
                          {ins.nombre}
                          {ins.stockComprometido > 0 && (
                            <span className="block text-[10px] text-cacao-mute">
                              libre {fNum(libre)} · reservado {fNum(ins.stockComprometido)}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-cacao-soft whitespace-nowrap">
                          {fNum(ins.stockTotal)} <span className="text-cacao-mute text-xs">{ins.unidadBase}</span>
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              inputMode="decimal"
                              value={conteos[ins.id] ?? ""}
                              onChange={(e) => setConteos((prev) => ({ ...prev, [ins.id]: e.target.value }))}
                              placeholder="—"
                              className="w-24 rounded-lg ring-1 ring-marfil px-2 py-1 text-sm text-right tabular-nums focus:ring-cacao"
                            />
                            <span className="text-cacao-mute text-xs">{ins.unidadBase}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums whitespace-nowrap">
                          {d === null || Math.abs(d) < 0.0001 ? (
                            <span className="text-cacao-mute">—</span>
                          ) : (
                            <span className={d > 0 ? "text-oliva" : "text-terracotta"}>
                              {d > 0 ? "+" : ""}{fNum(d)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
