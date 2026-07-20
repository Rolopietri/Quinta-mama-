"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Proveedor,
  Insumo,
  Compra,
  TasaBcv,
  Seccion,
  ModalidadPago,
} from "@/lib/types";

// ─── PROVEEDORES ─────────────────────────────────────────────────

type ProveedorRow = {
  id: string;
  nombre: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  acepta_bs_bcv_dolar: boolean;
  acepta_bs_bcv_euro: boolean;
  acepta_bs_paralela: boolean;
  acepta_usd_efectivo: boolean;
  acepta_usd_divisa: boolean;
  notas: string | null;
  activo: boolean;
};

function rowToProveedor(r: ProveedorRow): Proveedor {
  return {
    id: r.id,
    nombre: r.nombre,
    contactoNombre: r.contacto_nombre ?? undefined,
    contactoTelefono: r.contacto_telefono ?? undefined,
    contactoEmail: r.contacto_email ?? undefined,
    aceptaBsBcvDolar: r.acepta_bs_bcv_dolar,
    aceptaBsBcvEuro: r.acepta_bs_bcv_euro,
    aceptaBsParalela: r.acepta_bs_paralela,
    aceptaUsdEfectivo: r.acepta_usd_efectivo,
    aceptaUsdDivisa: r.acepta_usd_divisa,
    notas: r.notas ?? undefined,
    activo: r.activo,
  };
}

export type ProveedorInput = Omit<Proveedor, "id">;

export async function listProveedores(): Promise<Proveedor[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("proveedores")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return (data as ProveedorRow[]).map(rowToProveedor);
}

export async function createProveedor(
  input: ProveedorInput,
): Promise<Proveedor> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("proveedores")
    .insert({
      nombre: input.nombre,
      contacto_nombre: input.contactoNombre ?? null,
      contacto_telefono: input.contactoTelefono ?? null,
      contacto_email: input.contactoEmail ?? null,
      acepta_bs_bcv_dolar: input.aceptaBsBcvDolar,
      acepta_bs_bcv_euro: input.aceptaBsBcvEuro,
      acepta_bs_paralela: input.aceptaBsParalela,
      acepta_usd_efectivo: input.aceptaUsdEfectivo,
      acepta_usd_divisa: input.aceptaUsdDivisa,
      notas: input.notas ?? null,
      activo: input.activo,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToProveedor(data as ProveedorRow);
}

export async function updateProveedor(
  id: string,
  patch: Partial<ProveedorInput>,
): Promise<Proveedor> {
  const sb = createSupabaseBrowserClient();
  const db: Record<string, unknown> = {};
  if (patch.nombre !== undefined) db.nombre = patch.nombre;
  if (patch.contactoNombre !== undefined)
    db.contacto_nombre = patch.contactoNombre ?? null;
  if (patch.contactoTelefono !== undefined)
    db.contacto_telefono = patch.contactoTelefono ?? null;
  if (patch.contactoEmail !== undefined)
    db.contacto_email = patch.contactoEmail ?? null;
  if (patch.aceptaBsBcvDolar !== undefined)
    db.acepta_bs_bcv_dolar = patch.aceptaBsBcvDolar;
  if (patch.aceptaBsBcvEuro !== undefined)
    db.acepta_bs_bcv_euro = patch.aceptaBsBcvEuro;
  if (patch.aceptaBsParalela !== undefined)
    db.acepta_bs_paralela = patch.aceptaBsParalela;
  if (patch.aceptaUsdEfectivo !== undefined)
    db.acepta_usd_efectivo = patch.aceptaUsdEfectivo;
  if (patch.aceptaUsdDivisa !== undefined)
    db.acepta_usd_divisa = patch.aceptaUsdDivisa;
  if (patch.notas !== undefined) db.notas = patch.notas ?? null;
  if (patch.activo !== undefined) db.activo = patch.activo;

  const { data, error } = await sb
    .from("proveedores")
    .update(db)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToProveedor(data as ProveedorRow);
}

export async function deleteProveedor(id: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("proveedores").delete().eq("id", id);
  if (error) throw error;
}

// ─── INSUMOS ─────────────────────────────────────────────────────

type InsumoRow = {
  id: string;
  nombre: string;
  categoria: string;
  seccion: string;
  unidad_compra: string;
  cantidad_por_compra: number | string;
  unidad_base: string;
  precio_compra_usd: number | string | null;
  precio_base_usd: number | string | null;
  precio_actualizado: string | null;
  stock_actual: number | string;
  stock_comprometido: number | string | null;
  stock_minimo: number | string | null;
  merma_coccion_porc: number | string | null;
  proveedor_id: string | null;
  ultima_fecha: string | null;
  ultima_cantidad: number | string | null;
  ultima_precio_usd: number | string | null;
  ultima_precio_bs: number | string | null;
  penultima_fecha: string | null;
  penultima_cantidad: number | string | null;
  penultima_precio_usd: number | string | null;
  penultima_precio_bs: number | string | null;
  notas: string | null;
  activo: boolean;
};

function rowToInsumo(r: InsumoRow): Insumo {
  return {
    id: r.id,
    nombre: r.nombre,
    categoria: r.categoria,
    seccion: r.seccion as Seccion,
    unidadCompra: r.unidad_compra,
    cantidadPorCompra: Number(r.cantidad_por_compra),
    unidadBase: r.unidad_base,
    precioCompraUsd:
      r.precio_compra_usd === null ? null : Number(r.precio_compra_usd),
    precioBaseUsd:
      r.precio_base_usd === null ? null : Number(r.precio_base_usd),
    precioActualizado: r.precio_actualizado ?? undefined,
    // Mapeo de las 3 capas de stock. La columna DB se llama `stock_actual`
    // por compatibilidad (no rompemos triggers existentes) pero en código
    // se llama stockTotal. stock_comprometido es columna nueva.
    stockTotal: Number(r.stock_actual),
    stockComprometido:
      r.stock_comprometido === null || r.stock_comprometido === undefined
        ? 0
        : Number(r.stock_comprometido),
    stockMinimo: r.stock_minimo === null ? null : Number(r.stock_minimo),
    mermaCoccionPorc:
      r.merma_coccion_porc === null || r.merma_coccion_porc === undefined
        ? null
        : Number(r.merma_coccion_porc),
    proveedorId: r.proveedor_id ?? undefined,
    ultimaFecha: r.ultima_fecha ?? undefined,
    ultimaCantidad:
      r.ultima_cantidad === null ? undefined : Number(r.ultima_cantidad),
    ultimaPrecioUsd:
      r.ultima_precio_usd === null ? undefined : Number(r.ultima_precio_usd),
    ultimaPrecioBs:
      r.ultima_precio_bs === null ? undefined : Number(r.ultima_precio_bs),
    penultimaFecha: r.penultima_fecha ?? undefined,
    penultimaCantidad:
      r.penultima_cantidad === null ? undefined : Number(r.penultima_cantidad),
    penultimaPrecioUsd:
      r.penultima_precio_usd === null
        ? undefined
        : Number(r.penultima_precio_usd),
    penultimaPrecioBs:
      r.penultima_precio_bs === null
        ? undefined
        : Number(r.penultima_precio_bs),
    notas: r.notas ?? undefined,
    activo: r.activo,
  };
}

export type InsumoInput = Omit<
  Insumo,
  | "id"
  | "precioActualizado"
  | "ultimaFecha"
  | "ultimaCantidad"
  | "ultimaPrecioUsd"
  | "ultimaPrecioBs"
  | "penultimaFecha"
  | "penultimaCantidad"
  | "penultimaPrecioUsd"
  | "penultimaPrecioBs"
>;

export async function listInsumos(): Promise<Insumo[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("insumos")
    .select("*")
    .order("categoria")
    .order("nombre");
  if (error) throw error;
  return (data as InsumoRow[]).map(rowToInsumo);
}

export async function createInsumo(input: InsumoInput): Promise<Insumo> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("insumos")
    .insert({
      nombre: input.nombre,
      categoria: input.categoria,
      seccion: input.seccion,
      unidad_compra: input.unidadCompra,
      cantidad_por_compra: input.cantidadPorCompra,
      unidad_base: input.unidadBase,
      precio_compra_usd: input.precioCompraUsd,
      precio_base_usd: input.precioBaseUsd,
      stock_actual: input.stockTotal,
      stock_comprometido: input.stockComprometido ?? 0,
      stock_minimo: input.stockMinimo,
      merma_coccion_porc: input.mermaCoccionPorc ?? null,
      proveedor_id: input.proveedorId ?? null,
      notas: input.notas ?? null,
      activo: input.activo,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToInsumo(data as InsumoRow);
}

export async function updateInsumo(
  id: string,
  patch: Partial<InsumoInput>,
): Promise<Insumo> {
  const sb = createSupabaseBrowserClient();
  const db: Record<string, unknown> = {};
  if (patch.nombre !== undefined) db.nombre = patch.nombre;
  if (patch.categoria !== undefined) db.categoria = patch.categoria;
  if (patch.seccion !== undefined) db.seccion = patch.seccion;
  if (patch.unidadCompra !== undefined) db.unidad_compra = patch.unidadCompra;
  if (patch.cantidadPorCompra !== undefined)
    db.cantidad_por_compra = patch.cantidadPorCompra;
  if (patch.unidadBase !== undefined) db.unidad_base = patch.unidadBase;
  if (patch.precioCompraUsd !== undefined) {
    db.precio_compra_usd = patch.precioCompraUsd;
    // Recalcular precio_base si cambia precio_compra
    if (patch.cantidadPorCompra !== undefined && patch.cantidadPorCompra > 0) {
      db.precio_base_usd =
        (patch.precioCompraUsd ?? 0) / patch.cantidadPorCompra;
    }
  }
  if (patch.precioBaseUsd !== undefined) db.precio_base_usd = patch.precioBaseUsd;
  if (patch.stockTotal !== undefined) db.stock_actual = patch.stockTotal;
  if (patch.stockComprometido !== undefined)
    db.stock_comprometido = patch.stockComprometido;
  if (patch.stockMinimo !== undefined) db.stock_minimo = patch.stockMinimo;
  if (patch.mermaCoccionPorc !== undefined)
    db.merma_coccion_porc = patch.mermaCoccionPorc ?? null;
  if (patch.proveedorId !== undefined)
    db.proveedor_id = patch.proveedorId ?? null;
  if (patch.notas !== undefined) db.notas = patch.notas ?? null;
  if (patch.activo !== undefined) db.activo = patch.activo;

  const { data, error } = await sb
    .from("insumos")
    .update(db)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToInsumo(data as InsumoRow);
}

export async function deleteInsumo(id: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("insumos").delete().eq("id", id);
  if (error) throw error;
}

/** Refresca el precio de un insumo al precio de hoy SIN registrar una compra.
 *  Recalcula el precio por unidad base y estampa `precio_actualizado` con la
 *  fecha de hoy, para que el costeo deje de marcarlo como viejo. Pensado para
 *  cuando conoces el precio de mercado actual pero no compraste todavía. */
export async function actualizarPrecioInsumo(
  id: string,
  precioCompraUsd: number,
  cantidadPorCompra: number,
): Promise<Insumo> {
  const sb = createSupabaseBrowserClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const precioBase =
    cantidadPorCompra > 0
      ? precioCompraUsd / cantidadPorCompra
      : precioCompraUsd;
  const { data, error } = await sb
    .from("insumos")
    .update({
      precio_compra_usd: precioCompraUsd,
      precio_base_usd: precioBase,
      precio_actualizado: hoy,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToInsumo(data as InsumoRow);
}

// ─── COMPRAS ─────────────────────────────────────────────────────

type CompraRow = {
  id: string;
  insumo_id: string;
  proveedor_id: string | null;
  fecha: string;
  cantidad: number | string;
  precio_total_usd: number | string;
  precio_total_bs: number | string | null;
  tasa_bcv_usada: number | string | null;
  modalidad_pago: string | null;
  notas: string | null;
};

function rowToCompra(r: CompraRow): Compra {
  return {
    id: r.id,
    insumoId: r.insumo_id,
    proveedorId: r.proveedor_id ?? undefined,
    fecha: r.fecha,
    cantidad: Number(r.cantidad),
    precioTotalUsd: Number(r.precio_total_usd),
    precioTotalBs: r.precio_total_bs === null ? undefined : Number(r.precio_total_bs),
    tasaBcvUsada:
      r.tasa_bcv_usada === null ? undefined : Number(r.tasa_bcv_usada),
    modalidadPago: (r.modalidad_pago as ModalidadPago) ?? undefined,
    notas: r.notas ?? undefined,
  };
}

export type CompraInput = Omit<Compra, "id">;

export async function listCompras(insumoId?: string): Promise<Compra[]> {
  const sb = createSupabaseBrowserClient();
  let q = sb.from("compras").select("*").order("fecha", { ascending: false });
  if (insumoId) q = q.eq("insumo_id", insumoId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as CompraRow[]).map(rowToCompra);
}

export async function createCompra(input: CompraInput): Promise<Compra> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("compras")
    .insert({
      insumo_id: input.insumoId,
      proveedor_id: input.proveedorId ?? null,
      fecha: input.fecha,
      cantidad: input.cantidad,
      precio_total_usd: input.precioTotalUsd,
      precio_total_bs: input.precioTotalBs ?? null,
      tasa_bcv_usada: input.tasaBcvUsada ?? null,
      modalidad_pago: input.modalidadPago ?? null,
      notas: input.notas ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToCompra(data as CompraRow);
}

export async function deleteCompra(id: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("compras").delete().eq("id", id);
  if (error) throw error;
}

// ─── TASA BCV ────────────────────────────────────────────────────

type TasaRow = {
  fecha: string;
  usd_bs: number | string;
  eur_bs: number | string | null;
  paralela_bs: number | string | null;
  fuente: string | null;
};

export async function getTasaBcvActual(): Promise<TasaBcv | null> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("tasa_bcv")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as TasaRow;
  return {
    fecha: r.fecha,
    usdBs: Number(r.usd_bs),
    eurBs: r.eur_bs === null ? undefined : Number(r.eur_bs),
    paralelaBs: r.paralela_bs === null ? undefined : Number(r.paralela_bs),
    fuente: r.fuente ?? "bcv",
  };
}

export async function upsertTasaBcvParalela(
  fecha: string,
  paralelaBs: number,
): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { data: existing } = await sb
    .from("tasa_bcv")
    .select("*")
    .eq("fecha", fecha)
    .maybeSingle();
  if (existing) {
    const { error } = await sb
      .from("tasa_bcv")
      .update({ paralela_bs: paralelaBs })
      .eq("fecha", fecha);
    if (error) throw error;
  } else {
    const { error } = await sb
      .from("tasa_bcv")
      .insert({ fecha, usd_bs: 0, paralela_bs: paralelaBs, fuente: "manual" });
    if (error) throw error;
  }
}
