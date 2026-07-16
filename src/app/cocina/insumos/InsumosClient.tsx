"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS_INSUMO_SUGERIDAS,
  categoriaInsumoLabel,
  SECCIONES,
  type Insumo,
  type Seccion,
  type Proveedor,
} from "@/lib/types";
import {
  listInsumos,
  createInsumo,
  updateInsumo,
  deleteInsumo,
  listProveedores,
} from "@/lib/data/cocina";
import { UnitCalculator } from "@/components/UnitCalculator";
import { UnidadInput } from "@/components/UnidadInput";
import {
  convert,
  areCompatible,
  canonica,
  displayCantidad,
} from "@/lib/units";
import { stockLibre } from "@/lib/types";
import { normalizarBusqueda } from "@/lib/text";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Cuántas unidadBase hay en 1 unidadCompra cuando son convertibles.
 * Ej: ratioEsperado("kg", "g") = 1000.
 * Devuelve null si no son convertibles (ej unidadCompra="saco").
 */
function ratioEsperado(
  unidadCompra: string,
  unidadBase: string,
): number | null {
  if (!unidadCompra || !unidadBase) return null;
  if (!areCompatible(unidadCompra, unidadBase)) return null;
  return convert(1, unidadCompra, unidadBase);
}

/**
 * Detecta si el insumo tiene cantidadPorCompra incoherente con sus unidades.
 * Ej: unidadCompra="kg", unidadBase="g", pero cantidadPorCompra=1 → el precio
 * sale 1000× más alto de lo real. Devolvemos el ratio esperado para sugerir
 * el fix.
 */
function detectarInsumoConProblema(
  unidadCompra: string,
  unidadBase: string,
  cantidadPorCompra: number,
): { esperado: number } | null {
  const esperado = ratioEsperado(unidadCompra, unidadBase);
  if (esperado === null) return null;
  // Tolerancia 1% para evitar falsos positivos por redondeo
  const diff = Math.abs(cantidadPorCompra - esperado) / esperado;
  if (diff < 0.01) return null;
  return { esperado };
}

type FormState = {
  nombre: string;
  categoria: string;
  seccion: Seccion;
  unidadCompra: string;
  cantidadPorCompra: string;
  unidadBase: string;
  precioCompraUsd: string;
  stockTotal: string;
  stockMinimo: string;
  mermaCoccionPorc: string;
  proveedorId: string;
  notas: string;
};

const emptyForm: FormState = {
  nombre: "",
  categoria: "Otros",
  seccion: "ambos",
  unidadCompra: "",
  cantidadPorCompra: "1",
  unidadBase: "",
  precioCompraUsd: "",
  stockTotal: "0",
  stockMinimo: "",
  mermaCoccionPorc: "",
  proveedorId: "",
  notas: "",
};

export function InsumosClient() {
  const [items, setItems] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [filterSec, setFilterSec] = useState<Seccion | "todas">("todas");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  // true cuando el usuario eligió "➕ Nueva categoría…" en el desplegable.
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [pendienteBorrar, setPendienteBorrar] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ins, prov] = await Promise.all([
          listInsumos(),
          listProveedores(),
        ]);
        if (!cancelled) {
          setItems(ins);
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

  function resetForm() {
    setForm({ ...emptyForm });
    setCreandoCategoria(false);
    setEditingId(null);
    setAdding(false);
  }

  function startEdit(ins: Insumo) {
    setEditingId(ins.id);
    setCreandoCategoria(false);
    setForm({
      nombre: ins.nombre,
      categoria: ins.categoria,
      seccion: ins.seccion,
      unidadCompra: ins.unidadCompra,
      cantidadPorCompra: String(ins.cantidadPorCompra),
      unidadBase: ins.unidadBase,
      precioCompraUsd: ins.precioCompraUsd?.toString() ?? "",
      stockTotal: String(ins.stockTotal),
      stockMinimo: ins.stockMinimo?.toString() ?? "",
      mermaCoccionPorc: ins.mermaCoccionPorc?.toString() ?? "",
      proveedorId: ins.proveedorId ?? "",
      notas: ins.notas ?? "",
    });
    setAdding(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setError(null);
    const cantPC = Number(form.cantidadPorCompra) || 1;
    const precioC = form.precioCompraUsd === "" ? null : Number(form.precioCompraUsd);
    const precioB = precioC === null ? null : cantPC > 0 ? precioC / cantPC : precioC;

    const input = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || "Otros",
      seccion: form.seccion,
      unidadCompra: form.unidadCompra.trim() || "unidad",
      cantidadPorCompra: cantPC,
      unidadBase: form.unidadBase.trim() || "unidad",
      precioCompraUsd: precioC,
      precioBaseUsd: precioB,
      stockTotal: Number(form.stockTotal) || 0,
      // OJO: NO incluir stockComprometido acá. Es manejado por el sistema
      // (planes de producción) y al editar pisaría las reservas a cero. En
      // creación se setea 0 explícitamente abajo.
      stockMinimo: form.stockMinimo === "" ? null : Number(form.stockMinimo),
      mermaCoccionPorc:
        form.mermaCoccionPorc === "" ? null : Number(form.mermaCoccionPorc),
      proveedorId: form.proveedorId || undefined,
      notas: form.notas.trim() || undefined,
      activo: true,
    };
    try {
      // Guardamos el id del item que se va a editar/crear para hacer scroll
      // hacia él después de cerrar el form. Así el usuario no pierde el lugar
      // de la lista donde estaba trabajando.
      let scrollToId: string | null = null;
      if (editingId) {
        const upd = await updateInsumo(editingId, input);
        setItems((prev) => prev.map((x) => (x.id === editingId ? upd : x)));
        scrollToId = editingId;
      } else {
        const nuevo = await createInsumo({ ...input, stockComprometido: 0 });
        setItems((prev) => [...prev, nuevo]);
        scrollToId = nuevo.id;
      }
      resetForm();
      // Scroll al item recién editado/creado en el próximo tick, después del
      // re-render. Usamos requestAnimationFrame para asegurarnos que el DOM
      // ya tiene el data-id actualizado.
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-insumo-id="${scrollToId}"]`,
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Highlight breve para que el usuario sepa cuál guardó
          el.classList.add("ring-2", "ring-terracotta");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-terracotta");
          }, 1500);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteInsumo(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
    }
  }

  const filtered = useMemo(() => {
    const q = normalizarBusqueda(search.trim());
    return items.filter(
      (i) =>
        (filterCat === "todas" || i.categoria === filterCat) &&
        (filterSec === "todas" ||
          i.seccion === filterSec ||
          i.seccion === "ambos") &&
        (q === "" || normalizarBusqueda(i.nombre).includes(q)),
    );
  }, [items, filterCat, filterSec, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Insumo[]>();
    filtered.forEach((i) => {
      if (!map.has(i.categoria)) map.set(i.categoria, []);
      map.get(i.categoria)!.push(i);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Categorías que YA existen en el catálogo (para los pills de filtro).
  const categoriasReales = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.categoria && set.add(i.categoria));
    return Array.from(set).sort((a, b) =>
      categoriaInsumoLabel(a).localeCompare(categoriaInsumoLabel(b)),
    );
  }, [items]);

  // Categorías sugeridas para el formulario: las existentes + las predefinidas.
  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>(categoriasReales);
    CATEGORIAS_INSUMO_SUGERIDAS.forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) =>
      categoriaInsumoLabel(a).localeCompare(categoriaInsumoLabel(b)),
    );
  }, [categoriasReales]);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">
          {error}
        </div>
      )}

      <UnitCalculator className="mb-5" />

      {/* Buscador */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Buscar insumo por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg ring-1 ring-marfil px-3 py-2"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
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

      <div className="flex flex-wrap gap-2 mb-5">
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
        {categoriasReales.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-widest ring-1 ${
              filterCat === c
                ? "bg-cacao text-white ring-cacao"
                : "bg-white text-cacao-soft ring-marfil hover:bg-marfil-soft"
            }`}
          >
            {categoriaInsumoLabel(c)}
          </button>
        ))}
      </div>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full mb-5 rounded-xl bg-cacao text-white py-3 font-medium hover:bg-terracotta transition-colors"
        >
          + Nuevo insumo
        </button>
      )}

      {adding && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-3"
        >
          <h2 className="font-display text-sm tracking-[0.2em] uppercase text-cacao">
            {editingId ? "Editar insumo" : "Nuevo insumo"}
          </h2>
          <input
            type="text"
            placeholder="Nombre del insumo (ej: Café en grano)"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            autoFocus
            required
            className="w-full rounded-lg ring-1 ring-marfil px-3 py-2"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-cacao">
              Categoría
              <select
                value={creandoCategoria ? "__nueva__" : form.categoria}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__nueva__") {
                    setCreandoCategoria(true);
                    setForm({ ...form, categoria: "" });
                  } else {
                    setCreandoCategoria(false);
                    setForm({ ...form, categoria: v });
                  }
                }}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
              >
                {categoriasDisponibles.map((c) => (
                  <option key={c} value={c}>
                    {categoriaInsumoLabel(c)}
                  </option>
                ))}
                <option value="__nueva__">➕ Nueva categoría…</option>
              </select>
              {creandoCategoria && (
                <input
                  type="text"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                  placeholder="Nombre de la categoría nueva"
                  autoFocus
                  autoCapitalize="words"
                  spellCheck={false}
                  className="mt-2 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
                />
              )}
            </label>
            <label className="text-sm text-cacao">
              Sección
              <select
                value={form.seccion}
                onChange={(e) =>
                  setForm({ ...form, seccion: e.target.value as Seccion })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
              >
                {SECCIONES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-cacao">
              Proveedor
              <select
                value={form.proveedorId}
                onChange={(e) =>
                  setForm({ ...form, proveedorId: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
              >
                <option value="">— Ninguno —</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-cacao">
              Unidad de compra (ej: kg, paq 12 unid)
              <UnidadInput
                value={form.unidadCompra}
                onChange={(v) => {
                  // Si las unidades nuevas son convertibles y la cantidad actual
                  // sigue siendo el default (1) o vacía, autocompletamos el ratio.
                  const nuevoRatio = ratioEsperado(v, form.unidadBase);
                  const cantActual = Number(form.cantidadPorCompra);
                  const debeAutocompletar =
                    nuevoRatio !== null &&
                    (form.cantidadPorCompra === "" ||
                      form.cantidadPorCompra === "1" ||
                      !Number.isFinite(cantActual));
                  setForm({
                    ...form,
                    unidadCompra: v,
                    cantidadPorCompra: debeAutocompletar
                      ? String(nuevoRatio)
                      : form.cantidadPorCompra,
                  });
                }}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Cantidad por compra (en unidad base)
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.cantidadPorCompra}
                onChange={(e) =>
                  setForm({ ...form, cantidadPorCompra: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Unidad base (ej: g, ml, unidad)
              <UnidadInput
                value={form.unidadBase}
                onChange={(v) => {
                  const nuevoRatio = ratioEsperado(form.unidadCompra, v);
                  const cantActual = Number(form.cantidadPorCompra);
                  const debeAutocompletar =
                    nuevoRatio !== null &&
                    (form.cantidadPorCompra === "" ||
                      form.cantidadPorCompra === "1" ||
                      !Number.isFinite(cantActual));
                  setForm({
                    ...form,
                    unidadBase: v,
                    cantidadPorCompra: debeAutocompletar
                      ? String(nuevoRatio)
                      : form.cantidadPorCompra,
                  });
                }}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
          </div>

          {/* Hint visual: relación entre unidad de compra y unidad base */}
          <UnidadesHint
            unidadCompra={form.unidadCompra}
            unidadBase={form.unidadBase}
            cantidadPorCompra={form.cantidadPorCompra}
            onAplicarRatio={(r) =>
              setForm({ ...form, cantidadPorCompra: String(r) })
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-cacao">
              Precio del empaque (USD)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precioCompraUsd}
                onChange={(e) =>
                  setForm({ ...form, precioCompraUsd: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Stock total (físico, en unidad base)
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.stockTotal}
                onChange={(e) =>
                  setForm({ ...form, stockTotal: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
              <span className="text-[10px] text-cacao-mute block mt-1">
                Lo que hay físicamente. El stock libre (= total − comprometido)
                aparece en el listado.
              </span>
            </label>
            <label className="text-sm text-cacao">
              Stock mínimo (alerta si baja)
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.stockMinimo}
                onChange={(e) =>
                  setForm({ ...form, stockMinimo: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Merma por cocción (%)
              <input
                type="number"
                step="1"
                min="0"
                max="99"
                placeholder="Ej. 70 (opcional)"
                value={form.mermaCoccionPorc}
                onChange={(e) =>
                  setForm({ ...form, mermaCoccionPorc: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
              <span className="text-[10px] text-cacao-mute block mt-1">
                % de peso que pierde al cocinarse. Permite registrar pérdidas
                pesando el producto ya cocido (ej. tocineta ≈ 70%).
              </span>
            </label>
          </div>
          <textarea
            placeholder="Notas (opcional)"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={2}
            className="w-full rounded-lg ring-1 ring-marfil px-3 py-2"
          />
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-cacao text-white py-2 font-medium hover:bg-terracotta"
            >
              {editingId ? "Guardar cambios" : "Crear insumo"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg ring-1 ring-marfil px-4 py-2 text-cacao hover:bg-marfil-soft"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft">
          Cargando catálogo...
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft">
          No hay insumos en esta vista.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, ins]) => (
            <section
              key={cat}
              className="rounded-2xl bg-white ring-1 ring-marfil p-5"
            >
              <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute mb-3">
                {categoriaInsumoLabel(cat)}
              </h2>
              <ul className="divide-y divide-marfil">
                {ins.map((i) => {
                  // El badge "bajo" compara contra stockLibre, no contra stockTotal
                  // (es lo que realmente está disponible para producir).
                  const libre = stockLibre(i);
                  const lowStock =
                    i.stockMinimo !== null &&
                    i.stockMinimo > 0 &&
                    libre < i.stockMinimo;
                  // Detección automática de problema de unidades
                  const problemaUnidades = detectarInsumoConProblema(
                    i.unidadCompra,
                    i.unidadBase,
                    i.cantidadPorCompra,
                  );
                  return (
                    <li
                      key={i.id}
                      data-insumo-id={i.id}
                      className="py-3 grid grid-cols-12 gap-2 items-start rounded-lg transition-shadow"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <div className="text-cacao font-medium">
                          {i.nombre}
                          {lowStock && (
                            <span className="ml-2 text-[10px] uppercase tracking-widest text-terracotta">
                              · stock bajo
                            </span>
                          )}
                          {problemaUnidades && (
                            <button
                              type="button"
                              onClick={() => startEdit(i)}
                              title={`Revisar unidades: 1 ${canonica(i.unidadCompra)} debería ser ${formatN(problemaUnidades.esperado)} ${canonica(i.unidadBase)} (tiene ${formatN(i.cantidadPorCompra)})`}
                              className="ml-2 text-[10px] uppercase tracking-widest text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100"
                            >
                              ⚠ revisar unidades
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-cacao-mute mt-0.5">
                          {i.unidadCompra} · {i.cantidadPorCompra}{" "}
                          {i.unidadBase}
                          {" · "}
                          <span className="capitalize">{i.seccion}</span>
                        </div>
                      </div>
                      <div className="col-span-4 sm:col-span-3">
                        <div className="text-xs text-cacao-mute uppercase tracking-widest">
                          Precio
                        </div>
                        <div className="text-sm text-cacao">
                          {i.precioCompraUsd !== null
                            ? `$${i.precioCompraUsd.toFixed(2)} / ${i.unidadCompra}`
                            : "—"}
                        </div>
                        {i.precioBaseUsd !== null && (
                          <div className="text-xs text-cacao-soft">
                            ${i.precioBaseUsd.toFixed(5)} / {i.unidadBase}
                          </div>
                        )}
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <div className="text-xs text-cacao-mute uppercase tracking-widest">
                          Stock libre
                        </div>
                        <div
                          className={`text-sm ${lowStock ? "text-terracotta font-medium" : "text-cacao"}`}
                        >
                          {displayCantidad(libre, i.unidadBase)}
                        </div>
                        <div className="text-[10px] text-cacao-mute">
                          {displayCantidad(i.stockTotal, i.unidadBase)} total
                          {i.stockComprometido > 0 && (
                            <> · {displayCantidad(i.stockComprometido, i.unidadBase)} comp.</>
                          )}
                        </div>
                        {i.stockMinimo !== null && i.stockMinimo > 0 && (
                          <div className="text-[10px] text-cacao-mute">
                            min: {i.stockMinimo}
                          </div>
                        )}
                      </div>
                      <div className="col-span-4 sm:col-span-2 flex sm:justify-end gap-3 text-xs uppercase tracking-widest">
                        <button
                          onClick={() => startEdit(i)}
                          className="text-cacao-soft hover:text-cacao"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setPendienteBorrar(i.id)}
                          className="text-cacao-soft hover:text-terracotta"
                        >
                          Borrar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendienteBorrar !== null}
        title="¿Eliminar insumo?"
        message={<>¿Eliminar este insumo del catálogo?</>}
        onConfirm={() => {
          if (pendienteBorrar) handleDelete(pendienteBorrar);
          setPendienteBorrar(null);
        }}
        onCancel={() => setPendienteBorrar(null)}
      />
    </div>
  );
}

/**
 * Hint contextual debajo de la fila de unidades. Tres estados:
 *  • Verde:   la cantidad por compra coincide con la conversión esperada.
 *  • Amarillo: las unidades son convertibles pero la cantidad NO coincide
 *              — muestra el valor sugerido con botón "Aplicar".
 *  • Gris:    unidades no convertibles (ej "saco" o "g"+"g") — solo info.
 *  • Oculto:  ambas unidades vacías.
 */
function UnidadesHint({
  unidadCompra,
  unidadBase,
  cantidadPorCompra,
  onAplicarRatio,
}: {
  unidadCompra: string;
  unidadBase: string;
  cantidadPorCompra: string;
  onAplicarRatio: (ratio: number) => void;
}) {
  if (!unidadCompra && !unidadBase) return null;
  const esperado = ratioEsperado(unidadCompra, unidadBase);
  const cant = Number(cantidadPorCompra);
  const uc = canonica(unidadCompra);
  const ub = canonica(unidadBase);

  if (esperado === null) {
    // Unidades no convertibles automáticamente — explicación neutra
    return (
      <div className="mt-2 text-xs text-cacao-soft font-serif italic">
        Tip: &ldquo;Cantidad por compra&rdquo; es cuántas {ub || "unidades base"}{" "}
        hay en 1 {uc || "unidad de compra"}.
      </div>
    );
  }

  const problema = Number.isFinite(cant)
    ? detectarInsumoConProblema(unidadCompra, unidadBase, cant)
    : null;

  if (problema) {
    return (
      <div className="mt-2 rounded-lg ring-1 ring-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start justify-between gap-3">
        <span>
          ⚠ <strong>Revisar:</strong> 1 {uc} = {formatN(esperado)} {ub}, así
          que la cantidad por compra debería ser{" "}
          <strong>{formatN(esperado)}</strong> (tienes{" "}
          <strong>{formatN(cant)}</strong>). Si no lo corriges, el precio por{" "}
          {ub} sale{" "}
          {(esperado / Math.max(cant, 0.0001)).toFixed(0)}× más alto/bajo de lo
          real.
        </span>
        <button
          type="button"
          onClick={() => onAplicarRatio(esperado)}
          className="shrink-0 rounded-lg bg-amber-900 text-white px-3 py-1 text-[10px] uppercase tracking-widest hover:bg-amber-950"
        >
          Aplicar {formatN(esperado)}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg ring-1 ring-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
      ✓ 1 {uc} = {formatN(esperado)} {ub} — cantidad por compra correcta.
    </div>
  );
}

function formatN(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(/\.?0+$/, "");
}
