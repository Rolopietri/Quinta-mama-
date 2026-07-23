"use client";

import { BIENESTAR, C, CULTURA, type Aliado } from "../_lib/data";
import { useAbrirAliado } from "./AliadosProvider";

type Celda = Aliado & { area: string; tono: string };

const TODOS: Celda[] = [
  ...CULTURA.map((x) => ({ ...x, area: "Cultura", tono: C.terracota })),
  ...BIENESTAR.map((x) => ({ ...x, area: "Bienestar", tono: C.oliva })),
];

/** Muro de logos de los siete aliados. Clic abre el modal. */
export function MuroLogos() {
  const abrir = useAbrirAliado();
  return (
    <div className="muro-logos rv" id="muroLogos">
      {TODOS.map((x) => (
        <div
          key={x.n}
          className="logo-celda"
          style={{ color: x.tono }}
          onClick={() => abrir(x, x.tono)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              abrir(x, x.tono);
            }
          }}
        >
          <span className={`slot${x.logo ? " tiene" : ""}`}>
            {/* Logos de aliados pendientes; origen/formato aún desconocido. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {x.logo ? <img src={x.logo} alt={x.n} /> : "Logo"}
          </span>
          <span className="nm" style={{ color: "var(--cacao)" }}>
            {x.n}
          </span>
          <span className="cat">
            {x.area} · {x.p}
          </span>
        </div>
      ))}
    </div>
  );
}
