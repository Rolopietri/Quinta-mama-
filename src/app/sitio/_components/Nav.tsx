"use client";

import { useEffect, useRef, useState } from "react";
import { Isotipo } from "../_lib/Isotipo";

const LINKS = [
  { href: "#historia", label: "Historia" },
  { href: "#cultura", label: "Cultura" },
  { href: "#bienestar", label: "Bienestar" },
  { href: "#eventos", label: "Eventos" },
  { href: "#pdis", label: "PDIS" },
  { href: "#aliados", label: "Alianzas" },
  { href: "#contacto", label: "Contacto" },
];

export function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const pilaresRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Encogimiento del header + relevo por la barra de pilares (patrón Soho House).
  useEffect(() => {
    const nav = navRef.current;
    const barra = pilaresRef.current;
    const hero = document.getElementById("top");
    const movil = () => matchMedia("(max-width:900px)").matches;
    let tick = false;

    const actualiza = () => {
      const y = window.scrollY;
      const h = hero ? hero.offsetHeight : 400;
      nav?.classList.toggle("solid", y > h - 130);
      nav?.classList.toggle("mini", y > 150);
      if (barra) {
        const releva = movil() && y > h * 0.62;
        barra.classList.toggle("visible", releva);
        nav?.classList.toggle("oculto", releva);
      }
      tick = false;
    };
    const onScroll = () => {
      if (!tick) {
        requestAnimationFrame(actualiza);
        tick = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", actualiza, { passive: true });
    actualiza();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", actualiza);
    };
  }, []);

  // Pilar activo sincronizado con la sección visible; la barra lo centra.
  useEffect(() => {
    const barra = pilaresRef.current;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const sel = "#" + e.target.id;
          document
            .querySelectorAll(".qm-root .menu a")
            .forEach((a) =>
              a.classList.toggle("activo", a.getAttribute("href") === sel),
            );
          const act = barra?.querySelector("a.activo") ?? null;
          document
            .querySelectorAll(".qm-root .pilares a")
            .forEach((a) =>
              a.classList.toggle("activo", a.getAttribute("href") === sel),
            );
          const nuevo = barra?.querySelector<HTMLAnchorElement>("a.activo") ?? null;
          if (barra && nuevo && nuevo !== act) {
            const c = nuevo.offsetLeft - barra.clientWidth / 2 + nuevo.offsetWidth / 2;
            barra.scrollTo({ left: Math.max(0, c), behavior: "smooth" });
          }
        });
      },
      { rootMargin: "-42% 0px -52% 0px" },
    );
    document.querySelectorAll(".qm-root section[id]").forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, []);

  // Los enlaces compensan la altura de las barras fijas antes de saltar.
  const alturaBarras = () => {
    const nav = navRef.current;
    const barra = pilaresRef.current;
    const cs = getComputedStyle(document.querySelector(".qm-root")!);
    const nh = nav?.classList.contains("mini")
      ? parseInt(cs.getPropertyValue("--nav-mini"))
      : parseInt(cs.getPropertyValue("--nav-h"));
    if (barra?.classList.contains("visible")) return barra.offsetHeight;
    return nh || 76;
  };

  const onAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const dest = document.querySelector(href);
    if (!dest) return;
    e.preventDefault();
    const y =
      dest.getBoundingClientRect().top + window.scrollY - alturaBarras() + 1;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <>
      <nav className="nav" ref={navRef}>
        <a
          href="#top"
          className="logo"
          onClick={(e) => onAnchor(e, "#top")}
          aria-label="Quinta Mamá — inicio"
        >
          <span className="isoW">
            <Isotipo className="iso" />
          </span>
          <span className="txt">
            <span className="estd">1955 · ESTD</span>
            <span className="qm">
              <span className="q">Quinta</span>
              <span className="m">Mamá</span>
            </span>
          </span>
        </a>
        <ul className={`menu${menuOpen ? " on" : ""}`}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={(e) => onAnchor(e, l.href)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          className="burger"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className="pilares" ref={pilaresRef}>
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={(e) => onAnchor(e, l.href)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
