"use client";

import { useEffect, useRef } from "react";
import { Isotipo } from "../_lib/Isotipo";
import { caracolMarkup } from "../_lib/caracol";
import { NIVELES } from "../_lib/data";

const RANGO = 64; // % de recorrido de la panorámica

/**
 * Hero — recorrido vertical por la casa. Placeholder de la imagen 360 real.
 *
 * Crítico en móvil: el gesto vertical se cede al scroll de la página. Se
 * detecta el eje del gesto en los primeros 10px (ver 03-ARRANQUE): horizontal
 * controla el recorrido, vertical deja pasar el scroll. Sin esto el hero
 * secuestra el scroll y la página no baja.
 */
export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const panoRef = useRef<HTMLDivElement>(null);
  const rielPRef = useRef<HTMLDivElement>(null);
  const placaNRef = useRef<HTMLDivElement>(null);
  const placaLRef = useRef<HTMLDivElement>(null);
  const heroTxtRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current!;
    const pano = panoRef.current!;
    const rielP = rielPRef.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let pos = 0;
    let auto = !reduce;
    let arr = false;
    let y0 = 0;
    let p0 = 0;

    const render = () => {
      pos = Math.max(0, Math.min(1, pos));
      pano.style.transform = `translateY(${-pos * RANGO}%)`;
      rielP.style.top = pos * 100 + "%";
      const k = Math.min(3, Math.round(pos * 3));
      if (placaNRef.current) placaNRef.current.textContent = NIVELES[k].n;
      if (placaLRef.current) placaLRef.current.textContent = NIVELES[k].l;
    };
    const ini = (y: number) => {
      arr = true;
      auto = false;
      y0 = y;
      p0 = pos;
      hero.classList.add("arr");
    };
    const mov = (y: number) => {
      if (!arr) return;
      pos = p0 + (y0 - y) / hero.offsetHeight * 1.15;
      render();
    };
    const fin = () => {
      arr = false;
      hero.classList.remove("arr");
    };

    // ratón: arrastre vertical libre (no hay scroll en conflicto).
    const onMouseDown = (e: MouseEvent) => {
      ini(e.clientY);
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => mov(e.clientY);
    hero.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", fin);

    // táctil: el recorrido se controla con gesto HORIZONTAL; el vertical
    // se cede al scroll del documento.
    let tx0 = 0,
      ty0 = 0,
      eje: "x" | "y" | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      tx0 = t.clientX;
      ty0 = t.clientY;
      eje = null;
      p0 = pos;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const dx = t.clientX - tx0,
        dy = t.clientY - ty0;
      if (eje === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        eje = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (eje === "x") {
          auto = false;
          hero.classList.add("arr");
        }
      }
      if (eje === "y") return; // la página hace scroll normal
      pos = p0 - dx / hero.offsetWidth * 1.1;
      render();
      e.preventDefault();
    };
    const onTouchEnd = () => {
      eje = null;
      fin();
    };
    hero.addEventListener("touchstart", onTouchStart, { passive: true });
    hero.addEventListener("touchmove", onTouchMove, { passive: false });
    hero.addEventListener("touchend", onTouchEnd, { passive: true });
    hero.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // rueda: solo mientras el hero está a tope de página.
    const onWheel = (e: WheelEvent) => {
      if (window.scrollY > 4) return;
      const sig = pos + e.deltaY / 1400;
      if (sig > 0 && sig < 1) {
        e.preventDefault();
        auto = false;
        pos = sig;
        render();
      }
    };
    hero.addEventListener("wheel", onWheel, { passive: false });

    // deriva automática hasta que el usuario toma control.
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (!reduce) {
      let dir = 1;
      intervalId = setInterval(() => {
        if (!auto || arr) return;
        pos += 0.0015 * dir;
        if (pos >= 1 || pos <= 0) dir *= -1;
        render();
      }, 32);
    }
    render();

    // parallax del texto y del fondo al salir del hero.
    const onScroll = () => {
      const y = window.scrollY,
        h = hero.offsetHeight;
      if (y < h && !reduce) {
        const p = y / h;
        pano.style.opacity = String(1 - p * 1.1);
        const t = heroTxtRef.current;
        if (t) {
          t.style.transform = `translateY(${p * 72}px)`;
          t.style.opacity = String(1 - p * 1.4);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      hero.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", fin);
      hero.removeEventListener("touchstart", onTouchStart);
      hero.removeEventListener("touchmove", onTouchMove);
      hero.removeEventListener("touchend", onTouchEnd);
      hero.removeEventListener("touchcancel", onTouchEnd);
      hero.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <header className="hero" id="top" ref={heroRef}>
      <div className="nota">Placeholder — imagen 360 de la escalera caracol</div>
      <div className="pano" ref={panoRef}>
        <svg
          viewBox="0 0 1200 1560"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect width="1200" height="1560" fill="#2E1A10" />
          <g fill="none" dangerouslySetInnerHTML={{ __html: caracolMarkup() }} />
        </svg>
      </div>

      <div className="hero-txt" ref={heroTxtRef}>
        <div className="hero-iso" aria-label="Quinta Mamá">
          <Isotipo className="iso" />
        </div>
        <div className="hero-estd">Chacao · Caracas · Venezuela</div>
        <h1>
          <span className="r">En</span> <em>Quinta Mamá</em>
          <br />
          <span className="r">
            la cultura es la esencia
            <br />
            del bienestar
          </span>
        </h1>
        <div className="hero-sub">
          Centro de salud y cultura
          <br />
          Impulsado por la comunidad intergeneracional
        </div>
      </div>

      <div className="placa">
        <div className="placa-n" ref={placaNRef}>
          00
        </div>
        <div className="placa-l" ref={placaLRef}>
          Luz cenital
        </div>
      </div>

      <div className="riel">
        <div className="riel-p" ref={rielPRef} style={{ top: 0 }} />
        <span className="riel-lbl" style={{ top: "0%" }}>
          Techo
        </span>
        <span className="riel-lbl" style={{ top: "33%" }}>
          Piso 2
        </span>
        <span className="riel-lbl" style={{ top: "66%" }}>
          Piso 1
        </span>
        <span className="riel-lbl" style={{ top: "100%" }}>
          PB
        </span>
      </div>

      <div className="arrastra">Arrastra para descender</div>
    </header>
  );
}
