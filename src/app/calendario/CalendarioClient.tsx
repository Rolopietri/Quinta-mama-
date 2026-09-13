"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listCalendario,
  createCalendarioItem,
  updateCalendarioItem,
  deleteCalendarioItem,
  type CalendarioItemInput,
} from "@/lib/data/calendario";
import { listEventos } from "@/lib/data/eventos";
import { listPersonas } from "@/lib/data/tareas-so";
import {
  TIPOS_CALENDARIO,
  ESTADOS_CALENDARIO,
  tipoCalendarioMeta,
  estadoCalendarioMeta,
  AREAS,
  type CalendarioItem,
  type TipoCalendario,
  type EstadoCalendario,
  type Evento,
} from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CalendarIcon,
  ChevronIcon,
  PlusIcon,
  ClockIcon,
} from "@/components/icons";

// ── Helpers de fecha (sin librerías, en hora local) ──────────────────
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(s: string): Date {
  return new Date(s + "T00:00:00");
}

/** Matriz 6×7 de fechas ISO para el mes (semana empieza lunes). */
function buildMonth(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const cur = new Date(year, month, 1 - startOffset);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(toISO(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

/** Todas las fechas ISO entre inicio y fin (inclusive). Máx. 366 por seguridad. */
function rangoFechas(inicio: string, fin?: string): string[] {
  if (!fin || fin <= inicio) return [inicio];
  const out: string[] = [];
  const cur = fromISO(inicio);
  const end = fromISO(fin);
  let guard = 0;
  while (cur <= end && guard < 366) {
    out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

function fechaLarga(iso: string): string {
  const d = fromISO(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// Un item mostrable en el calendario: propio (editable) o un evento del módulo
// Eventos (solo lectura, se abre en su ficha).
type Disp = {
  key: string;
  source: "item" | "evento";
  id: string;
  tipo: TipoCalendario;
  titulo: string;
  hora?: string;
  estado?: string;
  responsable?: string;
  area?: string;
  fecha: string;
  raw?: CalendarioItem;
};

const DEFAULT_PERSONAS = [
  "Rodrigo Pietri",
  "Óscar Pietri",
  "Beatriz Márquez",
  "Lucía Dickson",
  "Luis Castellanos",
];

type FormState = {
  tipo: TipoCalendario;
  titulo: string;
  fecha: string;
  hora: string;
  fechaFin: string;
  responsable: string;
  area: string;
  estado: EstadoCalendario;
  notas: string;
};

function emptyForm(fecha: string): FormState {
  return {
    tipo: "reunion",
    titulo: "",
    fecha,
    hora: "",
    fechaFin: "",
    responsable: "",
    area: "",
    estado: "pendiente",
    notas: "",
  };
}

export function CalendarioClient() {
  const router = useRouter();

  const [items, setItems] = useState<CalendarioItem[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [personas, setPersonas] = useState<string[]>(DEFAULT_PERSONAS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [today, setToday] = useState("");
  const [selected, setSelected] = useState("");
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);

  // Filtros
  const [tiposOn, setTiposOn] = useState<Set<TipoCalendario>>(
    () => new Set(TIPOS_CALENDARIO.map((t) => t.value)),
  );
  const [filtroPersona, setFiltroPersona] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [verEventos, setVerEventos] = useState(true);

  // Modal / borrado
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Inicializa hoy + carga datos. Todo dentro del IIFE async para no fijar
  // estado en el cuerpo del efecto (evita también desajustes de SSR: la fecha
  // "hoy" se calcula en el cliente, no en el prerender).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const iso = toISO(now);
      if (!cancelled) {
        setToday(iso);
        setSelected(iso);
        setCursor({ y: now.getFullYear(), m: now.getMonth() });
      }
      try {
        const [its, evs] = await Promise.all([listCalendario(), listEventos()]);
        if (cancelled) return;
        setItems(its);
        setEventos(evs);
        try {
          const ps = await listPersonas();
          if (!cancelled && ps.length > 0) {
            setPersonas(ps.map((p) => p.nombre));
          }
        } catch {
          // sin personas de la DB: usamos las por defecto
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Opciones de responsable: personas del equipo + los que ya aparecen en datos
  const opcionesResponsable = useMemo(() => {
    const set = new Set<string>(personas);
    set.add("Equipo");
    for (const it of items) if (it.responsable) set.add(it.responsable);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [personas, items]);

  // Índice: fecha ISO → items visibles ese día (con filtros aplicados)
  const porFecha = useMemo(() => {
    const map = new Map<string, Disp[]>();
    const add = (fecha: string, d: Disp) => {
      const arr = map.get(fecha);
      if (arr) arr.push(d);
      else map.set(fecha, [d]);
    };

    for (const it of items) {
      if (!tiposOn.has(it.tipo)) continue;
      if (filtroPersona && it.responsable !== filtroPersona) continue;
      if (filtroArea && it.area !== filtroArea) continue;
      for (const f of rangoFechas(it.fecha, it.fechaFin)) {
        add(f, {
          key: `i-${it.id}-${f}`,
          source: "item",
          id: it.id,
          tipo: it.tipo,
          titulo: it.titulo,
          hora: it.hora,
          estado: it.estado,
          responsable: it.responsable,
          area: it.area,
          fecha: f,
          raw: it,
        });
      }
    }

    // Eventos del módulo Eventos (solo lectura). Se ocultan si hay filtro de
    // persona/área (no tienen esos campos) o si se apaga el tipo "evento".
    if (verEventos && tiposOn.has("evento") && !filtroPersona && !filtroArea) {
      for (const ev of eventos) {
        for (const f of rangoFechas(ev.fecha, ev.fechaFin)) {
          add(f, {
            key: `e-${ev.id}-${f}`,
            source: "evento",
            id: ev.id,
            tipo: "evento",
            titulo: ev.titulo,
            hora: ev.horario,
            estado: ev.estado,
            fecha: f,
          });
        }
      }
    }

    // Orden dentro del día: por hora (los sin hora al final), luego título
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ha = a.hora || "99:99";
        const hb = b.hora || "99:99";
        if (ha !== hb) return ha.localeCompare(hb);
        return a.titulo.localeCompare(b.titulo, "es");
      });
    }
    return map;
  }, [items, eventos, tiposOn, filtroPersona, filtroArea, verEventos]);

  const weeks = useMemo(
    () => (cursor ? buildMonth(cursor.y, cursor.m) : []),
    [cursor],
  );

  const selDisp = selected ? porFecha.get(selected) ?? [] : [];

  // ── Acciones ───────────────────────────────────────────────────────
  function toggleTipo(t: TipoCalendario) {
    setTiposOn((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function goMonth(delta: number) {
    setCursor((c) => {
      if (!c) return c;
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function goHoy() {
    if (!today) return;
    const d = fromISO(today);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  }

  function openAdd(fecha: string) {
    setEditId(null);
    setForm(emptyForm(fecha || selected || today));
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(it: CalendarioItem) {
    setEditId(it.id);
    setForm({
      tipo: it.tipo,
      titulo: it.titulo,
      fecha: it.fecha,
      hora: it.hora ?? "",
      fechaFin: it.fechaFin ?? "",
      responsable: it.responsable ?? "",
      area: it.area ?? "",
      estado: it.estado,
      notas: it.notas ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function guardar() {
    const titulo = form.titulo.trim();
    if (!titulo) {
      setFormError("Ponle un título.");
      return;
    }
    if (!form.fecha) {
      setFormError("Elige una fecha.");
      return;
    }
    if (form.fechaFin && form.fechaFin < form.fecha) {
      setFormError("La fecha de fin no puede ser antes de la de inicio.");
      return;
    }
    const input: CalendarioItemInput = {
      tipo: form.tipo,
      titulo,
      fecha: form.fecha,
      fechaFin: form.fechaFin || null,
      hora: form.hora || null,
      responsable: form.responsable || null,
      area: form.area || null,
      estado: form.estado,
      notas: form.notas || null,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editId) {
        const upd = await updateCalendarioItem(editId, input);
        setItems((prev) => prev.map((it) => (it.id === editId ? upd : it)));
      } else {
        const created = await createCalendarioItem(input);
        setItems((prev) => [...prev, created]);
        setSelected(created.fecha);
      }
      setModalOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function borrar(id: string) {
    setSaving(true);
    try {
      await deleteCalendarioItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setConfirmDel(null);
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function onDispClick(d: Disp) {
    if (d.source === "evento") {
      router.push(`/eventos/${d.id}`);
    } else if (d.raw) {
      openEdit(d.raw);
    }
  }

  // ── Render ───────────────────────────────────────────────────────
  if (!cursor) {
    return (
      <div className="py-16 text-center text-cacao-mute font-serif italic">
        Cargando calendario…
      </div>
    );
  }

  const tituloMes = `${MESES[cursor.m]} ${cursor.y}`;

  return (
    <div>
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-terracotta" />
          <h2 className="font-cinzel text-xl sm:text-2xl tracking-[0.06em] text-cacao capitalize">
            {tituloMes}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Mes anterior"
            className="rounded-lg ring-1 ring-marfil p-2 text-cacao hover:bg-marfil-soft"
          >
            <ChevronIcon className="size-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={goHoy}
            className="rounded-lg ring-1 ring-marfil px-3 py-2 text-sm text-cacao hover:bg-marfil-soft"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Mes siguiente"
            className="rounded-lg ring-1 ring-marfil p-2 text-cacao hover:bg-marfil-soft"
          >
            <ChevronIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => openAdd(selected || today)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-terracotta-deep"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>

      {/* Filtros: tipos (toggle) + persona + área */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TIPOS_CALENDARIO.map((t) => {
          const on = tiposOn.has(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleTipo(t.value)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 transition-colors ${
                on ? t.color : "bg-white text-cacao-mute ring-marfil"
              }`}
            >
              <span
                className={`size-2 rounded-full ${on ? t.dot : "bg-cacao-mute"}`}
              />
              {t.label}
            </button>
          );
        })}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="rounded-lg ring-1 ring-marfil bg-white px-2.5 py-1.5 text-xs text-cacao"
            aria-label="Filtrar por persona"
          >
            <option value="">Todas las personas</option>
            {opcionesResponsable.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="rounded-lg ring-1 ring-marfil bg-white px-2.5 py-1.5 text-xs text-cacao"
            aria-label="Filtrar por área"
          >
            <option value="">Todas las áreas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-cacao-soft cursor-pointer select-none">
            <input
              type="checkbox"
              checked={verEventos}
              onChange={(e) => setVerEventos(e.target.checked)}
              className="accent-terracotta"
            />
            Mostrar eventos
          </label>
        </div>
      </div>

      {error && <ErrorBanner className="mb-4">{error}</ErrorBanner>}

      {/* Rejilla del mes */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-marfil bg-white">
        <div className="grid grid-cols-7 border-b border-marfil-light bg-marfil-soft">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-1 py-2 text-center font-display text-[10px] tracking-[0.2em] text-cacao-soft"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weeks.flat().map((iso) => {
            const d = fromISO(iso);
            const inMonth = d.getMonth() === cursor.m;
            const isToday = iso === today;
            const isSel = iso === selected;
            const dayItems = porFecha.get(iso) ?? [];
            const visibles = dayItems.slice(0, 3);
            const resto = dayItems.length - visibles.length;
            return (
              <div
                key={iso}
                onClick={() => setSelected(iso)}
                className={`group relative min-h-[74px] sm:min-h-[104px] border-b border-r border-marfil-light p-1 sm:p-1.5 cursor-pointer transition-colors ${
                  inMonth ? "bg-white" : "bg-marfil-soft/40"
                } ${isSel ? "ring-2 ring-inset ring-terracotta/40" : ""} hover:bg-marfil-soft`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-terracotta text-white font-semibold"
                        : inMonth
                          ? "text-cacao"
                          : "text-cacao-mute"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAdd(iso);
                    }}
                    aria-label="Agregar en este día"
                    className="opacity-0 group-hover:opacity-100 text-cacao-mute hover:text-terracotta transition-opacity"
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                </div>

                <div className="mt-0.5 space-y-0.5">
                  {visibles.map((di) => {
                    const meta = tipoCalendarioMeta(di.tipo);
                    const done = di.estado === "completado";
                    return (
                      <button
                        key={di.key}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDispClick(di);
                        }}
                        title={`${di.hora ? di.hora + " · " : ""}${di.titulo}`}
                        className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight ring-1 ${meta.color} ${
                          done ? "opacity-55 line-through" : ""
                        }`}
                      >
                        <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} />
                        {di.hora && (
                          <span className="shrink-0 tabular-nums opacity-70">
                            {di.hora}
                          </span>
                        )}
                        <span className="truncate">{di.titulo}</span>
                      </button>
                    );
                  })}
                  {resto > 0 && (
                    <div className="px-1 text-[10px] text-cacao-mute">
                      +{resto} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda del día seleccionado */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-cinzel text-lg tracking-[0.05em] text-cacao capitalize">
            {selected ? fechaLarga(selected) : "—"}
          </h3>
          <button
            type="button"
            onClick={() => openAdd(selected || today)}
            className="inline-flex items-center gap-1.5 rounded-lg ring-1 ring-marfil px-3 py-1.5 text-sm text-cacao hover:bg-marfil-soft"
          >
            <PlusIcon className="size-4" />
            Agregar en este día
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-cacao-mute font-serif italic">
            Cargando…
          </p>
        ) : selDisp.length === 0 ? (
          <p className="rounded-xl ring-1 ring-marfil bg-white px-4 py-6 text-center text-sm text-cacao-mute font-serif italic">
            Nada agendado este día. Toca “Agregar” para empezar.
          </p>
        ) : (
          <ul className="space-y-2">
            {selDisp.map((di) => {
              const meta = tipoCalendarioMeta(di.tipo);
              const estado = di.estado ? estadoCalendarioMeta(di.estado) : null;
              return (
                <li key={di.key}>
                  <button
                    type="button"
                    onClick={() => onDispClick(di)}
                    className="flex w-full items-start gap-3 rounded-xl ring-1 ring-marfil bg-white px-3 py-2.5 text-left hover:bg-marfil-soft transition-colors"
                  >
                    <span className={`mt-1 size-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        {di.hora && (
                          <span className="inline-flex items-center gap-1 text-xs text-cacao-soft">
                            <ClockIcon className="size-3.5" />
                            {di.hora}
                          </span>
                        )}
                        {di.source === "evento" && (
                          <span className="text-[10px] text-cacao-mute">
                            (Eventos ↗)
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-1 text-sm text-cacao ${
                          di.estado === "completado" ? "line-through opacity-60" : ""
                        }`}
                      >
                        {di.titulo}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-cacao-soft">
                        {di.responsable && <span>{di.responsable}</span>}
                        {di.area && <span>· {di.area}</span>}
                        {estado && di.source === "item" && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ${estado.color}`}
                          >
                            <span className={`size-1.5 rounded-full ${estado.dot}`} />
                            {estado.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal agregar / editar */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-cacao/40 backdrop-blur-sm"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white ring-1 ring-marfil p-5 sm:p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-cinzel text-xl tracking-[0.06em] text-cacao">
                {editId ? "Editar" : "Agregar al calendario"}
              </h2>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                aria-label="Cerrar"
                className="text-cacao-mute hover:text-cacao text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>

            {/* Tipo */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TIPOS_CALENDARIO.map((t) => {
                const on = form.tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: t.value }))}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs ring-1 ${
                      on ? t.color : "bg-white text-cacao-soft ring-marfil"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${on ? t.dot : "bg-cacao-mute"}`} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-cacao-soft">Título</span>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="¿Qué es?"
                  autoFocus
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-cacao-soft">Fecha</span>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-cacao-soft">Hora (opcional)</span>
                  <input
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                    className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-cacao-soft">
                  Fecha de fin (opcional — para varios días)
                </span>
                <input
                  type="date"
                  value={form.fechaFin}
                  min={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-cacao-soft">Responsable</span>
                  <select
                    value={form.responsable}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, responsable: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg ring-1 ring-marfil bg-white px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                  >
                    <option value="">— Nadie —</option>
                    {opcionesResponsable.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-cacao-soft">Área</span>
                  <select
                    value={form.area}
                    onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                    className="mt-1 w-full rounded-lg ring-1 ring-marfil bg-white px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                  >
                    <option value="">— Sin área —</option>
                    {AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-cacao-soft">Estado</span>
                <select
                  value={form.estado}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      estado: e.target.value as EstadoCalendario,
                    }))
                  }
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil bg-white px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                >
                  {ESTADOS_CALENDARIO.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-cacao-soft">Notas (opcional)</span>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg ring-1 ring-marfil px-3 py-2 text-sm text-cacao focus:outline-none focus:ring-terracotta"
                />
              </label>
            </div>

            {formError && <ErrorBanner className="mt-4">{formError}</ErrorBanner>}

            <div className="mt-5 flex items-center justify-between gap-2">
              {editId ? (
                <button
                  type="button"
                  onClick={() => setConfirmDel(editId)}
                  disabled={saving}
                  className="rounded-xl px-3 py-2 text-sm text-terracotta hover:bg-marfil-soft disabled:opacity-50"
                >
                  Eliminar
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl ring-1 ring-marfil px-4 py-2 text-sm text-cacao hover:bg-marfil-soft disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={saving}
                  className="rounded-xl bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-deep disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDel !== null}
        title="¿Eliminar del calendario?"
        message="Esta acción no se puede deshacer."
        busy={saving}
        onConfirm={() => confirmDel && borrar(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
