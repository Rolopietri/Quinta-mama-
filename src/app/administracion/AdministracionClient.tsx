"use client";

// Administración financiera · cliente
// La puerta con contraseña la maneja el servidor: este cliente solo pide la
// clave, y todo lo financiero se lee/escribe por /api/admin/* (que exige el
// token). Menú desplegable con las secciones; se van construyendo por fases.

import { useCallback, useEffect, useState } from "react";

type Seccion = "proveedores" | "solicitudes" | "ingresos" | "egresos" | "estado" | "historico";
const SECCIONES: { id: Seccion; label: string; grupo?: string }[] = [
  { id: "proveedores", label: "Proveedores", grupo: "Proveedores" },
  { id: "solicitudes", label: "Generar solicitud de pagos", grupo: "Proveedores" },
  { id: "ingresos", label: "Ingresos" },
  { id: "egresos", label: "Egresos" },
  { id: "estado", label: "Estado de Cuenta" },
  { id: "historico", label: "Históricos y comparación" },
];

export function AdministracionClient() {
  const [estado, setEstado] = useState<"cargando" | "sin-config" | "bloqueado" | "abierto">("cargando");

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d: { configurado: boolean; authed: boolean }) => {
        setEstado(!d.configurado ? "sin-config" : d.authed ? "abierto" : "bloqueado");
      })
      .catch(() => setEstado("bloqueado"));
  }, []);

  if (estado === "cargando") return <p className="text-cacao-soft italic font-serif">Cargando…</p>;
  if (estado === "sin-config") return <SinConfig />;
  if (estado === "bloqueado") return <Puerta onEntrar={() => setEstado("abierto")} />;
  return <Panel onSalir={() => setEstado("bloqueado")} />;
}

function SinConfig() {
  return (
    <div className="rounded-2xl bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-6 text-[#7A2419]">
      <h2 className="font-display text-xs tracking-[0.3em] uppercase mb-2">Falta configurar</h2>
      <p className="text-sm">
        La sección de Administración necesita una contraseña definida en Vercel
        (variable <span className="font-mono">ADMIN_PASSWORD</span>) y la llave de servicio
        (<span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>). Cuando estén configuradas, aquí
        aparece la puerta con contraseña.
      </p>
    </div>
  );
}

function Puerta({ onEntrar }: { onEntrar: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function entrar() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) onEntrar();
      else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Contraseña incorrecta.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-10 rounded-2xl bg-white ring-1 ring-marfil p-6">
      <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute mb-1">Administración</h2>
      <p className="text-sm text-cacao-soft mb-4">Sección privada. Ingresa la contraseña.</p>
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-2.5 text-sm text-[#7A2419] mb-3">{error}</div>}
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && pw && entrar()}
        placeholder="Contraseña"
        className="w-full border border-marfil rounded-lg px-3 py-2 text-cacao"
        autoFocus
      />
      <button
        type="button"
        onClick={entrar}
        disabled={busy || !pw}
        className="mt-3 w-full rounded-lg bg-cacao text-white py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute"
      >
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </div>
  );
}

function Panel({ onSalir }: { onSalir: () => void }) {
  const [seccion, setSeccion] = useState<Seccion>("proveedores");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const actual = SECCIONES.find((s) => s.id === seccion)!;

  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    onSalir();
  }

  return (
    <div className="space-y-6">
      {/* Barra superior con menú desplegable */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-cinzel text-xl text-cacao">{actual.label}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="flex items-center gap-2 rounded-lg ring-1 ring-marfil px-3 py-1.5 text-xs uppercase tracking-widest text-cacao hover:bg-marfil-soft"
            >
              Menú
              <span className={`transition-transform ${menuAbierto ? "rotate-180" : ""}`}>▾</span>
            </button>
            {menuAbierto && (
              <div className="absolute right-0 mt-1 w-64 rounded-xl bg-white ring-1 ring-marfil shadow-lg z-30 p-1.5">
                <div className="flex justify-between items-center px-2 py-1">
                  <span className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute">Secciones</span>
                  <button type="button" onClick={() => setMenuAbierto(false)} className="text-cacao-soft hover:text-cacao text-sm">✕</button>
                </div>
                {SECCIONES.map((s, i) => {
                  const primerDelGrupo = s.grupo && SECCIONES[i - 1]?.grupo !== s.grupo;
                  return (
                    <div key={s.id}>
                      {primerDelGrupo && (
                        <div className="px-2 pt-2 pb-0.5 font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute">{s.grupo}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSeccion(s.id)}
                        className={`block w-full text-left rounded-lg px-2 py-2 text-sm ${seccion === s.id ? "bg-cacao text-white" : "text-cacao hover:bg-marfil-soft"} ${s.grupo ? "pl-4" : ""}`}
                      >
                        {s.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button type="button" onClick={salir} className="text-[11px] uppercase tracking-widest text-cacao-soft hover:text-terracotta">Salir</button>
        </div>
      </div>

      {seccion === "proveedores" ? (
        <SeccionProveedores />
      ) : (
        <EnConstruccion seccion={actual.label} />
      )}
    </div>
  );
}

function EnConstruccion({ seccion }: { seccion: string }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-10 text-center">
      <p className="font-display text-[11px] tracking-[0.3em] uppercase text-cacao-mute mb-2">{seccion}</p>
      <p className="text-cacao">En construcción</p>
      <p className="text-sm text-cacao-soft mt-1 font-serif italic">Esta sección se construye en las siguientes fases.</p>
    </div>
  );
}

// ── Proveedores ─────────────────────────────────────────────────────
type Proveedor = {
  id: string;
  nombre: string;
  concepto: string | null;
  cedula: string | null;
  rif: string | null;
  numero_cuenta: string | null;
  banco: string | null;
};
const CAMPOS_FORM: { k: keyof Proveedor; label: string; req?: boolean; ph?: string }[] = [
  { k: "nombre", label: "Nombre", req: true },
  { k: "concepto", label: "Concepto (producto o servicio que ofrece)" },
  { k: "cedula", label: "Cédula (opcional)" },
  { k: "rif", label: "RIF (opcional)" },
  { k: "numero_cuenta", label: "Número de cuenta" },
  { k: "banco", label: "Nombre del banco" },
];

function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [confirmando, setConfirmando] = useState<Proveedor[] | null>(null);
  const [tick, setTick] = useState(0);

  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/proveedores");
        const d = await r.json();
        if (a) setProveedores(d.proveedores ?? []);
      } catch {
        if (a) setError("No se pudieron cargar los proveedores.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [tick]);

  const filtrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  function toggle(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function abrirEditar() {
    setError(null);
    if (sel.length !== 1) { setError("Selecciona un proveedor (uno) para editar."); return; }
    const p = proveedores.find((x) => x.id === sel[0]) ?? null;
    setEditando(p);
    setModo("form");
  }
  function pedirEliminar() {
    setError(null);
    if (sel.length === 0) { setError("Selecciona al menos un proveedor para eliminar."); return; }
    setConfirmando(proveedores.filter((p) => sel.includes(p.id)));
  }
  async function eliminar() {
    if (!confirmando) return;
    const ids = confirmando.map((p) => p.id);
    try {
      await fetch(`/api/admin/proveedores?ids=${ids.join(",")}`, { method: "DELETE" });
      setMsg(`Eliminaste ${confirmando.length === 1 ? "a " + confirmando[0].nombre : confirmando.length + " proveedores"} de tu registro.`);
      setSel([]);
      setConfirmando(null);
      recargar();
    } catch {
      setError("No se pudo eliminar.");
    }
  }

  // Confirmación de borrado
  if (confirmando) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-6 max-w-lg">
        <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute mb-3">Confirmar eliminación</h2>
        <p className="text-cacao">
          ¿Seguro que quieres eliminar {confirmando.length === 1 ? <><strong>{confirmando[0].nombre}</strong></> : <>estos <strong>{confirmando.length}</strong> proveedores</>} del registro?
        </p>
        {confirmando.length > 1 && (
          <ul className="mt-2 text-sm text-cacao-soft list-disc pl-5">
            {confirmando.map((p) => <li key={p.id}>{p.nombre}</li>)}
          </ul>
        )}
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={eliminar} className="rounded-lg bg-terracotta text-white px-5 py-2 text-xs uppercase tracking-widest">Sí, eliminar</button>
          <button type="button" onClick={() => { setConfirmando(null); setMsg("Ningún proveedor fue eliminado."); }} className="rounded-lg ring-1 ring-marfil text-cacao px-5 py-2 text-xs uppercase tracking-widest">No</button>
        </div>
      </div>
    );
  }

  // Formulario agregar/editar
  if (modo === "form") {
    return (
      <FormProveedor
        inicial={editando}
        onCancelar={() => { setModo("lista"); setEditando(null); }}
        onGuardado={(nombre, esEdicion) => {
          setModo("lista");
          setEditando(null);
          setSel([]);
          setMsg(esEdicion ? "Información del proveedor actualizada correctamente." : `Proveedor "${nombre}" agregado correctamente.`);
          recargar();
        }}
      />
    );
  }

  // Lista
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setEditando(null); setModo("form"); setError(null); }} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">+ Agregar</button>
        <button type="button" onClick={abrirEditar} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft">Editar</button>
        <button type="button" onClick={pedirEliminar} className="rounded-lg ring-1 ring-marfil text-cacao-soft px-4 py-2 text-xs uppercase tracking-widest hover:text-terracotta hover:ring-terracotta">− Eliminar</button>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {msg && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">{msg}</div>}

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cacao-mute">⌕</span>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar proveedor por nombre…" className="w-full border border-marfil rounded-lg pl-9 pr-3 py-2 text-sm text-cacao" />
      </div>

      <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        {cargando ? (
          <p className="p-5 text-cacao-soft italic font-serif">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-8 text-center text-cacao-soft italic font-serif">
            {proveedores.length === 0 ? "Aún no hay proveedores. Agrega el primero con “+ Agregar”." : "Ningún proveedor coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-marfil">
            {filtrados.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3.5">
                <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} className="mt-1 accent-[#0F0F0F]" />
                <div className="flex-1 min-w-0">
                  <div className="text-cacao font-medium">{p.nombre}</div>
                  {p.concepto && <div className="text-xs text-cacao-soft mt-0.5">{p.concepto}</div>}
                  {(p.numero_cuenta || p.banco) && (
                    <div className="text-[11px] text-cacao-mute mt-1">
                      {p.banco ? p.banco : ""}{p.banco && p.numero_cuenta ? " · " : ""}{p.numero_cuenta ? p.numero_cuenta : ""}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!cargando && proveedores.length > 0 && (
        <p className="text-xs text-cacao-mute">{proveedores.length} proveedor{proveedores.length === 1 ? "" : "es"} · {sel.length} seleccionado{sel.length === 1 ? "" : "s"}</p>
      )}
    </div>
  );
}

function FormProveedor({
  inicial,
  onGuardado,
  onCancelar,
}: {
  inicial: Proveedor | null;
  onGuardado: (nombre: string, esEdicion: boolean) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of CAMPOS_FORM) o[c.k] = (inicial?.[c.k] as string) ?? "";
    return o;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esEdicion = !!inicial;

  async function guardar() {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/proveedores", {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esEdicion ? { id: inicial!.id, ...form } : form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error guardando");
      onGuardado(form.nombre.trim(), esEdicion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-5 max-w-lg space-y-4">
      <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">{esEdicion ? "Editar proveedor" : "Agregar proveedor"}</h2>
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-2.5 text-sm text-[#7A2419]">{error}</div>}
      <div className="grid gap-3">
        {CAMPOS_FORM.map((c) => (
          <div key={c.k}>
            <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">{c.label}{c.req ? " *" : ""}</label>
            <input
              value={form[c.k]}
              onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))}
              className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={busy} className="rounded-lg bg-cacao text-white px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar} className="rounded-lg ring-1 ring-marfil text-cacao px-5 py-2.5 text-xs uppercase tracking-widest">Cancelar</button>
      </div>
    </div>
  );
}
