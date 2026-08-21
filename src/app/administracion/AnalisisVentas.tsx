"use client";

// Dashboard "Análisis de Ventas". Usa exactamente los mismos datos que el
// reporte detallado (tabla `ventas`, es_merma=false). No crea datos paralelos:
// carga las ventas del rango + las recetas (para la categoría) y agrega todo en
// el cliente con useMemo. Modular: no toca la lógica de registro de ventas.

import { useEffect, useMemo, useState } from "react";
import type { Venta, Receta, Insumo } from "@/lib/types";
import { categoriaRecetaLabel, categoriaInsumoLabel } from "@/lib/types";
import { listVentasRango } from "@/lib/data/ventas";
import { listRecetas } from "@/lib/data/recetas";
import { listInsumos } from "@/lib/data/cocina";
import { hoyISO } from "@/lib/ui";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  BarrasH,
  LineaEvolucion,
  Dona,
  PanelCard,
  colorPorIndice,
  type BarRow,
} from "@/components/charts/VentasCharts";

// ── Formato ──────────────────────────────────────────────────────────────
const fUSD = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fUnid = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const fPct = (n: number) => `${n.toFixed(1)}%`;

// Fecha ISO local (evita el corrimiento de zona horaria de toISOString()).
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Etiqueta corta de día para el eje X (ej. "05/08").
function diaCorto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

type Preset = "dia" | "semana" | "mes" | "rango";

// Rango de fechas para cada preset (mes = mes actual por defecto).
function rangoDePreset(preset: Preset): { desde: string; hasta: string } {
  const hoy = new Date();
  if (preset === "dia") return { desde: isoLocal(hoy), hasta: isoLocal(hoy) };
  if (preset === "semana") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 6);
    return { desde: isoLocal(d), hasta: isoLocal(hoy) };
  }
  // mes actual
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: isoLocal(primero), hasta: isoLocal(hoy) };
}

// Normaliza un nombre de categoría para AGRUPAR: sin acentos, en minúsculas y
// sin espacios repetidos. Así "Otros" de receta y "Otros" de insumo (o cualquier
// par que se escriba igual) caen en la MISMA categoría en vez de duplicarse.
function normCat(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Unifica nombres equivalentes de las DOS taxonomías (categorías de receta +
// categorías de insumo de reventa) en una sola etiqueta canónica, para que el
// análisis no muestre categorías repetidas. Solo toca la VISTA del dashboard;
// no cambia los datos de recetas ni insumos. Clave = nombre normalizado.
const CANON_CATEGORIA: Record<string, string> = {
  otros: "Otros",
  // "Leche de Almendras" vendida como extra: el insumo está en "Lácteos", pero
  // no es una categoría de venta propia → va a Otros.
  lacteos: "Otros",
  snack: "Snacks",
  snacks: "Snacks",
  bebidas: "Bebidas",
  "bebida fria": "Bebidas",
  "bebida alcoholica": "Bebidas Alcohólicas",
  "bebidas alcoholicas": "Bebidas Alcohólicas",
  "cafe & bebida caliente": "Café",
  "cafe & te": "Café",
  cafe: "Café",
  smoothie: "Smoothie",
  sandwich: "Sandwich",
};

// Categoría de una venta (usa datos existentes, no inventa):
//   • receta vinculada con categoría → esa categoría.
//   • venta insumo_directo (reventa: aguas, refrescos, galletas…) → la categoría
//     del insumo del catálogo.
//   • consignación / servicio → su tipo.
//   • si no → "Sin categoría".
// Se agrupa por el nombre CANÓNICO (una sola lista limpia, sin repetidos).
function categoriaDeVenta(
  v: Venta,
  catPorReceta: Map<string, string>,
  catPorInsumo: Map<string, string>,
): { key: string; label: string } {
  let label: string | null = null;
  if (v.recetaId) {
    const cat = catPorReceta.get(v.recetaId);
    if (cat && cat.trim()) label = categoriaRecetaLabel(cat);
  }
  if (!label && v.insumoId) {
    const cat = catPorInsumo.get(v.insumoId);
    if (cat && cat.trim()) label = categoriaInsumoLabel(cat);
  }
  if (!label && v.tipoItem === "consignacion") label = "Consignación";
  if (!label && v.tipoItem === "servicio") label = "Servicio";
  if (!label) label = "Sin categoría";
  const canon = CANON_CATEGORIA[normCat(label)] ?? label;
  return { key: normCat(canon), label: canon };
}

type OrdenTabla = "monto" | "unidades" | "pct";

export function AnalisisVentas() {
  const [preset, setPreset] = useState<Preset>("mes");
  const inicial = rangoDePreset("mes");
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [filtroCat, setFiltroCat] = useState<string>("all");
  const [filtroProd, setFiltroProd] = useState<string>("all");
  const [topN, setTopN] = useState<5 | 10 | 20>(5);
  const [orden, setOrden] = useState<OrdenTabla>("monto");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Conciliación con Administración (componentes del rango, en euros).
  const [conc, setConc] = useState<{ setuxNeto: number; ivaSetux: number; cxc: number; rpp: number; cobrosEur: number; otrosEur: number } | null>(null);

  // Recetas + insumos una sola vez (para los mapas de categoría: las ventas de
  // receta usan la categoría de la receta; las de reventa (insumo_directo) usan
  // la del insumo).
  useEffect(() => {
    let cancel = false;
    listRecetas()
      .then((r) => !cancel && setRecetas(r))
      .catch(() => {});
    listInsumos()
      .then((i) => !cancel && setInsumos(i))
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  // Ventas: se recargan cuando cambia el rango de fechas.
  useEffect(() => {
    let cancel = false;
    async function cargar() {
      setLoading(true);
      setError(null);
      try {
        const v = await listVentasRango(desde, hasta);
        if (!cancel) setVentas(v);
      } catch (e) {
        if (!cancel)
          setError(e instanceof Error ? e.message : "Error cargando ventas");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    cargar();
    return () => {
      cancel = true;
    };
  }, [desde, hasta]);

  // Componentes de conciliación (Setux neto, CXC, RPP…) del mismo rango.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/conciliacion?desde=${desde}&hasta=${hasta}`, { cache: "no-store" });
        const d = await r.json();
        if (!cancel) setConc(r.ok ? d : null);
      } catch {
        if (!cancel) setConc(null);
      }
    })();
    return () => { cancel = true; };
  }, [desde, hasta]);

  // Total de Cocina del rango (todas las ventas, sin filtros de cat/producto).
  const cocinaTotalRango = useMemo(() => ventas.reduce((s, v) => s + (v.totalUsd ?? 0), 0), [ventas]);

  const catPorReceta = useMemo(() => {
    const m = new Map<string, string>();
    recetas.forEach((r) => {
      if (r.categoria) m.set(r.id, r.categoria);
    });
    return m;
  }, [recetas]);

  const catPorInsumo = useMemo(() => {
    const m = new Map<string, string>();
    insumos.forEach((i) => {
      if (i.categoria) m.set(i.id, i.categoria);
    });
    return m;
  }, [insumos]);

  // Enriquecer cada venta con producto/categoría/unidades/monto.
  const enriquecidas = useMemo(
    () =>
      ventas.map((v) => {
        const cat = categoriaDeVenta(v, catPorReceta, catPorInsumo);
        return {
          fecha: v.fecha,
          producto: v.recetaNombre.trim() || "—",
          catKey: cat.key,
          catLabel: cat.label,
          unidades: v.cantidad || 0,
          monto: v.totalUsd ?? 0,
        };
      }),
    [ventas, catPorReceta, catPorInsumo],
  );

  // Opciones de los filtros (según lo que existe en el rango cargado).
  const categoriasOpciones = useMemo(() => {
    const m = new Map<string, string>();
    enriquecidas.forEach((e) => m.set(e.catKey, e.catLabel));
    return Array.from(m.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enriquecidas]);

  const productosOpciones = useMemo(() => {
    const base =
      filtroCat === "all"
        ? enriquecidas
        : enriquecidas.filter((e) => e.catKey === filtroCat);
    return Array.from(new Set(base.map((e) => e.producto))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [enriquecidas, filtroCat]);

  // Aplicar filtros de categoría y producto.
  const filtradas = useMemo(
    () =>
      enriquecidas.filter(
        (e) =>
          (filtroCat === "all" || e.catKey === filtroCat) &&
          (filtroProd === "all" || e.producto === filtroProd),
      ),
    [enriquecidas, filtroCat, filtroProd],
  );

  // ── Agregados ────────────────────────────────────────────────────────
  const totalMonto = useMemo(
    () => filtradas.reduce((s, e) => s + e.monto, 0),
    [filtradas],
  );
  const totalUnidades = useMemo(
    () => filtradas.reduce((s, e) => s + e.unidades, 0),
    [filtradas],
  );

  const porProducto = useMemo(() => {
    const m = new Map<
      string,
      { producto: string; catLabel: string; unidades: number; monto: number }
    >();
    filtradas.forEach((e) => {
      const cur =
        m.get(e.producto) ??
        { producto: e.producto, catLabel: e.catLabel, unidades: 0, monto: 0 };
      cur.unidades += e.unidades;
      cur.monto += e.monto;
      m.set(e.producto, cur);
    });
    return Array.from(m.values());
  }, [filtradas]);

  const porCategoria = useMemo(() => {
    const m = new Map<
      string,
      { key: string; label: string; unidades: number; monto: number }
    >();
    filtradas.forEach((e) => {
      const cur =
        m.get(e.catKey) ??
        { key: e.catKey, label: e.catLabel, unidades: 0, monto: 0 };
      cur.unidades += e.unidades;
      cur.monto += e.monto;
      m.set(e.catKey, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.monto - a.monto);
  }, [filtradas]);

  // Evolución diaria: todos los días del rango, con 0 si no hubo ventas.
  const porDia = useMemo(() => {
    const acc = new Map<string, number>();
    filtradas.forEach((e) => acc.set(e.fecha, (acc.get(e.fecha) ?? 0) + e.monto));
    const dias: { label: string; value: number; tip: string }[] = [];
    const d = new Date(desde + "T00:00");
    const fin = new Date(hasta + "T00:00");
    let guard = 0;
    while (d <= fin && guard < 400) {
      const iso = isoLocal(d);
      dias.push({ label: diaCorto(iso), value: acc.get(iso) ?? 0, tip: iso });
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return dias;
  }, [filtradas, desde, hasta]);

  const masVendidoUnid = useMemo(
    () =>
      porProducto.reduce<(typeof porProducto)[number] | null>(
        (best, p) => (!best || p.unidades > best.unidades ? p : best),
        null,
      ),
    [porProducto],
  );
  const masFactura = useMemo(
    () =>
      porProducto.reduce<(typeof porProducto)[number] | null>(
        (best, p) => (!best || p.monto > best.monto ? p : best),
        null,
      ),
    [porProducto],
  );

  const tablaOrdenada = useMemo(() => {
    const arr = [...porProducto];
    arr.sort((a, b) =>
      orden === "unidades" ? b.unidades - a.unidades : b.monto - a.monto,
    );
    return arr;
  }, [porProducto, orden]);

  const topUnidades = useMemo(
    () => [...porProducto].sort((a, b) => b.unidades - a.unidades).slice(0, topN),
    [porProducto, topN],
  );
  const topMonto = useMemo(
    () => [...porProducto].sort((a, b) => b.monto - a.monto).slice(0, topN),
    [porProducto, topN],
  );
  const menosVendidos = useMemo(
    () =>
      [...porProducto].sort((a, b) => a.unidades - b.unidades).slice(0, topN),
    [porProducto, topN],
  );

  const pct = (monto: number) => (totalMonto > 0 ? (monto / totalMonto) * 100 : 0);

  function limpiarFiltros() {
    setPreset("mes");
    const r = rangoDePreset("mes");
    setDesde(r.desde);
    setHasta(r.hasta);
    setFiltroCat("all");
    setFiltroProd("all");
    setTopN(5);
    setOrden("monto");
  }

  function aplicarPreset(p: Preset) {
    setPreset(p);
    if (p !== "rango") {
      const r = rangoDePreset(p);
      setDesde(r.desde);
      setHasta(r.hasta);
    }
  }

  const hayDatos = filtradas.length > 0;

  const pill = (active: boolean) =>
    `px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
      active
        ? "bg-cacao text-white ring-cacao"
        : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
    }`;

  return (
    <div className="space-y-5">
      {/* ── Filtros ─────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["dia", "semana", "mes", "rango"] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => aplicarPreset(p)}
              className={pill(preset === p)}
            >
              {p === "dia"
                ? "Día"
                : p === "semana"
                  ? "Semana"
                  : p === "mes"
                    ? "Mes"
                    : "Rango"}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1 text-xs text-cacao-soft">
              Desde
              <input
                type="date"
                value={desde}
                max={hasta}
                onChange={(e) => {
                  setPreset("rango");
                  setDesde(e.target.value);
                }}
                className="rounded-lg ring-1 ring-marfil px-2 py-1 text-sm bg-white"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-cacao-soft">
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde}
                max={hoyISO()}
                onChange={(e) => {
                  setPreset("rango");
                  setHasta(e.target.value);
                }}
                className="rounded-lg ring-1 ring-marfil px-2 py-1 text-sm bg-white"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroCat}
            onChange={(e) => {
              setFiltroCat(e.target.value);
              setFiltroProd("all");
            }}
            className="rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white"
          >
            <option value="all">Todas las categorías</option>
            {categoriasOpciones.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={filtroProd}
            onChange={(e) => setFiltroProd(e.target.value)}
            className="rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white max-w-[240px]"
          >
            <option value="all">Todos los productos</option>
            {productosOpciones.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {(filtroCat !== "all" ||
            filtroProd !== "all" ||
            preset !== "mes") && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs uppercase tracking-widest text-cacao-soft hover:text-terracotta"
            >
              ↺ Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* ── Conciliación con Administración ─────────────────────── */}
      {conc && (cocinaTotalRango > 0.005 || conc.setuxNeto > 0.005) && (() => {
        const esperado = cocinaTotalRango - conc.cxc - conc.rpp;
        const residuo = Math.round((esperado - conc.setuxNeto) * 100) / 100;
        const cuadra = Math.abs(residuo) <= 1;
        const fEUR = (n: number) => `${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
        return (
          <section className="rounded-2xl bg-white ring-1 ring-marfil p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-cinzel text-base text-cacao">Conciliación con Administración</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${cuadra ? "bg-[#F1F4ED] text-[#2F4A1F]" : "bg-[#FBF3E2] text-[#7A5A18]"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cuadra ? "bg-[#4B7A2F]" : "bg-[#C9A24B]"}`} />
                {cuadra ? "Cuadra" : "Revisar"}
              </span>
            </div>
            <p className="text-[11px] text-cacao-mute mb-3">Sobre todas las ventas del período (ignora los filtros de categoría/producto). En euros.</p>
            <div className="text-sm max-w-md space-y-1">
              <Fila label="Ventas en Cocina (neto)" val={fEUR(cocinaTotalRango)} />
              <Fila label="− Ventas a crédito (CXC)" val={`− ${fEUR(conc.cxc)}`} tenue />
              <Fila label="− Cortesías (RPP)" val={`− ${fEUR(conc.rpp)}`} tenue />
              <div className="border-t border-marfil pt-1"><Fila label="= Ventas POS de contado (esperado)" val={fEUR(esperado)} fuerte /></div>
              <Fila label="Ingresos netos POS en Admin (Setux)" val={fEUR(conc.setuxNeto)} />
              <div className="border-t border-marfil pt-1">
                <Fila label="Diferencia sin explicar" val={`${residuo < 0 ? "− " : ""}${fEUR(Math.abs(residuo))}`} fuerte />
              </div>
            </div>
            {!cuadra && (
              <p className="text-[12px] text-cacao-soft mt-2">
                {residuo > 0
                  ? <>Cocina registró más ventas de contado que Administración. Revisa: ¿faltan días de Setux por importar en Ingresos?, ¿se importó dos veces algún día en Cocina? {conc.ivaSetux > 1 && <>Si la diferencia se parece al IVA del período ({fEUR(conc.ivaSetux)}), es que Cocina traía IVA y Admin no.</>}</>
                  : <>Administración tiene más ventas de contado que Cocina. Revisa: ¿faltan días por importar en Cocina?, ¿faltó cargar la CXC o las cortesías del período?</>}
              </p>
            )}
            {conc.cobrosEur > 0.005 && (
              <p className="text-[11px] text-cacao-mute mt-2">Nota: además hubo {fEUR(conc.cobrosEur)} en cobros de cuentas por cobrar en el período (son cobranzas de ventas anteriores, no ventas de este período; por eso no entran en la conciliación).</p>
            )}
          </section>
        );
      })()}

      {loading ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center text-cacao-soft">
          Cargando análisis…
        </div>
      ) : !hayDatos ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center">
          <p className="font-serif italic text-cacao-soft">
            No hay ventas en el período{filtroCat !== "all" || filtroProd !== "all" ? " / filtro" : ""}{" "}
            seleccionado. Ajusta las fechas o limpia los filtros.
          </p>
        </div>
      ) : (
        <>
          {/* ── Resumen ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard titulo="Ventas totales" valor={fUSD(totalMonto)} />
            <StatCard titulo="Unidades vendidas" valor={fUnid(totalUnidades)} />
            <StatCard
              titulo="Productos distintos"
              valor={fUnid(porProducto.length)}
            />
            <StatCard
              titulo="Más vendido (unid.)"
              valor={masVendidoUnid?.producto ?? "—"}
              sub={masVendidoUnid ? `${fUnid(masVendidoUnid.unidades)} unid.` : undefined}
            />
            <StatCard
              titulo="Mayor facturación"
              valor={masFactura?.producto ?? "—"}
              sub={masFactura ? fUSD(masFactura.monto) : undefined}
            />
          </div>

          {/* Aviso: más vendido ≠ más factura */}
          {masVendidoUnid &&
            masFactura &&
            masVendidoUnid.producto !== masFactura.producto && (
              <div className="rounded-lg bg-marfil-soft ring-1 ring-marfil p-3 text-xs text-cacao-soft">
                <strong className="text-cacao">{masVendidoUnid.producto}</strong> es
                el más vendido por unidades ({fUnid(masVendidoUnid.unidades)}), pero{" "}
                <strong className="text-cacao">{masFactura.producto}</strong> es el
                que más factura ({fUSD(masFactura.monto)}). Vender más unidades no
                siempre es facturar más.
              </div>
            )}

          {/* ── Evolución ───────────────────────────────────────── */}
          <PanelCard titulo="Evolución de ventas (por día)">
            <LineaEvolucion puntos={porDia} format={fUSD} />
          </PanelCard>

          {/* ── Categorías ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard titulo="Ventas por categoría">
              <BarrasH
                rows={porCategoria.map((c, i) => ({
                  key: c.key,
                  label: c.label,
                  value: c.monto,
                  color: colorPorIndice(i),
                  tip: `${c.label}: ${fUnid(c.unidades)} unid · ${fUSD(c.monto)} · ${fPct(pct(c.monto))} del total`,
                }))}
                format={fUSD}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-cacao-mute uppercase tracking-widest text-left">
                      <th className="py-1 font-normal">Categoría</th>
                      <th className="py-1 font-normal text-right">Unid.</th>
                      <th className="py-1 font-normal text-right">Monto</th>
                      <th className="py-1 font-normal text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCategoria.map((c) => (
                      <tr key={c.key} className="border-t border-marfil">
                        <td className="py-1 text-cacao">{c.label}</td>
                        <td className="py-1 text-right tabular-nums text-cacao-soft">
                          {fUnid(c.unidades)}
                        </td>
                        <td className="py-1 text-right tabular-nums text-cacao">
                          {fUSD(c.monto)}
                        </td>
                        <td className="py-1 text-right tabular-nums text-cacao-soft">
                          {fPct(pct(c.monto))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelCard>

            <PanelCard titulo="Distribución por categoría (facturación)">
              <Dona
                segmentos={porCategoria.map((c, i) => ({
                  key: c.key,
                  label: c.label,
                  value: c.monto,
                  color: colorPorIndice(i),
                }))}
                format={fUSD}
              />
            </PanelCard>
          </div>

          {/* ── Top / menos vendidos ────────────────────────────── */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-cacao-mute">
              Mostrar
            </span>
            {([5, 10, 20] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTopN(n)}
                className={pill(topN === n)}
              >
                Top {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard titulo={`Top ${topN} más vendidos (unidades)`}>
              <BarrasH
                rows={topUnidades.map((p, i) => barProd(p, i, "unidades"))}
                format={fUnid}
              />
            </PanelCard>
            <PanelCard titulo={`Top ${topN} por facturación (monto)`}>
              <BarrasH
                rows={topMonto.map((p, i) => barProd(p, i, "monto"))}
                format={fUSD}
              />
            </PanelCard>
          </div>

          <PanelCard titulo={`Productos menos vendidos (Top ${topN})`}>
            <BarrasH
              rows={menosVendidos.map((p, i) => barProd(p, i, "unidades"))}
              format={fUnid}
            />
          </PanelCard>

          {/* ── Detalle por producto ────────────────────────────── */}
          <PanelCard titulo="Detalle por producto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-cacao-mute uppercase tracking-widest text-[11px] text-left">
                    <th className="py-2 font-normal">Producto</th>
                    <th className="py-2 font-normal">Categoría</th>
                    <SortableTh
                      label="Unidades"
                      active={orden === "unidades"}
                      onClick={() => setOrden("unidades")}
                    />
                    <SortableTh
                      label="Monto"
                      active={orden === "monto"}
                      onClick={() => setOrden("monto")}
                    />
                    <SortableTh
                      label="% del total"
                      active={orden === "monto"}
                      onClick={() => setOrden("monto")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {tablaOrdenada.map((p) => (
                    <tr key={p.producto} className="border-t border-marfil">
                      <td className="py-2 text-cacao">{p.producto}</td>
                      <td className="py-2 text-cacao-soft">{p.catLabel}</td>
                      <td className="py-2 text-right tabular-nums text-cacao">
                        {fUnid(p.unidades)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-cacao">
                        {fUSD(p.monto)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-cacao-soft">
                        {fPct(pct(p.monto))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-marfil font-medium">
                    <td className="py-2 text-cacao" colSpan={2}>
                      Total ({porProducto.length} productos)
                    </td>
                    <td className="py-2 text-right tabular-nums text-cacao">
                      {fUnid(totalUnidades)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-cacao">
                      {fUSD(totalMonto)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-cacao-soft">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </PanelCard>
        </>
      )}
    </div>
  );

  // Fila de barra para un producto (con tooltip de detalle).
  function barProd(
    p: { producto: string; catLabel: string; unidades: number; monto: number },
    i: number,
    metric: "unidades" | "monto",
  ): BarRow {
    return {
      key: p.producto,
      label: p.producto,
      value: metric === "unidades" ? p.unidades : p.monto,
      color: colorPorIndice(i),
      tip: `${p.producto} (${p.catLabel}): ${fUnid(p.unidades)} unid · ${fUSD(p.monto)} · ${fPct(pct(p.monto))} del total`,
    };
  }
}

// ── Subcomponentes ─────────────────────────────────────────────────────
function Fila({ label, val, tenue, fuerte }: { label: string; val: string; tenue?: boolean; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={tenue ? "text-cacao-soft" : fuerte ? "text-cacao font-medium" : "text-cacao"}>{label}</span>
      <span className={`tabular-nums whitespace-nowrap ${fuerte ? "text-cacao font-medium" : tenue ? "text-cacao-soft" : "text-cacao"}`}>{val}</span>
    </div>
  );
}

function StatCard({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">
        {titulo}
      </div>
      <div className="mt-1 font-cinzel text-lg text-cacao leading-tight break-words">
        {valor}
      </div>
      {sub && <div className="text-xs text-cacao-soft mt-0.5">{sub}</div>}
    </div>
  );
}

function SortableTh({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="py-2 font-normal text-right">
      <button
        type="button"
        onClick={onClick}
        className={`uppercase tracking-widest text-[11px] hover:text-cacao ${
          active ? "text-cacao" : "text-cacao-mute"
        }`}
        title="Ordenar de mayor a menor"
      >
        {label} {active ? "↓" : ""}
      </button>
    </th>
  );
}
