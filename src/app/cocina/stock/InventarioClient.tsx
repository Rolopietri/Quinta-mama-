"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SECCIONES,
  TIPOS_PERDIDA,
  MOTIVOS_MERMA_PRODUCCION,
  tipoMovimientoLabel,
  categoriaInsumoLabel,
  stockLibre,
  type Insumo,
  type Seccion,
  type StockMovimiento,
  type TipoMovimientoStock,
  type Receta,
  type Venta,
} from "@/lib/types";
import { pillClass } from "@/lib/ui";
import { listInsumos } from "@/lib/data/cocina";
import { listRecetas, calcularCostoReceta } from "@/lib/data/recetas";
import {
  listMovimientos,
  registrarPerdida,
  deleteMovimiento,
} from "@/lib/data/stock-movimientos";
import { registrarMerma, listMermas, deleteVenta } from "@/lib/data/ventas";
import {
  listPlanesProduccion,
  recalcularStockComprometido,
} from "@/lib/data/planes-produccion";
import type { PlanProduccion } from "@/lib/types";
import { normalizarBusqueda } from "@/lib/text";
import { extractError } from "@/lib/data/error";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { displayCantidad } from "@/lib/units";

type TipoPerdida = (typeof TIPOS_PERDIDA)[number]["value"];

/**
 * Entry consolidada del historial. Dos tipos:
 *   - "manual": un único movimiento (pérdida, merma, ajuste manual). Se
 *               muestra individualmente como antes.
 *   - "plan": un evento de plan de producción (comprometido/realizado/
 *             cancelado) que colapsa los N movimientos por ingrediente
 *             en UNA sola línea para que el historial no se llene.
 */
type HistorialEntry =
  | {
      kind: "manual";
      id: string;
      fecha: string;
      mov: StockMovimiento;
    }
  | {
      kind: "plan";
      id: string;
      /** Fecha de la actividad más reciente del plan (para ordenar). */
      fecha: string;
      plan: PlanProduccion;
    }
  | {
      kind: "merma";
      id: string;
      fecha: string;
      merma: Venta;
    };

export function InventarioClient() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movs, setMovs] = useState<StockMovimiento[]>([]);
  const [planes, setPlanes] = useState<PlanProduccion[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [mermas, setMermas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filterSec, setFilterSec] = useState<Seccion | "todas">("todas");
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [search, setSearch] = useState("");

  /** Insumo expandido — al hacer click en la fila se muestra su historial
   *  individual de pérdidas/mermas debajo. */
  const [expandedInsumoId, setExpandedInsumoId] = useState<string | null>(null);

  // Modal de pérdida
  const [perdidaInsumo, setPerdidaInsumo] = useState<Insumo | null>(null);
  const [perdidaCant, setPerdidaCant] = useState("");
  const [perdidaTipo, setPerdidaTipo] = useState<TipoPerdida>("perdida");
  const [perdidaFecha, setPerdidaFecha] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [perdidaMotivo, setPerdidaMotivo] = useState("");
  const [perdidaNota, setPerdidaNota] = useState("");
  /** "Pesé el producto ya cocido": la cantidad ingresada es peso cocido y se
   *  convierte a crudo con el % de merma antes de descontar del stock. */
  const [perdidaCocido, setPerdidaCocido] = useState(false);
  const [perdidaMermaPct, setPerdidaMermaPct] = useState("");
  const [registrando, setRegistrando] = useState(false);

  // Confirmación de borrado de movimiento del historial
  const [pendienteBorrar, setPendienteBorrar] = useState<string | null>(null);
  /** Al borrar una pérdida: si se devuelve la cantidad al stock (default sí). */
  const [devolverStock, setDevolverStock] = useState(true);

  // Modal de merma de producción (pérdida de algo pre-producido, por receta)
  const [mermaOpen, setMermaOpen] = useState(false);
  const [mermaRecetaId, setMermaRecetaId] = useState("");
  const [mermaRaciones, setMermaRaciones] = useState("1");
  // Unidad de la merma: por raciones (default) o por gramos (según el
  // rendimiento de la receta). El backend siempre guarda en raciones.
  const [mermaUnidad, setMermaUnidad] = useState<"raciones" | "gramos">(
    "raciones",
  );
  const [mermaGramos, setMermaGramos] = useState("");
  const [mermaMotivo, setMermaMotivo] = useState<string>(
    MOTIVOS_MERMA_PRODUCCION[0],
  );
  const [mermaFecha, setMermaFecha] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [mermaNota, setMermaNota] = useState("");
  const [mermaProcesando, setMermaProcesando] = useState(false);
  const [pendienteBorrarMerma, setPendienteBorrarMerma] = useState<
    string | null
  >(null);

  // Carga inicial: sincroniza el stock_comprometido a partir de los planes
  // activos (silencioso) ANTES de leer los insumos, así la columna siempre
  // refleja el estado real sin que el usuario tenga que tocar botones.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Sincronizar stock_comprometido desde planes — silencioso.
        // Si falla (función pendiente o RLS), no rompemos la carga.
        try {
          await recalcularStockComprometido();
        } catch {
          // No crítico — el resto de la página igual funciona.
        }
        // 2. Leer datos frescos
        const ins = await listInsumos();
        if (cancelled) return;
        setInsumos(ins);
        try {
          const m = await listMovimientos({ limit: 200 });
          if (!cancelled) setMovs(m);
        } catch {
          // Si la tabla aún no existe (SQL pendiente), seguimos sin historial.
        }
        try {
          const p = await listPlanesProduccion();
          if (!cancelled) setPlanes(p);
        } catch {
          // Tabla de planes pendiente — el historial sólo muestra movimientos manuales.
        }
        try {
          const rec = await listRecetas();
          if (!cancelled) setRecetas(rec);
        } catch {
          // Sin recetas no se puede registrar merma de producción, pero el resto va.
        }
        try {
          const me = await listMermas();
          if (!cancelled) setMermas(me);
        } catch {
          // Columna es_merma pendiente (SQL) — seguimos sin mermas.
        }
      } catch (e) {
        if (!cancelled) setError(extractError(e, "Error cargando"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-lee stock/planes/mermas tras registrar o borrar una merma (que cambia
   *  el stock y el comprometido por los triggers del servidor). */
  async function refrescarTrasMerma() {
    try {
      await recalcularStockComprometido();
    } catch {
      // no crítico
    }
    const [ins, p, me] = await Promise.all([
      listInsumos(),
      listPlanesProduccion(),
      listMermas(),
    ]);
    setInsumos(ins);
    setPlanes(p);
    setMermas(me);
  }

  // Recetas seleccionables para merma (todas las activas).
  const recetasMermaOpciones = useMemo(
    () => recetas.filter((r) => r.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [recetas],
  );

  // Resumen de producción por receta: raciones sin vender (disponibles) según
  // los planes activos. Es el "stock de productos terminados/pre-producidos".
  const produccionPorReceta = useMemo(() => {
    const map = new Map<
      string,
      { recetaId: string; recetaNombre: string; sinVender: number }
    >();
    for (const p of planes) {
      if (p.estado !== "pendiente" && p.estado !== "completado") continue;
      const sv = Math.max(0, p.raciones - p.racionesConsumidas);
      if (sv <= 0) continue;
      const cur = map.get(p.recetaId) ?? {
        recetaId: p.recetaId,
        recetaNombre: p.recetaNombre,
        sinVender: 0,
      };
      cur.sinVender += sv;
      map.set(p.recetaId, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.recetaNombre.localeCompare(b.recetaNombre),
    );
  }, [planes]);

  // Receta seleccionada en el modal de merma y su gramaje por ración.
  // gramosPorRacion = rendimiento total ÷ porciones (solo si la receta
  // tiene rendimiento definido). Sirve para convertir gramos → raciones.
  const mermaReceta = useMemo(
    () => recetas.find((r) => r.id === mermaRecetaId) ?? null,
    [recetas, mermaRecetaId],
  );
  const gramosPorRacion =
    mermaReceta &&
    typeof mermaReceta.rendimiento === "number" &&
    mermaReceta.rendimiento > 0 &&
    mermaReceta.porciones > 0
      ? mermaReceta.rendimiento / mermaReceta.porciones
      : null;
  const rendUnidad = mermaReceta?.rendimientoUnidad || "g";

  // Raciones que quedan reservadas en planes de producción activos de la
  // receta elegida — para poder mermar "lo que quedó" sin ir a buscarlo.
  const racionesEnPlanes = useMemo(() => {
    if (!mermaRecetaId) return null;
    const activos = planes.filter(
      (p) =>
        p.recetaId === mermaRecetaId &&
        (p.estado === "pendiente" || p.estado === "completado") &&
        p.racionesConsumidas < p.raciones,
    );
    const total = activos.reduce(
      (acc, p) => acc + (p.raciones - p.racionesConsumidas),
      0,
    );
    return { total, planes: activos.length };
  }, [mermaRecetaId, planes]);

  // Raciones efectivas a registrar, según la unidad elegida. NaN si es inválido.
  const mermaRacionesCalc = useMemo(() => {
    if (mermaUnidad === "gramos") {
      if (!gramosPorRacion) return NaN;
      const g = Number(mermaGramos);
      if (!Number.isFinite(g) || g <= 0) return NaN;
      return g / gramosPorRacion;
    }
    const r = Number(mermaRaciones);
    return Number.isFinite(r) && r > 0 ? r : NaN;
  }, [mermaUnidad, mermaGramos, mermaRaciones, gramosPorRacion]);

  function openMerma() {
    setMermaRecetaId("");
    setMermaRaciones("1");
    setMermaUnidad("raciones");
    setMermaGramos("");
    setMermaMotivo(MOTIVOS_MERMA_PRODUCCION[0]);
    setMermaFecha(new Date().toISOString().slice(0, 10));
    setMermaNota("");
    setMermaOpen(true);
  }

  async function handleMermaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rec = recetas.find((r) => r.id === mermaRecetaId);
    const raciones = mermaRacionesCalc;
    if (!rec) {
      setError("Elegí una receta.");
      return;
    }
    if (!Number.isFinite(raciones) || raciones <= 0) {
      setError(
        mermaUnidad === "gramos"
          ? "Ingresá un gramaje válido (la receta debe tener rendimiento definido)."
          : "Ingresá una cantidad de raciones válida.",
      );
      return;
    }
    setMermaProcesando(true);
    setError(null);
    try {
      await registrarMerma({
        recetaId: rec.id,
        recetaNombre: rec.nombre,
        raciones,
        motivo: mermaMotivo,
        fecha: mermaFecha,
        nota: mermaNota || undefined,
      });
      await refrescarTrasMerma();
      const detalle =
        mermaUnidad === "gramos"
          ? `${Number(mermaGramos)} ${rendUnidad} (≈ ${raciones.toFixed(2)} raciones)`
          : `${raciones} ración${raciones === 1 ? "" : "es"}`;
      setInfo(`Merma registrada: ${detalle} de ${rec.nombre}.`);
      setMermaOpen(false);
    } catch (err) {
      setError(extractError(err, "Error registrando merma"));
    } finally {
      setMermaProcesando(false);
    }
  }

  async function ejecutarBorrarMerma() {
    if (!pendienteBorrarMerma) return;
    setError(null);
    try {
      await deleteVenta(pendienteBorrarMerma);
      await refrescarTrasMerma();
      setInfo("Merma eliminada. Stock y compromiso restaurados.");
    } catch (err) {
      setError(extractError(err, "Error eliminando merma"));
    } finally {
      setPendienteBorrarMerma(null);
    }
  }

  // Conversión cocido → crudo para la vista previa del modal de pérdida.
  const conversionCocido = useMemo(() => {
    if (!perdidaCocido) return null;
    const cant = Number(perdidaCant);
    const pct = Number(perdidaMermaPct);
    if (!Number.isFinite(cant) || cant <= 0) return { error: true as const };
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100)
      return { error: true as const };
    return { error: false as const, crudo: cant / (1 - pct / 100) };
  }, [perdidaCocido, perdidaCant, perdidaMermaPct]);

  // Costo estimado de la merma en edición (para mostrar en el modal)
  const mermaCostoPreview = useMemo(() => {
    const rec = recetas.find((r) => r.id === mermaRecetaId);
    const raciones = mermaRacionesCalc;
    if (!rec || !Number.isFinite(raciones) || raciones <= 0) return null;
    const { porPorcion } = calcularCostoReceta(rec, insumos, recetas);
    return porPorcion * raciones;
  }, [mermaRecetaId, mermaRacionesCalc, recetas, insumos]);

  // Banner auto-cerrable
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(null), 4000);
    return () => clearTimeout(t);
  }, [info]);

  function openPerdida(ins: Insumo) {
    setPerdidaInsumo(ins);
    setPerdidaCant("");
    setPerdidaTipo("perdida");
    setPerdidaFecha(new Date().toISOString().slice(0, 10));
    setPerdidaMotivo("");
    setPerdidaNota("");
    // Si el insumo tiene merma por cocción configurada, arrancamos el modo
    // "pesé cocido" apagado pero con el % ya cargado para cuando lo active.
    setPerdidaCocido(false);
    setPerdidaMermaPct(
      ins.mermaCoccionPorc != null ? String(ins.mermaCoccionPorc) : "",
    );
  }
  function closePerdida() {
    setPerdidaInsumo(null);
  }

  async function handleRegistrarPerdida(e: React.FormEvent) {
    e.preventDefault();
    if (!perdidaInsumo) return;
    const cant = Number(perdidaCant);
    if (!Number.isFinite(cant) || cant <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }

    // Cantidad a descontar del stock (siempre en crudo). Si se pesó cocido,
    // convertimos: crudo = cocido / (1 - pct/100).
    let cantidadCruda = cant;
    let notaFinal = perdidaNota || undefined;
    if (perdidaCocido) {
      const pct = Number(perdidaMermaPct);
      if (!Number.isFinite(pct) || pct < 0 || pct >= 100) {
        setError("La merma por cocción debe estar entre 0 y 99%.");
        return;
      }
      cantidadCruda = cant / (1 - pct / 100);
      const nota = `Pesado cocido: ${cant} ${perdidaInsumo.unidadBase} · merma ${pct}% → ${cantidadCruda.toFixed(4)} ${perdidaInsumo.unidadBase} crudo`;
      notaFinal = perdidaNota ? `${perdidaNota} — ${nota}` : nota;
    }

    setRegistrando(true);
    setError(null);
    try {
      const res = await registrarPerdida({
        insumoId: perdidaInsumo.id,
        cantidad: cantidadCruda,
        tipo: perdidaTipo,
        motivo: perdidaMotivo || undefined,
        fecha: perdidaFecha,
        nota: notaFinal,
      });
      // Actualizar stock localmente — pérdida descuenta del stockTotal
      setInsumos((prev) =>
        prev.map((i) =>
          i.id === perdidaInsumo.id ? { ...i, stockTotal: res.stockTotal } : i,
        ),
      );
      setMovs((prev) => [res.movimiento, ...prev]);
      setInfo(
        perdidaCocido
          ? `Pérdida registrada: ${displayCantidad(cantidadCruda, perdidaInsumo.unidadBase)} crudo de ${perdidaInsumo.nombre} (pesado cocido).`
          : `Pérdida registrada: ${cant} ${perdidaInsumo.unidadBase} de ${perdidaInsumo.nombre}.`,
      );
      closePerdida();
    } catch (e) {
      setError(extractError(e, "Error registrando pérdida"));
    } finally {
      setRegistrando(false);
    }
  }

  async function handleDeleteMov(id: string, devolver: boolean) {
    const mov = movs.find((m) => m.id === id);
    try {
      const res = await deleteMovimiento(id, { devolverStock: devolver });
      setMovs((prev) => prev.filter((m) => m.id !== id));
      if (devolver && res.stockTotal !== undefined && mov) {
        setInsumos((prev) =>
          prev.map((i) =>
            i.id === mov.insumoId ? { ...i, stockTotal: res.stockTotal! } : i,
          ),
        );
        setInfo("Movimiento eliminado y stock devuelto.");
      } else {
        setInfo("Movimiento eliminado del historial.");
      }
    } catch (e) {
      setError(extractError(e, "Error eliminando"));
    }
  }

  const insumosFiltrados = useMemo(() => {
    const q = normalizarBusqueda(search.trim());
    return insumos
      .filter((i) => i.activo)
      .filter((i) => filterSec === "todas" || i.seccion === filterSec || i.seccion === "ambos")
      .filter((i) => filterCat === "todas" || i.categoria === filterCat)
      .filter((i) => (q ? normalizarBusqueda(i.nombre).includes(q) : true))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, filterSec, filterCat, search]);

  // Categorías existentes en el catálogo (para los pills de filtro).
  const categoriasReales = useMemo(() => {
    const set = new Set<string>();
    insumos.forEach((i) => i.categoria && set.add(i.categoria));
    return Array.from(set).sort((a, b) =>
      categoriaInsumoLabel(a).localeCompare(categoriaInsumoLabel(b)),
    );
  }, [insumos]);

  // Map insumoId → nombre para historial
  const insumoMap = useMemo(
    () => new Map(insumos.map((i) => [i.id, i] as const)),
    [insumos],
  );

  /**
   * Map insumoId → array de movimientos manuales (pérdida, merma, mal_estado,
   * vencimiento, otro, ajuste) ordenados por fecha desc. Sirve para mostrar
   * el historial individual al expandir cada fila.
   */
  const movsManualesPorInsumo = useMemo(() => {
    const TIPOS_MANUALES: TipoMovimientoStock[] = [
      "perdida",
      "mal_estado",
      "merma",
      "vencimiento",
      "otro",
      "ajuste",
    ];
    const map = new Map<string, StockMovimiento[]>();
    movs
      .filter((m) => TIPOS_MANUALES.includes(m.tipo))
      .forEach((m) => {
        if (!map.has(m.insumoId)) map.set(m.insumoId, []);
        map.get(m.insumoId)!.push(m);
      });
    // Ordenar cada lista por fecha desc
    map.forEach((list) => list.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    return map;
  }, [movs]);

  /**
   * Historial consolidado:
   *  - Movimientos manuales (pérdida, merma, mal estado, vencimiento, ajuste,
   *    otro) → cada uno como una línea individual.
   *  - Planes de producción → UNA línea por estado del plan (aprobado /
   *    realizado / cancelado) — no se muestran los movimientos por ingrediente
   *    porque saturan el historial.
   *
   * Los movimientos plan_completado, comprometido_in y comprometido_out se
   * filtran porque ya están representados por las líneas de plan.
   */
  const historial = useMemo<HistorialEntry[]>(() => {
    const TIPOS_DE_PLAN: TipoMovimientoStock[] = [
      "comprometido_in",
      "comprometido_out",
      "plan_completado",
    ];
    // 1. Movimientos manuales (NO relacionados a planes)
    const manuales: HistorialEntry[] = movs
      .filter((m) => !TIPOS_DE_PLAN.includes(m.tipo))
      .map((m) => ({
        kind: "manual" as const,
        id: m.id,
        fecha: m.fecha,
        mov: m,
      }));

    // 2. Eventos de plan — UNA sola línea por plan. En esa línea se muestran sus
    // hitos con fecha (Aprobado y, si aplica, Realizado / Cancelado). El estado
    // "vendido" no se muestra como evento aparte: lo maneja Xetux al importar.
    // La fecha de orden es la del hito más reciente.
    const planEvents: HistorialEntry[] = planes.map((p) => {
      const fechaRaw = p.canceladoAt ?? p.completadoAt ?? p.createdAt;
      return {
        kind: "plan" as const,
        id: p.id,
        fecha: fechaRaw.slice(0, 10),
        plan: p,
      };
    });

    // 3. Mermas de producción (pérdidas de algo pre-producido, por receta)
    const mermaEntries: HistorialEntry[] = mermas.map((m) => ({
      kind: "merma" as const,
      id: m.id,
      fecha: m.fecha,
      merma: m,
    }));

    // 4. Mergear y ordenar por fecha desc
    return [...manuales, ...planEvents, ...mermaEntries]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 100);
  }, [movs, planes, mermas]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft">
        Cargando inventario...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">
          {info}
        </div>
      )}

      {/* ── Bloque plegable: INSUMOS ── */}
      <details
        open
        className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden"
      >
        <summary className="px-4 py-3 cursor-pointer select-none flex items-center justify-between gap-2 hover:bg-marfil-soft">
          <span className="font-display text-xs tracking-[0.3em] uppercase text-cacao">
            Insumos
          </span>
          <span className="text-[10px] uppercase tracking-widest text-cacao-mute">
            {insumosFiltrados.length} en vista
          </span>
        </summary>
        <div className="p-4 border-t border-marfil space-y-3">

      {/* Filtros */}
      <section className="space-y-2">
        <input
          type="text"
          placeholder="Buscar insumo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg ring-1 ring-marfil px-3 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterSec("todas")}
            className={pillClass(filterSec === "todas")}
          >
            Todas las secciones
          </button>
          {SECCIONES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterSec(s.value)}
              className={pillClass(filterSec === s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat("todas")}
            className={pillClass(filterCat === "todas")}
          >
            Todas las categorías
          </button>
          {categoriasReales.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={pillClass(filterCat === c)}
            >
              {categoriaInsumoLabel(c)}
            </button>
          ))}
        </div>
      </section>

      {/* Lista de insumos con stock */}
      <section className="rounded-lg ring-1 ring-marfil overflow-hidden">
        {insumosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-cacao-soft italic font-serif">
            Sin insumos para mostrar con estos filtros.
          </div>
        ) : (
          <ul className="divide-y divide-marfil">
            {insumosFiltrados.map((i) => {
              const libre = stockLibre(i);
              const lowStock =
                i.stockMinimo !== null &&
                i.stockMinimo !== undefined &&
                i.stockMinimo > 0 &&
                libre < i.stockMinimo;
              const perdidas = movsManualesPorInsumo.get(i.id) ?? [];
              const isExpanded = expandedInsumoId === i.id;
              return (
                <li key={i.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedInsumoId(isExpanded ? null : i.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedInsumoId(isExpanded ? null : i.id);
                      }
                    }}
                    className="p-4 grid grid-cols-12 gap-3 items-center hover:bg-marfil-soft cursor-pointer transition-colors"
                  >
                    <div className="col-span-12 sm:col-span-4 min-w-0">
                      <div className="font-medium text-cacao flex items-center gap-2">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden
                          className={`size-3 text-cacao-mute transition-transform shrink-0 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {i.nombre}
                      </div>
                      <div className="text-xs text-cacao-mute mt-0.5 capitalize ml-5">
                        {categoriaInsumoLabel(i.categoria)}{" "}
                        · {i.seccion}
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">
                        Total
                      </div>
                      <div className="text-sm text-cacao">
                        {displayCantidad(i.stockTotal, i.unidadBase)}
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">
                        Comprometido
                      </div>
                      <div className="text-sm text-cacao-soft">
                        {displayCantidad(i.stockComprometido, i.unidadBase)}
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">
                        Libre
                      </div>
                      <div
                        className={`text-sm font-medium ${
                          lowStock ? "text-terracotta" : "text-cacao"
                        }`}
                      >
                        {displayCantidad(libre, i.unidadBase)}
                        {lowStock && (
                          <span className="ml-1 text-[10px] uppercase tracking-widest">
                            · bajo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPerdida(i);
                        }}
                        className="text-[10px] uppercase tracking-widest rounded-full ring-1 ring-marfil px-3 py-1.5 text-cacao-soft hover:bg-marfil-soft hover:text-cacao bg-white"
                      >
                        Registrar pérdida
                      </button>
                    </div>
                  </div>

                  {/* Expansión: historial de pérdidas/mermas del insumo */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-9 bg-marfil-soft/40 border-t border-marfil">
                      <div className="font-display text-[10px] tracking-[0.3em] uppercase text-cacao-mute mt-3 mb-2">
                        Historial de pérdidas
                      </div>
                      {perdidas.length === 0 ? (
                        <p className="text-xs text-cacao-soft italic font-serif py-2">
                          Sin pérdidas registradas para este insumo todavía.
                        </p>
                      ) : (
                        <ul className="divide-y divide-marfil">
                          {perdidas.map((m) => {
                            const fecha = new Date(
                              m.fecha + "T00:00",
                            ).toLocaleDateString("es-VE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            });
                            return (
                              <li
                                key={m.id}
                                className="py-2 grid grid-cols-12 gap-2 items-start text-sm"
                              >
                                <div className="col-span-3 sm:col-span-2 text-xs text-cacao">
                                  {fecha}
                                </div>
                                <div className="col-span-6 sm:col-span-7 min-w-0">
                                  <div className="text-[10px] uppercase tracking-widest text-cacao-mute">
                                    {tipoMovimientoLabel(m.tipo)}
                                  </div>
                                  {m.motivo && (
                                    <div className="text-xs text-cacao-soft mt-0.5">
                                      {m.motivo}
                                    </div>
                                  )}
                                  {m.nota && (
                                    <div className="text-xs text-cacao-soft italic font-serif mt-0.5">
                                      {m.nota}
                                    </div>
                                  )}
                                </div>
                                <div className="col-span-3 sm:col-span-3 text-right text-sm text-terracotta">
                                  {displayCantidad(m.cantidad, i.unidadBase)}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
        </div>
      </details>

      {/* ── Bloque plegable: RECETAS (producción) ── */}
      <details className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer select-none flex items-center justify-between gap-2 hover:bg-marfil-soft">
          <span className="font-display text-xs tracking-[0.3em] uppercase text-cacao">
            Recetas (producción)
          </span>
          <span className="text-[10px] uppercase tracking-widest text-cacao-mute">
            {produccionPorReceta.length} con producción
          </span>
        </summary>
        <div className="p-4 border-t border-marfil space-y-3">
          <button
            type="button"
            onClick={openMerma}
            className="w-full rounded-xl ring-1 ring-marfil py-2.5 text-sm text-cacao-soft hover:bg-marfil-soft hover:text-cacao transition-colors"
          >
            ⚠ Registrar merma de producción (por receta)
          </button>
          {produccionPorReceta.length === 0 ? (
            <p className="text-xs text-cacao-soft italic font-serif py-1">
              No hay recetas con producción activa. Creá planes en Inventario →
              Planes.
            </p>
          ) : (
            <ul className="divide-y divide-marfil rounded-lg ring-1 ring-marfil overflow-hidden">
              {produccionPorReceta.map((r) => (
                <li
                  key={r.recetaId}
                  className="px-3 py-2 flex justify-between items-center text-sm"
                >
                  <span className="text-cacao">{r.recetaNombre}</span>
                  <span className="text-cacao-soft text-xs">
                    {r.sinVender} ración{r.sinVender === 1 ? "" : "es"} sin vender
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {/* ── Bloque plegable: HISTORIAL ── */}
      <details className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        <summary className="p-4 border-b border-marfil cursor-pointer select-none">
          <span className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">
            Historial de movimientos
          </span>
          <p className="text-xs text-cacao-soft italic font-serif mt-1">
            Pérdidas y mermas individuales · cada plan de producción en una sola
            línea con sus fechas de aprobación y realización.
          </p>
        </summary>
        {historial.length === 0 ? (
          <div className="p-8 text-center text-cacao-soft italic font-serif">
            Sin movimientos registrados todavía.
          </div>
        ) : (
          <ul className="divide-y divide-marfil">
            {historial.map((h) => {
              const fecha = new Date(h.fecha + "T00:00").toLocaleDateString(
                "es-VE",
                { day: "numeric", month: "short", year: "numeric" },
              );
              if (h.kind === "manual") {
                const ins = insumoMap.get(h.mov.insumoId);
                return (
                  <li
                    key={h.id}
                    className="p-4 grid grid-cols-12 gap-3 items-start"
                  >
                    <div className="col-span-3 sm:col-span-2 text-xs">
                      <div className="text-cacao">{fecha}</div>
                    </div>
                    <div className="col-span-9 sm:col-span-7 min-w-0">
                      <div className="font-medium text-cacao text-sm">
                        {ins?.nombre ?? "(Insumo eliminado)"}
                      </div>
                      <div className="text-xs text-cacao-soft mt-0.5">
                        <span className="uppercase tracking-widest text-[10px]">
                          {tipoMovimientoLabel(h.mov.tipo)}
                        </span>
                        {h.mov.motivo && <span> · {h.mov.motivo}</span>}
                      </div>
                      {h.mov.nota && (
                        <div className="text-xs text-cacao-soft italic font-serif mt-1">
                          {h.mov.nota}
                        </div>
                      )}
                    </div>
                    <div className="col-span-9 sm:col-span-2 text-right text-sm">
                      <span
                        className={
                          h.mov.cantidad < 0
                            ? "text-terracotta"
                            : "text-emerald-700"
                        }
                      >
                        {h.mov.cantidad > 0 ? "+" : ""}
                        {displayCantidad(h.mov.cantidad, ins?.unidadBase)}
                      </span>
                    </div>
                    <div className="col-span-3 sm:col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDevolverStock(true);
                          setPendienteBorrar(h.mov.id);
                        }}
                        title="Eliminar del historial"
                        className="text-cacao-mute hover:text-terracotta text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              }
              if (h.kind === "merma") {
                const m = h.merma;
                return (
                  <li
                    key={h.id}
                    className="p-4 grid grid-cols-12 gap-3 items-start"
                  >
                    <div className="col-span-3 sm:col-span-2 text-xs">
                      <div className="text-cacao">{fecha}</div>
                    </div>
                    <div className="col-span-9 sm:col-span-8 min-w-0">
                      <div className="text-sm text-cacao">
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ring-1 bg-[#F9EBE7] text-[#7A2419] ring-[#E8C5BC] mr-2">
                          Merma
                        </span>
                        <span className="font-medium">{m.recetaNombre}</span>{" "}
                        <span className="text-cacao-soft">
                          × {m.cantidad} ración{m.cantidad === 1 ? "" : "es"}
                        </span>
                      </div>
                      {m.mermaMotivo && (
                        <div className="text-xs text-cacao-soft mt-0.5">
                          {m.mermaMotivo}
                        </div>
                      )}
                      {m.notas && (
                        <div className="text-xs text-cacao-soft italic font-serif mt-0.5">
                          {m.notas}
                        </div>
                      )}
                    </div>
                    <div className="col-span-12 sm:col-span-2 text-right">
                      <button
                        type="button"
                        onClick={() => setPendienteBorrarMerma(m.id)}
                        title="Eliminar merma (restaura stock y compromiso)"
                        className="text-cacao-mute hover:text-terracotta text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              }
              // Plan event — UNA línea por plan con sus hitos y fechas.
              // Los hitos son timestamps (timestamptz UTC); los formateamos en
              // hora de Caracas para que no se "adelanten" un día de noche.
              const fmtFecha = (iso: string) =>
                new Date(iso).toLocaleDateString("es-VE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "America/Caracas",
                });
              const realizado = h.plan.completadoAt;
              const cancelado = h.plan.canceladoAt;
              return (
                <li
                  key={h.id}
                  className="p-4 grid grid-cols-12 gap-3 items-start"
                >
                  <div className="col-span-3 sm:col-span-2 text-xs">
                    <div className="text-cacao">{fmtFecha(h.plan.createdAt)}</div>
                  </div>
                  <div className="col-span-9 sm:col-span-8 min-w-0">
                    <div className="text-sm text-cacao">
                      <span className="font-medium">{h.plan.recetaNombre}</span>{" "}
                      <span className="text-cacao-soft">
                        × {h.plan.raciones} raciones
                      </span>
                    </div>
                    {/* Hitos del plan, en la misma línea, con fechas */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] uppercase tracking-widest">
                      <span className="text-amber-700">
                        Plan aprobado · {fmtFecha(h.plan.createdAt)}
                      </span>
                      {realizado && (
                        <span className="text-emerald-700">
                          Realizado · {fmtFecha(realizado)}
                        </span>
                      )}
                      {cancelado && (
                        <span className="text-stone-500">
                          Cancelado · {fmtFecha(cancelado)}
                        </span>
                      )}
                    </div>
                    {h.plan.nota && (
                      <div className="text-xs text-cacao-soft italic font-serif mt-1">
                        {h.plan.nota}
                      </div>
                    )}
                    <div className="text-[10px] uppercase tracking-widest text-cacao-mute mt-1">
                      {h.plan.compromisos.length} ingrediente
                      {h.plan.compromisos.length === 1 ? "" : "s"}{" "}
                      {cancelado ? "liberados" : "reservados"}
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-2 text-right">
                    <a
                      href="/cocina/inventario/planes"
                      className="text-[10px] uppercase tracking-widest text-cacao-soft hover:text-cacao"
                    >
                      Ver planes →
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </details>

      {/* Modal: registrar pérdida */}
      {perdidaInsumo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cacao/40 backdrop-blur-sm"
          onClick={() => !registrando && closePerdida()}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleRegistrarPerdida}
            className="rounded-2xl bg-white ring-1 ring-marfil p-6 max-w-md w-full shadow-xl space-y-3"
          >
            <h2 className="font-cinzel text-xl tracking-[0.08em] text-cacao">
              Registrar pérdida
            </h2>
            <div className="rounded-lg bg-marfil-soft p-3 text-sm">
              <div className="font-medium text-cacao">{perdidaInsumo.nombre}</div>
              <div className="text-xs text-cacao-soft mt-0.5">
                Stock total actual:{" "}
                <strong>
                  {displayCantidad(perdidaInsumo.stockTotal, perdidaInsumo.unidadBase)}
                </strong>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-cacao">
                {perdidaCocido ? "Peso cocido" : "Cantidad afectada"}
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={perdidaCant}
                  onChange={(e) => setPerdidaCant(e.target.value)}
                  required
                  autoFocus
                  placeholder={`En ${perdidaInsumo.unidadBase}`}
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
                />
                <span className="text-[10px] text-cacao-mute block mt-1">
                  {perdidaCocido
                    ? "Lo que pesaste ya cocido."
                    : "Se descuenta del stock."}
                </span>
              </label>
              <label className="text-sm text-cacao">
                Motivo principal
                <select
                  value={perdidaTipo}
                  onChange={(e) =>
                    setPerdidaTipo(e.target.value as TipoPerdida)
                  }
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
                >
                  {TIPOS_PERDIDA.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Pesé cocido → convertir a crudo */}
            <div className="rounded-lg ring-1 ring-marfil p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perdidaCocido}
                  onChange={(e) => setPerdidaCocido(e.target.checked)}
                  className="h-4 w-4 accent-cacao"
                />
                <span className="text-sm text-cacao">
                  Pesé el producto ya cocido (convertir a crudo)
                </span>
              </label>
              {perdidaCocido && (
                <div className="mt-3 space-y-2">
                  <label className="text-sm text-cacao block">
                    Merma por cocción (%)
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="99"
                      value={perdidaMermaPct}
                      onChange={(e) => setPerdidaMermaPct(e.target.value)}
                      placeholder="Ej. 70"
                      className="mt-1 w-28 rounded-lg ring-1 ring-marfil px-3 py-2"
                    />
                    <span className="text-[10px] text-cacao-mute block mt-1">
                      {perdidaInsumo.mermaCoccionPorc != null
                        ? "Sugerido desde la ficha del insumo — editable."
                        : "% de peso que pierde al cocinarse."}
                    </span>
                  </label>
                  <div className="rounded-lg bg-marfil-soft p-2 text-sm">
                    {conversionCocido === null ? null : conversionCocido.error ? (
                      <span className="text-cacao-soft">
                        Escribe el peso cocido y un % entre 0 y 99.
                      </span>
                    ) : (
                      <span className="text-cacao">
                        Se descontarán{" "}
                        <strong>
                          {displayCantidad(
                            conversionCocido.crudo,
                            perdidaInsumo.unidadBase,
                          )}
                        </strong>{" "}
                        en crudo.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <label className="text-sm text-cacao block">
              Fecha
              <input
                type="date"
                value={perdidaFecha}
                onChange={(e) => setPerdidaFecha(e.target.value)}
                required
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao block">
              Detalle{" "}
              <span className="text-cacao-mute font-normal">(opcional)</span>
              <input
                type="text"
                placeholder="Ej: caja se mojó, pollo en mal estado al recibir, etc."
                value={perdidaMotivo}
                onChange={(e) => setPerdidaMotivo(e.target.value)}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao block">
              Nota interna{" "}
              <span className="text-cacao-mute font-normal">(opcional)</span>
              <textarea
                value={perdidaNota}
                onChange={(e) => setPerdidaNota(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closePerdida}
                disabled={registrando}
                className="rounded-xl ring-1 ring-marfil px-4 py-2 text-cacao hover:bg-marfil-soft disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={registrando}
                className="flex-1 rounded-xl bg-terracotta text-white px-4 py-2 font-medium hover:bg-cacao disabled:opacity-50"
              >
                {registrando ? "Registrando..." : "Registrar pérdida"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={pendienteBorrar !== null}
        title="¿Eliminar este movimiento del historial?"
        message={
          <>
            <label className="flex items-start gap-2 rounded-lg bg-marfil-soft ring-1 ring-marfil p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={devolverStock}
                onChange={(e) => setDevolverStock(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-cacao"
              />
              <span className="text-sm text-cacao">
                Devolver la cantidad al stock
                <span className="block text-xs text-cacao-soft">
                  Márcalo si registraste la pérdida por error. Déjalo sin marcar
                  para solo borrar el registro sin tocar el stock.
                </span>
              </span>
            </label>
          </>
        }
        onConfirm={() => {
          if (pendienteBorrar) handleDeleteMov(pendienteBorrar, devolverStock);
          setPendienteBorrar(null);
        }}
        onCancel={() => setPendienteBorrar(null)}
      />

      {/* Modal: registrar merma de producción (por receta) */}
      {mermaOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cacao/40 backdrop-blur-sm"
          onClick={() => !mermaProcesando && setMermaOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleMermaSubmit}
            className="rounded-2xl bg-white ring-1 ring-marfil p-6 max-w-md w-full shadow-xl space-y-3"
          >
            <h2 className="font-cinzel text-xl tracking-[0.08em] text-cacao">
              Merma de producción
            </h2>
            <p className="text-sm text-cacao-soft font-serif leading-relaxed">
              Registrá una ración (o varias) de algo pre-producido que se perdió
              por un fallo interno (no es una venta). Descuenta los insumos del
              stock y libera el compromiso del plan, sin sumar ingresos.
            </p>
            <label className="text-sm text-cacao block">
              Receta
              <select
                value={mermaRecetaId}
                onChange={(e) => setMermaRecetaId(e.target.value)}
                required
                autoFocus
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
              >
                <option value="">— Seleccioná —</option>
                {recetasMermaOpciones.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                    {r.esSubreceta ? " · subreceta" : ` (${r.seccion})`}
                  </option>
                ))}
              </select>
            </label>
            {/* Nota: raciones que quedan reservadas en planes activos */}
            {racionesEnPlanes && racionesEnPlanes.total > 0 && (
              <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-2.5 text-sm text-[#2F4A1F] flex items-center justify-between gap-2 flex-wrap">
                <span>
                  Quedan{" "}
                  <strong>
                    {Number(racionesEnPlanes.total.toFixed(2))} raciones
                  </strong>{" "}
                  reservadas en{" "}
                  {racionesEnPlanes.planes === 1
                    ? "1 plan activo"
                    : `${racionesEnPlanes.planes} planes activos`}
                  .
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMermaUnidad("raciones");
                    setMermaRaciones(
                      String(Number(racionesEnPlanes.total.toFixed(2))),
                    );
                  }}
                  className="rounded-lg ring-1 ring-[#C9D6BC] px-2.5 py-1 text-xs font-medium hover:bg-white"
                >
                  Usar todas
                </button>
              </div>
            )}
            {/* Unidad de la merma: por raciones o por gramos */}
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMermaUnidad("raciones")}
                className={`flex-1 rounded-lg px-3 py-1.5 transition ${
                  mermaUnidad === "raciones"
                    ? "bg-terracotta text-white"
                    : "ring-1 ring-marfil text-cacao hover:bg-marfil-soft"
                }`}
              >
                Por raciones
              </button>
              <button
                type="button"
                onClick={() => setMermaUnidad("gramos")}
                className={`flex-1 rounded-lg px-3 py-1.5 transition ${
                  mermaUnidad === "gramos"
                    ? "bg-terracotta text-white"
                    : "ring-1 ring-marfil text-cacao hover:bg-marfil-soft"
                }`}
              >
                Por gramos
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mermaUnidad === "gramos" ? (
                <label className="text-sm text-cacao">
                  Cantidad perdida ({rendUnidad})
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={mermaGramos}
                    onChange={(e) => setMermaGramos(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
                  />
                </label>
              ) : (
                <label className="text-sm text-cacao">
                  Raciones perdidas
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={mermaRaciones}
                    onChange={(e) => setMermaRaciones(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
                  />
                </label>
              )}
              <label className="text-sm text-cacao">
                Motivo
                <select
                  value={mermaMotivo}
                  onChange={(e) => setMermaMotivo(e.target.value)}
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
                >
                  {MOTIVOS_MERMA_PRODUCCION.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* Conversión gramos → raciones (según el rendimiento de la receta) */}
            {mermaUnidad === "gramos" && mermaReceta && !gramosPorRacion && (
              <p className="text-xs text-terracotta font-serif leading-relaxed">
                Esta receta no tiene rendimiento definido. Registrá por raciones,
                o agregá el rendimiento (g/ml) en la ficha de la receta.
              </p>
            )}
            {mermaUnidad === "gramos" && gramosPorRacion && (
              <p className="text-xs text-cacao-soft font-serif leading-relaxed">
                Rendimiento: {gramosPorRacion.toFixed(0)} {rendUnidad}/ración
                {Number.isFinite(mermaRacionesCalc)
                  ? ` · equivale a ≈ ${mermaRacionesCalc.toFixed(2)} raciones`
                  : ""}
                .
              </p>
            )}
            <label className="text-sm text-cacao block">
              Fecha
              <input
                type="date"
                value={mermaFecha}
                onChange={(e) => setMermaFecha(e.target.value)}
                required
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao block">
              Nota{" "}
              <span className="text-cacao-mute font-normal">(opcional)</span>
              <input
                type="text"
                placeholder="Ej: se quemó por falla de la freidora"
                value={mermaNota}
                onChange={(e) => setMermaNota(e.target.value)}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            {mermaCostoPreview !== null && (
              <div className="rounded-lg bg-marfil-soft p-3 text-xs text-cacao-soft">
                Costo estimado de la merma:{" "}
                <strong className="text-cacao">
                  ${mermaCostoPreview.toFixed(2)} USD
                </strong>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMermaOpen(false)}
                disabled={mermaProcesando}
                className="rounded-xl ring-1 ring-marfil px-4 py-2 text-cacao hover:bg-marfil-soft disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mermaProcesando}
                className="flex-1 rounded-xl bg-terracotta text-white px-4 py-2 font-medium hover:bg-cacao disabled:opacity-50"
              >
                {mermaProcesando ? "Registrando..." : "Registrar merma"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={pendienteBorrarMerma !== null}
        title="¿Eliminar esta merma?"
        message={
          <>
            Se va a restaurar el stock y el compromiso que esta merma había
            descontado (como deshacer el registro).
          </>
        }
        onConfirm={ejecutarBorrarMerma}
        onCancel={() => setPendienteBorrarMerma(null)}
      />
    </div>
  );
}

