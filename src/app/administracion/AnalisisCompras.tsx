"use client";

// Análisis de Compras (insumos de Cocina). Refleja la tabla `compras` de Cocina
// —igual que Análisis de ventas refleja `ventas`— con la MISMA lente (rango,
// evolución, por categoría, ▲▼ vs período anterior) para que ambos se comparen
// lado a lado. La utilidad real (ventas − costos) vive en el Resumen.
import { useEffect, useMemo, useState } from "react";
import type { Compra, Insumo, Proveedor } from "@/lib/types";
import { categoriaInsumoLabel } from "@/lib/types";
import { listComprasRango, listInsumos, listProveedores } from "@/lib/data/cocina";
import { hoyISO } from "@/lib/ui";
import { ErrorBanner } from "@/components/ErrorBanner";
import { BarrasH, LineaEvolucion, Dona, PanelCard, colorPorIndice } from "@/components/charts/VentasCharts";

const fUSD = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fUnid = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const fPct = (n: number) => `${n.toFixed(1)}%`;
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function diaCorto(iso: string): string { const [, m, d] = iso.split("-"); return `${d}/${m}`; }
type Preset = "dia" | "semana" | "mes" | "rango";
function rangoDePreset(preset: Preset): { desde: string; hasta: string } {
  const hoy = new Date();
  if (preset === "dia") return { desde: isoLocal(hoy), hasta: isoLocal(hoy) };
  if (preset === "semana") { const d = new Date(hoy); d.setDate(d.getDate() - 6); return { desde: isoLocal(d), hasta: isoLocal(hoy) }; }
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: isoLocal(primero), hasta: isoLocal(hoy) };
}
const MODALIDAD: Record<string, string> = {
  bcv_dolar: "BCV dólar", bcv_euro: "BCV euro", paralela: "Paralela", efectivo: "Efectivo", divisa: "Divisa",
};

export function AnalisisCompras() {
  const [preset, setPreset] = useState<Preset>("mes");
  const ini = rangoDePreset("mes");
  const [desde, setDesde] = useState(ini.desde);
  const [hasta, setHasta] = useState(ini.hasta);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [comprasPrev, setComprasPrev] = useState<Compra[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    listInsumos().then((i) => !cancel && setInsumos(i)).catch(() => {});
    listProveedores().then((p) => !cancel && setProveedores(p)).catch(() => {});
    return () => { cancel = true; };
  }, []);

  const rangoPrev = useMemo(() => {
    const d0 = new Date(desde + "T00:00"); const d1 = new Date(hasta + "T00:00");
    const dias = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
    const fin = new Date(d0); fin.setDate(fin.getDate() - 1);
    const ini2 = new Date(fin); ini2.setDate(ini2.getDate() - (dias - 1));
    return { desde: isoLocal(ini2), hasta: isoLocal(fin) };
  }, [desde, hasta]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const c = await listComprasRango(desde, hasta);
        if (!cancel) setCompras(c);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Error cargando compras");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [desde, hasta]);

  useEffect(() => {
    let cancel = false;
    listComprasRango(rangoPrev.desde, rangoPrev.hasta).then((c) => !cancel && setComprasPrev(c)).catch(() => !cancel && setComprasPrev([]));
    return () => { cancel = true; };
  }, [rangoPrev.desde, rangoPrev.hasta]);

  const insMap = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const provMap = useMemo(() => new Map(proveedores.map((p) => [p.id, p.nombre])), [proveedores]);

  const total = useMemo(() => compras.reduce((s, c) => s + (c.precioTotalUsd || 0), 0), [compras]);
  const totalPrev = useMemo(() => comprasPrev.reduce((s, c) => s + (c.precioTotalUsd || 0), 0), [comprasPrev]);
  const delta = totalPrev > 0 ? (total - totalPrev) / totalPrev : null;
  const nCompras = compras.length;
  const compraPromedio = nCompras > 0 ? total / nCompras : 0;
  const diasConCompra = useMemo(() => new Set(compras.map((c) => c.fecha)).size, [compras]);

  // Por insumo (top por gasto).
  const porInsumo = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; monto: number; veces: number }>();
    for (const c of compras) {
      const ins = insMap.get(c.insumoId);
      const nombre = ins?.nombre ?? "—";
      const cur = m.get(c.insumoId) ?? { id: c.insumoId, nombre, monto: 0, veces: 0 };
      cur.monto += c.precioTotalUsd || 0; cur.veces += 1; m.set(c.insumoId, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.monto - a.monto);
  }, [compras, insMap]);

  // Por proveedor.
  const porProveedor = useMemo(() => {
    const m = new Map<string, { key: string; nombre: string; monto: number }>();
    for (const c of compras) {
      const key = c.proveedorId ?? "sin";
      const nombre = c.proveedorId ? (provMap.get(c.proveedorId) ?? "Proveedor") : "Sin proveedor";
      const cur = m.get(key) ?? { key, nombre, monto: 0 };
      cur.monto += c.precioTotalUsd || 0; m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.monto - a.monto);
  }, [compras, provMap]);

  // Por categoría del insumo.
  const porCategoria = useMemo(() => {
    const m = new Map<string, { key: string; label: string; monto: number }>();
    for (const c of compras) {
      const ins = insMap.get(c.insumoId);
      const label = ins?.categoria ? categoriaInsumoLabel(ins.categoria) : "Sin categoría";
      const key = label.toLowerCase();
      const cur = m.get(key) ?? { key, label, monto: 0 };
      cur.monto += c.precioTotalUsd || 0; m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.monto - a.monto);
  }, [compras, insMap]);

  // Por modalidad de pago.
  const porModalidad = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of compras) { const k = c.modalidadPago ?? "—"; m.set(k, (m.get(k) ?? 0) + (c.precioTotalUsd || 0)); }
    return Array.from(m.entries()).map(([k, monto]) => ({ key: k, label: MODALIDAD[k] ?? k, monto })).sort((a, b) => b.monto - a.monto);
  }, [compras]);

  // Evolución diaria.
  const porDia = useMemo(() => {
    const acc = new Map<string, number>();
    compras.forEach((c) => acc.set(c.fecha, (acc.get(c.fecha) ?? 0) + (c.precioTotalUsd || 0)));
    const dias: { label: string; value: number; tip: string }[] = [];
    const d = new Date(desde + "T00:00"); const fin = new Date(hasta + "T00:00");
    let guard = 0;
    while (d <= fin && guard < 400) { const iso = isoLocal(d); dias.push({ label: diaCorto(iso), value: acc.get(iso) ?? 0, tip: iso }); d.setDate(d.getDate() + 1); guard++; }
    return dias;
  }, [compras, desde, hasta]);

  const pct = (m: number) => (total > 0 ? (m / total) * 100 : 0);
  const concentracion = porProveedor[0] ? pct(porProveedor[0].monto) : 0;

  function aplicarPreset(p: Preset) {
    setPreset(p);
    if (p !== "rango") { const r = rangoDePreset(p); setDesde(r.desde); setHasta(r.hasta); }
  }
  const pill = (active: boolean) => `px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${active ? "bg-cacao text-white ring-cacao" : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"}`;
  const hayDatos = compras.length > 0;

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <section className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["dia", "semana", "mes", "rango"] as Preset[]).map((p) => (
            <button key={p} type="button" onClick={() => aplicarPreset(p)} className={pill(preset === p)}>
              {p === "dia" ? "Día" : p === "semana" ? "Semana" : p === "mes" ? "Mes" : "Rango"}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1 text-xs text-cacao-soft">Desde
              <input type="date" value={desde} max={hasta} onChange={(e) => { setPreset("rango"); setDesde(e.target.value); }} className="rounded-lg ring-1 ring-marfil px-2 py-1 text-sm bg-white" />
            </label>
            <label className="flex items-center gap-1 text-xs text-cacao-soft">Hasta
              <input type="date" value={hasta} min={desde} max={hoyISO()} onChange={(e) => { setPreset("rango"); setHasta(e.target.value); }} className="rounded-lg ring-1 ring-marfil px-2 py-1 text-sm bg-white" />
            </label>
          </div>
        </div>
      </section>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center text-cacao-soft">Cargando compras…</div>
      ) : !hayDatos ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center">
          <p className="font-serif italic text-cacao-soft">No hay compras de insumos registradas en el período. Se registran en Cocina → Compras y aquí se reflejan.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card titulo="Compras totales" valor={fUSD(total)} />
            <Card titulo="vs período anterior" valor={delta == null ? "—" : `${delta >= 0 ? "▲" : "▼"} ${fPct(Math.abs(delta) * 100)}`} sub={totalPrev > 0 ? `antes ${fUSD(totalPrev)}` : "sin datos previos"} tono={delta == null ? undefined : delta >= 0 ? "alerta" : "bien"} />
            <Card titulo="Nº de compras" valor={fUnid(nCompras)} sub={`${diasConCompra} días con compra`} />
            <Card titulo="Compra promedio" valor={fUSD(compraPromedio)} />
            <Card titulo="Insumos distintos" valor={fUnid(porInsumo.length)} />
          </div>

          <PanelCard titulo="Evolución de compras (por día)">
            <LineaEvolucion puntos={porDia} format={fUSD} />
          </PanelCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard titulo="Compras por categoría de insumo">
              <BarrasH rows={porCategoria.map((c, i) => ({ key: c.key, label: c.label, value: c.monto, color: colorPorIndice(i), tip: `${c.label}: ${fUSD(c.monto)} · ${fPct(pct(c.monto))}` }))} format={fUSD} />
            </PanelCard>
            <PanelCard titulo="Distribución por categoría">
              <Dona segmentos={porCategoria.map((c, i) => ({ key: c.key, label: c.label, value: c.monto, color: colorPorIndice(i) }))} format={fUSD} />
            </PanelCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard titulo="Top proveedores (gasto)">
              <BarrasH rows={porProveedor.slice(0, 8).map((p, i) => ({ key: p.key, label: p.nombre, value: p.monto, color: colorPorIndice(i), tip: `${p.nombre}: ${fUSD(p.monto)} · ${fPct(pct(p.monto))}` }))} format={fUSD} />
              {porProveedor[0] && (
                <p className="mt-3 text-[11px] text-cacao-mute">Concentración: <strong className="text-cacao">{porProveedor[0].nombre}</strong> es el {fPct(concentracion)} de tus compras.{concentracion >= 50 ? " Dependes fuerte de un solo proveedor." : ""}</p>
              )}
            </PanelCard>
            <PanelCard titulo="Top insumos por gasto">
              <BarrasH rows={porInsumo.slice(0, 10).map((p, i) => ({ key: p.id, label: p.nombre, value: p.monto, color: colorPorIndice(i), tip: `${p.nombre}: ${fUSD(p.monto)} · ${p.veces} compra(s)` }))} format={fUSD} />
            </PanelCard>
          </div>

          <PanelCard titulo="Por modalidad de pago">
            <BarrasH rows={porModalidad.map((m, i) => ({ key: m.key, label: m.label, value: m.monto, color: colorPorIndice(i), tip: `${m.label}: ${fUSD(m.monto)} · ${fPct(pct(m.monto))}` }))} format={fUSD} />
          </PanelCard>

          <p className="text-[11px] text-cacao-soft italic">El costo de insumos vs las ventas (food cost %) y la utilidad real están en la pestaña <strong>Resumen</strong>.</p>
        </>
      )}
    </div>
  );
}

function Card({ titulo, valor, sub, tono }: { titulo: string; valor: string; sub?: string; tono?: "bien" | "alerta" }) {
  const color = tono === "bien" ? "text-[#2F4A1F]" : tono === "alerta" ? "text-[#7A5A18]" : "text-cacao";
  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">{titulo}</div>
      <div className={`mt-1 font-cinzel text-lg leading-tight break-words ${color}`}>{valor}</div>
      {sub && <div className="text-xs text-cacao-soft mt-0.5">{sub}</div>}
    </div>
  );
}
