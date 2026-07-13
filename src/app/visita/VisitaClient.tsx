"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

/* ─── Contenido de las plantas ──────────────────────────────────────
   Orden de recorrido: entras por la planta baja (A) y subes por la
   escalera hasta la azotea (D). Cada planta es una "parada" del recorrido. */

type Actividad = { nombre: string; detalle: string };
type Planta = {
  clave: string;
  etiqueta: string; // "Planta A"
  nivel: string; // "Planta baja"
  titulo: string; // nombre editorial del piso
  lema: string;
  plano: string;
  acento: string; // color de acento
  actividades: Actividad[];
};

const PLANTAS: Planta[] = [
  {
    clave: "A",
    etiqueta: "Planta A",
    nivel: "Planta baja",
    titulo: "El corazón de la casa",
    lema: "Donde todo comienza: mesa, cocina y encuentro.",
    plano: "/planos/planta-a.png",
    acento: "#B53727", // terracotta
    actividades: [
      {
        nombre: "Sala expositiva",
        detalle: "El gran salón para eventos, muestras y celebraciones.",
      },
      {
        nombre: "Comedor",
        detalle: "Cocina de temporada en un ambiente cálido y luminoso.",
      },
      {
        nombre: "Cafetín",
        detalle: "Café de especialidad, smoothies y desayunos caraqueños.",
      },
      {
        nombre: "Casa Payasa",
        detalle: "Un rincón para los más pequeños y el juego creativo.",
      },
    ],
  },
  {
    clave: "B",
    etiqueta: "Planta B",
    nivel: "Primer piso",
    titulo: "Movimiento y bienestar",
    lema: "El cuerpo que respira, se estira y se cuida.",
    plano: "/planos/planta-b.png",
    acento: "#758F5F", // oliva
    actividades: [
      {
        nombre: "Pilates",
        detalle: "Dos estudios dedicados al método, en grupos reducidos.",
      },
      {
        nombre: "Holistic",
        detalle: "Terapias y prácticas para el equilibrio del cuerpo y la mente.",
      },
      {
        nombre: "Arko",
        detalle: "Espacio de movimiento y disciplina corporal.",
      },
      {
        nombre: "Sala multiusos",
        detalle: "Talleres, clases y encuentros que cambian cada semana.",
      },
    ],
  },
  {
    clave: "C",
    etiqueta: "Planta C",
    nivel: "Segundo piso",
    titulo: "Comunidad y trabajo",
    lema: "Ideas, oficios y buen gusto que se cruzan.",
    plano: "/planos/planta-c.png",
    acento: "#9FB6D2", // azul polvo
    actividades: [
      {
        nombre: "Mercadillo del Buen Gusto",
        detalle: "Marcas y productos seleccionados de la escena local.",
      },
      {
        nombre: "Co-working",
        detalle: "Un lugar tranquilo para trabajar, crear y coincidir.",
      },
      {
        nombre: "Archivo Público",
        detalle: "Memoria y documentación abierta de la casa.",
      },
      {
        nombre: "Oficinas",
        detalle: "El equipo que hace posible cada día en la Quinta.",
      },
    ],
  },
  {
    clave: "D",
    etiqueta: "Planta D",
    nivel: "Azotea",
    titulo: "Las alturas",
    lema: "El cielo de Caracas para los momentos que se recuerdan.",
    plano: "/planos/planta-d.png",
    acento: "#C8695C", // coral
    actividades: [
      {
        nombre: "Eventos especiales",
        detalle: "Un espacio abierto y flexible para celebraciones únicas.",
      },
    ],
  },
];

/* Índice de secciones: 0 = entrada, 1..N = plantas, N+1 = cierre */
const TOTAL_SECCIONES = PLANTAS.length + 2;

export function VisitaClient() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activa, setActiva] = useState(0);
  const [entrado, setEntrado] = useState(false);

  const irA = useCallback((idx: number) => {
    const el = sectionRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Detectar la sección visible + revelar contenido al entrar en vista
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const activeObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            setActiva(idx);
            if (idx > 0) setEntrado(true);
          }
        }
      },
      { root, threshold: 0.55 }
    );

    const revealObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add("is-visible");
        }
      },
      { root, threshold: 0.2 }
    );

    sectionRefs.current.forEach((s) => s && activeObs.observe(s));
    root
      .querySelectorAll(".reveal")
      .forEach((el) => revealObs.observe(el));

    return () => {
      activeObs.disconnect();
      revealObs.disconnect();
    };
  }, []);

  const acentoActual =
    activa >= 1 && activa <= PLANTAS.length
      ? PLANTAS[activa - 1].acento
      : "#0A0A0A";

  return (
    <div
      ref={scrollRef}
      className="qm-scroll h-dvh overflow-y-auto snap-y snap-mandatory bg-white"
    >
      {/* ── Escalera-navegador (fija) ───────────────────────────── */}
      <Escalera
        plantas={PLANTAS}
        activa={activa}
        visible={entrado}
        acento={acentoActual}
        onIr={irA}
      />

      {/* ── Sección 0: Entrada ──────────────────────────────────── */}
      <section
        ref={(el) => {
          sectionRefs.current[0] = el;
        }}
        data-idx={0}
        className="relative snap-start min-h-dvh flex flex-col items-center justify-center px-6 text-center overflow-hidden"
      >
        {/* Círculo de fondo: la casa redonda */}
        <div
          aria-hidden
          className="qm-spin-slow pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[min(88vw,720px)] w-[min(88vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-marfil"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[min(58vw,460px)] w-[min(58vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-marfil-light"
        />

        <div className="relative z-10 reveal">
          <Image
            src="/logo-black.svg"
            alt="La Quinta Mamá"
            width={200}
            height={200}
            priority
            className="mx-auto h-32 w-32 sm:h-40 sm:w-40"
          />
          <p className="mt-8 font-display text-[11px] sm:text-xs tracking-[0.4em] text-cacao-soft">
            Casa de salud y cultura · Caracas
          </p>
          <h1 className="mt-4 font-cinzel text-4xl sm:text-6xl tracking-[0.12em] uppercase text-cacao">
            La Quinta Mamá
          </h1>
          <p className="mt-5 font-serif italic text-lg sm:text-2xl text-cacao-soft max-w-md mx-auto leading-snug">
            Donde la cultura y el bienestar florecen.
          </p>

          <button
            onClick={() => irA(1)}
            className="group mt-12 inline-flex flex-col items-center gap-3"
            aria-label="Entrar a la casa"
          >
            <span className="font-display text-sm tracking-[0.35em] text-cacao border border-cacao rounded-full px-10 py-4 transition-colors duration-300 group-hover:bg-cacao group-hover:text-white">
              ENTRAR
            </span>
            <span className="qm-float text-cacao-mute text-xl" aria-hidden>
              ↓
            </span>
          </button>
        </div>

        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 font-serif italic text-sm text-cacao-mute reveal">
          Sube por la escalera y recorre los cuatro pisos.
        </p>
      </section>

      {/* ── Secciones 1..N: las plantas ─────────────────────────── */}
      {PLANTAS.map((p, i) => (
        <PlantaSeccion
          key={p.clave}
          planta={p}
          idx={i + 1}
          subiendo={i === 0}
          ref={(el) => {
            sectionRefs.current[i + 1] = el;
          }}
        />
      ))}

      {/* ── Sección final: participar ───────────────────────────── */}
      <section
        ref={(el) => {
          sectionRefs.current[TOTAL_SECCIONES - 1] = el;
        }}
        data-idx={TOTAL_SECCIONES - 1}
        className="snap-start min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-marfil-soft"
      >
        <div className="reveal max-w-xl">
          <p className="font-display text-[11px] tracking-[0.4em] text-cacao-soft">
            Te esperamos
          </p>
          <h2 className="mt-4 font-cinzel text-3xl sm:text-4xl tracking-[0.1em] uppercase text-cacao">
            ¿Quieres participar?
          </h2>
          <p className="mt-5 font-serif italic text-lg text-cacao-soft leading-relaxed">
            Ya sea para tomar una clase, montar un evento, sumar tu marca al
            mercadillo o simplemente venir a conocernos: la casa está abierta.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:info@quintamama.com"
              className="font-display text-sm tracking-[0.3em] text-white bg-cacao rounded-full px-8 py-4 transition-colors hover:bg-terracotta"
            >
              ESCRÍBENOS
            </a>
            <button
              onClick={() => irA(0)}
              className="font-display text-sm tracking-[0.3em] text-cacao border border-marfil rounded-full px-8 py-4 transition-colors hover:border-cacao"
            >
              VOLVER A LA ENTRADA
            </button>
          </div>

          <p className="mt-12 font-display text-[11px] tracking-[0.4em] text-cacao-mute">
            La Quinta Mamá · Caracas
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block font-serif italic text-sm text-cacao-mute hover:text-cacao transition-colors"
          >
            ¿Eres del equipo? Entrar a la plataforma →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ─── Escalera-navegador ────────────────────────────────────────── */

function Escalera({
  plantas,
  activa,
  visible,
  acento,
  onIr,
}: {
  plantas: Planta[];
  activa: number;
  visible: boolean;
  acento: string;
  onIr: (idx: number) => void;
}) {
  // Se muestran de arriba (D) hacia abajo (A) para imitar la escalera real.
  const escalones = [...plantas].reverse();
  return (
    <nav
      aria-label="Pisos de la casa"
      className={`fixed right-4 sm:right-7 top-1/2 z-30 -translate-y-1/2 transition-opacity duration-700 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ul className="flex flex-col gap-1">
        {escalones.map((p, i) => {
          const idx = plantas.length - i; // índice real de sección
          const isActive = activa === idx;
          return (
            <li
              key={p.clave}
              // efecto escalera: cada escalón sangra un poco
              style={{ marginRight: `${i * 10}px` }}
            >
              <button
                onClick={() => onIr(idx)}
                className="group flex items-center justify-end gap-2"
                aria-current={isActive ? "true" : undefined}
                aria-label={`${p.etiqueta} — ${p.titulo}`}
              >
                <span
                  className={`font-display text-[10px] tracking-[0.25em] transition-all duration-300 ${
                    isActive
                      ? "opacity-100 text-cacao"
                      : "opacity-0 group-hover:opacity-100 text-cacao-soft"
                  }`}
                >
                  {p.etiqueta.replace("Planta ", "PISO ")}
                </span>
                <span
                  className="h-6 rounded-full transition-all duration-300"
                  style={{
                    width: isActive ? "3px" : "2px",
                    background: isActive ? acento : "#D5CECB",
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ─── Una planta ────────────────────────────────────────────────── */

const PlantaSeccion = ({
  planta: p,
  idx,
  ref,
}: {
  planta: Planta;
  idx: number;
  subiendo: boolean;
  ref: (el: HTMLElement | null) => void;
}) => {
  return (
    <section
      ref={ref}
      data-idx={idx}
      className="snap-start min-h-dvh flex items-center px-6 sm:px-10 py-20"
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 sm:gap-14 md:grid-cols-2">
        {/* El plano dentro del círculo (la casa redonda) */}
        <div className="reveal order-1 md:order-none">
          <div className="relative mx-auto aspect-square w-[78vw] max-w-[420px]">
            <div
              aria-hidden
              className="qm-spin-slow absolute inset-0 rounded-full border border-dashed"
              style={{ borderColor: p.acento, opacity: 0.35 }}
            />
            <div className="absolute inset-[7%] overflow-hidden rounded-full bg-marfil-soft ring-1 ring-marfil">
              <Image
                src={p.plano}
                alt={`Plano de ${p.etiqueta}`}
                fill
                sizes="(max-width: 768px) 78vw, 420px"
                className="object-contain p-6"
              />
            </div>
            {/* Sello del piso */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full text-white font-cinzel text-xl shadow-sm"
              style={{ background: p.acento }}
            >
              {p.clave}
            </div>
          </div>
        </div>

        {/* Texto y actividades */}
        <div>
          <p
            className="reveal font-display text-[11px] tracking-[0.4em]"
            style={{ color: p.acento }}
          >
            {p.etiqueta.toUpperCase()} · {p.nivel}
          </p>
          <h2 className="reveal mt-3 font-cinzel text-3xl sm:text-4xl tracking-[0.06em] uppercase text-cacao">
            {p.titulo}
          </h2>
          <p className="reveal mt-4 font-serif italic text-lg text-cacao-soft leading-snug">
            {p.lema}
          </p>

          <ul className="mt-8 divide-y divide-marfil border-t border-marfil">
            {p.actividades.map((a, j) => (
              <li
                key={a.nombre}
                className="reveal py-4"
                style={{ ["--reveal-delay" as string]: `${j * 90}ms` }}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="mt-1 h-1.5 w-1.5 flex-none rounded-full"
                    style={{ background: p.acento }}
                  />
                  <div>
                    <h3 className="text-lg font-medium text-cacao">
                      {a.nombre}
                    </h3>
                    <p className="mt-0.5 font-serif text-base text-cacao-soft leading-snug">
                      {a.detalle}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
