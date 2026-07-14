"use client";

// Movimientos de stock (M5 — libro de inventario).
// Por ahora solo registramos pérdidas/mermas manuales que descuentan del
// `stock_actual` actual. Cuando entremos al refactor de 3 capas, esta misma
// tabla soporta movimientos de la capa "comprometido" sin migración.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

  // Paso 1: registrar movimiento (cantidad guardada como NEGATIVA)
  const { data: movRow, error: movErr } = await sb
    .from("stock_movimientos")
    .insert({
      insumo_id: input.insumoId,
      tipo: input.tipo,
      capa: "total",
      cantidad: -Math.abs(input.cantidad),
      motivo: input.motivo?.trim() || null,
      fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
      nota: input.nota?.trim() || null,
    })
    .select("*")
    .single();
  if (movErr) throw movErr;

  // Paso 2: leer stock actual y descontar
  const { data: insRow, error: insErr } = await sb
    .from("insumos")
    .select("stock_actual")
    .eq("id", input.insumoId)
    .single();
  if (insErr) throw insErr;

  const stockAnterior = Number(
    (insRow as { stock_actual: number | string }).stock_actual ?? 0,
  );
  const stockNuevo = Math.max(0, stockAnterior - Math.abs(input.cantidad));

  const { error: updErr } = await sb
    .from("insumos")
    .update({ stock_actual: stockNuevo })
    .eq("id", input.insumoId);
  if (updErr) throw updErr;

  return {
    movimiento: rowToMov(movRow as Row),
    stockTotal: stockNuevo,
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
export async function deleteMovimiento(
  id: string,
  opts: { devolverStock?: boolean } = {},
): Promise<{ stockTotal?: number }> {
  const sb = createSupabaseBrowserClient();

  if (opts.devolverStock) {
    const { data: movRow, error: movErr } = await sb
      .from("stock_movimientos")
      .select("insumo_id, capa, cantidad")
      .eq("id", id)
      .single();
    if (movErr) throw movErr;
    const m = movRow as {
      insumo_id: string;
      capa: string;
      cantidad: number | string;
    };
    const cantidad = Number(m.cantidad);
    // Solo reponemos la capa física ('total'). Reponer = deshacer el delta:
    // como las pérdidas se guardan en negativo, restar la cantidad la suma
    // de vuelta al stock.
    if (m.capa === "total" && cantidad !== 0) {
      const { data: insRow, error: insErr } = await sb
        .from("insumos")
        .select("stock_actual")
        .eq("id", m.insumo_id)
        .single();
      if (insErr) throw insErr;
      const actual = Number(
        (insRow as { stock_actual: number | string }).stock_actual ?? 0,
      );
      const nuevo = Math.max(0, actual - cantidad);
      const { error: updErr } = await sb
        .from("insumos")
        .update({ stock_actual: nuevo })
        .eq("id", m.insumo_id);
      if (updErr) throw updErr;

      const { error: delErr } = await sb
        .from("stock_movimientos")
        .delete()
        .eq("id", id);
      if (delErr) throw delErr;
      return { stockTotal: nuevo };
    }
  }

  const { error } = await sb.from("stock_movimientos").delete().eq("id", id);
  if (error) throw error;
  return {};
}
