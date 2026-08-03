"use client";

// Sistema Operativo · cliente principal (vive bajo /tareas)
// ═══════════════════════════════════════════════════════════════════
// Navegación interna de las 9 vistas + contenido. Estética blanco y negro
// del prototipo. Portado por lotes: Áreas, Tablero, Objetivos y Casa
// funcionan (lectura); las vistas con escritura quedan "en construcción".

import { useCallback, useEffect, useMemo, useState } from "react";
import { AREAS, VALORES, nombreSubEje, ESTADOS_ESPACIO } from "@/lib/tareas-so/taxonomia";
import { clasificar, progreso } from "@/lib/tareas-so/pce.mjs";
import {
  listObjetivos,
  listTareas,
  listPersonas,
  listEspacios,
  crearTarea,
} from "@/lib/data/tareas-so";
import type {
  Objetivo,
  Tarea,
  Persona,
  Espacio,
  Impacto,
  Proximidad,
} from "@/lib/tareas-so/types";

const VISTAS: [string, string][] = [
  ["tablero", "Tablero"],
  ["nueva", "Nueva tarea"],
  ["objetivos", "Objetivos"],
  ["areas", "Áreas"],
  ["casa", "Casa"],
  ["notif", "Notificaciones"],
  ["reportes", "Reportes"],
  ["sync", "Sincronizar"],
  ["config", "Ajustes"],
];

const NOTA_CONSTRUCCION: Record<string, string> = {
  nueva: "Crear tareas con el puntaje en vivo. Necesita la capa de escritura.",
  notif: "Avisos a responsables por asignación y vencimiento.",
  reportes: "Informe quincenal de operaciones.",
  sync: "Entrada y salida de datos — acá se importan los datos reales.",
  config: "Equipo, correos, pesos del PCE y umbrales.",
};

const ORDEN: Record<string, number> = {
  Crítica: 0,
  Estratégica: 1,
  "Operativa necesaria": 2,
  "Delegar o automatizar": 3,
  Ruido: 4,
};

// ── Helpers ─────────────────────────────────────────────────────────
function fmtFecha(d?: string): string {
  if (!d) return "—";
  const x = new Date(d + "T12:00:00");
  return x.toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
}
function diasHasta(d?: string): number | null {
  if (!d) return null;
  const x = new Date(d + "T12:00:00");
  const h = new Date();
  h.setHours(12, 0, 0, 0);
  return Math.round((x.getTime() - h.getTime()) / 86400000);
}
type Clasif = { nombre: string; critica: boolean; puntaje: number };
function clasifDe(t: Tarea, objs: Map<string, Objetivo>): Clasif {
  const o = t.objetivoId ? objs.get(t.objetivoId) : undefined;
  return clasificar({
    impacto: t.impacto,
    proximidad: t.proximidad,
    horizonte: o?.horizonte ?? null,
    valores: t.valores,
    compromiso: t.compromiso,
    patrimonio: t.patrimonio,
    subEjeId: t.subEjeId,
  }) as Clasif;
}

export function SistemaOperativoClient() {
  const [vista, setVista] = useState("tablero");
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [o, t, p, e] = await Promise.all([
          listObjetivos(),
          listTareas(),
          listPersonas(),
          listEspacios(),
        ]);
        if (!vivo) return;
        setObjetivos(o);
        setTareas(t);
        setPersonas(p);
        setEspacios(e);
      } catch (err) {
        if (vivo)
          setError(err instanceof Error ? err.message : "Error cargando datos");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const recargarTareas = useCallback(async () => {
    try {
      setTareas(await listTareas());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error recargando");
    }
  }, []);

  const objMap = useMemo(
    () => new Map(objetivos.map((o) => [o.id, o])),
    [objetivos],
  );
  const nombreDe = useMemo(() => {
    const m = new Map(personas.map((p) => [p.id, p.nombre]));
    return (ids: string[]) =>
      ids.length ? ids.map((i) => m.get(i) ?? "?").join(" · ") : "Sin asignar";
  }, [personas]);

  return (
    <div className="text-[#0F0F0F]">
      <nav className="flex flex-wrap gap-1.5 border-b border-[#DEDEDA] pb-3 mb-5">
        {VISTAS.map(([id, label], i) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={`text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${
              vista === id
                ? "bg-[#0F0F0F] text-white border-[#0F0F0F]"
                : "bg-white text-[#8C8C86] border-[#DEDEDA] hover:text-[#0F0F0F]"
            }`}
          >
            <span className="font-mono mr-1.5 opacity-50">
              {String(i + 1).padStart(2, "0")}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="border border-[#9F3E2E] border-l-4 bg-white px-4 py-3 text-sm text-[#9F3E2E] mb-4">
          {error}
        </div>
      )}
      {loading && (
        <p className="text-[13px] text-[#8C8C86] italic mb-4">Cargando datos…</p>
      )}

      {vista === "tablero" && (
        <VistaTablero
          tareas={tareas}
          objetivos={objetivos}
          espacios={espacios}
          objMap={objMap}
          nombreDe={nombreDe}
        />
      )}
      {vista === "areas" && <VistaAreas objetivos={objetivos} tareas={tareas} />}
      {vista === "objetivos" && <VistaObjetivos objetivos={objetivos} tareas={tareas} />}
      {vista === "casa" && <VistaCasa espacios={espacios} tareas={tareas} />}
      {vista === "nueva" && (
        <VistaNueva
          objetivos={objetivos}
          personas={personas}
          espacios={espacios}
          onCreated={async () => {
            await recargarTareas();
            setVista("tablero");
          }}
        />
      )}
      {["notif", "reportes", "sync", "config"].includes(vista) && (
        <EnConstruccion titulo={etiqueta(vista)} nota={NOTA_CONSTRUCCION[vista]} />
      )}
    </div>
  );
}

function etiqueta(id: string): string {
  return VISTAS.find(([v]) => v === id)?.[1] ?? id;
}

// ── Componentes chicos ──────────────────────────────────────────────
function Medidor({ valor, critica }: { valor: number; critica: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[12px] w-6 text-right">{valor}</span>
      <div className="relative h-3 w-[120px] bg-[#EDEDEA]">
        <div
          className={`absolute inset-y-0 left-0 ${critica ? "bg-[#9F3E2E]" : "bg-[#0F0F0F]"}`}
          style={{ width: `${Math.min(100, valor)}%` }}
        />
        {[20, 40, 70].map((g) => (
          <div
            key={g}
            className="absolute -top-0.5 -bottom-0.5 w-px bg-[#B9B9B3]"
            style={{ left: `${g}%` }}
          />
        ))}
      </div>
    </div>
  );
}
function ChipClasif({ c }: { c: Clasif }) {
  const cls = c.critica
    ? "bg-[#9F3E2E] text-white border-[#9F3E2E]"
    : c.puntaje >= 70
      ? "bg-[#0F0F0F] text-white border-[#0F0F0F]"
      : "border-[#DEDEDA] text-[#8C8C86]";
  return (
    <span className={`inline-block text-[9px] tracking-[0.14em] uppercase px-2 py-0.5 border ${cls}`}>
      {c.nombre}
    </span>
  );
}
function Barra({ p }: { p: number }) {
  return (
    <div className="h-1 bg-[#EDEDEA] mt-1.5 relative">
      <div
        className={`absolute inset-y-0 left-0 ${p < 40 ? "bg-[#9F3E2E]" : "bg-[#0F0F0F]"}`}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}
function Kpi({ chico, num, nota }: { chico: string; num: React.ReactNode; nota?: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[9px] tracking-[0.16em] uppercase text-[#8C8C86] mb-1.5">
        {chico}
      </div>
      <div className="text-[26px] font-light leading-none font-mono">{num}</div>
      {nota && <div className="text-[11px] text-[#8C8C86] mt-1">{nota}</div>}
    </div>
  );
}
function Card({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-[#DEDEDA] bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 border-b border-[#DEDEDA]">
        <h2 className="text-[11px] tracking-[0.16em] uppercase font-medium">{titulo}</h2>
        {extra && <span className="text-[11px] text-[#8C8C86]">{extra}</span>}
      </header>
      {children}
    </section>
  );
}

// ── Vista: Tablero ──────────────────────────────────────────────────
function VistaTablero({
  tareas,
  objetivos,
  espacios,
  objMap,
  nombreDe,
}: {
  tareas: Tarea[];
  objetivos: Objetivo[];
  espacios: Espacio[];
  objMap: Map<string, Objetivo>;
  nombreDe: (ids: string[]) => string;
}) {
  const activas = tareas.filter((t) => t.estado === "pendiente" && t.objetivoId);
  const conClasif = activas
    .map((t) => ({ t, c: clasifDe(t, objMap) }))
    .sort((a, b) =>
      ORDEN[a.c.nombre] !== ORDEN[b.c.nombre]
        ? ORDEN[a.c.nombre] - ORDEN[b.c.nombre]
        : b.c.puntaje - a.c.puntaje,
    );
  const criticas = conClasif.filter((x) => x.c.critica).length;
  const estrategicas = conClasif.filter((x) => !x.c.critica && x.c.puntaje >= 70).length;
  const avanceG = objetivos.length
    ? Math.round(objetivos.reduce((s, o) => s + progreso(o), 0) / objetivos.length)
    : 0;
  const corto = objetivos.filter((o) => o.horizonte === "corto");
  const avanceC = corto.length
    ? Math.round(corto.reduce((s, o) => s + progreso(o), 0) / corto.length)
    : 0;
  const conNovedad = espacios.filter((e) => e.estado !== "operativo").length;
  const sinClasif = tareas.filter((t) => !t.objetivoId && t.estado !== "descartado").length;
  const vencidas = activas.filter((t) => {
    const d = diasHasta(t.vence);
    return d !== null && d < 0;
  }).length;

  return (
    <div className="space-y-5">
      {(sinClasif > 0 || vencidas > 0) && (
        <div className="space-y-2">
          {vencidas > 0 && (
            <Aviso k="Vencidas" rojo>
              {vencidas} tarea{vencidas === 1 ? "" : "s"} con fecha vencida. Reprogramar o cerrar.
            </Aviso>
          )}
          {sinClasif > 0 && (
            <Aviso k="Sin clasificar" rojo>
              {sinClasif} tarea{sinClasif === 1 ? "" : "s"} sin objetivo — no entran al tablero hasta asignarles uno.
            </Aviso>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[#DEDEDA] border border-[#DEDEDA]">
        <Kpi chico="Tareas activas" num={activas.length} />
        <Kpi chico="Críticas" num={criticas} nota="excepción sobre el PCE" />
        <Kpi chico="Estratégicas" num={estrategicas} nota="PCE ≥ 70" />
        <Kpi chico="Avance global" num={`${avanceG}%`} nota={<Barra p={avanceG} />} />
        <Kpi chico="Avance corto plazo" num={`${avanceC}%`} nota={<Barra p={avanceC} />} />
        <Kpi chico="Espacios con novedad" num={conNovedad} nota={`de ${espacios.length}`} />
      </div>

      <Card titulo="Tareas activas" extra={`${activas.length} en total`}>
        {conClasif.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[#8C8C86] italic">
            Ninguna tarea activa todavía. Los datos reales de Beatriz entran por
            la vista Sincronizar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] tracking-[0.16em] uppercase text-[#8C8C86]">
                  <th className="text-left font-medium px-4 py-2 border-b border-[#DEDEDA]">Tarea</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Responsables</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Vence</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">PCE</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {conClasif.map(({ t, c }) => {
                  const d = diasHasta(t.vence);
                  return (
                    <tr key={t.id} className="border-b border-[#DEDEDA] last:border-0 align-top">
                      <td className="px-4 py-3 max-w-[320px]">
                        <div className="text-[13px]">{t.titulo}</div>
                        <div className="font-mono text-[10px] text-[#B9B9B3] mt-1">
                          {t.id} · {t.subEjeId} — {nombreSubEje(t.subEjeId)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px]">{nombreDe(t.responsables)}</td>
                      <td className="px-3 py-3 font-mono text-[11px]" style={d !== null && d < 0 ? { color: "#9F3E2E" } : undefined}>
                        {fmtFecha(t.vence)}
                        {d !== null && (
                          <div className="text-[10px] text-[#8C8C86]">
                            {d < 0 ? `${Math.abs(d)} d vencida` : `${d} d`}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Medidor valor={c.puntaje} critica={c.critica} />
                      </td>
                      <td className="px-3 py-3"><ChipClasif c={c} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Aviso({ k, rojo, children }: { k: string; rojo?: boolean; children: React.ReactNode }) {
  return (
    <div className={`border bg-white px-4 py-3 flex gap-3 items-start ${rojo ? "border-[#DEDEDA] border-l-[3px] border-l-[#9F3E2E]" : "border-[#DEDEDA] border-l-[3px] border-l-[#0F0F0F]"}`}>
      <span className={`text-[9px] tracking-[0.16em] uppercase pt-0.5 ${rojo ? "text-[#9F3E2E]" : "text-[#8C8C86]"} flex-none w-[92px]`}>{k}</span>
      <span className="text-[13px]">{children}</span>
    </div>
  );
}

// ── Vista: Objetivos ────────────────────────────────────────────────
function VistaObjetivos({ objetivos, tareas }: { objetivos: Objetivo[]; tareas: Tarea[] }) {
  return (
    <div className="space-y-6">
      {AREAS.map((a) => {
        const objs = objetivos.filter((o) => o.areaId === a.id);
        const pr = objs.length
          ? Math.round(objs.reduce((s, o) => s + progreso(o), 0) / objs.length)
          : null;
        return (
          <Card
            key={a.id}
            titulo={`${a.id} · ${a.nombre}`}
            extra={pr !== null ? `${pr}% de avance` : "sin objetivos cargados"}
          >
            {objs.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-[#8C8C86] italic">
                Todavía no hay objetivos cargados para esta área.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[9px] tracking-[0.16em] uppercase text-[#8C8C86]">
                      <th className="text-left font-medium px-4 py-2 border-b border-[#DEDEDA]">Objetivo</th>
                      <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Sub-eje</th>
                      <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Horizonte</th>
                      <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Tareas</th>
                      <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA] w-[150px]">Avance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objs.map((o) => {
                      const p = progreso(o);
                      const ts = tareas.filter((t) => t.objetivoId === o.id && t.estado === "pendiente").length;
                      return (
                        <tr key={o.id} className="border-b border-[#DEDEDA] last:border-0 align-top">
                          <td className="px-4 py-3 max-w-[320px]">
                            <div className="text-[13px]">{o.titulo}</div>
                            <div className="text-[11px] text-[#8C8C86] mt-0.5">{o.indicador}</div>
                            <div className="font-mono text-[10px] text-[#B9B9B3] mt-1">{o.id}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px]">{o.subEjeId}</td>
                          <td className="px-3 py-3">
                            <span className="text-[9px] tracking-[0.14em] uppercase px-2 py-0.5 border border-[#DEDEDA] text-[#8C8C86]">{o.horizonte}</span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[12px]">{ts}</td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-[13px]">{p}%</span>
                            <Barra p={p} />
                            <div className="text-[10px] text-[#8C8C86] mt-1">{o.actual} / {o.meta} {o.unidad}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Vista: Casa ─────────────────────────────────────────────────────
function estadoLabel(e: string): string {
  return ESTADOS_ESPACIO.find((x) => x.value === e)?.label ?? e;
}
function VistaCasa({ espacios, tareas }: { espacios: Espacio[]; tareas: Tarea[] }) {
  const activas = tareas.filter((t) => t.estado === "pendiente");
  const conNovedad = espacios.filter((e) => e.estado !== "operativo").length;
  const trabajosAbiertos = activas.filter((t) => t.espacioId).length;
  const conTrabajos = espacios.filter(
    (e) => activas.filter((t) => t.espacioId === e.id).length > 0,
  ).length;
  const plantas = espacios.reduce<string[]>((acc, e) => {
    if (!acc.includes(e.planta)) acc.push(e.planta);
    return acc;
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#DEDEDA] border border-[#DEDEDA]">
        <Kpi chico="Espacios" num={espacios.length} />
        <Kpi chico="Con novedad" num={conNovedad} nota="no operativos" />
        <Kpi chico="Con trabajos" num={conTrabajos} />
        <Kpi chico="Trabajos abiertos" num={trabajosAbiertos} />
      </div>

      <Card titulo="Inventario de la casa">
        {espacios.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[#8C8C86] italic">
            Todavía no hay espacios cargados. Entran por la vista Sincronizar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] tracking-[0.16em] uppercase text-[#8C8C86]">
                  <th className="text-left font-medium px-4 py-2 border-b border-[#DEDEDA]">Espacio</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Uso</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Estado</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-[#DEDEDA]">Trabajos abiertos</th>
                </tr>
              </thead>
              <tbody>
                {plantas.map((pl) => (
                  <FragmentoPlanta
                    key={pl}
                    planta={pl}
                    espacios={espacios.filter((e) => e.planta === pl)}
                    activas={activas}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
function FragmentoPlanta({ planta, espacios, activas }: { planta: string; espacios: Espacio[]; activas: Tarea[] }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="bg-[#F4F4F2] px-4 py-2 text-[9px] tracking-[0.2em] uppercase text-[#8C8C86]">
          {planta}
        </td>
      </tr>
      {espacios.map((e) => {
        const ab = activas.filter((t) => t.espacioId === e.id).length;
        const alerta = e.estado === "fuera" || e.estado === "intervención";
        return (
          <tr key={e.id} className="border-b border-[#DEDEDA] last:border-0 align-top">
            <td className="px-4 py-3">
              <div className="text-[13px]">{e.nombre}</div>
              <div className="font-mono text-[10px] text-[#B9B9B3] mt-1">{e.id}</div>
            </td>
            <td className="px-3 py-3 text-[12px] text-[#8C8C86]">{e.tipo}</td>
            <td className="px-3 py-3">
              <span className={`text-[9px] tracking-[0.14em] uppercase px-2 py-0.5 border ${alerta ? "bg-[#9F3E2E] text-white border-[#9F3E2E]" : "border-[#DEDEDA] text-[#8C8C86]"}`}>
                {estadoLabel(e.estado)}
              </span>
            </td>
            <td className="px-3 py-3 font-mono text-[13px]">{ab}</td>
          </tr>
        );
      })}
    </>
  );
}

// ── Vista: Áreas ────────────────────────────────────────────────────
function VistaAreas({ objetivos, tareas }: { objetivos: Objetivo[]; tareas: Tarea[] }) {
  const activas = tareas.filter((t) => t.estado === "pendiente");
  return (
    <div className="space-y-6">
      {AREAS.map((a) => {
        const objsArea = objetivos.filter((o) => o.areaId === a.id);
        const avance = objsArea.length
          ? Math.round(objsArea.reduce((s, o) => s + progreso(o), 0) / objsArea.length)
          : null;
        return (
          <Card
            key={a.id}
            titulo={`${a.id} · ${a.nombre}`}
            extra={
              <>
                Dueño: {a.dueno}
                {avance !== null && <span className="font-mono"> · {avance}% de avance</span>}
              </>
            }
          >
            <div className="divide-y divide-[#DEDEDA]">
              {a.subEjes.map((s) => {
                const objsSub = objetivos.filter((o) => o.subEjeId === s.id);
                const tareasSub = activas.filter((t) => t.subEjeId === s.id);
                return (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-[12px]">{s.id}</span>
                      <span className="text-[13px] font-medium">{s.nombre}</span>
                      <span className="ml-auto text-[11px] text-[#8C8C86] font-mono">
                        {objsSub.length} objetivo{objsSub.length === 1 ? "" : "s"} · {tareasSub.length} tarea{tareasSub.length === 1 ? "" : "s"} activa{tareasSub.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#8C8C86] mt-1 leading-relaxed">{s.estrategia}</p>
                    {objsSub.length === 0 && (
                      <p className="text-[11px] text-[#9F3E2E] mt-1 uppercase tracking-wider">Sin objetivos</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card titulo="Reglas de excepción" extra="anulan el puntaje">
        <div className="px-4 py-3 space-y-3 text-[12.5px]">
          <Regla n="1 · Patrimonio">Toda tarea de OPS-05 con riesgo estructural o de seguridad se marca Crítica sin importar el puntaje. La casa es el activo; nada la subordina.</Regla>
          <Regla n="2 · Compromiso adquirido">Obligación contractual o fecha comprometida con un tercero se marca Crítica.</Regla>
          <Regla n="3 · Concentración">Si más del 60% de las tareas activas de una persona son de prioridad alta, el sistema avisa. Con responsables múltiples, la tarea cuenta para cada uno.</Regla>
          <Regla n="4 · Vacío">Un área sin tareas activas, o un sub-eje sin objetivos, se señala.</Regla>
        </div>
      </Card>
    </div>
  );
}
function Regla({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[#0F0F0F] pl-3">
      <b className="block font-medium mb-0.5">{n}</b>
      <p className="text-[#4A4A46]">{children}</p>
    </div>
  );
}

// ── Vista: Nueva tarea ──────────────────────────────────────────────
const IMPACTOS: Impacto[] = ["alto", "medio", "bajo", "nulo"];
const PROXIMIDADES: Proximidad[] = ["directa", "requisito", "apoyo"];

function VistaNueva({
  objetivos,
  personas,
  espacios,
  onCreated,
}: {
  objetivos: Objetivo[];
  personas: Persona[];
  espacios: Espacio[];
  onCreated: () => void | Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [areaId, setAreaId] = useState("");
  const [subEjeId, setSubEjeId] = useState("");
  const [objetivoId, setObjetivoId] = useState("");
  const [responsables, setResponsables] = useState<string[]>([]);
  const [valores, setValores] = useState<string[]>([]);
  const [vence, setVence] = useState("");
  const [espacioId, setEspacioId] = useState("");
  const [impacto, setImpacto] = useState<Impacto>("medio");
  const [proximidad, setProximidad] = useState<Proximidad>("requisito");
  const [patrimonio, setPatrimonio] = useState(false);
  const [compromiso, setCompromiso] = useState(false);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const area = AREAS.find((a) => a.id === areaId) ?? null;
  const objetivosArea = objetivos.filter((o) => o.areaId === areaId);
  const objetivoSel = objetivos.find((o) => o.id === objetivoId) ?? null;

  function cambiarArea(v: string) {
    setAreaId(v);
    setSubEjeId("");
    setObjetivoId("");
  }
  function toggle(lista: string[], set: (x: string[]) => void, v: string) {
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  }

  const clasif =
    objetivoId && objetivoSel
      ? (clasificar({
          impacto,
          proximidad,
          horizonte: objetivoSel.horizonte,
          valores,
          compromiso,
          patrimonio,
          subEjeId,
        }) as Clasif)
      : null;

  const plantas = espacios.reduce<string[]>((acc, e) => {
    if (!acc.includes(e.planta)) acc.push(e.planta);
    return acc;
  }, []);

  async function crear() {
    if (!titulo.trim() || !objetivoId) return;
    setGuardando(true);
    setError(null);
    try {
      await crearTarea({
        titulo: titulo.trim(),
        subEjeId: subEjeId || objetivoSel!.subEjeId,
        objetivoId,
        espacioId: espacioId || undefined,
        vence: vence || undefined,
        impacto,
        proximidad,
        patrimonio,
        compromiso,
        nota: nota.trim() || undefined,
        responsables,
        valores,
      });
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la tarea");
      setGuardando(false);
    }
  }

  const lbl = "block text-[9px] tracking-[0.16em] uppercase text-[#8C8C86] mb-1.5";
  const inp = "w-full text-[13px] border border-[#DEDEDA] px-2.5 py-2 bg-white focus:outline focus:outline-2 focus:outline-[#0F0F0F] -outline-offset-1";

  return (
    <div className="max-w-3xl">
      <Card titulo="Crear tarea" extra="el objetivo es compuerta de entrada">
        <div className="p-4 space-y-4">
          {error && (
            <div className="border border-[#9F3E2E] border-l-4 px-3 py-2 text-[13px] text-[#9F3E2E]">{error}</div>
          )}

          <div>
            <label className={lbl}>Tarea</label>
            <input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Qué hay que hacer, en imperativo" />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Área</label>
              <select className={inp} value={areaId} onChange={(e) => cambiarArea(e.target.value)}>
                <option value="">Elegir área</option>
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>{a.id} · {a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Sub-eje</label>
              <select className={inp} value={subEjeId} onChange={(e) => setSubEjeId(e.target.value)} disabled={!area}>
                <option value="">{area ? "Elegir sub-eje" : "Elige un área"}</option>
                {area?.subEjes.map((s) => (
                  <option key={s.id} value={s.id}>{s.id} · {s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Objetivo · obligatorio</label>
              <select className={inp} value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)} disabled={!area}>
                <option value="">{area ? "Elegir objetivo" : "Elige un área"}</option>
                {objetivosArea.map((o) => (
                  <option key={o.id} value={o.id}>{o.id} · {o.titulo.slice(0, 50)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Responsables</label>
              <div className="border border-[#DEDEDA] max-h-[130px] overflow-y-auto px-2.5 py-1">
                {personas.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1 text-[12.5px] cursor-pointer">
                    <input type="checkbox" checked={responsables.includes(p.id)} onChange={() => toggle(responsables, setResponsables, p.id)} className="accent-[#0F0F0F]" />
                    {p.nombre}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Valores</label>
              <div className="border border-[#DEDEDA] max-h-[130px] overflow-y-auto px-2.5 py-1">
                {VALORES.map((v) => (
                  <label key={v} className="flex items-center gap-2 py-1 text-[12.5px] cursor-pointer">
                    <input type="checkbox" checked={valores.includes(v)} onChange={() => toggle(valores, setValores, v)} className="accent-[#0F0F0F]" />
                    Refuerza {v}
                  </label>
                ))}
                <label className="flex items-center gap-2 py-1 text-[12.5px] cursor-pointer text-[#9F3E2E]">
                  <input type="checkbox" checked={valores.includes("__tensiona")} onChange={() => toggle(valores, setValores, "__tensiona")} className="accent-[#9F3E2E]" />
                  Tensiona un valor
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Vence</label>
                <input type="date" className={inp} value={vence} onChange={(e) => setVence(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Espacio · opcional</label>
                <select className={inp} value={espacioId} onChange={(e) => setEspacioId(e.target.value)}>
                  <option value="">Sin espacio</option>
                  {plantas.map((pl) => (
                    <optgroup key={pl} label={pl}>
                      {espacios.filter((e) => e.planta === pl).map((e) => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Impacto en KPI · 40</label>
              <select className={inp} value={impacto} onChange={(e) => setImpacto(e.target.value as Impacto)}>
                {IMPACTOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Proximidad · 30</label>
              <select className={inp} value={proximidad} onChange={(e) => setProximidad(e.target.value as Proximidad)}>
                {PROXIMIDADES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Horizonte · heredado</label>
              <input className={`${inp} bg-[#F4F4F2] text-[#8C8C86]`} disabled value={objetivoSel ? objetivoSel.horizonte : "del objetivo"} />
            </div>
          </div>

          <div>
            <label className={lbl}>Nota</label>
            <input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Contexto, alcance o condición de cierre" />
          </div>

          <div className="border-t border-[#DEDEDA] pt-3 space-y-2">
            <label className="flex items-start gap-2.5 text-[12.5px] cursor-pointer">
              <input type="checkbox" checked={patrimonio} onChange={(e) => setPatrimonio(e.target.checked)} className="mt-0.5 accent-[#0F0F0F]" />
              <span>Regla de patrimonio<span className="block text-[#8C8C86] text-[11px]">Riesgo estructural o de seguridad. Solo aplica en OPS-05.</span></span>
            </label>
            <label className="flex items-start gap-2.5 text-[12.5px] cursor-pointer">
              <input type="checkbox" checked={compromiso} onChange={(e) => setCompromiso(e.target.checked)} className="mt-0.5 accent-[#0F0F0F]" />
              <span>Compromiso adquirido<span className="block text-[#8C8C86] text-[11px]">Obligación contractual o fecha comprometida con un tercero.</span></span>
            </label>
          </div>

          <div className="border-t border-[#DEDEDA] pt-3">
            <label className={lbl}>Puntaje de contribución estratégica</label>
            {clasif ? (
              <div className="flex items-center gap-3">
                <Medidor valor={clasif.puntaje} critica={clasif.critica} />
                <ChipClasif c={clasif} />
              </div>
            ) : (
              <p className="text-[12px] text-[#8C8C86] italic">Elige un objetivo para calcular el puntaje. Sin objetivo, la tarea no entra al tablero.</p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={crear}
              disabled={!titulo.trim() || !objetivoId || guardando}
              className="text-[11px] tracking-[0.18em] uppercase px-5 py-2.5 bg-[#0F0F0F] text-white disabled:bg-[#F4F4F2] disabled:text-[#B9B9B3] disabled:cursor-not-allowed"
            >
              {guardando ? "Creando…" : "Crear tarea"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Placeholder ─────────────────────────────────────────────────────
function EnConstruccion({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <div className="border border-[#DEDEDA] bg-white px-6 py-12 text-center">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#8C8C86] mb-2">{titulo}</p>
      <p className="text-[15px] text-[#0F0F0F] mb-1">En construcción</p>
      {nota && <p className="text-[13px] text-[#8C8C86]">{nota}</p>}
    </div>
  );
}
