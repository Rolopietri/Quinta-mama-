"use client";

// Movimientos de stock (M5 — libro de inventario).
// Por ahora solo registramos pérdidas/mermas manuales que descuentan del
// `stock_actual` actual. Cuando entremos al refactor de 3 capas, esta misma
// tabla soporta movimientos de la capa "comprometido" sin migración.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hoyISO } from "@/lib/ui";
import type {
  StockMovimiento,
  TipoMovimientoStock,
  CapaStock,
} from "@/lib/types";

type Row = {
  id: string;
  insumo_id: string;
  tipo: string;
  capa: string;
  cantidad: number | string;
  motivo: string | null;
  fecha: string;
  nota: string | null;
  created_at: string;
};

function rowToMov(r: Row): StockMovimiento {
  return {
    id: r.id,
    insumoId: r.insumo_id,
    tipo: r.tipo as TipoMovimientoStock,
    capa: r.capa as CapaStock,
    cantidad: Number(r.cantidad),
    motivo: r.motivo ?? undefined,
    fecha: r.fecha,
    nota: r.nota ?? undefined,
    createdAt: r.created_at,
  };
}

export async function listMovimientos(
  opts: { insumoId?: string; limit?: number } = {},
): Promise<StockMovimiento[]> {
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("stock_movimientos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.insumoId) q = q.eq("insumo_id", opts.insumoId);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]).map(rowToMov);
}

export type PerdidaInput = {
  insumoId: string;
  /** Cantidad afectada en positivo (la convertimos a negativo internamente). */
  cantidad: number;
  tipo: Extract<
    TipoMovimientoStock,
    "perdida" | "mal_estado" | "merma" | "vencimiento" | "otro"
  >;
  motivo?: string;
  fecha?: string;
  nota?: string;
};

/**
 * Registra una pérdida/merma. En dos pasos:
 *   1. Inserta el movimiento (cantidad negativa, capa = 'total')
 *   2. Descuenta del stock total del insumo (DB: `stock_actual`)
 *
 * Devuelve el movimiento creado + el nuevo stockTotal.
 */
export async function registrarPerdida(
  input: PerdidaInput,
): Promise<{ movimiento: StockMovimiento; stockTotal: number }> {
  if (input.cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }
  const sb = createSupabaseBrowserClient();

  // Descuento + registro del movimiento en UNA transacción atómica (RPC). El
  // stock se resta en la DB con `stock_actual = stock_actual - x` bajo lock de
  // fila, así no hay lost-update si entra otro cambio (venta, compra, otra
  // pérdida) entre medias.
  const { data, error } = await sb.rpc("registrar_perdida_stock", {
    p_insumo_id: input.insumoId,
    p_tipo: input.tipo,
    p_cantidad: Math.abs(input.cantidad),
    p_motivo: input.motivo?.trim() || null,
    p_fecha: input.fecha ?? hoyISO(),
    p_nota: input.nota?.trim() || null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | (Row & { stock_nuevo: number | string })
    | undefined;
  if (!row) throw new Error("No se pudo registrar la pérdida.");
  return {
    movimiento: rowToMov(row),
    stockTotal: Number(row.stock_nuevo),
  };
}

/**
 * Borra un movimiento del historial.
 *
 * Con `devolverStock: true` repone al stock físico la cantidad del
 * movimiento antes de borrarlo (útil cuando se registró una pérdida por
 * error). Solo repone movimientos de la capa 'total'. Devuelve el nuevo
 * stock físico si hubo reposición.
 */
/**
 * Conteo físico: fija el stock_actual del insumo al valor ABSOLUTO contado y
 * registra el ajuste (delta) en el libro. Atómico (RPC con lock de fila).
 * Devuelve el nuevo stock. Si el valor es igual al actual, no registra nada.
 */
export async function ajustarStockConteo(
  insumoId: string,
  nuevo: number,
  nota?: string,
): Promise<number> {
  if (!(nuevo >= 0)) throw new Error("El conteo debe ser un número ≥ 0.");
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("ajustar_stock_conteo", {
    p_insumo_id: insumoId,
    p_nuevo: nuevo,
    p_nota: nota?.trim() || null,
  });
  if (error) throw error;
  return Number(data);
}

export async function deleteMovimiento(
  id: string,
  opts: { devolverStock?: boolean } = {},
): Promise<{ stockTotal?: number }> {
  const sb = createSupabaseBrowserClient();
  // Reposición (opcional) + borrado en UNA transacción atómica (RPC). Con
  // devolverStock, el stock se repone con `stock_actual = stock_actual - x`
  // (x es negativo → suma) bajo lock de fila, sin lost-update.
  const { data, error } = await sb.rpc("borrar_movimiento_stock", {
    p_id: id,
    p_devolver: !!opts.devolverStock,
  });
  if (error) throw error;
  const nuevo = data as number | null;
  return nuevo == null ? {} : { stockTotal: Number(nuevo) };
}
