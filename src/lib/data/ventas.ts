"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Venta,
  FuenteVenta,
  TipoItem,
  PosClasificacion,
  PedidoSugerido,
  PedidoSugeridoItem,
  Receta,
  Insumo,
  Proveedor,
} from "@/lib/types";
import { convertirParaCosto } from "@/lib/units";
import { stockLibre } from "@/lib/types";

type Row = {
  id: string;
  fecha: string;
  receta_id: string | null;
  receta_nombre: string;
  cantidad: number | string;
  precio_unitario_usd: number | string | null;
  total_usd: number | string | null;
  fuente: string;
  batch_id: string | null;
  notas: string | null;
  es_merma: boolean | null;
  merma_motivo: string | null;
  tipo_item: string | null;
  insumo_id: string | null;
  insumo_cantidad: number | string | null;
  extra_receta_id: string | null;
  extra_cantidad: number | string | null;
  swap_from_insumo_id: string | null;
  swap_to_insumo_id: string | null;
  created_at: string;
};

function rowToVenta(r: Row): Venta {
  return {
    id: r.id,
    fecha: r.fecha,
    recetaId: r.receta_id ?? undefined,
    recetaNombre: r.receta_nombre,
    cantidad: Number(r.cantidad),
    precioUnitarioUsd:
      r.precio_unitario_usd === null
        ? undefined
        : Number(r.precio_unitario_usd),
    totalUsd: r.total_usd === null ? undefined : Number(r.total_usd),
    fuente: r.fuente as FuenteVenta,
    batchId: r.batch_id ?? undefined,
    notas: r.notas ?? undefined,
    esMerma: r.es_merma ?? false,
    mermaMotivo: r.merma_motivo ?? undefined,
    tipoItem: (r.tipo_item as TipoItem) ?? "insumo",
    insumoId: r.insumo_id ?? undefined,
    insumoCantidad:
      r.insumo_cantidad === null || r.insumo_cantidad === undefined
        ? undefined
        : Number(r.insumo_cantidad),
    extraRecetaId: r.extra_receta_id ?? undefined,
    extraCantidad:
      r.extra_cantidad === null || r.extra_cantidad === undefined
        ? undefined
        : Number(r.extra_cantidad),
    swapFromInsumoId: r.swap_from_insumo_id ?? undefined,
    swapToInsumoId: r.swap_to_insumo_id ?? undefined,
    createdAt: r.created_at,
  };
}

export type VentaInput = {
  fecha: string;
  recetaId?: string;
  recetaNombre: string;
  cantidad: number;
  precioUnitarioUsd?: number;
  totalUsd?: number;
  fuente?: FuenteVenta;
  batchId?: string;
  notas?: string;
  /** Clasificación del ítem. Default 'insumo'. Los no-insumo NO descuentan
   *  stock (van con receta_id null). */
  tipoItem?: TipoItem;
  /** Solo 'insumo_directo': insumo a descontar y cuánto por unidad vendida. */
  insumoId?: string;
  insumoCantidad?: number;
  /** Receta extra descontada además de la base (combos "con papas fritas"). */
  extraRecetaId?: string;
  extraCantidad?: number;
  /** Sustitución de insumo al descontar la receta base. */
  swapFromInsumoId?: string;
  swapToInsumoId?: string;
};

export async function listVentas(limit = 100): Promise<Venta[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("ventas")
    .select("*")
    .eq("es_merma", false) // las mermas no son ventas — se excluyen del historial
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Row[]).map(rowToVenta);
}

/**
 * Historial por DÍAS COMPLETOS: trae todas las ventas de las `dias` fechas más
 * recientes, sin cortar ningún día por la mitad. A diferencia de un tope de
 * filas (que puede dejar una fecha incompleta en el borde), aquí cada fecha que
 * aparece trae todos sus ítems — así el total por día del historial es fiel.
 */
export async function listVentasDiasCompletos(dias = 30): Promise<Venta[]> {
  const sb = createSupabaseBrowserClient();
  // Paso 1: derivar las fechas distintas más recientes (columna liviana).
  const { data: fechasRows, error: e1 } = await sb
    .from("ventas")
    .select("fecha")
    .eq("es_merma", false)
    .order("fecha", { ascending: false })
    .limit(2000);
  if (e1) throw e1;
  const fechas = Array.from(
    new Set((fechasRows as { fecha: string }[]).map((r) => r.fecha)),
  );
  if (fechas.length === 0) return [];
  // La fecha de corte es la n-ésima más reciente; traemos todo desde ahí.
  const corte = fechas[Math.min(dias, fechas.length) - 1];
  const { data, error } = await sb
    .from("ventas")
    .select("*")
    .eq("es_merma", false)
    .gte("fecha", corte)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(rowToVenta);
}

/** Solo mermas de producción (pérdidas internas de algo pre-producido). */
export async function listMermas(limit = 200): Promise<Venta[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("ventas")
    .select("*")
    .eq("es_merma", true)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Row[]).map(rowToVenta);
}

/**
 * Registra una merma de producción: una ración (o varias) de una receta
 * pre-producida que se perdió (falla de equipo, etc.). Se inserta por el mismo
 * "carril" que las ventas (con la marca es_merma) para reutilizar los triggers
 * que descuentan stock y liberan el compromiso del plan — pero NO es venta:
 * no lleva precio y queda fuera de los reportes de venta.
 */
export async function registrarMerma(input: {
  recetaId: string;
  recetaNombre: string;
  raciones: number;
  motivo: string;
  fecha: string;
  nota?: string;
}): Promise<Venta> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("ventas")
    .insert({
      fecha: input.fecha,
      receta_id: input.recetaId,
      receta_nombre: input.recetaNombre,
      cantidad: input.raciones,
      precio_unitario_usd: null,
      total_usd: null,
      fuente: "manual",
      es_merma: true,
      merma_motivo: input.motivo,
      notas: input.nota ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToVenta(data as Row);
}

export async function createVenta(input: VentaInput): Promise<Venta> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("ventas")
    .insert({
      fecha: input.fecha,
      receta_id: input.recetaId ?? null,
      receta_nombre: input.recetaNombre,
      cantidad: input.cantidad,
      precio_unitario_usd: input.precioUnitarioUsd ?? null,
      total_usd: input.totalUsd ?? null,
      fuente: input.fuente ?? "manual",
      batch_id: input.batchId ?? null,
      notas: input.notas ?? null,
      tipo_item: input.tipoItem ?? "insumo",
      insumo_id: input.insumoId ?? null,
      insumo_cantidad: input.insumoCantidad ?? null,
      extra_receta_id: input.extraRecetaId ?? null,
      extra_cantidad: input.extraCantidad ?? null,
      swap_from_insumo_id: input.swapFromInsumoId ?? null,
      swap_to_insumo_id: input.swapToInsumoId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToVenta(data as Row);
}

export async function createVentasBatch(
  ventas: VentaInput[],
): Promise<Venta[]> {
  if (ventas.length === 0) return [];
  const sb = createSupabaseBrowserClient();
  const rows = ventas.map((v) => ({
    fecha: v.fecha,
    receta_id: v.recetaId ?? null,
    receta_nombre: v.recetaNombre,
    cantidad: v.cantidad,
    precio_unitario_usd: v.precioUnitarioUsd ?? null,
    total_usd: v.totalUsd ?? null,
    fuente: v.fuente ?? "manual",
    batch_id: v.batchId ?? null,
    notas: v.notas ?? null,
    tipo_item: v.tipoItem ?? "insumo",
    insumo_id: v.insumoId ?? null,
    insumo_cantidad: v.insumoCantidad ?? null,
    extra_receta_id: v.extraRecetaId ?? null,
    extra_cantidad: v.extraCantidad ?? null,
    swap_from_insumo_id: v.swapFromInsumoId ?? null,
    swap_to_insumo_id: v.swapToInsumoId ?? null,
  }));
  const { data, error } = await sb.from("ventas").insert(rows).select("*");
  if (error) {
    // Throw a more descriptive Error
    const msg = [
      error.message,
      error.details ? `Detalles: ${error.details}` : null,
      error.hint ? `Hint: ${error.hint}` : null,
      error.code ? `Código: ${error.code}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    throw new Error(msg || "Error desconocido al insertar ventas");
  }
  return (data as Row[]).map(rowToVenta);
}

export async function deleteVenta(id: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("ventas").delete().eq("id", id);
  if (error) throw error;
}

// ─── CÁLCULO DE CONSUMO DE INSUMOS POR RECETA ────────────────────
//
// Reusable: el pedido sugerido lo usa para comparar contra stock libre, y los
// planes de producción lo usan para calcular qué reservar (stock_comprometido).

/**
 * Dada una receta y un número de raciones, devuelve cuánto se consume de
 * cada insumo en su unidad_base (con expansión de subrecetas y conversión
 * de unidades).
 */
export function calcularConsumoReceta(
  recetaId: string,
  raciones: number,
  recetas: Receta[],
  insumos: Insumo[],
): Map<string, number> {
  const acc = new Map<string, number>();
  if (raciones <= 0) return acc;
  const recMap = new Map(recetas.map((r) => [r.id, r]));
  const insMap = new Map(insumos.map((i) => [i.id, i]));
  acumularInsumos(recetaId, raciones, recMap, insMap, acc, new Set(), 0);
  return acc;
}

// ─── PEDIDO SUGERIDO ───────────────────────────────────────────────

// Expande recursivamente una receta y acumula consumo de insumos en el accumulator.
// Maneja subrecetas siguiendo el mismo modelo que el SQL flatten_receta_insumos.
//
// IMPORTANTE: convierte ing.cantidad (en ing.unidad) a la unidad base del
// insumo antes de sumar. Esto evita el bug donde una receta declara "30 g"
// pero el insumo está en kg → el sistema mezclaba unidades y pedía cientos
// de kg de más. Si las unidades son custom (taza, saco) o no convertibles,
// hace fallback al comportamiento original (sumar tal cual).
function acumularInsumos(
  recetaId: string,
  factor: number,
  recMap: Map<string, Receta>,
  insMap: Map<string, Insumo>,
  acc: Map<string, number>,
  visitados: Set<string>,
  depth: number,
): void {
  if (depth > 5) return;
  if (visitados.has(recetaId)) return;
  const r = recMap.get(recetaId);
  if (!r) return;
  const porciones = r.porciones || 1;
  const nextVisited = new Set(visitados);
  nextVisited.add(recetaId);
  for (const ing of r.ingredientes) {
    if (ing.insumoId) {
      const ins = insMap.get(ing.insumoId);
      let total = (ing.cantidad * factor) / porciones;
      if (ins) {
        // Convertir a la unidad base del insumo (kg→g, L→ml, etc.) para que
        // el match con stockActual y cantidadPorCompra cuadre.
        const conv = convertirParaCosto(total, ing.unidad, ins.unidadBase);
        if (conv) total = conv.resultado;
      }
      acc.set(ing.insumoId, (acc.get(ing.insumoId) ?? 0) + total);
    } else if (ing.subrecetaId) {
      const sub = recMap.get(ing.subrecetaId);
      if (!sub) continue;
      // Rendimiento se interpreta como el TOTAL del batch. Si no está
      // definido, asumimos 1.
      const rendEfectivo =
        sub.rendimiento && sub.rendimiento > 0 ? sub.rendimiento : 1;
      const subPorciones = sub.porciones || 1;
      // Convertir la cantidad pedida a la unidad de rendimiento de la
      // subreceta antes de calcular cuántos batches hacen falta.
      let cantidadEnRend = (ing.cantidad * factor) / porciones;
      if (sub.rendimientoUnidad) {
        const conv = convertirParaCosto(
          cantidadEnRend,
          ing.unidad,
          sub.rendimientoUnidad,
        );
        if (conv) cantidadEnRend = conv.resultado;
      }
      // batches necesarios = cantidad ÷ rendimiento total del batch
      // porciones a producir = batches × porciones por batch
      // Esto se pasa al recurso (acumularInsumos espera "porciones objetivo")
      const subFactor = (cantidadEnRend / rendEfectivo) * subPorciones;
      acumularInsumos(
        ing.subrecetaId,
        subFactor,
        recMap,
        insMap,
        acc,
        nextVisited,
        depth + 1,
      );
    }
  }
}

export function calcularPedidoSugerido(
  objetivos: { recetaId: string; raciones: number }[],
  recetas: Receta[],
  insumos: Insumo[],
  proveedores: Proveedor[] = [],
): PedidoSugerido {
  const recMap = new Map(recetas.map((r) => [r.id, r]));
  const insMap = new Map(insumos.map((i) => [i.id, i]));
  const provMap = new Map(proveedores.map((p) => [p.id, p]));

  // Acumular cantidades necesarias por insumo (con expansión de subrecetas)
  const acc = new Map<string, number>();
  const recetasUsadas: PedidoSugerido["recetasObjetivo"] = [];

  for (const obj of objetivos) {
    const r = recMap.get(obj.recetaId);
    if (!r || obj.raciones <= 0) continue;
    recetasUsadas.push({
      recetaId: r.id,
      recetaNombre: r.nombre,
      raciones: obj.raciones,
    });
    // factor: cuántas porciones totales necesitamos
    acumularInsumos(r.id, obj.raciones, recMap, insMap, acc, new Set(), 0);
  }

  const items: PedidoSugeridoItem[] = [];
  let costoTotal = 0;
  for (const [insumoId, cantidadNecesaria] of acc) {
    const ins = insMap.get(insumoId);
    if (!ins) continue;
    // Comparamos contra stockLibre (no stockTotal) porque lo comprometido por
    // planes de producción NO está disponible para nuevas recetas.
    const libre = stockLibre(ins);
    const faltante = Math.max(0, cantidadNecesaria - libre);
    if (faltante <= 0) continue; // ya hay suficiente, no se incluye
    const empaquesNecesarios = Math.ceil(faltante / ins.cantidadPorCompra);
    const precioCompra = ins.precioCompraUsd;
    // Costo proporcional: lo que CUESTA la cantidad que falta, no lo que vas
    // a pagar en empaques enteros. Esto hace que el costo total escale
    // linealmente con las raciones (sin escalones por redondeo a paquete).
    // El número de empaques sigue informativo para la lista de compras.
    const costo =
      ins.precioBaseUsd !== null && faltante > 0
        ? faltante * ins.precioBaseUsd
        : 0;
    costoTotal += costo;
    const prov = ins.proveedorId ? provMap.get(ins.proveedorId) : undefined;
    items.push({
      insumoId,
      insumoNombre: ins.nombre,
      unidadCompra: ins.unidadCompra,
      unidadBase: ins.unidadBase,
      cantidadPorCompra: ins.cantidadPorCompra,
      cantidadNecesaria,
      stockLibre: libre,
      faltante,
      empaquesNecesarios,
      precioCompraUsd: precioCompra,
      costoTotalEstimado: costo,
      proveedorNombre: prov?.nombre,
    });
  }

  // Ordenar por proveedor y luego nombre
  items.sort((a, b) => {
    const ap = a.proveedorNombre ?? "zzz";
    const bp = b.proveedorNombre ?? "zzz";
    if (ap !== bp) return ap.localeCompare(bp);
    return a.insumoNombre.localeCompare(b.insumoNombre);
  });

  return { recetasObjetivo: recetasUsadas, items, costoTotalEstimado: costoTotal };
}

// ─── PARSE CSV DE XETUX (genérico, tolerante) ──────────────────────

export type FilaImportada = {
  nombre: string;
  cantidad: number;
  precio?: number;
};

/** Parsea un número respetando separadores de miles/decimal en cualquier
 *  formato (venezolano/europeo "1.234,56" o gringo "1,234.56"). El separador
 *  DECIMAL es el que aparece de último; el otro se trata como miles y se quita.
 *  Antes se hacía `.replace(",", ".")` a secas, y "1.234,56" quedaba "1.234.56"
 *  → parseFloat lo cortaba en 1.234 (mil veces menos). */
function parseNumeroLocale(raw: string): number {
  const s = (raw ?? "").replace(/[^\d.,-]/g, "").trim();
  if (s === "" || s === "-") return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let norm: string;
  if (lastComma > lastDot) {
    // "," es el decimal → quitar "." (miles), "," → "."
    norm = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // "." es el decimal → quitar "," (miles)
    norm = s.replace(/,/g, "");
  } else {
    norm = s; // sin separadores
  }
  return parseFloat(norm);
}

export function parseCSV(content: string): FilaImportada[] {
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Detectar separador (',' o ';' o '\t')
  const sample = lines[0];
  const seps = [",", ";", "\t", "|"];
  let sep = ",";
  let max = 0;
  for (const s of seps) {
    const count = sample.split(s).length;
    if (count > max) {
      max = count;
      sep = s;
    }
  }

  function splitLine(line: string): string[] {
    // Manejo simple de comillas
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === sep && !inQ) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());

  // Encontrar columnas
  const colNombre = headers.findIndex((h) =>
    /producto|nombre|item|descripci/i.test(h),
  );
  const colCantidad = headers.findIndex((h) =>
    /cantidad|unidades|qty|cant\.|piezas/i.test(h),
  );
  const colPrecio = headers.findIndex((h) =>
    /precio|importe|monto|total|subtotal/i.test(h),
  );

  if (colNombre === -1 || colCantidad === -1) {
    throw new Error(
      "No pude detectar columnas de 'Producto' y 'Cantidad'. Verifica que el archivo tenga encabezados.",
    );
  }

  const filas: FilaImportada[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const nombre = (cells[colNombre] ?? "").trim();
    const cant = parseNumeroLocale(cells[colCantidad] ?? "");
    if (!nombre || isNaN(cant) || cant <= 0) continue;
    let precio: number | undefined;
    if (colPrecio !== -1) {
      const p = parseNumeroLocale(cells[colPrecio] ?? "");
      if (!isNaN(p)) precio = p;
    }
    filas.push({ nombre, cantidad: cant, precio });
  }
  return filas;
}

// ─── CLASIFICACIÓN DE ÍTEMS DEL POS (insumo / servicio / consignación) ──────

/** Normaliza un nombre del POS para hacer match (minúsculas, sin acentos ni
 *  símbolos). */
export function normPos(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

type ClasifRow = {
  id: string;
  nombre_norm: string;
  nombre_original: string;
  tipo: string;
  receta_id: string | null;
  extra_receta_id: string | null;
  extra_cantidad: number | string | null;
  swap_from_insumo_id: string | null;
  swap_to_insumo_id: string | null;
  insumo_id: string | null;
  cantidad_por_unidad: number | string | null;
  proveedor_id: string | null;
  porcentaje_acuerdo: number | string | null;
  created_at: string;
  updated_at: string;
};

function rowToClasif(r: ClasifRow): PosClasificacion {
  return {
    id: r.id,
    nombreNorm: r.nombre_norm,
    nombreOriginal: r.nombre_original,
    tipo: (r.tipo as TipoItem) ?? "sin_clasificar",
    recetaId: r.receta_id ?? undefined,
    extraRecetaId: r.extra_receta_id ?? undefined,
    extraCantidad:
      r.extra_cantidad == null ? undefined : Number(r.extra_cantidad),
    swapFromInsumoId: r.swap_from_insumo_id ?? undefined,
    swapToInsumoId: r.swap_to_insumo_id ?? undefined,
    insumoId: r.insumo_id ?? undefined,
    cantidadPorUnidad:
      r.cantidad_por_unidad == null ? undefined : Number(r.cantidad_por_unidad),
    proveedorId: r.proveedor_id ?? undefined,
    porcentajeAcuerdo:
      r.porcentaje_acuerdo == null ? undefined : Number(r.porcentaje_acuerdo),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Lista las clasificaciones guardadas. Si la tabla aún no existe (migración
 *  pendiente), devuelve [] en lugar de romper. */
export async function listClasificacion(): Promise<PosClasificacion[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.from("pos_clasificacion").select("*");
  if (error) return [];
  return (data as ClasifRow[]).map(rowToClasif);
}

/** Crea o actualiza (por nombre normalizado) la clasificación de un ítem. */
export async function upsertClasificacion(input: {
  nombreOriginal: string;
  tipo: TipoItem;
  recetaId?: string;
  extraRecetaId?: string;
  extraCantidad?: number;
  swapFromInsumoId?: string;
  swapToInsumoId?: string;
  insumoId?: string;
  cantidadPorUnidad?: number;
  proveedorId?: string;
  porcentajeAcuerdo?: number;
}): Promise<PosClasificacion> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("pos_clasificacion")
    .upsert(
      {
        nombre_norm: normPos(input.nombreOriginal),
        nombre_original: input.nombreOriginal,
        tipo: input.tipo,
        receta_id: input.recetaId ?? null,
        extra_receta_id:
          input.tipo === "insumo" ? (input.extraRecetaId ?? null) : null,
        extra_cantidad:
          input.tipo === "insumo" && input.extraRecetaId
            ? (input.extraCantidad ?? 1)
            : null,
        // swap_from se usa en 'insumo' (receta: reemplaza-desde) y en
        // 'insumo_directo' (modificador: insumo que se DEVUELVE).
        swap_from_insumo_id:
          input.tipo === "insumo" || input.tipo === "insumo_directo"
            ? (input.swapFromInsumoId ?? null)
            : null,
        swap_to_insumo_id:
          input.tipo === "insumo" ? (input.swapToInsumoId ?? null) : null,
        insumo_id: input.insumoId ?? null,
        cantidad_por_unidad:
          input.tipo === "insumo_directo"
            ? (input.cantidadPorUnidad ?? 1)
            : null,
        proveedor_id: input.proveedorId ?? null,
        porcentaje_acuerdo: input.porcentajeAcuerdo ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "nombre_norm" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return rowToClasif(data as ClasifRow);
}

/** Elimina una clasificación guardada. */
export async function deleteClasificacion(id: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("pos_clasificacion").delete().eq("id", id);
  if (error) throw error;
}

/** Resultado de clasificar una fila importada del POS. */
export type ClasificItem = {
  fila: FilaImportada;
  tipo: TipoItem;
  /** Presente si tipo = 'insumo' (matcheó una receta). */
  receta?: Receta;
  /** Receta extra vinculada (combo "con papas fritas"). */
  extraReceta?: Receta;
  /** Sustitución de insumo (ej. leche entera → almendras). */
  swapFrom?: Insumo;
  swapTo?: Insumo;
  /** Presente si tipo = 'insumo_directo' (mapeado a un insumo). */
  insumo?: Insumo;
  /** Clasificación guardada, si existe. */
  clasif?: PosClasificacion;
  /** Sugerencia difusa (NO se aplica sola) para ítems sin clasificar. */
  sugerencia?: Receta;
};

/**
 * Clasifica cada fila del reporte:
 *   1. Si hay clasificación guardada → se respeta (prioridad).
 *   2. Si matchea EXACTO una receta (nombre o xetux_nombre) → 'insumo'.
 *   3. Si no → 'sin_clasificar' (con sugerencia difusa opcional).
 * A propósito NO auto-clasifica por match difuso, para no descontar stock por
 * accidente sobre un ítem que en realidad es servicio/consignación.
 */
export function clasificarFilas(
  filas: FilaImportada[],
  recetas: Receta[],
  clasifs: PosClasificacion[],
  insumos: Insumo[] = [],
): ClasificItem[] {
  const recIndex = new Map<string, Receta>();
  for (const r of recetas) {
    recIndex.set(normPos(r.nombre), r);
    if (r.xetux_nombre) recIndex.set(normPos(r.xetux_nombre), r);
  }
  const recById = new Map(recetas.map((r) => [r.id, r]));
  const insById = new Map(insumos.map((i) => [i.id, i]));
  const clasIndex = new Map(clasifs.map((c) => [c.nombreNorm, c]));

  return filas.map((f) => {
    const k = normPos(f.nombre);

    // 1) Clasificación explícita guardada (prioridad).
    const clasif = clasIndex.get(k);
    if (clasif) {
      if (clasif.tipo === "insumo") {
        const receta = clasif.recetaId
          ? recById.get(clasif.recetaId)
          : recIndex.get(k);
        const extraReceta = clasif.extraRecetaId
          ? recById.get(clasif.extraRecetaId)
          : undefined;
        const swapFrom = clasif.swapFromInsumoId
          ? insById.get(clasif.swapFromInsumoId)
          : undefined;
        const swapTo = clasif.swapToInsumoId
          ? insById.get(clasif.swapToInsumoId)
          : undefined;
        return {
          fila: f,
          tipo: "insumo" as const,
          receta,
          extraReceta,
          swapFrom,
          swapTo,
          clasif,
        };
      }
      if (clasif.tipo === "insumo_directo") {
        const insumo = clasif.insumoId
          ? insById.get(clasif.insumoId)
          : undefined;
        // swap_from = insumo que se devuelve (modificador de sustitución).
        const swapFrom = clasif.swapFromInsumoId
          ? insById.get(clasif.swapFromInsumoId)
          : undefined;
        return {
          fila: f,
          tipo: "insumo_directo" as const,
          insumo,
          swapFrom,
          clasif,
        };
      }
      return { fila: f, tipo: clasif.tipo, clasif };
    }

    // 2) Match exacto con receta → insumo.
    const receta = recIndex.get(k);
    if (receta) return { fila: f, tipo: "insumo" as const, receta };

    // 3) Sin clasificar. Sugerencia difusa (no se aplica automáticamente).
    //    Entre los posibles, se elige el MÁS ESPECÍFICO (nombre más largo que
    //    coincide), para no sugerir "Café" cuando la fila es "Café con leche".
    let sugerencia: Receta | undefined;
    let mejorLargo = 0;
    for (const r of recetas) {
      const rn = normPos(r.nombre);
      if (rn.length >= 4 && (k.includes(rn) || rn.includes(k))) {
        if (rn.length > mejorLargo) {
          sugerencia = r;
          mejorLargo = rn.length;
        }
      }
    }
    return { fila: f, tipo: "sin_clasificar" as const, sugerencia };
  });
}
