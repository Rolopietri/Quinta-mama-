"use client";

// Categoría de venta asignada POR NOMBRE del ítem del POS. Para clasificar en el
// análisis los ítems que no son receta ni insumo de reventa (consignación,
// servicios, "sin clasificar"), que no tienen dónde guardar su categoría.
// Se matchea por el nombre normalizado (misma normalización que pos_clasificacion).
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normPos } from "@/lib/data/ventas";

export type CategoriaPorNombre = { nombreNorm: string; nombreOriginal: string; categoria: string };

type Row = { nombre_norm: string; nombre_original: string; categoria: string };

/** Lista las asignaciones por nombre. Si la tabla no existe, devuelve []. */
export async function listCategoriasPorNombre(): Promise<CategoriaPorNombre[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("categoria_por_nombre")
    .select("nombre_norm, nombre_original, categoria");
  if (error) return [];
  return (data as Row[]).map((r) => ({ nombreNorm: r.nombre_norm, nombreOriginal: r.nombre_original, categoria: r.categoria }));
}

/** Asigna (o quita, si categoria vacía) la categoría de un ítem por su nombre. */
export async function setCategoriaPorNombre(nombreOriginal: string, categoria: string | null): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const norm = normPos(nombreOriginal);
  if (!categoria || !categoria.trim()) {
    const { error } = await sb.from("categoria_por_nombre").delete().eq("nombre_norm", norm);
    if (error) throw error;
    return;
  }
  const { error } = await sb.from("categoria_por_nombre").upsert(
    { nombre_norm: norm, nombre_original: nombreOriginal, categoria: categoria.trim(), updated_at: new Date().toISOString() },
    { onConflict: "nombre_norm" },
  );
  if (error) throw error;
}
