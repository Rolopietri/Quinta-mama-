"use client";

import type { Aliado } from "../_lib/data";
import { Placeholder } from "../_lib/placeholder";
import { useAbrirAliado } from "./AliadosProvider";

/** Galería de fichas de aliados (Cultura / Bienestar). Clic abre el modal. */
export function Grid({
  id,
  data,
  tono,
}: {
  id: string;
  data: Aliado[];
  tono: string;
}) {
  const abrir = useAbrirAliado();
  return (
    <div className="grid rv" id={id}>
      {data.map((x) => (
        <article
          key={x.n}
          className="card"
          onClick={() => abrir(x, tono)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              abrir(x, tono);
            }
          }}
        >
          <div className="ph">
            <Placeholder seed={x.n} tono={tono} />
          </div>
          <span className="card-piso" style={{ background: tono }}>
            {x.p}
          </span>
          <div className="card-txt">
            <div className="card-head">
              <span className={`marca-slot${x.logo ? " tiene" : ""}`}>
                {/* Logos de aliados pendientes; origen/formato aún desconocido.
                    Cuando lleguen, valorar next/image + remotePatterns. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.logo ? <img src={x.logo} alt={x.n} /> : "Logo"}
              </span>
              <h3>{x.n}</h3>
            </div>
            <p>{x.s}</p>
            <span className="card-ver">Conocer</span>
          </div>
        </article>
      ))}
    </div>
  );
}
