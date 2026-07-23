"use client";

import { useEffect } from "react";

/**
 * Revelado al entrar en pantalla: observa todos los `.rv` del sitio y les
 * añade `.in`. Escalonado de 80ms entre elementos vecinos.
 * Respeta `prefers-reduced-motion` (el CSS ya deja los `.rv` visibles).
 */
export function ScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll<HTMLElement>(".qm-root .rv").forEach((el, i) => {
      el.style.transitionDelay = (i % 4) * 80 + "ms";
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
