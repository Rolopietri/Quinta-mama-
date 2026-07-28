"use client";

import { useState } from "react";
import {
  C,
  CATERING,
  CORREO_EVENTOS,
  ESPACIOS,
  TIPOS_EVENTO,
} from "../_lib/data";
import { Placeholder } from "../_lib/placeholder";

/**
 * Formulario de solicitud de espacio. Envío actual por `mailto:`.
 *
 * PENDIENTE de producción (ver 00-BRIEF sección 9): reemplazar `mailto:` por
 * un endpoint real (`/api/solicitudes`) que guarde en Supabase y notifique por
 * correo.
 */
export function EventForm() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipo, setTipo] = useState("");
  const [espacio, setEspacio] = useState("");
  const [fecha, setFecha] = useState("");
  const [invitados, setInvitados] = useState("");
  const [catering, setCatering] = useState("");
  const [detalles, setDetalles] = useState("");
  const [aviso, setAviso] = useState<{ texto: React.ReactNode; color: string } | null>(
    null,
  );

  const enviar = () => {
    if (!nombre.trim() || !tipo || !espacio || !fecha) {
      setAviso({
        texto: "Completa nombre, tipo de evento, espacio y fecha para enviar.",
        color: C.terracota,
      });
      return;
    }

    let fechaTxt = fecha;
    try {
      const [a, m, d] = fecha.split("-");
      fechaTxt = new Date(Number(a), Number(m) - 1, Number(d)).toLocaleDateString(
        "es-VE",
        { day: "numeric", month: "long", year: "numeric" },
      );
    } catch {
      /* deja la fecha ISO si falla el formateo */
    }

    const asunto = `Solicitud de espacio — ${tipo} · ${nombre}`;
    const cuerpo = [
      "Hola, equipo de Quinta Mamá:",
      "",
      "Me gustaría solicitar un espacio para un evento en la casa. Estos son los datos:",
      "",
      `• Nombre: ${nombre}`,
      telefono.trim() ? `• Teléfono / WhatsApp: ${telefono.trim()}` : null,
      `• Tipo de evento: ${tipo}`,
      `• Espacio de interés: ${espacio}`,
      `• Fecha tentativa: ${fechaTxt}`,
      invitados.trim() ? `• Invitados (aprox.): ${invitados.trim()}` : null,
      catering ? `• Catering: ${catering}` : null,
      "",
      detalles.trim() ? "Lo que tengo en mente:" : null,
      detalles.trim() || null,
      "",
      "¿Me podrían indicar disponibilidad, tarifas y los siguientes pasos? Quedo atento/a.",
      "",
      "Gracias,",
      nombre,
    ]
      .filter((x) => x !== null)
      .join("\n");

    const url = `mailto:${CORREO_EVENTOS}?subject=${encodeURIComponent(
      asunto,
    )}&body=${encodeURIComponent(cuerpo)}`;

    setAviso({
      texto: "Abriendo tu correo con la solicitud lista para enviar…",
      color: C.oliva,
    });
    window.location.href = url;

    setTimeout(() => {
      setAviso({
        texto: (
          <>
            Si tu correo no se abrió, escríbenos a{" "}
            <a href={`mailto:${CORREO_EVENTOS}`}>{CORREO_EVENTOS}</a> con el
            asunto «{asunto}».
          </>
        ),
        color: C.cacao,
      });
    }, 2500);
  };

  return (
    <div className="evt rv">
      <div className="evt-img">
        <Placeholder seed="Eventos Quinta Mama" tono={C.cacao} />
      </div>
      <div className="evt-form">
        <h3>Solicita tu espacio</h3>

        <div className="campo">
          <label htmlFor="f1">Nombre</label>
          <input
            id="f1"
            type="text"
            placeholder="Nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="f1b">Teléfono / WhatsApp</label>
          <input
            id="f1b"
            type="tel"
            inputMode="tel"
            placeholder="Para responderte más rápido"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="f2">Tipo de evento</label>
          <select
            id="f2"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="">Selecciona</option>
            {TIPOS_EVENTO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="f3">Espacio</label>
          <select
            id="f3"
            value={espacio}
            onChange={(e) => setEspacio(e.target.value)}
          >
            <option value="">Selecciona</option>
            {ESPACIOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="f4">Fecha tentativa</label>
          <input
            id="f4"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="f5">Invitados</label>
          <input
            id="f5"
            type="number"
            min={1}
            placeholder="Cantidad aproximada"
            value={invitados}
            onChange={(e) => setInvitados(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="f7">¿Deseas servicio de catering?</label>
          <select
            id="f7"
            value={catering}
            onChange={(e) => setCatering(e.target.value)}
          >
            <option value="">Selecciona</option>
            {CATERING.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <p className="nota-campo">
            Solo factible si se solicita con al menos 10 días de anticipación.
          </p>
        </div>

        <div className="campo">
          <label htmlFor="f6">Detalles</label>
          <textarea
            id="f6"
            placeholder="Cuéntanos qué tienes en mente"
            value={detalles}
            onChange={(e) => setDetalles(e.target.value)}
          />
        </div>

        <button className="btn" onClick={enviar}>
          Enviar solicitud
        </button>
        <div className="aviso" style={{ color: aviso?.color }}>
          {aviso?.texto}
        </div>
      </div>
    </div>
  );
}
