"use client";

// Sistema Operativo · cliente principal (vive bajo /tareas)
// ═══════════════════════════════════════════════════════════════════
// Navegación interna de las 9 vistas + contenido. Estética blanco y negro
// del prototipo (tinta/papel/fondo/alerta). Se va portando vista por vista;
// arranca con Áreas funcionando y el resto como "en construcción".

import { useEffect, useMemo, useState } from "react";
import { AREAS } from "@/lib/tareas-so/taxonomia";
import { progreso } from "@/lib/tareas-so/pce.mjs";
import { listObjetivos, listTareas } from "@/lib/data/tareas-so";
import type { Objetivo, Tarea } from "@/lib/tareas-so/types";

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

const LISTA_VISTA: Record<string, string> = {
  areas: "Toca un sub-eje para ver su estrategia y objetivos.",
  tablero: "El trabajo del equipo, ordenado por contribución estratégica.",
  objetivos: "Las metas estratégicas y su avance.",
  casa: "Inventario de espacios y trabajos abiertos.",
};

export function SistemaOperativoClient() {
  const [vista, setVista] = useState("areas");
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [o, t] = await Promise.all([listObjetivos(), listTareas()]);
        if (!vivo) return;
        setObjetivos(o);
        setTareas(t);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "Error cargando datos");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="text-[#0F0F0F]">
      {/* Navegación interna */}
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

      {vista === "areas" ? (
        <VistaAreas objetivos={objetivos} tareas={tareas} loading={loading} />
      ) : (
        <EnConstruccion titulo={etiqueta(vista)} nota={LISTA_VISTA[vista]} />
      )}
    </div>
  );
}

function etiqueta(id: string): string {
  return VISTAS.find(([v]) => v === id)?.[1] ?? id;
}

// ── Vista: Áreas ────────────────────────────────────────────────────
function VistaAreas({
  objetivos,
  tareas,
  loading,
}: {
  objetivos: Objetivo[];
  tareas: Tarea[];
  loading: boolean;
}) {
  const activas = useMemo(
    () => tareas.filter((t) => t.estado === "pendiente"),
    [tareas],
  );

  return (
    <div className="space-y-6">
      {loading && (
        <p className="text-[13px] text-[#8C8C86] italic">Cargando datos…</p>
      )}

      {AREAS.map((a) => {
        const objsArea = objetivos.filter((o) => o.areaId === a.id);
        const avance = objsArea.length
          ? Math.round(
              objsArea.reduce((s, o) => s + progreso(o), 0) / objsArea.length,
            )
          : null;
        return (
          <section key={a.id} className="border border-[#DEDEDA] bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 border-b border-[#DEDEDA]">
              <h2 className="text-[11px] tracking-[0.16em] uppercase font-medium">
                <span className="font-mono">{a.id}</span> · {a.nombre}
              </h2>
              <span className="text-[11px] text-[#8C8C86]">
                Dueño: {a.dueno}
                {avance !== null && (
                  <span className="font-mono"> · {avance}% de avance</span>
                )}
              </span>
            </header>
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
                        {objsSub.length} objetivo{objsSub.length === 1 ? "" : "s"}
                        {" · "}
                        {tareasSub.length} tarea{tareasSub.length === 1 ? "" : "s"} activa
                        {tareasSub.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#8C8C86] mt-1 leading-relaxed">
                      {s.estrategia}
                    </p>
                    {objsSub.length === 0 && (
                      <p className="text-[11px] text-[#9F3E2E] mt-1 uppercase tracking-wider">
                        Sin objetivos
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Reglas de excepción (texto fijo del sistema) */}
      <section className="border border-[#DEDEDA] bg-white">
        <header className="px-4 py-3 border-b border-[#DEDEDA]">
          <h2 className="text-[11px] tracking-[0.16em] uppercase font-medium">
            Reglas de excepción{" "}
            <span className="text-[#8C8C86] normal-case tracking-normal font-normal">
              — anulan el puntaje
            </span>
          </h2>
        </header>
        <div className="px-4 py-3 space-y-3 text-[12.5px]">
          <Regla n="1 · Patrimonio">
            Toda tarea de OPS-05 con riesgo estructural o de seguridad se marca
            Crítica sin importar el puntaje. La casa es el activo; nada la
            subordina.
          </Regla>
          <Regla n="2 · Compromiso adquirido">
            Obligación contractual o fecha comprometida con un tercero se marca
            Crítica.
          </Regla>
          <Regla n="3 · Concentración">
            Si más del 60% de las tareas activas de una persona son de prioridad
            alta, el sistema avisa. Con responsables múltiples, la tarea cuenta
            para cada uno.
          </Regla>
          <Regla n="4 · Vacío">
            Un área sin tareas activas, o un sub-eje sin objetivos, se señala.
          </Regla>
        </div>
      </section>
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

// ── Placeholder de vistas aún no portadas ───────────────────────────
function EnConstruccion({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <div className="border border-[#DEDEDA] bg-white px-6 py-12 text-center">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#8C8C86] mb-2">
        {titulo}
      </p>
      <p className="text-[15px] text-[#0F0F0F] mb-1">En construcción</p>
      {nota && <p className="text-[13px] text-[#8C8C86]">{nota}</p>}
    </div>
  );
}
