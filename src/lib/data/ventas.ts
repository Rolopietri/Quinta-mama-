"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Venta,
  FuenteVenta,
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
    const cantStr = (cells[colCantidad] ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
    const cant = parseFloat(cantStr);
    if (!nombre || isNaN(cant) || cant <= 0) continue;
    let precio: number | undefined;
    if (colPrecio !== -1) {
      const pStr = (cells[colPrecio] ?? "")
        .replace(/[^\d.,-]/g, "")
        .replace(",", ".");
      const p = parseFloat(pStr);
      if (!isNaN(p)) precio = p;
    }
    filas.push({ nombre, cantidad: cant, precio });
  }
  return filas;
}

// Match fuzzy de filas importadas con recetas (por nombre o xetux_nombre)
export type MatchResult = {
  fila: FilaImportada;
  receta?: Receta;
  matched: boolean;
};

export function matchVentasConRecetas(
  filas: FilaImportada[],
  recetas: Receta[],
): MatchResult[] {
  function norm(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }
  const index: Map<string, Receta> = new Map();
  for (const r of recetas) {
    index.set(norm(r.nombre), r);
    if (r.xetux_nombre) index.set(norm(r.xetux_nombre), r);
  }
  return filas.map((f) => {
    const k = norm(f.nombre);
    let receta = index.get(k);
    if (!receta) {
      // Buscar parcial: alguna receta cuyo nombre normalizado esté contenido
      for (const r of recetas) {
        const rn = norm(r.nombre);
        if (rn.length >= 4 && (k.includes(rn) || rn.includes(k))) {
          receta = r;
          break;
        }
      }
    }
    return { fila: f, receta, matched: !!receta };
  });
}
