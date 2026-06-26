"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MODALIDADES_PAGO,
  type Compra,
  type Insumo,
  type Proveedor,
  type TasaBcv,
  type ModalidadPago,
} from "@/lib/types";
import {
  listCompras,
  createCompra,
  deleteCompra,
  listInsumos,
  listProveedores,
  getTasaBcvActual,
} from "@/lib/data/cocina";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type FormState = {
  insumoId: string;
  proveedorId: string;
  fecha: string;
  cantidad: string;
  modalidadPago: ModalidadPago;
  precioTotalUsd: string;
  precioTotalBs: string;
  tasaBcvUsada: string;
  notas: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: FormState = {
  insumoId: "",
  proveedorId: "",
  fecha: todayISO(),
  cantidad: "1",
  modalidadPago: "divisa",
  precioTotalUsd: "",
  precioTotalBs: "",
  tasaBcvUsada: "",
  notas: "",
};

export function ComprasClient() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tasa, setTasa] = useState<TasaBcv | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [pendienteBorrar, setPendienteBorrar] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, ins, prov, t] = await Promise.all([
          listCompras(),
          listInsumos(),
          listProveedores(),
          getTasaBcvActual(),
        ]);
        if (!cancelled) {
          setCompras(c);
          setInsumos(ins);
          setProveedores(prov);
          setTasa(t);
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
    setForm({ ...emptyForm, fecha: todayISO() });
    setAdding(false);
  }

  const insumoSeleccionado = useMemo(
    () => insumos.find((i) => i.id === form.insumoId),
    [insumos, form.insumoId],
  );

  const pagaEnBs = useMemo(
    () =>
      form.modalidadPago === "bcv_dolar" ||
      form.modalidadPago === "bcv_euro" ||
      form.modalidadPago === "paralela",
    [form.modalidadPago],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.insumoId || !form.fecha || !form.cantidad) return;
    setError(null);

    let precioUsd = Number(form.precioTotalUsd) || 0;
    let precioBs: number | undefined;
    let tasaUsada: number | undefined;

    if (pagaEnBs) {
      precioBs = Number(form.precioTotalBs) || 0;
      tasaUsada = Number(form.tasaBcvUsada) || 0;
      if (precioBs > 0 && tasaUsada > 0) {
        precioUsd = precioBs / tasaUsada;
      }
    }

    const input = {
      insumoId: form.insumoId,
      proveedorId: form.proveedorId || undefined,
      fecha: form.fecha,
      cantidad: Number(form.cantidad),
      precioTotalUsd: precioUsd,
      precioTotalBs: precioBs,
      tasaBcvUsada: tasaUsada,
      modalidadPago: form.modalidadPago,
      notas: form.notas.trim() || undefined,
    };
    try {
      const nueva = await createCompra(input);
      setCompras((prev) => [nueva, ...prev]);
      // Recargar insumos para reflejar nuevo stock y precio
      const fresh = await listInsumos();
      setInsumos(fresh);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCompra(id);
      setCompras((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
    }
  }

  // Auto-rellenar tasa cuando cambia modalidad
  function setModalidad(m: ModalidadPago) {
    setForm((prev) => {
      let tasaDef = prev.tasaBcvUsada;
      if (m === "bcv_dolar" && tasa) tasaDef = String(tasa.usdBs);
      else if (m === "bcv_euro" && tasa?.eurBs) tasaDef = String(tasa.eurBs);
      else if (m === "paralela" && tasa?.paralelaBs)
        tasaDef = String(tasa.paralelaBs);
      else if (m === "efectivo" || m === "divisa") tasaDef = "";
      return { ...prev, modalidadPago: m, tasaBcvUsada: tasaDef };
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">
          {error}
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full mb-5 rounded-xl bg-cacao text-white py-3 font-medium hover:bg-terracotta transition-colors"
        >
          + Registrar nueva compra
        </button>
      )}

      {adding && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-3"
        >
          <h2 className="font-display text-sm tracking-[0.2em] uppercase text-cacao">
            Nueva compra
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-cacao">
              Insumo
              <select
                required
                value={form.insumoId}
                onChange={(e) =>
                  setForm({ ...form, insumoId: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
              >
                <option value="">— Selecciona insumo —</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidadCompra})
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-cacao">
              Fecha
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
            <label className="text-sm text-cacao">
              Cantidad{" "}
              {insumoSeleccionado && (
                <span className="text-xs text-cacao-mute">
                  (en {insumoSeleccionado.unidadCompra})
                </span>
              )}
              <input
                type="number"
                step="0.0001"
                min="0"
                required
                value={form.cantidad}
                onChange={(e) =>
                  setForm({ ...form, cantidad: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
          </div>

          <label className="text-sm text-cacao block">
            Modalidad de pago
            <select
              value={form.modalidadPago}
              onChange={(e) => setModalidad(e.target.value as ModalidadPago)}
              className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 bg-white"
            >
              {MODALIDADES_PAGO.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {pagaEnBs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-cacao">
                Monto en Bs
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.precioTotalBs}
                  onChange={(e) =>
                    setForm({ ...form, precioTotalBs: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
                />
              </label>
              <label className="text-sm text-cacao">
                Tasa usada
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  value={form.tasaBcvUsada}
                  onChange={(e) =>
                    setForm({ ...form, tasaBcvUsada: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
                />
                <span className="text-xs text-cacao-mute block mt-1">
                  Equivalente USD:{" "}
                  <span className="text-cacao font-medium">
                    $
                    {form.precioTotalBs && form.tasaBcvUsada
                      ? (
                          Number(form.precioTotalBs) /
                          Number(form.tasaBcvUsada)
                        ).toFixed(2)
                      : "0.00"}
                  </span>
                </span>
              </label>
            </div>
          ) : (
            <label className="text-sm text-cacao block">
              Monto en USD
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.precioTotalUsd}
                onChange={(e) =>
                  setForm({ ...form, precioTotalUsd: e.target.value })
                }
                className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2"
              />
            </label>
          )}

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
              Registrar compra
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
          Cargando compras...
        </div>
      ) : compras.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-12 text-center">
          <p className="font-serif italic text-cacao-soft">
            Sin compras registradas todavía.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
          <ul className="divide-y divide-marfil">
            {compras.map((c) => {
              const insumo = insumos.find((i) => i.id === c.insumoId);
              const proveedor = proveedores.find((p) => p.id === c.proveedorId);
              const modalidad = MODALIDADES_PAGO.find(
                (m) => m.value === c.modalidadPago,
              );
              return (
                <li
                  key={c.id}
                  className="p-4 flex flex-wrap items-start gap-4 justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-cacao">
                      {insumo?.nombre ?? "Insumo eliminado"}
                    </div>
                    <div className="text-xs text-cacao-soft mt-0.5">
                      {new Date(c.fecha + "T00:00").toLocaleDateString(
                        "es-VE",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                      {proveedor && ` · ${proveedor.nombre}`}
                      {modalidad && ` · ${modalidad.label}`}
                    </div>
                    {c.notas && (
                      <div className="text-xs text-cacao-soft italic mt-1 font-serif">
                        {c.notas}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-cacao font-medium">
                      ${c.precioTotalUsd.toFixed(2)}
                    </div>
                    {c.precioTotalBs && (
                      <div className="text-xs text-cacao-soft">
                        Bs {c.precioTotalBs.toFixed(2)}
                        {c.tasaBcvUsada
                          ? ` · tasa ${c.tasaBcvUsada.toFixed(2)}`
                          : ""}
                      </div>
                    )}
                    <div className="text-xs text-cacao-mute">
                      {c.cantidad} × {insumo?.unidadCompra ?? ""}
                    </div>
                    <button
                      onClick={() => setPendienteBorrar(c.id)}
                      className="mt-1 text-[10px] uppercase tracking-widest text-cacao-mute hover:text-terracotta"
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={pendienteBorrar !== null}
        title="¿Eliminar compra?"
        message={
          <>
            ¿Eliminar este registro de compra? (No revierte el stock
            automáticamente — ajustar manualmente si hace falta)
          </>
        }
        onConfirm={() => {
          if (pendienteBorrar) handleDelete(pendienteBorrar);
          setPendienteBorrar(null);
        }}
        onCancel={() => setPendienteBorrar(null)}
      />
    </div>
  );
}
