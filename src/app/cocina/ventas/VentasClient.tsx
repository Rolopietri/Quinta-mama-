"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Receta,
  Venta,
  PosClasificacion,
  TipoItem,
  Proveedor,
  Insumo,
} from "@/lib/types";
import { listRecetas } from "@/lib/data/recetas";
import { listProveedores, listInsumos } from "@/lib/data/cocina";
import {
  listVentas,
  createVenta,
  createVentasBatch,
  deleteVenta,
  parseCSV,
  clasificarFilas,
  listClasificacion,
  upsertClasificacion,
  deleteClasificacion,
  type ClasificItem,
} from "@/lib/data/ventas";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Tab = "registrar" | "importar" | "clasificacion" | "historial";

export function VentasClient() {
  const [tab, setTab] = useState<Tab>("registrar");
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  /** Ítem del POS que se está mapeando a un insumo directo (modal). */
  const [insumoDirectoItem, setInsumoDirectoItem] = useState<string | null>(
    null,
  );
  const [idInsumoSel, setIdInsumoSel] = useState("");
  const [idCantidad, setIdCantidad] = useState("1");
  const [idBuscar, setIdBuscar] = useState("");
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
        const [r, v, c, p, ins] = await Promise.all([
          listRecetas(),
          listVentas(50),
          listClasificacion(),
          listProveedores(),
          listInsumos(),
        ]);
        if (!cancelled) {
          setRecetas(r);
          setVentas(v);
          setClasifs(c);
          setProveedores(p);
          setInsumos(ins);
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
      setClasif(clasificarFilas(filas, recetasVendibles, clasifs, insumos));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error parseando CSV");
      setClasif(null);
    }
  }

  // Clasifica un ítem del POS (lo guarda y re-clasifica el preview).
  async function reclasificar(
    nombreOriginal: string,
    tipo: TipoItem,
    opts?: { recetaId?: string; insumoId?: string; cantidadPorUnidad?: number },
  ) {
    setError(null);
    try {
      const saved = await upsertClasificacion({
        nombreOriginal,
        tipo,
        recetaId: opts?.recetaId,
        insumoId: opts?.insumoId,
        cantidadPorUnidad: opts?.cantidadPorUnidad,
      });
      const nuevos = [
        ...clasifs.filter((c) => c.nombreNorm !== saved.nombreNorm),
        saved,
      ];
      setClasifs(nuevos);
      if (clasif) {
        const filas = clasif.map((c) => c.fila);
        setClasif(clasificarFilas(filas, recetasVendibles, nuevos, insumos));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error clasificando");
    }
  }

  // Guarda/actualiza una clasificación del catálogo (con todos sus campos).
  async function saveClasif(
    nombreOriginal: string,
    next: {
      tipo: TipoItem;
      recetaId?: string;
      insumoId?: string;
      cantidadPorUnidad?: number;
      proveedorId?: string;
      porcentajeAcuerdo?: number;
    },
  ) {
    setError(null);
    try {
      const saved = await upsertClasificacion({ nombreOriginal, ...next });
      setClasifs((prev) => {
        const rest = prev.filter((c) => c.nombreNorm !== saved.nombreNorm);
        return [...rest, saved].sort((a, b) =>
          a.nombreOriginal.localeCompare(b.nombreOriginal),
        );
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    }
  }

  function abrirInsumoDirecto(nombre: string) {
    setIdInsumoSel("");
    setIdCantidad("1");
    setIdBuscar("");
    setInsumoDirectoItem(nombre);
  }

  async function confirmarInsumoDirecto() {
    if (!insumoDirectoItem || !idInsumoSel) return;
    const cant = Number(idCantidad);
    await reclasificar(insumoDirectoItem, "insumo_directo", {
      insumoId: idInsumoSel,
      cantidadPorUnidad: Number.isFinite(cant) && cant > 0 ? cant : 1,
    });
    setInsumoDirectoItem(null);
  }

  async function removeClasif(id: string) {
    setError(null);
    try {
      await deleteClasificacion(id);
      setClasifs((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
    }
  }

  const clasifsOrdenadas = useMemo(
    () =>
      [...clasifs].sort((a, b) =>
        a.nombreOriginal.localeCompare(b.nombreOriginal),
      ),
    [clasifs],
  );

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
        recetaNombre: c.receta?.nombre ?? c.insumo?.nombre ?? c.fila.nombre,
        cantidad: c.fila.cantidad,
        precioUnitarioUsd: c.fila.precio,
        totalUsd: c.fila.precio ? c.fila.cantidad * c.fila.precio : undefined,
        fuente: "xetux_csv" as const,
        batchId: batch,
        tipoItem: c.tipo,
        insumoId:
          c.tipo === "insumo_directo" && c.insumo ? c.insumo.id : undefined,
        insumoCantidad:
          c.tipo === "insumo_directo"
            ? (c.clasif?.cantidadPorUnidad ?? 1)
            : undefined,
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

  const insumoCount =
    clasif?.filter(
      (c) => c.tipo === "insumo" || c.tipo === "insumo_directo",
    ).length ?? 0;
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
            { v: "clasificacion", l: "Clasificación POS" },
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
                    <div className="col-span-5 flex flex-wrap gap-1 justify-end items-center">
                      {c.tipo === "insumo" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                          → {c.receta?.nombre ?? "insumo"}
                        </span>
                      ) : c.tipo === "insumo_directo" ? (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                            → {c.insumo?.nombre ?? "insumo"} (directo)
                          </span>
                          <button
                            onClick={() => reclasificar(c.fila.nombre, "sin_clasificar")}
                            className="text-[11px] text-cacao-mute hover:text-terracotta underline"
                          >
                            cambiar
                          </button>
                        </>
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
                                reclasificar(c.fila.nombre, "insumo", {
                                  recetaId: c.sugerencia!.id,
                                })
                              }
                              className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                            >
                              ¿{c.sugerencia.nombre}?
                            </button>
                          )}
                          <button
                            onClick={() => abrirInsumoDirecto(c.fila.nombre)}
                            className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-emerald-200 text-emerald-800 hover:bg-emerald-50"
                          >
                            Insumo directo
                          </button>
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

      {/* TAB: Clasificación POS */}
      {tab === "clasificacion" && (
        <section className="rounded-2xl bg-white ring-1 ring-marfil p-5">
          <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute mb-1">
            Clasificación de ítems del POS
          </h2>
          <p className="text-xs text-cacao-soft italic font-serif mb-4">
            Administra cómo se trata cada ítem del reporte: si descuenta
            inventario (insumo) o si es servicio/consignación (solo registra
            ingreso). En consignación puedes guardar el proveedor y el % de
            acuerdo para futuras liquidaciones.
          </p>
          {clasifsOrdenadas.length === 0 ? (
            <p className="font-serif italic text-cacao-soft text-sm">
              Todavía no hay ítems clasificados. Se crean al importar un cierre
              de Xetux (clasificando los que salen en ámbar).
            </p>
          ) : (
            <ul className="divide-y divide-marfil">
              {clasifsOrdenadas.map((c) => (
                <li
                  key={c.id}
                  className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center"
                >
                  <div className="sm:col-span-4 text-sm text-cacao font-medium">
                    {c.nombreOriginal}
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      value={c.tipo}
                      onChange={(e) => {
                        const t = e.target.value as TipoItem;
                        saveClasif(c.nombreOriginal, {
                          tipo: t,
                          recetaId: t === "insumo" ? c.recetaId : undefined,
                          insumoId:
                            t === "insumo_directo" ? c.insumoId : undefined,
                          cantidadPorUnidad:
                            t === "insumo_directo"
                              ? (c.cantidadPorUnidad ?? 1)
                              : undefined,
                          proveedorId:
                            t === "consignacion" ? c.proveedorId : undefined,
                          porcentajeAcuerdo:
                            t === "consignacion"
                              ? c.porcentajeAcuerdo
                              : undefined,
                        });
                      }}
                      className="w-full rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="insumo">Insumo (receta)</option>
                      <option value="insumo_directo">Insumo directo</option>
                      <option value="servicio">Servicio</option>
                      <option value="consignacion">Consignación</option>
                      <option value="sin_clasificar">Sin clasificar</option>
                    </select>
                  </div>
                  <div className="sm:col-span-5">
                    {c.tipo === "insumo" ? (
                      <select
                        value={c.recetaId ?? ""}
                        onChange={(e) =>
                          saveClasif(c.nombreOriginal, {
                            tipo: "insumo",
                            recetaId: e.target.value || undefined,
                          })
                        }
                        className="w-full rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">— Vincular receta —</option>
                        {recetasVendibles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    ) : c.tipo === "insumo_directo" ? (
                      <div className="flex gap-2">
                        <select
                          value={c.insumoId ?? ""}
                          onChange={(e) =>
                            saveClasif(c.nombreOriginal, {
                              tipo: "insumo_directo",
                              insumoId: e.target.value || undefined,
                              cantidadPorUnidad: c.cantidadPorUnidad ?? 1,
                            })
                          }
                          className="flex-1 rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white"
                        >
                          <option value="">— Vincular insumo —</option>
                          {insumos
                            .filter((i) => i.activo)
                            .map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre}
                              </option>
                            ))}
                        </select>
                        <div className="flex items-center rounded-lg ring-1 ring-marfil px-2 w-24">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            defaultValue={c.cantidadPorUnidad ?? 1}
                            title="Cantidad por unidad vendida"
                            onBlur={(e) =>
                              saveClasif(c.nombreOriginal, {
                                tipo: "insumo_directo",
                                insumoId: c.insumoId,
                                cantidadPorUnidad:
                                  e.target.value === ""
                                    ? 1
                                    : Number(e.target.value),
                              })
                            }
                            className="w-full py-1.5 text-sm outline-none bg-transparent"
                          />
                          <span className="text-[10px] text-cacao-mute">/u</span>
                        </div>
                      </div>
                    ) : c.tipo === "consignacion" ? (
                      <div className="flex gap-2">
                        <select
                          value={c.proveedorId ?? ""}
                          onChange={(e) =>
                            saveClasif(c.nombreOriginal, {
                              tipo: "consignacion",
                              proveedorId: e.target.value || undefined,
                              porcentajeAcuerdo: c.porcentajeAcuerdo,
                            })
                          }
                          className="flex-1 rounded-lg ring-1 ring-marfil px-2 py-1.5 text-sm bg-white"
                        >
                          <option value="">— Proveedor —</option>
                          {proveedores.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center rounded-lg ring-1 ring-marfil px-2 w-24">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            defaultValue={c.porcentajeAcuerdo ?? ""}
                            placeholder="%"
                            onBlur={(e) =>
                              saveClasif(c.nombreOriginal, {
                                tipo: "consignacion",
                                proveedorId: c.proveedorId,
                                porcentajeAcuerdo:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              })
                            }
                            className="w-full py-1.5 text-sm outline-none bg-transparent"
                          />
                          <span className="text-xs text-cacao-mute">%</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-cacao-soft italic">
                        Solo registra ingreso, no toca inventario.
                      </span>
                    )}
                  </div>
                  <div className="sm:col-span-1 text-right">
                    <button
                      onClick={() => removeClasif(c.id)}
                      className="text-[10px] uppercase tracking-widest text-cacao-mute hover:text-terracotta"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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

      {/* Modal: mapear ítem del POS a un insumo directo */}
      {insumoDirectoItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-cacao/40 backdrop-blur-sm overflow-y-auto"
          onClick={() => setInsumoDirectoItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-8 rounded-2xl bg-white ring-1 ring-marfil p-6 max-w-md w-full shadow-xl"
          >
            <h2 className="font-cinzel text-xl tracking-[0.08em] text-cacao">
              Insumo directo
            </h2>
            <p className="mt-1 text-sm text-cacao-soft font-serif">
              Vincula{" "}
              <strong className="text-cacao">{insumoDirectoItem}</strong> a un
              insumo del inventario. Al venderlo, descuenta esa cantidad del
              insumo (ideal para bebidas y reventa, sin crear receta).
            </p>

            <label className="block mt-4 text-sm text-cacao">
              Buscar insumo
              <input
                type="text"
                value={idBuscar}
                onChange={(e) => setIdBuscar(e.target.value)}
                placeholder="Ej. Pepsi, Agua…"
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>

            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg ring-1 ring-marfil divide-y divide-marfil">
              {insumos
                .filter(
                  (i) =>
                    i.activo &&
                    (idBuscar.trim() === "" ||
                      i.nombre
                        .toLowerCase()
                        .includes(idBuscar.toLowerCase())),
                )
                .slice(0, 60)
                .map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setIdInsumoSel(i.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-marfil-soft ${
                      idInsumoSel === i.id
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-cacao"
                    }`}
                  >
                    {i.nombre}
                    <span className="text-cacao-mute text-xs">
                      {" "}
                      · {i.unidadBase}
                    </span>
                  </button>
                ))}
            </div>

            <label className="block mt-4 text-sm text-cacao">
              Cantidad a descontar por unidad vendida
              <input
                type="number"
                step="any"
                min="0"
                value={idCantidad}
                onChange={(e) => setIdCantidad(e.target.value)}
                className="mt-1 w-32 rounded-lg ring-1 ring-marfil px-3 py-2"
              />
              <span className="block text-[11px] text-cacao-mute mt-1">
                Normalmente 1 (una venta = una unidad del insumo).
              </span>
            </label>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setInsumoDirectoItem(null)}
                className="rounded-xl ring-1 ring-marfil px-4 py-2 text-cacao hover:bg-marfil-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarInsumoDirecto}
                disabled={!idInsumoSel}
                className="rounded-xl bg-cacao text-white px-4 py-2 font-medium hover:bg-terracotta disabled:opacity-50"
              >
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
