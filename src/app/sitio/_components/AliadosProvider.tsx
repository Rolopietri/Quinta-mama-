"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Aliado } from "../_lib/data";
import { Placeholder } from "../_lib/placeholder";

interface ModalState {
  aliado: Aliado;
  tono: string;
}

const AliadosCtx = createContext<(a: Aliado, tono: string) => void>(() => {});

export function useAbrirAliado() {
  return useContext(AliadosCtx);
}

export function AliadosProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [on, setOn] = useState(false);

  const abrir = useCallback((aliado: Aliado, tono: string) => {
    setModal({ aliado, tono });
    // pequeño diferimiento para disparar la transición de opacidad
    requestAnimationFrame(() => setOn(true));
  }, []);

  const cerrar = useCallback(() => setOn(false), []);

  // Al cerrar (fin de la transición) limpiamos el contenido.
  useEffect(() => {
    if (on) return;
    const t = setTimeout(() => setModal(null), 450);
    return () => clearTimeout(t);
  }, [on]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cerrar]);

  return (
    <AliadosCtx.Provider value={abrir}>
      {children}
      <div
        className={`modal${on ? " on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) cerrar();
        }}
        aria-hidden={!on}
      >
        <button className="cerrar" onClick={cerrar}>
          Cerrar
        </button>
        <div className="modal-in" role="dialog" aria-modal="true">
          <div className="ph">
            {modal && <Placeholder seed={modal.aliado.n} tono={modal.tono} />}
          </div>
          <div className="modal-c">
            <h3 style={{ color: modal?.tono }}>{modal?.aliado.n}</h3>
            <div className="meta">
              {modal ? `${modal.aliado.s} · ${modal.aliado.p}` : ""}
            </div>
            <p>{modal?.aliado.d}</p>
          </div>
        </div>
      </div>
    </AliadosCtx.Provider>
  );
}
