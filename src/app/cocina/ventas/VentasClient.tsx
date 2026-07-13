"use client";

import { useEffect, useMemo, useState } from "react";
import type { Receta, Venta, PosClasificacion, TipoItem } from "@/lib/types";
import { listRecetas } from "@/lib/data/recetas";
import {
  listVentas,
  createVenta,
  createVentasBatch,
  deleteVenta,
  parseCSV,
  clasificarFilas,
  listClasificacion,
  upsertClasificacion,
  type ClasificItem,
} from "@/lib/data/ventas";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Tab = "registrar" | "importar" | "historial";

export function VentasClient() {
  const [tab, setTab] = useState<Tab>("registrar");
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registro manual
  const [mFecha, setMFecha] = useState(todayISO());
  const [mRecetaId, setMRecetaId] = useState("");
  const [mCantidad, setMCantidad] = useState("1");
  const [mPrecio, setMPrecio] = useState("");
  const [saving, setSaving] = useState(false);

  // Importar
  const [iFecha, setIFecha] = useState(todayISO());
  const [csvText, setCsvText] = useState("");
  const [clasif, setClasif] = useState<ClasificItem[] | null>(null);
  const [clasifs, setClasifs] = useState<PosClasificacion[]>([]);
  const [importing, setImporting] = useState(false);
  const [pendienteBorrar, setPendienteBorrar] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, v, c] = await Promise.all([
          listRecetas(),
          listVentas(50),
          listClasificacion(),
        ]);
        if (!cancelled) {
          setRecetas(r);
          setVentas(v);
          setClasifs(c);
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

  async function handleRegistroManual(e: React.FormEvent) {
    e.preventDefault();
    if (!mRecetaId) return;
    setError(null);
    setSaving(true);
    try {
      const r = recetas.find((x) => x.id === mRecetaId);
      const cant = Number(mCantidad);
      const precio = mPrecio ? Number(mPrecio) : undefined;
      const nueva = await createVenta({
        fecha: mFecha,
        recetaId: mRecetaId,
        recetaNombre: r?.nombre ?? "—",
        cantidad: cant,
        precioUnitarioUsd: precio,
        totalUsd: precio ? cant * precio : undefined,
        fuente: "manual",
      });
      setVentas((prev) => [nueva, ...prev]);
      setMCantidad("1");
      setMPrecio("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  const recetasVendibles = useMemo(
    () => recetas.filter((r) => !r.esSubreceta),
    [recetas],
  );

  function parsear() {
    setError(null);
    try {
      const filas = parseCSV(csvText);
      if (filas.length === 0) {
        setError("No se pudo leer ninguna fila del archivo.");
        setClasif(null);
        return;
      }
      setClasif(clasificarFilas(filas, recetasVendibles, clasifs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error parseando CSV");
      setClasif(null);
    }
  }

  // Clasifica un ítem del POS (lo guarda y re-clasifica el preview).
  async function reclasificar(
    nombreOriginal: string,
    tipo: TipoItem,
    recetaId?: string,
  ) {
    setError(null);
    try {
      const saved = await upsertClasificacion({ nombreOriginal, tipo, recetaId });
      const nuevos = [
        ...clasifs.filter((c) => c.nombreNorm !== saved.nombreNorm),
        saved,
      ];
      setClasifs(nuevos);
      if (clasif) {
        const filas = clasif.map((c) => c.fila);
        setClasif(clasificarFilas(filas, recetasVendibles, nuevos));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error clasificando");
    }
  }

  async function confirmarImport() {
    if (!clasif || clasif.length === 0) return;
    setError(null);
    setImporting(true);
    try {
      const batch = uid();
      // Se registran TODAS las filas. Los que no son insumo van sin receta
      // (receta_id null) → no descuentan stock, pero sí registran el ingreso.
      const ventasInput = clasif.map((c) => ({
        fecha: iFecha,
        recetaId: c.tipo === "insumo" && c.receta ? c.receta.id : undefined,
        recetaNombre: c.receta?.nombre ?? c.fila.nombre,
        cantidad: c.fila.cantidad,
        precioUnitarioUsd: c.fila.precio,
        totalUsd: c.fila.precio ? c.fila.cantidad * c.fila.precio : undefined,
        fuente: "xetux_csv" as const,
        batchId: batch,
        tipoItem: c.tipo,
      }));
      const created = await createVentasBatch(ventasInput);
      setVentas((prev) => [...created, ...prev]);
      setCsvText("");
      setClasif(null);
      setTab("historial");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error importando");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVenta(id);
      setVentas((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
    }
  }

  const insumoCount = clasif?.filter((c) => c.tipo === "insumo").length ?? 0;
  const noGestCount =
    clasif?.filter((c) => c.tipo === "servicio" || c.tipo === "consignacion")
      .length ?? 0;
  const sinClasCount =
    clasif?.filter((c) => c.tipo === "sin_clasificar").length ?? 0;
  const totalRows = clasif?.length ?? 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "registrar", l: "Registro manual" },
            { v: "importar", l: "Importar Xetux" },
            { v: "historial", l: "Historial" },
          ] as { v: Tab; l: string }[]
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest ring-1 ${
              tab === t.v
                ? "bg-cacao text-white ring-cacao"
                : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* TAB: Registro manual */}
      {tab === "registrar" && (
        <form
          onSubmit={handleRegistroManual}
          className="rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-3"
        >
          <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">
            Registrar venta puntual
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-cacao">
              Fecha
              <input
                type="date"
                value={mFecha}
                onChange={(e) => setMFecha(e.target.value)}
                required
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Receta
              <select
                value={mRecetaId}
                onChange={(e) => setMRecetaId(e.target.value)}
                required
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
              >
                <option value="">— Selecciona —</option>
                {recetas
                  .filter((r) => !r.esSubreceta)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm text-cacao">
              Cantidad vendida
              <input
                type="number"
                step="1"
                min="1"
                value={mCantidad}
                onChange={(e) => setMCantidad(e.target.value)}
                required
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Precio unitario USD (opcional)
              <input
                type="number"
                step="0.01"
                min="0"
                value={mPrecio}
                onChange={(e) => setMPrecio(e.target.value)}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
          </div>
          <div className="text-right">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cacao text-white px-4 py-2 font-medium hover:bg-terracotta disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Registrar venta"}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Importar */}
      {tab === "importar" && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-3">
            <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">
              Importar cierre de Xetux
            </h2>
            <p className="text-xs text-cacao-soft italic font-serif">
              Exporta el cierre diario de Xetux como CSV. Pega el contenido aquí
              o sube el archivo. El sistema busca columnas con encabezados
              tipo <strong>Producto</strong> y <strong>Cantidad</strong>.
            </p>
            <label className="text-sm text-cacao block">
              Fecha de la venta
              <input
                type="date"
                value={iFecha}
                onChange={(e) => setIFecha(e.target.value)}
                className="mt-1 w-full sm:w-48 rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao block">
              Archivo CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const t = reader.result;
                    if (typeof t === "string") setCsvText(t);
                  };
                  reader.readAsText(f, "utf-8");
                }}
                className="mt-1 block text-sm text-cacao-soft"
              />
            </label>
            <label className="text-sm text-cacao block">
              O pega el contenido directo
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                placeholder="Producto,Cantidad,Precio&#10;Latte,15,3.50&#10;Mango Sunrise,8,7.50"
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 font-mono text-xs"
              />
            </label>
            <div className="text-right">
              <button
                type="button"
                onClick={parsear}
                disabled={!csvText.trim()}
                className="rounded-lg bg-cacao text-white px-4 py-2 font-medium hover:bg-terracotta disabled:opacity-50"
              >
                Analizar →
              </button>
            </div>
          </section>

          {clasif && (
            <section className="rounded-2xl bg-white ring-1 ring-marfil p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">
                  Preview · {totalRows} ítems
                </h3>
                <button
                  onClick={confirmarImport}
                  disabled={importing || totalRows === 0}
                  className="rounded-lg bg-cacao text-white px-4 py-2 text-sm font-medium hover:bg-terracotta disabled:opacity-50"
                >
                  {importing ? "Importando..." : "Confirmar import →"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                  {insumoCount} insumo (descuenta stock)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 ring-1 ring-sky-200">
                  {noGestCount} no gestionados (servicio/consignación)
                </span>
                {sinClasCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-300">
                    {sinClasCount} sin clasificar
                  </span>
                )}
              </div>
              {sinClasCount > 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-2 mb-3 font-serif">
                  Hay ítems <strong>sin clasificar</strong>. Se importarán como
                  ingreso pero <strong>sin tocar inventario</strong>. Clasifícalos
                  para que el sistema los recuerde y no queden como alerta.
                </p>
              )}
              <ul className="divide-y divide-marfil text-sm">
                {clasif.map((c, i) => (
                  <li
                    key={i}
                    className={`py-2 grid grid-cols-12 gap-2 items-center ${
                      c.tipo === "sin_clasificar" ? "bg-amber-50/60 -mx-2 px-2 rounded" : ""
                    }`}
                  >
                    <div className="col-span-4 text-cacao">{c.fila.nombre}</div>
                    <div className="col-span-1 text-cacao-soft text-xs">
                      ×{c.fila.cantidad}
                    </div>
                    <div className="col-span-2 text-cacao-soft text-xs">
                      {c.fila.precio ? `$${c.fila.precio.toFixed(2)}` : ""}
                    </div>
                    <div className="col-span-5 flex flex-wrap gap-1 justify-end">
                      {c.tipo === "insumo" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                          → {c.receta?.nombre ?? "insumo"}
                        </span>
                      ) : c.tipo === "servicio" || c.tipo === "consignacion" ? (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 ring-1 ring-sky-200">
                            {c.tipo === "servicio" ? "Servicio" : "Consignación"}
                          </span>
                          <button
                            onClick={() => reclasificar(c.fila.nombre, "sin_clasificar")}
                            className="text-[11px] text-cacao-mute hover:text-terracotta underline"
                          >
                            cambiar
                          </button>
                        </>
                      ) : (
                        <>
                          {c.sugerencia && (
                            <button
                              onClick={() =>
                                reclasificar(c.fila.nombre, "insumo", c.sugerencia!.id)
                              }
                              className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                            >
                              ¿{c.sugerencia.nombre}?
                            </button>
                          )}
                          <button
                            onClick={() => reclasificar(c.fila.nombre, "servicio")}
                            className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-sky-200 text-sky-800 hover:bg-sky-50"
                          >
                            Servicio
                          </button>
                          <button
                            onClick={() => reclasificar(c.fila.nombre, "consignacion")}
                            className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-sky-200 text-sky-800 hover:bg-sky-50"
                          >
                            Consignación
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* TAB: Historial */}
      {tab === "historial" && (
        <div>
          {loading ? (
            <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft">
              Cargando...
            </div>
          ) : ventas.length === 0 ? (
            <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center">
              <p className="font-serif italic text-cacao-soft">
                Sin ventas registradas todavía.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
              <ul className="divide-y divide-marfil">
                {ventas.map((v) => (
                  <li
                    key={v.id}
                    className="p-4 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-cacao flex items-center gap-2 flex-wrap">
                        {v.recetaNombre}
                        {v.tipoItem && v.tipoItem !== "insumo" && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ${
                              v.tipoItem === "sin_clasificar"
                                ? "bg-amber-50 text-amber-800 ring-amber-300"
                                : "bg-sky-50 text-sky-800 ring-sky-200"
                            }`}
                          >
                            {v.tipoItem === "servicio"
                              ? "Servicio"
                              : v.tipoItem === "consignacion"
                                ? "Consignación"
                                : "Sin clasificar"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-cacao-soft mt-0.5">
                        {new Date(v.fecha + "T00:00").toLocaleDateString(
                          "es-VE",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                        {" · "}
                        {v.fuente === "xetux_csv"
                          ? "Importado Xetux"
                          : "Manual"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-cacao font-medium">
                        {v.cantidad}× ·{" "}
                        {v.totalUsd ? `$${v.totalUsd.toFixed(2)}` : ""}
                      </div>
                      <button
                        onClick={() => setPendienteBorrar(v.id)}
                        className="mt-1 text-[10px] uppercase tracking-widest text-cacao-mute hover:text-terracotta"
                      >
                        Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendienteBorrar !== null}
        title="¿Eliminar esta venta?"
        message={<>El stock se va a revertir automáticamente.</>}
        onConfirm={() => {
          if (pendienteBorrar) handleDelete(pendienteBorrar);
          setPendienteBorrar(null);
        }}
        onCancel={() => setPendienteBorrar(null)}
      />
    </div>
  );
}
