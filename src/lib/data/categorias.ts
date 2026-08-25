"use client";

// Categorías de producto definidas por el usuario (para clasificar ventas).
// Se gestionan desde la página y se comparten entre módulos. El producto guarda
// el NOMBRE de la categoría en su campo `categoria`.
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type CategoriaProducto = { id: string; nombre: string; orden: number };

type Row = { id: string; nombre: string; orden: number | string | null };
const toCat = (r: Row): CategoriaProducto => ({ id: r.id, nombre: r.nombre, orden: Number(r.orden ?? 0) });

/** Lista las categorías (ordenadas). Si la tabla aún no existe, devuelve []. */
export async function listCategoriasProducto(): Promise<CategoriaProducto[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("categoria_producto")
    .select("id, nombre, orden")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) return [];
  return (data as Row[]).map(toCat);
}

/** Crea una categoría. `orden` la deja al final por defecto. */
export async function createCategoriaProducto(nombre: string, orden = 500): Promise<CategoriaProducto> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("categoria_producto")
    .insert({ nombre: nombre.trim(), orden })
    .select("id, nombre, orden")
    .single();
  if (error) throw error;
  return toCat(data as Row);
}

/** Renombra una categoría y actualiza en cascada los productos que la usaban
 *  (recetas e insumos con ese nombre exacto), para que no se pierdan. */
export async function renameCategoriaProducto(id: string, nombreViejo: string, nombreNuevo: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const nuevo = nombreNuevo.trim();
  const { error } = await sb.from("categoria_producto").update({ nombre: nuevo }).eq("id", id);
  if (error) throw error;
  await sb.from("recetas").update({ categoria: nuevo }).eq("categoria", nombreViejo);
  await sb.from("insumos").update({ categoria: nuevo }).eq("categoria", nombreViejo);
}

/** Borra una categoría. Los productos que la tuvieran quedan "sin categoría". */
export async function deleteCategoriaProducto(id: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("categoria_producto").delete().eq("id", id);
  if (error) throw error;
}
