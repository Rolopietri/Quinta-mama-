"use client";

// Sistema Operativo · Capa de datos (lecturas)
// ═══════════════════════════════════════════════════════════════════
// Puente entre las pantallas y las tablas so_* de Supabase. Mismo patrón
// que el resto de módulos: cliente de navegador + RLS. Las escrituras se
// agregan junto con los formularios.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Persona,
  Objetivo,
  Espacio,
  Tarea,
  Subtarea,
  Comentario,
  Impacto,
  Proximidad,
  Sentido,
  Horizonte,
  EstadoEspacio,
  EstadoTareaSO,
  OrigenTarea,
} from "@/lib/tareas-so/types";

// ── Filas crudas (snake_case) ──────────────────────────────────────
type PersonaRow = {
  id: string; nombre: string; correo: string | null;
  activo: boolean; rol: string | null; figura: string | null;
};
type ObjetivoRow = {
  id: string; area_id: string; sub_eje_id: string; horizonte: string;
  titulo: string; indicador: string; meta: number | string;
  actual: number | string; unidad: string; sentido: string;
};
type EspacioRow = {
  id: string; nombre: string; planta: string; tipo: string;
  estado: string; nota: string | null;
};
type TareaRow = {
  id: string; titulo: string; sub_eje_id: string;
  objetivo_id: string | null; espacio_id: string | null;
  vence: string | null; creada: string; cerrada: string | null;
  impacto: string; proximidad: string; patrimonio: boolean;
  compromiso: boolean; nota: string | null; estado: string; origen: string;
};
type SubtareaRow = {
  id: string; tarea_id: string; titulo: string; hecho: boolean; orden: number;
};
type ComentarioRow = {
  id: string; tarea_id: string; persona_id: string | null;
  autor: string | null; fecha: string; texto: string;
};

// ── Mapeos fila → dominio ──────────────────────────────────────────
function rowToPersona(r: PersonaRow): Persona {
  return {
    id: r.id, nombre: r.nombre, correo: r.correo ?? undefined,
    activo: r.activo, rol: r.rol ?? undefined, figura: r.figura ?? undefined,
  };
}
function rowToObjetivo(r: ObjetivoRow): Objetivo {
  return {
    id: r.id, areaId: r.area_id, subEjeId: r.sub_eje_id,
    horizonte: r.horizonte as Horizonte, titulo: r.titulo,
    indicador: r.indicador, meta: Number(r.meta), actual: Number(r.actual),
    unidad: r.unidad, sentido: r.sentido as Sentido,
  };
}
function rowToEspacio(r: EspacioRow): Espacio {
  return {
    id: r.id, nombre: r.nombre, planta: r.planta, tipo: r.tipo,
    estado: r.estado as EstadoEspacio, nota: r.nota ?? undefined,
  };
}

// ── Lecturas simples ───────────────────────────────────────────────
export async function listPersonas(): Promise<Persona[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("so_persona")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data as PersonaRow[]).map(rowToPersona);
}

export async function listEspacios(): Promise<Espacio[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.from("so_espacio").select("*");
  if (error) throw error;
  return (data as EspacioRow[]).map(rowToEspacio);
}

export async function listObjetivos(): Promise<Objetivo[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.from("so_objetivo").select("*");
  if (error) throw error;
  return (data as ObjetivoRow[]).map(rowToObjetivo);
}

// ── Tareas: cabecera + hijos (responsables, valores, subtareas, coms) ──
export async function listTareas(): Promise<Tarea[]> {
  const sb = createSupabaseBrowserClient();
  const { data: heads, error } = await sb
    .from("so_tarea")
    .select("*")
    .order("creada", { ascending: false });
  if (error) throw error;
  const rows = heads as TareaRow[];
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  const [resp, vals, subs, coms] = await Promise.all([
    sb.from("so_tarea_responsable").select("*").in("tarea_id", ids),
    sb.from("so_tarea_valor").select("*").in("tarea_id", ids),
    sb.from("so_subtarea").select("*").in("tarea_id", ids).order("orden", { ascending: true }),
    sb.from("so_comentario").select("*").in("tarea_id", ids).order("fecha", { ascending: true }),
  ]);
  if (resp.error) throw resp.error;
  if (vals.error) throw vals.error;
  if (subs.error) throw subs.error;
  if (coms.error) throw coms.error;

  const respBy = agrupar(resp.data as { tarea_id: string; persona_id: string }[], "tarea_id");
  const valsBy = agrupar(vals.data as { tarea_id: string; valor: string }[], "tarea_id");
  const subsBy = agrupar(subs.data as SubtareaRow[], "tarea_id");
  const comsBy = agrupar(coms.data as ComentarioRow[], "tarea_id");

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    subEjeId: r.sub_eje_id,
    objetivoId: r.objetivo_id ?? undefined,
    espacioId: r.espacio_id ?? undefined,
    vence: r.vence ?? undefined,
    creada: r.creada,
    cerrada: r.cerrada ?? undefined,
    impacto: r.impacto as Impacto,
    proximidad: r.proximidad as Proximidad,
    patrimonio: r.patrimonio,
    compromiso: r.compromiso,
    nota: r.nota ?? undefined,
    estado: r.estado as EstadoTareaSO,
    origen: r.origen as OrigenTarea,
    responsables: (respBy[r.id] ?? []).map((x) => x.persona_id),
    valores: (valsBy[r.id] ?? []).map((x) => x.valor),
    subtareas: (subsBy[r.id] ?? []).map(
      (x): Subtarea => ({ id: x.id, titulo: x.titulo, hecho: x.hecho, orden: x.orden }),
    ),
    comentarios: (comsBy[r.id] ?? []).map(
      (x): Comentario => ({
        id: x.id, personaId: x.persona_id ?? undefined,
        autor: x.autor ?? undefined, fecha: x.fecha, texto: x.texto,
      }),
    ),
  }));
}

/** Agrupa una lista por una clave de texto. */
function agrupar<T extends Record<string, unknown>>(
  lista: T[],
  clave: keyof T,
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of lista) {
    const k = String(item[clave]);
    (out[k] ??= []).push(item);
  }
  return out;
}
