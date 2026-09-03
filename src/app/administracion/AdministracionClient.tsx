"use client";

// Administración financiera · cliente
// La puerta con contraseña la maneja el servidor: este cliente solo pide la
// clave, y todo lo financiero se lee/escribe por /api/admin/* (que exige el
// token). Menú desplegable con las secciones; se van construyendo por fases.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { totalesVentasPorMes } from "@/lib/data/ventas";
import { listTasasBcvRango, listComprasRango } from "@/lib/data/cocina";
import type { TasaBcv, Compra } from "@/lib/types";
import { AnalisisAdministrativo } from "./AnalisisAdministrativo";

type Seccion = "proveedores" | "solicitudes" | "ingresos" | "analisis-ventas" | "cobrar" | "egresos" | "estado" | "historico";
const SECCIONES: { id: Seccion; label: string; grupo?: string }[] = [
  { id: "estado", label: "Estado de Cuenta" },
  { id: "ingresos", label: "Ingresos" },
  { id: "egresos", label: "Egresos" },
  { id: "cobrar", label: "Cuentas por cobrar" },
  { id: "analisis-ventas", label: "Análisis administrativo" },
  { id: "historico", label: "Históricos y comparación" },
  { id: "proveedores", label: "Proveedores", grupo: "Proveedores" },
  { id: "solicitudes", label: "Generar solicitud de pagos", grupo: "Proveedores" },
];

export function AdministracionClient() {
  const [estado, setEstado] = useState<"cargando" | "sin-config" | "bloqueado" | "abierto">("cargando");

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
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
  const [seccion, setSeccion] = useState<Seccion>("estado");
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

      <AlertaCobrar refreshKey={seccion} onIr={() => setSeccion("cobrar")} />

      {seccion === "proveedores" ? (
        <SeccionProveedores />
      ) : seccion === "solicitudes" ? (
        <SeccionSolicitudes />
      ) : seccion === "cobrar" ? (
        <SeccionCuentasCobrar />
      ) : seccion === "egresos" ? (
        <SeccionEgresos />
      ) : seccion === "ingresos" ? (
        <SeccionIngresos />
      ) : seccion === "analisis-ventas" ? (
        <AnalisisAdministrativo />
      ) : seccion === "estado" ? (
        <SeccionEstado />
      ) : seccion === "historico" ? (
        <SeccionHistorico />
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
        const r = await fetch("/api/admin/proveedores", { cache: "no-store" });
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

// ── Solicitudes de pago ─────────────────────────────────────────────
// Una solicitud junta uno o varios pagos (líneas). Cada línea puede venir
// de un proveedor de la base (con sus datos) o ser un concepto adicional.
// De aquí sale el texto de WhatsApp para pedir los pagos, y se guarda el
// historial (pendiente → procesada). Moneda original + conversión a USD.

const MONEDAS = ["Bs", "USD", "EUR"] as const;
const METODOS = ["Transferencia", "Pago móvil", "Zelle", "Efectivo", "USDT", "Otro"] as const;
const TASA_TIPOS = ["dólar", "del día", "promedio", "VNC", "USDT", "otra"] as const;

type LineaForm = {
  uid: string;
  tipo: "proveedor" | "adicional";
  proveedor_id: string | null;
  proveedor_nombre: string;
  datos_registrados: boolean;
  concepto: string;
  monto: string;
  moneda: string;
  metodo: string;
  tasa: string;
  tasa_tipo: string;
  factura: string;
  nota: string;
};

type SolicitudCab = { id: string; fecha: string; estado: string; nota: string | null };
type LineaGuardada = Omit<LineaForm, "uid" | "monto" | "tasa"> & {
  id: string;
  orden: number;
  monto: number | null;
  tasa: number | null;
};

let uidSeq = 0;
function nuevaLinea(tipo: "proveedor" | "adicional"): LineaForm {
  uidSeq += 1;
  return {
    uid: `l${uidSeq}`,
    tipo,
    proveedor_id: null,
    proveedor_nombre: "",
    datos_registrados: false,
    concepto: "",
    monto: "",
    moneda: "Bs",
    metodo: tipo === "proveedor" ? "Transferencia" : "",
    tasa: "",
    tasa_tipo: "dólar",
    factura: "",
    nota: "",
  };
}

function parseMonto(s: string): number | null {
  // El decimal es SIEMPRE punto. Reusamos la lógica de parseTasa (el separador
  // más a la derecha es el decimal), que acepta "1234.56", "1234,56" y, si
  // pegan un monto con miles, "1.234,56". Antes el punto se tomaba como miles.
  return parseTasa(s);
}

// Lee una TASA o PORCENTAJE (no un monto): aquí el punto y la coma son
// SIEMPRE decimales (1.08 = 1,08 = 1.08). Si trae los dos, el separador de
// más a la derecha es el decimal (1.234,56 = 1234.56). Evita el bug de
// interpretar "1.08" como 108 (que sí aplica a montos con miles).
function parseTasa(s: string): number | null {
  const t = (s ?? "").toString().trim();
  if (!t) return null;
  const iComa = t.lastIndexOf(",");
  const iPunto = t.lastIndexOf(".");
  let limpio: string;
  if (iComa >= 0 && iPunto >= 0) {
    const dec = Math.max(iComa, iPunto);
    limpio = t.slice(0, dec).replace(/[.,]/g, "") + "." + t.slice(dec + 1).replace(/[.,]/g, "");
  } else {
    limpio = t.replace(",", ".");
  }
  const n = Number(limpio);
  return isFinite(n) ? n : null;
}

function fmtMonto(monto: number, moneda: string): string {
  if (moneda === "USD") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(monto);
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  if (moneda === "EUR") return `${n} €`;
  return `${n} Bs`;
}

// Equivalente en USD de una línea, si se puede calcular (si no, null).
function equivUSD(monto: number | null, moneda: string, tasa: number | null): number | null {
  if (monto == null) return null;
  if (moneda === "USD") return monto;
  if (moneda === "Bs") return tasa && tasa > 0 ? monto / tasa : null;
  if (moneda === "EUR") return tasa && tasa > 0 ? monto * tasa : null;
  return null;
}

function textoSolicitud(lineas: LineaForm[]): string {
  const provs = lineas.filter((l) => l.tipo === "proveedor");
  const adics = lineas.filter((l) => l.tipo === "adicional");
  const bloques: string[] = [];
  provs.forEach((l, i) => {
    const m = parseMonto(l.monto);
    const b: string[] = [`${i + 1}. Proveedor: ${l.proveedor_nombre || "(sin nombre)"}`];
    if (l.concepto) b.push(`Concepto: ${l.concepto}`);
    b.push(`Monto: ${m != null ? fmtMonto(m, l.moneda) : "(sin monto)"}`);
    if (l.metodo) b.push(`Método: ${l.metodo}`);
    if (l.factura) b.push(`Factura: ${l.factura}`);
    if (l.nota) b.push(`NOTA: ${l.nota}`);
    b.push(l.datos_registrados ? "✓ Datos registrados" : "✕ Faltan datos");
    bloques.push(b.join("\n"));
  });
  if (adics.length) {
    const items = adics.map((l) => {
      const m = parseMonto(l.monto);
      return `${l.concepto || "(concepto)"}: ${m != null ? fmtMonto(m, l.moneda) : "(sin monto)"}`;
    });
    bloques.push(["Adicionales:", ...items].join("\n"));
  }
  return bloques.join("\n\n");
}

function SeccionSolicitudes() {
  const [vista, setVista] = useState<"nueva" | "historial">("nueva");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg ring-1 ring-marfil p-1 w-fit">
        {([["nueva", "Nueva solicitud"], ["historial", "Historial"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setVista(k)}
            className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-widest ${vista === k ? "bg-cacao text-white" : "text-cacao hover:bg-marfil-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {vista === "nueva" ? <NuevaSolicitud /> : <HistorialSolicitudes />}
    </div>
  );
}

function NuevaSolicitud() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/proveedores", { cache: "no-store" });
        const d = await r.json();
        if (a) setProveedores(d.proveedores ?? []);
      } catch {
        /* la lista de proveedores es opcional para armar el texto */
      }
    })();
    return () => { a = false; };
  }, []);

  function actualizar(uid: string, cambios: Partial<LineaForm>) {
    setLineas((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...cambios } : l)));
  }
  function elegirProveedor(uid: string, id: string) {
    const p = proveedores.find((x) => x.id === id);
    if (!p) { actualizar(uid, { proveedor_id: null, proveedor_nombre: "", datos_registrados: false }); return; }
    actualizar(uid, {
      proveedor_id: p.id,
      proveedor_nombre: p.nombre,
      concepto: p.concepto ?? "",
      datos_registrados: !!(p.numero_cuenta && p.banco),
    });
  }
  function quitar(uid: string) {
    setLineas((ls) => ls.filter((l) => l.uid !== uid));
  }

  const texto = textoSolicitud(lineas);
  const totalUSD = lineas.reduce((acc, l) => {
    const e = equivUSD(parseMonto(l.monto), l.moneda, parseMonto(l.tasa));
    return e != null ? acc + e : acc;
  }, 0);
  const faltanTasa = lineas.some((l) => parseMonto(l.monto) != null && equivUSD(parseMonto(l.monto), l.moneda, parseMonto(l.tasa)) == null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  }

  async function guardar() {
    if (lineas.length === 0) { setError("Agrega al menos una línea."); return; }
    setGuardando(true);
    setError(null);
    setMsg(null);
    try {
      const payload = {
        lineas: lineas.map((l) => ({
          tipo: l.tipo,
          proveedor_id: l.proveedor_id,
          proveedor_nombre: l.proveedor_nombre,
          datos_registrados: l.datos_registrados,
          concepto: l.concepto,
          monto: parseMonto(l.monto),
          moneda: l.moneda,
          metodo: l.metodo,
          tasa: parseMonto(l.tasa),
          tasa_tipo: l.tasa_tipo,
          factura: l.factura,
          nota: l.nota,
        })),
      };
      const r = await fetch("/api/admin/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error guardando");
      setMsg("Solicitud guardada en el historial (pendiente).");
      setLineas([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setLineas((l) => [...l, nuevaLinea("proveedor")])} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">+ Agregar proveedor al pago</button>
        <button type="button" onClick={() => setLineas((l) => [...l, nuevaLinea("adicional")])} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft">+ Concepto adicional</button>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {msg && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">{msg}</div>}

      {lineas.length === 0 ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft italic font-serif">
          Aún no hay pagos en esta solicitud. Agrega un proveedor o un concepto adicional.
        </p>
      ) : (
        <div className="space-y-3">
          {lineas.map((l, i) => (
            <LineaEditor
              key={l.uid}
              linea={l}
              indice={i + 1}
              proveedores={proveedores}
              onCambio={(c) => actualizar(l.uid, c)}
              onElegirProveedor={(id) => elegirProveedor(l.uid, id)}
              onQuitar={() => quitar(l.uid)}
            />
          ))}
        </div>
      )}

      {lineas.length > 0 && (
        <>
          <div className="rounded-2xl bg-[#0F0F0F] text-[#EDE7E0] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-[10px] tracking-[0.3em] uppercase text-[#9A938B]">Texto para WhatsApp</span>
              <button type="button" onClick={copiar} className="rounded-md bg-[#EDE7E0] text-[#0F0F0F] px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-white">
                {copiado ? "✓ Copiado" : "Copiar texto"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{texto || "…"}</pre>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-cacao-mute">
              Total ≈ {fmtMonto(totalUSD, "USD")}
              {faltanTasa ? " · faltan tasas para incluir todo" : ""}
            </p>
            <button type="button" onClick={guardar} disabled={guardando} className="rounded-lg bg-cacao text-white px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">
              {guardando ? "Guardando…" : "Guardar en historial"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LineaEditor({
  linea,
  indice,
  proveedores,
  onCambio,
  onElegirProveedor,
  onQuitar,
}: {
  linea: LineaForm;
  indice: number;
  proveedores: Proveedor[];
  onCambio: (c: Partial<LineaForm>) => void;
  onElegirProveedor: (id: string) => void;
  onQuitar: () => void;
}) {
  const esProv = linea.tipo === "proveedor";
  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute">
          {esProv ? `Pago ${indice} · Proveedor` : "Concepto adicional"}
        </span>
        <div className="flex items-center gap-2">
          {esProv && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${linea.datos_registrados ? "bg-[#F1F4ED] text-[#2F4A1F]" : "bg-[#F9EBE7] text-[#7A2419]"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${linea.datos_registrados ? "bg-[#4B7A2F]" : "bg-[#C0563F]"}`} />
              {linea.datos_registrados ? "Datos registrados" : "Faltan datos"}
            </span>
          )}
          <button type="button" onClick={onQuitar} className="text-cacao-soft hover:text-terracotta text-sm" aria-label="Quitar">✕</button>
        </div>
      </div>

      {esProv && (
        <div>
          <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">Proveedor</label>
          <select
            value={linea.proveedor_id ?? ""}
            onChange={(e) => onElegirProveedor(e.target.value)}
            className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao bg-white"
          >
            <option value="">— Elegir de la base —</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Concepto">
          <input value={linea.concepto} onChange={(e) => onCambio({ concepto: e.target.value })} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Monto">
            <input inputMode="decimal" value={linea.monto} onChange={(e) => onCambio({ monto: e.target.value })} placeholder="0,00" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
          </Campo>
          <Campo label="Moneda">
            <select value={linea.moneda} onChange={(e) => onCambio({ moneda: e.target.value })} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
        </div>
      </div>

      {esProv && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Método de pago">
            <select value={linea.metodo} onChange={(e) => onCambio({ metodo: e.target.value })} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
              {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
          <Campo label="Factura (opcional)">
            <input value={linea.factura} onChange={(e) => onCambio({ factura: e.target.value })} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
          </Campo>
        </div>
      )}

      {linea.moneda !== "USD" && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Tasa a USD (opcional)">
            <input inputMode="decimal" value={linea.tasa} onChange={(e) => onCambio({ tasa: e.target.value })} placeholder={linea.moneda === "Bs" ? "Bs por USD" : "USD por EUR"} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
          </Campo>
          <Campo label="Tipo de tasa">
            <select value={linea.tasa_tipo} onChange={(e) => onCambio({ tasa_tipo: e.target.value })} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
              {TASA_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
        </div>
      )}

      <Campo label="Nota (opcional)">
        <input value={linea.nota} onChange={(e) => onCambio({ nota: e.target.value })} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
      </Campo>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">{label}</label>
      {children}
    </div>
  );
}

function HistorialSolicitudes() {
  const [solicitudes, setSolicitudes] = useState<SolicitudCab[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<(SolicitudCab & { lineas: LineaGuardada[] }) | null>(null);
  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/solicitudes", { cache: "no-store" });
        const d = await r.json();
        if (a) setSolicitudes(d.solicitudes ?? []);
      } catch {
        if (a) setError("No se pudo cargar el historial.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [tick]);

  async function abrir(id: string) {
    setError(null);
    try {
      const r = await fetch(`/api/admin/solicitudes?id=${id}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAbierta(d.solicitud);
    } catch {
      setError("No se pudo abrir la solicitud.");
    }
  }
  async function cambiarEstado(id: string, estado: string) {
    try {
      await fetch("/api/admin/solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado }),
      });
      setAbierta((s) => (s && s.id === id ? { ...s, estado } : s));
      recargar();
    } catch {
      setError("No se pudo cambiar el estado.");
    }
  }
  async function borrar(id: string) {
    try {
      await fetch(`/api/admin/solicitudes?id=${id}`, { method: "DELETE" });
      setAbierta(null);
      recargar();
    } catch {
      setError("No se pudo eliminar.");
    }
  }

  if (abierta) {
    const provs = abierta.lineas.filter((l) => l.tipo === "proveedor");
    const adics = abierta.lineas.filter((l) => l.tipo === "adicional");
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setAbierta(null)} className="text-xs uppercase tracking-widest text-cacao-soft hover:text-cacao">← Volver al historial</button>
        <div className="rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-cinzel text-lg text-cacao">Solicitud del {fmtFecha(abierta.fecha)}</h3>
              <EstadoPill estado={abierta.estado} />
            </div>
            <div className="flex gap-2">
              {abierta.estado === "pendiente" ? (
                <button type="button" onClick={() => cambiarEstado(abierta.id, "procesada")} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">Marcar procesada</button>
              ) : (
                <button type="button" onClick={() => cambiarEstado(abierta.id, "pendiente")} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft">Reabrir</button>
              )}
              <button type="button" onClick={() => borrar(abierta.id)} className="rounded-lg ring-1 ring-marfil text-cacao-soft px-4 py-2 text-xs uppercase tracking-widest hover:text-terracotta hover:ring-terracotta">Eliminar</button>
            </div>
          </div>
          {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
          {abierta.estado === "pendiente" && (
            <ConfirmarPago
              solicitud={abierta}
              onListo={() => { setAbierta((s) => (s ? { ...s, estado: "procesada" } : s)); recargar(); }}
            />
          )}
          <ul className="divide-y divide-marfil">
            {provs.map((l, i) => (
              <li key={l.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-cacao font-medium">{i + 1}. {l.proveedor_nombre || "(sin nombre)"}</span>
                  <span className="text-cacao">{l.monto != null ? fmtMonto(l.monto, l.moneda || "Bs") : "—"}</span>
                </div>
                {l.concepto && <div className="text-xs text-cacao-soft mt-0.5">{l.concepto}</div>}
                <div className="text-[11px] text-cacao-mute mt-1">
                  {[l.metodo, l.factura && `Factura ${l.factura}`, l.datos_registrados ? "✓ datos registrados" : "✕ faltan datos"].filter(Boolean).join(" · ")}
                </div>
                {l.nota && <div className="text-[11px] text-cacao-mute mt-0.5 italic">NOTA: {l.nota}</div>}
              </li>
            ))}
            {adics.map((l) => (
              <li key={l.id} className="py-3 flex items-baseline justify-between gap-3">
                <span className="text-cacao-soft">{l.concepto || "(concepto)"}</span>
                <span className="text-cacao">{l.monto != null ? fmtMonto(l.monto, l.moneda || "Bs") : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {cargando ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-5 text-cacao-soft italic font-serif">Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft italic font-serif">Aún no hay solicitudes guardadas.</p>
      ) : (
        <ul className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden divide-y divide-marfil">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => abrir(s.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-marfil-soft">
                <div>
                  <div className="text-cacao">Solicitud del {fmtFecha(s.fecha)}</div>
                  {s.nota && <div className="text-xs text-cacao-soft mt-0.5">{s.nota}</div>}
                </div>
                <EstadoPill estado={s.estado} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EstadoPill({ estado }: { estado: string }) {
  const procesada = estado === "procesada";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${procesada ? "bg-[#F1F4ED] text-[#2F4A1F]" : "bg-[#FBF3E2] text-[#7A5A18]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${procesada ? "bg-[#4B7A2F]" : "bg-[#C79A2E]"}`} />
      {procesada ? "Procesada" : "Pendiente"}
    </span>
  );
}

function fmtFecha(iso: string): string {
  // iso "2026-08-10" → "10 ago 2026" sin depender de zona horaria.
  const [y, m, d] = (iso ?? "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return iso ?? "";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1] ?? ""} ${y}`;
}

// ── Categorías y egresos (tipos compartidos) ────────────────────────
type Categoria = { id: string; nombre: string; clasificacion: "fija" | "variable" };
type Egreso = {
  id: string;
  fecha: string;
  concepto: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  clasificacion: "fija" | "variable" | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  monto: number | null;
  moneda: string | null;
  tasa: number | null;
  monto_usd: number | null;
  metodo: string | null;
  factura: string | null;
  nota: string | null;
  solicitud_linea_id: string | null;
};

// Confirmar pago de una solicitud pendiente → registrar egresos y marcar procesada.
function ConfirmarPago({
  solicitud,
  onListo,
}: {
  solicitud: SolicitudCab & { lineas: LineaGuardada[] };
  onListo: () => void;
}) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [asig, setAsig] = useState<Record<string, string>>({}); // linea.id → categoria_id
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/categorias", { cache: "no-store" });
        const d = await r.json();
        if (a) setCategorias(d.categorias ?? []);
      } catch {
        /* sin catálogo igual se puede registrar sin categoría */
      }
    })();
    return () => { a = false; };
  }, []);

  async function confirmar() {
    setBusy(true);
    setError(null);
    try {
      const egresos = solicitud.lineas.map((l) => {
        const cat = categorias.find((c) => c.id === asig[l.id]);
        return {
          fecha: solicitud.fecha,
          concepto: l.concepto ?? (l.tipo === "proveedor" ? l.proveedor_nombre : null),
          categoria_id: cat?.id ?? null,
          categoria_nombre: cat?.nombre ?? null,
          clasificacion: cat?.clasificacion ?? null,
          proveedor_id: l.proveedor_id,
          proveedor_nombre: l.proveedor_nombre,
          monto: l.monto,
          moneda: l.moneda,
          tasa: l.tasa,
          metodo: l.metodo,
          factura: l.factura,
          nota: l.nota,
          solicitud_linea_id: l.id,
        };
      });
      const r = await fetch("/api/admin/egresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ egresos }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudieron registrar los egresos.");
      await fetch("/api/admin/solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: solicitud.id, estado: "procesada" }),
      });
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!abierto) {
    return (
      <div className="rounded-xl bg-marfil-soft ring-1 ring-marfil p-3 flex items-center justify-between gap-3">
        <span className="text-sm text-cacao-soft">¿Ya se pagó? Registra los egresos de esta solicitud.</span>
        <button type="button" onClick={() => setAbierto(true)} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta shrink-0">Confirmar pago</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-marfil-soft ring-1 ring-marfil p-4 space-y-3">
      <p className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute">Confirmar pago · asigna categoría a cada renglón</p>
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-2.5 text-sm text-[#7A2419]">{error}</div>}
      <ul className="space-y-2">
        {solicitud.lineas.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white ring-1 ring-marfil px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm text-cacao truncate">{l.proveedor_nombre || l.concepto || "(renglón)"}</div>
              <div className="text-[11px] text-cacao-mute">{l.monto != null ? fmtMonto(l.monto, l.moneda || "Bs") : "—"}</div>
            </div>
            <select
              value={asig[l.id] ?? ""}
              onChange={(e) => setAsig((a) => ({ ...a, [l.id]: e.target.value }))}
              className="border border-marfil rounded-lg px-2 py-1.5 text-sm text-cacao bg-white"
            >
              <option value="">Sin categoría</option>
              <optgroup label="Fijas">
                {categorias.filter((c) => c.clasificacion === "fija").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </optgroup>
              <optgroup label="Variables">
                {categorias.filter((c) => c.clasificacion === "variable").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </optgroup>
            </select>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={confirmar} disabled={busy} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">
          {busy ? "Registrando…" : `Registrar ${solicitud.lineas.length} egreso${solicitud.lineas.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest">Cancelar</button>
      </div>
    </div>
  );
}

// ── Egresos ─────────────────────────────────────────────────────────
function mesActualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nombreMes(iso: string): string {
  const [y, m] = iso.split("-").map((x) => parseInt(x, 10));
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${meses[m - 1] ?? ""} ${y}`;
}
function moverMes(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map((x) => parseInt(x, 10));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function SeccionEgresos() {
  const [vista, setVista] = useState<"egresos" | "categorias">("egresos");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg ring-1 ring-marfil p-1 w-fit">
        {([["egresos", "Egresos"], ["categorias", "Categorías"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setVista(k)} className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-widest ${vista === k ? "bg-cacao text-white" : "text-cacao hover:bg-marfil-soft"}`}>
            {label}
          </button>
        ))}
      </div>
      {vista === "egresos" ? <EgresosMes /> : <CategoriasCatalogo />}
    </div>
  );
}

function EgresosMes() {
  const [mes, setMes] = useState<string>(mesActualISO());
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]); // compras de insumos (Cocina) reflejadas
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [editando, setEditando] = useState<Egreso | null>(null);
  const [reclasificando, setReclasificando] = useState<string | null>(null);
  const [mostrarClasif, setMostrarClasif] = useState(false);
  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const [y, m] = mes.split("-").map((x) => parseInt(x, 10));
        const finMes = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
        const [re, rc, rp, cp] = await Promise.all([
          fetch(`/api/admin/egresos?mes=${mes}`, { cache: "no-store" }),
          fetch("/api/admin/categorias", { cache: "no-store" }),
          fetch("/api/admin/proveedores", { cache: "no-store" }),
          listComprasRango(`${mes}-01`, finMes).catch(() => [] as Compra[]),
        ]);
        const [de, dc, dp] = await Promise.all([re.json(), rc.json(), rp.json()]);
        if (a) {
          setEgresos(de.egresos ?? []);
          setCompras(cp);
          setCategorias(dc.categorias ?? []);
          setProveedores(dp.proveedores ?? []);
        }
      } catch {
        if (a) setError("No se pudieron cargar los egresos.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [mes, tick]);

  // Compras de insumos (Cocina) reflejadas como egresos en $ (solo lectura).
  const comprasEgreso: Egreso[] = compras
    .filter((c) => (c.precioTotalUsd ?? 0) > 0.005)
    .map((c) => ({
      id: `compra:${c.id}`, fecha: c.fecha, concepto: "Compra de insumos", categoria_id: null,
      categoria_nombre: "Insumos (Cocina)", clasificacion: "variable",
      proveedor_id: null, proveedor_nombre: null,
      monto: c.precioTotalUsd, moneda: "USD", tasa: null, monto_usd: c.precioTotalUsd,
      metodo: c.modalidadPago ?? null, factura: null, nota: null, solicitud_linea_id: null,
    }) as unknown as Egreso);
  const egresosAll: Egreso[] = [...egresos, ...comprasEgreso]
    .sort((a2, b2) => (b2.fecha ?? "").localeCompare(a2.fecha ?? ""));
  const esCocina = (e: Egreso) => e.id.startsWith("compra:");

  const totalUSD = egresosAll.reduce((s, e) => s + (e.monto_usd ?? 0), 0);
  const fijasUSD = egresosAll.filter((e) => e.clasificacion === "fija").reduce((s, e) => s + (e.monto_usd ?? 0), 0);
  const variablesUSD = egresosAll.filter((e) => e.clasificacion === "variable").reduce((s, e) => s + (e.monto_usd ?? 0), 0);
  const sinTasa = egresosAll.some((e) => e.monto != null && e.monto_usd == null);

  // Reclasificar un egreso (asignar/cambiar categoría) sin tocar el resto.
  async function reclasificar(egresoId: string, categoriaId: string) {
    const cat = categorias.find((c) => c.id === categoriaId);
    if (!cat) return;
    setReclasificando(egresoId);
    try {
      const r = await fetch("/api/admin/egresos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solo_categoria: true, id: egresoId, categoria_id: cat.id, categoria_nombre: cat.nombre, clasificacion: cat.clasificacion }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "No se pudo reclasificar."); }
      recargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo reclasificar."); }
    finally { setReclasificando(null); }
  }

  async function borrar(id: string) {
    try {
      await fetch(`/api/admin/egresos?id=${id}`, { method: "DELETE" });
      setMsg("Egreso eliminado.");
      recargar();
    } catch {
      setError("No se pudo eliminar.");
    }
  }

  if (modo === "form") {
    return (
      <FormEgreso
        inicial={editando}
        mes={mes}
        categorias={categorias}
        proveedores={proveedores}
        onCancelar={() => { setModo("lista"); setEditando(null); }}
        onGuardado={(esEdicion) => { setModo("lista"); setEditando(null); setMsg(esEdicion ? "Egreso actualizado." : "Egreso registrado."); recargar(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setCargando(true); setMes((m) => moverMes(m, -1)); }} className="rounded-lg ring-1 ring-marfil px-2.5 py-1.5 text-cacao hover:bg-marfil-soft" aria-label="Mes anterior">←</button>
          <span className="font-cinzel text-base text-cacao min-w-[9rem] text-center">{nombreMes(mes)}</span>
          <button type="button" onClick={() => { setCargando(true); setMes((m) => moverMes(m, 1)); }} className="rounded-lg ring-1 ring-marfil px-2.5 py-1.5 text-cacao hover:bg-marfil-soft" aria-label="Mes siguiente">→</button>
        </div>
        <button type="button" onClick={() => { setEditando(null); setModo("form"); }} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">+ Registrar egreso</button>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {msg && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">{msg}</div>}

      <div className="grid grid-cols-3 gap-3">
        <ResumenCaja titulo="Total del mes" valor={fmtMonto(totalUSD, "USD")} fuerte />
        <ResumenCaja titulo="Fijas" valor={fmtMonto(fijasUSD, "USD")} />
        <ResumenCaja titulo="Variables" valor={fmtMonto(variablesUSD, "USD")} />
      </div>
      {sinTasa && <p className="text-[11px] text-cacao-mute">Hay egresos sin tasa: no se suman al total en USD hasta que les pongas la tasa.</p>}

      {/* Clasificar egresos: asigna/cambia la categoría de cada egreso cargado. */}
      {egresos.length > 0 && (() => {
        const sinCat = egresos.filter((e) => !e.categoria_id).length;
        const ordenados = [...egresos].sort((x, z) => (x.categoria_id ? 1 : 0) - (z.categoria_id ? 1 : 0) || (z.fecha ?? "").localeCompare(x.fecha ?? ""));
        return (
          <section className="rounded-2xl bg-white ring-1 ring-marfil p-4">
            <button type="button" onClick={() => setMostrarClasif((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
              <span className="font-cinzel text-base text-cacao">Clasificar egresos</span>
              <span className="flex items-center gap-2">
                {sinCat > 0 && <span className="rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-300 px-2 py-0.5 text-[10px] uppercase tracking-widest">{sinCat} sin categoría</span>}
                <span className={`text-cacao-mute transition-transform ${mostrarClasif ? "rotate-90" : ""}`}>›</span>
              </span>
            </button>
            {mostrarClasif && (
              <div className="mt-3">
                <p className="text-[12px] text-cacao-soft mb-2">Asigna la categoría de cada egreso cargado (sin categoría primero). Se guarda al instante y se refleja en el análisis.</p>
                <div className="rounded-xl ring-1 ring-marfil overflow-hidden max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-cacao-mute uppercase tracking-widest text-left"><th className="sticky top-0 z-10 bg-white py-1.5 px-2 font-normal">Fecha</th><th className="sticky top-0 z-10 bg-white py-1.5 px-2 font-normal">Concepto / Proveedor</th><th className="sticky top-0 z-10 bg-white py-1.5 px-2 font-normal text-right">Monto</th><th className="sticky top-0 z-10 bg-white py-1.5 px-2 font-normal">Categoría</th></tr></thead>
                    <tbody>
                      {ordenados.map((e) => (
                        <tr key={e.id} className={`border-t border-marfil ${!e.categoria_id ? "bg-amber-50/50" : ""}`}>
                          <td className="py-1 px-2 text-cacao-soft whitespace-nowrap">{fmtFecha(e.fecha)}</td>
                          <td className="py-1 px-2 text-cacao min-w-0">{e.proveedor_nombre || e.concepto || "(egreso)"}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-cacao">{e.monto != null ? fmtMonto(e.monto, e.moneda || "Bs") : "—"}</td>
                          <td className="py-1 px-2">
                            <select value={e.categoria_id ?? ""} disabled={reclasificando === e.id || categorias.length === 0} onChange={(ev) => reclasificar(e.id, ev.target.value)} className={`rounded-lg ring-1 px-2 py-1 text-xs bg-white disabled:opacity-50 ${!e.categoria_id ? "ring-amber-300 text-amber-800" : "ring-marfil text-cacao"}`}>
                              <option value="" disabled>{reclasificando === e.id ? "Guardando…" : "Sin categoría"}</option>
                              <optgroup label="Fijas">{categorias.filter((c) => c.clasificacion === "fija").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>
                              <optgroup label="Variables">{categorias.filter((c) => c.clasificacion === "variable").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        );
      })()}

      <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        {cargando ? (
          <p className="p-5 text-cacao-soft italic font-serif">Cargando…</p>
        ) : egresosAll.length === 0 ? (
          <p className="p-8 text-center text-cacao-soft italic font-serif">No hay egresos en {nombreMes(mes)}.</p>
        ) : (
          <ul className="divide-y divide-marfil">
            {egresosAll.map((e) => {
              const cocina = esCocina(e);
              return (
              <li key={e.id} className="flex items-start gap-3 p-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-cacao font-medium truncate">{e.proveedor_nombre || e.concepto || "(egreso)"}{cocina && <span className="ml-2 align-middle inline-block rounded-full bg-marfil-soft text-cacao-mute text-[9px] uppercase tracking-widest px-2 py-0.5">Cocina</span>}</span>
                    <span className="text-cacao whitespace-nowrap">{e.monto != null ? fmtMonto(e.monto, e.moneda || "Bs") : "—"}</span>
                  </div>
                  <div className="text-[11px] text-cacao-mute mt-1 flex flex-wrap gap-x-2">
                    <span>{fmtFecha(e.fecha)}</span>
                    {e.categoria_nombre && <span>· {e.categoria_nombre}</span>}
                    {e.clasificacion && <span>· {e.clasificacion}</span>}
                    {e.monto_usd != null && e.moneda !== "USD" && <span>· ≈ {fmtMonto(e.monto_usd, "USD")}</span>}
                    {e.solicitud_linea_id && <span>· de solicitud</span>}
                  </div>
                  {e.concepto && e.proveedor_nombre && <div className="text-xs text-cacao-soft mt-0.5">{e.concepto}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {cocina ? (
                    <span className="text-cacao-mute text-[10px] uppercase tracking-widest self-center" title="Se gestiona en Cocina → Compras">Cocina ↗</span>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditando(e); setModo("form"); }} className="text-cacao-soft hover:text-cacao text-sm" aria-label="Editar">✎</button>
                      <button type="button" onClick={() => borrar(e.id)} className="text-cacao-soft hover:text-terracotta text-sm" aria-label="Eliminar">✕</button>
                    </>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResumenCaja({ titulo, valor, sub, fuerte }: { titulo: string; valor: string; sub?: string; fuerte?: boolean }) {
  return (
    <div className={`rounded-2xl ring-1 p-4 ${fuerte ? "bg-[#0F0F0F] text-[#EDE7E0] ring-[#0F0F0F]" : "bg-white text-cacao ring-marfil"}`}>
      <div className={`font-display text-[9px] tracking-[0.25em] uppercase ${fuerte ? "text-[#9A938B]" : "text-cacao-mute"}`}>{titulo}</div>
      <div className="text-lg font-medium mt-1">{valor}</div>
      {sub && <div className={`text-[11px] mt-0.5 ${fuerte ? "text-[#9A938B]" : "text-cacao-mute"}`}>{sub}</div>}
    </div>
  );
}

function FormEgreso({
  inicial,
  mes,
  categorias,
  proveedores,
  onGuardado,
  onCancelar,
}: {
  inicial: Egreso | null;
  mes: string;
  categorias: Categoria[];
  proveedores: Proveedor[];
  onGuardado: (esEdicion: boolean) => void;
  onCancelar: () => void;
}) {
  const esEdicion = !!inicial;
  const [f, setF] = useState({
    fecha: inicial?.fecha ?? `${mes}-01`,
    categoria_id: inicial?.categoria_id ?? "",
    proveedor_id: inicial?.proveedor_id ?? "",
    concepto: inicial?.concepto ?? "",
    monto: inicial?.monto != null ? String(inicial.monto) : "",
    moneda: inicial?.moneda ?? "Bs",
    tasa: inicial?.tasa != null ? String(inicial.tasa) : "",
    metodo: inicial?.metodo ?? "Transferencia",
    factura: inicial?.factura ?? "",
    nota: inicial?.nota ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Registro de un proveedor NUEVO desde aquí mismo (se guarda en el catálogo).
  const [creandoProv, setCreandoProv] = useState(false);
  const [nprov, setNprov] = useState<Record<string, string>>({ nombre: "", concepto: "", cedula: "", rif: "", numero_cuenta: "", banco: "" });
  const setNp = (k: string, v: string) => setNprov((o) => ({ ...o, [k]: v }));

  function set<K extends keyof typeof f>(k: K, v: string) { setF((o) => ({ ...o, [k]: v })); }

  async function guardar() {
    if (parseMonto(f.monto) == null) { setError("Pon un monto."); return; }
    if (creandoProv && !nprov.nombre.trim()) { setError("Pon el nombre del proveedor nuevo (o elige “— Ninguno —”)."); return; }
    setBusy(true);
    setError(null);
    try {
      const cat = categorias.find((c) => c.id === f.categoria_id);
      // Si se está registrando un proveedor nuevo, se crea primero en el catálogo.
      let provId: string | null = f.proveedor_id || null;
      let provNombre: string | null = proveedores.find((p) => p.id === f.proveedor_id)?.nombre ?? null;
      if (creandoProv) {
        const rp = await fetch("/api/admin/proveedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nprov) });
        const dp = await rp.json();
        if (!rp.ok) throw new Error(dp.error || "No se pudo crear el proveedor.");
        provId = dp.proveedor?.id ?? null;
        provNombre = dp.proveedor?.nombre ?? nprov.nombre.trim();
      }
      const cuerpo = {
        ...(esEdicion ? { id: inicial!.id } : {}),
        fecha: f.fecha,
        concepto: f.concepto,
        categoria_id: f.categoria_id || null,
        categoria_nombre: cat?.nombre ?? null,
        clasificacion: cat?.clasificacion ?? null,
        proveedor_id: provId,
        proveedor_nombre: provNombre,
        monto: parseMonto(f.monto),
        moneda: f.moneda,
        tasa: parseTasa(f.tasa),
        metodo: f.metodo,
        factura: f.factura,
        nota: f.nota,
      };
      const r = await fetch("/api/admin/egresos", {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esEdicion ? cuerpo : { egreso: cuerpo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error guardando");
      onGuardado(esEdicion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-5 max-w-lg space-y-3">
      <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">{esEdicion ? "Editar egreso" : "Registrar egreso"}</h2>
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-2.5 text-sm text-[#7A2419]">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
        <Campo label="Categoría">
          <select value={f.categoria_id} onChange={(e) => set("categoria_id", e.target.value)} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
            <option value="">Sin categoría</option>
            <optgroup label="Fijas">{categorias.filter((c) => c.clasificacion === "fija").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>
            <optgroup label="Variables">{categorias.filter((c) => c.clasificacion === "variable").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>
          </select>
        </Campo>
      </div>
      <Campo label="Proveedor (opcional)">
        <select
          value={creandoProv ? "__nuevo__" : f.proveedor_id}
          onChange={(e) => { const v = e.target.value; if (v === "__nuevo__") { setCreandoProv(true); set("proveedor_id", ""); } else { setCreandoProv(false); set("proveedor_id", v); } }}
          className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white"
        >
          <option value="">— Ninguno —</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          <option value="__nuevo__">+ Nuevo proveedor…</option>
        </select>
      </Campo>
      {creandoProv && (
        <div className="rounded-xl ring-1 ring-marfil bg-marfil-soft/40 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-cacao-mute">Nuevo proveedor (se guarda en tu registro)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAMPOS_FORM.map((c) => (
              <Campo key={c.k as string} label={c.label}>
                <input value={nprov[c.k as string] ?? ""} onChange={(e) => setNp(c.k as string, e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
              </Campo>
            ))}
          </div>
        </div>
      )}
      <Campo label="Concepto"><input value={f.concepto} onChange={(e) => set("concepto", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Monto"><input inputMode="decimal" value={f.monto} onChange={(e) => set("monto", e.target.value)} placeholder="0,00" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
        <Campo label="Moneda">
          <select value={f.moneda} onChange={(e) => set("moneda", e.target.value)} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Tasa a USD">
          <input inputMode="decimal" value={f.tasa} onChange={(e) => set("tasa", e.target.value)} disabled={f.moneda === "USD"} placeholder={f.moneda === "USD" ? "—" : ""} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao disabled:bg-marfil-soft" />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Método">
          <select value={f.metodo} onChange={(e) => set("metodo", e.target.value)} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Factura (opcional)"><input value={f.factura} onChange={(e) => set("factura", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      </div>
      <Campo label="Nota (opcional)"><input value={f.nota} onChange={(e) => set("nota", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={guardar} disabled={busy} className="rounded-lg bg-cacao text-white px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={onCancelar} className="rounded-lg ring-1 ring-marfil text-cacao px-5 py-2.5 text-xs uppercase tracking-widest">Cancelar</button>
      </div>
    </div>
  );
}

function CategoriasCatalogo() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [clasificacion, setClasificacion] = useState<"fija" | "variable">("variable");
  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/categorias", { cache: "no-store" });
        const d = await r.json();
        if (a) setCategorias(d.categorias ?? []);
      } catch {
        if (a) setError("No se pudieron cargar las categorías.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [tick]);

  async function agregar() {
    if (!nombre.trim()) return;
    try {
      const r = await fetch("/api/admin/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), clasificacion }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNombre("");
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar.");
    }
  }
  async function eliminar(id: string) {
    try {
      await fetch(`/api/admin/categorias?id=${id}`, { method: "DELETE" });
      recargar();
    } catch {
      setError("No se pudo eliminar.");
    }
  }

  const fijas = categorias.filter((c) => c.clasificacion === "fija");
  const variables = categorias.filter((c) => c.clasificacion === "variable");

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[10rem]">
          <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">Nueva categoría</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregar()} placeholder="Nombre" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
        </div>
        <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value as "fija" | "variable")} className="border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
          <option value="fija">Fija</option>
          <option value="variable">Variable</option>
        </select>
        <button type="button" onClick={agregar} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">Agregar</button>
      </div>

      {cargando ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-5 text-cacao-soft italic font-serif">Cargando…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {([["Fijas", fijas], ["Variables", variables]] as const).map(([titulo, lista]) => (
            <section key={titulo} className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
              <div className="px-4 py-2.5 font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute border-b border-marfil">{titulo}</div>
              {lista.length === 0 ? (
                <p className="p-4 text-sm text-cacao-soft italic font-serif">Ninguna todavía.</p>
              ) : (
                <ul className="divide-y divide-marfil">
                  {lista.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <span className="text-cacao text-sm">{c.nombre}</span>
                      <button type="button" onClick={() => eliminar(c.id)} className="text-cacao-soft hover:text-terracotta text-sm" aria-label="Eliminar">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ingresos ────────────────────────────────────────────────────────
type CategoriaIngreso = { id: string; nombre: string };
type Ingreso = {
  id: string;
  fecha: string;
  concepto: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  pagador: string | null;
  monto: number | null;
  moneda: string | null;
  tasa: number | null;
  monto_usd: number | null;
  iva: number | null;
  metodo: string | null;
  factura: string | null;
  nota: string | null;
};

function SeccionIngresos() {
  const [vista, setVista] = useState<"ingresos" | "factura" | "categorias">("ingresos");
  const tabs: [typeof vista, string][] = [
    ["ingresos", "Ingresos"],
    ["factura", "Importar por factura"],
    ["categorias", "Categorías"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg ring-1 ring-marfil p-1 w-fit">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setVista(k)} className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-widest ${vista === k ? "bg-cacao text-white" : "text-cacao hover:bg-marfil-soft"}`}>
            {label}
          </button>
        ))}
      </div>
      {vista === "ingresos" ? <IngresosMes /> : vista === "factura" ? <CuadreFacturas /> : <CategoriasIngresoCatalogo />}
    </div>
  );
}

// ── Cuadre del "Reporte Detallado por Factura" ──────────────────────────────
// Lee el reporte por factura (Excel/CSV), calcula Ingresos/CXC/RPP y ticket
// promedio, y los COMPARA con lo ya cargado en Administración — sin guardar.
type DiaFacturaUI = { fecha: string; ingresoNeto: number; ingresoBruto: number; cxcNeto: number; cxcBruto: number; rppNeto: number; rppBruto: number; propina: number; tickets: number };
type TotalesFacturaUI = { ingresoNeto: number; ingresoBruto: number; cxcNeto: number; cxcBruto: number; rppNeto: number; rppBruto: number; totalNeto: number; totalBruto: number; propina: number; tickets: number; ticketPromedioBruto: number; ticketPromedioNeto: number };
type MetodoUI = { metodo: string; categoria: "INGRESO" | "CXC" | "RPP"; neto: number; iva: number; monto: number; tickets: number };
type CxCClienteUI = { cliente: string; total: number; docs: { ref: string; fecha: string; monto: number }[] };

function CuadreFacturas() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rep, setRep] = useState<{ desde: string; hasta: string; dias: DiaFacturaUI[]; totales: TotalesFacturaUI; porMetodo?: MetodoUI[]; cxcDetalle?: CxCClienteUI[] } | null>(null);
  const [archivoB64, setArchivoB64] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const fEUR = (v: number) => `${(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  async function subir(file: File) {
    setError(null); setOk(null); setCargando(true); setRep(null); setArchivoB64(null);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("no se pudo leer"));
        fr.readAsDataURL(file);
      });
      const r = await fetch("/api/admin/importar-facturas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_base64: b64 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo leer el archivo.");
      setRep(d.reporte);
      setArchivoB64(b64);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setCargando(false); }
  }

  async function guardar() {
    if (!archivoB64 || !rep) return;
    if (!confirm(`Se importará el reporte (${rep.desde} → ${rep.hasta}): Ingresos, CXC, RPP, propina y tickets. Si reimportas los mismos días, se actualizan (no se duplican). ¿Continuar?`)) return;
    setGuardando(true); setError(null); setOk(null);
    try {
      const r = await fetch("/api/admin/importar-facturas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_base64: archivoB64 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      setOk(`Importado ${d.desde} → ${d.hasta}: ${d.ingresos} ingreso(s), ${d.cxc} CXC, ${d.rpp} RPP, ${d.dias} día(s) de tickets. Ticket promedio ${fEUR(d.ticketPromedio)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setGuardando(false); }
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-4">
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {ok && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#CBD9BC] p-3 text-sm text-[#2F4A1F]">{ok}</div>}

      {!rep ? (
        <div className="text-center py-4">
          <p className="font-display text-[11px] tracking-[0.3em] uppercase text-cacao-mute mb-1">Importar por factura</p>
          <p className="text-sm text-cacao-soft mb-4 font-serif italic max-w-xl mx-auto">Sube el <strong>“Reporte Detallado por Factura”</strong> (Excel .xlsx/.xls o CSV). De un solo archivo salen Ingresos (por método, con IVA), CXC, RPP y el ticket promedio, fechados por la <strong>fecha de orden</strong>. Verás el desglose y con “Guardar” se carga todo.</p>
          <p className="text-[11px] text-cacao-mute mb-3">En iOS: en Numbers usa Compartir → Exportar → Excel (o CSV). En Windows: Excel directo.</p>
          <label className="inline-block rounded-lg bg-cacao text-white px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta cursor-pointer">
            {cargando ? "Leyendo…" : "Elegir archivo (Excel o CSV)"}
            <input type="file" accept=".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" disabled={cargando} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }} />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute">Período {rep.desde} → {rep.hasta} · {rep.totales.tickets} facturas</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={guardar} disabled={guardando || !archivoB64} className="rounded-lg bg-terracotta text-white px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40">
                {guardando ? "Importando…" : "Importar"}
              </button>
              <button type="button" onClick={() => { setRep(null); setArchivoB64(null); setOk(null); }} className="text-xs uppercase tracking-widest text-cacao-soft hover:text-cacao">Cambiar archivo</button>
            </div>
          </div>

          {/* KPIs del reporte */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniKpi titulo="Ticket promedio" valor={fEUR(rep.totales.ticketPromedioBruto)} sub={`${rep.totales.tickets} tickets · neto ${fEUR(rep.totales.ticketPromedioNeto)}`} />
            <MiniKpi titulo="Ingresos (dinero real)" valor={fEUR(rep.totales.ingresoBruto)} sub={`neto ${fEUR(rep.totales.ingresoNeto)}`} />
            <MiniKpi titulo="CXC (crédito)" valor={fEUR(rep.totales.cxcBruto)} sub={`neto ${fEUR(rep.totales.cxcNeto)}`} />
            <MiniKpi titulo="RPP (cortesías)" valor={fEUR(rep.totales.rppBruto)} sub={`neto ${fEUR(rep.totales.rppNeto)}`} />
          </div>

          {/* Desglose por método de pago (como el Detallado por Forma de Pago) */}
          {rep.porMetodo && rep.porMetodo.length > 0 && (
            <div className="rounded-xl ring-1 ring-marfil overflow-hidden">
              <div className="px-3 py-2 bg-marfil-soft font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute">Desglose por método de pago</div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-cacao-mute uppercase tracking-widest text-left"><th className="py-1.5 px-3 font-normal">Método</th><th className="py-1.5 px-3 font-normal">Tipo</th><th className="py-1.5 px-3 font-normal text-right">Fact.</th><th className="py-1.5 px-3 font-normal text-right">Neto</th><th className="py-1.5 px-3 font-normal text-right">IVA</th><th className="py-1.5 px-3 font-normal text-right">Total</th></tr></thead>
                <tbody>
                  {rep.porMetodo.map((m) => (
                    <tr key={m.metodo} className="border-t border-marfil">
                      <td className="py-1 px-3 text-cacao whitespace-nowrap">{m.metodo}</td>
                      <td className="py-1 px-3 text-cacao-soft">{m.categoria === "INGRESO" ? "Ingreso" : m.categoria === "CXC" ? "Crédito (CXC)" : "Cortesía (RPP)"}</td>
                      <td className="py-1 px-3 text-right tabular-nums text-cacao-soft">{m.tickets}</td>
                      <td className="py-1 px-3 text-right tabular-nums text-cacao-soft">{fEUR(m.neto)}</td>
                      <td className="py-1 px-3 text-right tabular-nums text-cacao-soft">{fEUR(m.iva)}</td>
                      <td className="py-1 px-3 text-right tabular-nums text-cacao">{fEUR(m.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-marfil font-medium"><td className="py-1 px-3 text-cacao" colSpan={3}>Total</td><td className="py-1 px-3 text-right tabular-nums text-cacao-soft">{fEUR(rep.totales.totalNeto)}</td><td className="py-1 px-3 text-right tabular-nums text-cacao-soft">{fEUR(rep.totales.totalBruto - rep.totales.totalNeto)}</td><td className="py-1 px-3 text-right tabular-nums text-cacao">{fEUR(rep.totales.totalBruto)}</td></tr></tfoot>
              </table>
              </div>
            </div>
          )}

          {/* Detalle de cuentas por cobrar (crédito) por cliente */}
          {rep.cxcDetalle && rep.cxcDetalle.length > 0 && (
            <div className="rounded-xl ring-1 ring-marfil overflow-hidden">
              <div className="px-3 py-2 bg-marfil-soft font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute flex items-center justify-between">
                <span>Cuentas por cobrar (crédito) · {rep.cxcDetalle.length} cliente{rep.cxcDetalle.length === 1 ? "" : "s"}</span>
                <span className="text-cacao">{fEUR(rep.totales.cxcBruto)}</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {rep.cxcDetalle.map((c) => (
                      <tr key={c.cliente} className="border-t border-marfil">
                        <td className="py-1.5 px-3 text-cacao">{c.cliente}<span className="text-cacao-mute"> · {c.docs.length} doc{c.docs.length === 1 ? "" : "s"} ({c.docs.map((d) => d.ref).filter(Boolean).join(", ")})</span></td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-cacao whitespace-nowrap">{fEUR(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[11px] text-cacao-soft">Con <strong>“Importar”</strong> se cargan los días del reporte ({rep.desde} → {rep.hasta}): Ingresos (por método, neto + IVA), CXC (por cliente), RPP, propina y tickets. Es idempotente: reimportar los mismos días los actualiza (no duplica), y los días que no vienen en el archivo no se tocan.</p>
        </div>
      )}
    </div>
  );
}

function MiniKpi({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl ring-1 ring-marfil p-3">
      <div className="text-[10px] uppercase tracking-widest text-cacao-mute">{titulo}</div>
      <div className="mt-1 font-cinzel text-base text-cacao leading-tight">{valor}</div>
      {sub && <div className="text-[11px] text-cacao-soft mt-0.5">{sub}</div>}
    </div>
  );
}

function IngresosMes() {
  const [mes, setMes] = useState<string>(mesActualISO());
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<CategoriaIngreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [editando, setEditando] = useState<Ingreso | null>(null);
  const [ventasMes, setVentasMes] = useState<Record<string, number>>({});
  const [propinas, setPropinas] = useState<{ id: string; fecha: string; monto: number | null; moneda: string | null }[]>([]);
  const [propFecha, setPropFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [propMonto, setPropMonto] = useState("");
  const [propNota, setPropNota] = useState("");
  const [guardandoProp, setGuardandoProp] = useState(false);
  const [tasaInput, setTasaInput] = useState("1.17");
  const [guardandoTasa, setGuardandoTasa] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [ivaInput, setIvaInput] = useState("16");
  const [sinIvaInput, setSinIvaInput] = useState("Zelle, Dólar");
  const [guardandoIva, setGuardandoIva] = useState(false);
  const [recalculandoIva, setRecalculandoIva] = useState(false);
  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const [ri, rc, rp] = await Promise.all([
          fetch(`/api/admin/ingresos?mes=${mes}`, { cache: "no-store" }),
          fetch("/api/admin/categorias-ingreso", { cache: "no-store" }),
          fetch(`/api/admin/propinas?mes=${mes}`, { cache: "no-store" }),
        ]);
        const [di, dc, dp] = await Promise.all([ri.json(), rc.json(), rp.json()]);
        if (a) {
          setIngresos(di.ingresos ?? []);
          setCategorias(dc.categorias ?? []);
          setPropinas(dp.propinas ?? []);
        }
      } catch {
        if (a) setError("No se pudieron cargar los ingresos.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [mes, tick]);

  // Total de ventas registradas en Cocina (para comparar/conciliar). Es la
  // misma cifra del POS que se importa como ingresos; se carga una vez.
  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const t = await totalesVentasPorMes();
        if (a) setVentasMes(t);
      } catch {
        /* la comparación es opcional */
      }
    })();
    return () => { a = false; };
  }, [tick]);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/config", { cache: "no-store" });
        const d = await r.json();
        const v = d.config?.tasa_eur_usd;
        if (a && v != null && v !== "") setTasaInput(String(v));
        if (a && d.config?.iva_pct != null && d.config.iva_pct !== "") setIvaInput(String(d.config.iva_pct));
        if (a && d.config?.metodos_sin_iva) setSinIvaInput(String(d.config.metodos_sin_iva));
      } catch {
        /* usa el valor por defecto */
      }
    })();
    return () => { a = false; };
  }, []);

  async function guardarTasa() {
    setGuardandoTasa(true);
    setError(null);
    try {
      const val = parseTasa(tasaInput);
      if (!val || val <= 0) { setError("Pon una tasa válida (ej. 1,17)."); return; }
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave: "tasa_eur_usd", valor: String(val) }),
      });
      setMsg(`Tasa guardada: 1 € = ${val} $. Usa "Recalcular" para aplicarla a lo ya cargado.`);
    } catch {
      setError("No se pudo guardar la tasa.");
    } finally {
      setGuardandoTasa(false);
    }
  }

  async function recalcularUSD() {
    setRecalculando(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/recalcular-usd", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo recalcular.");
      setMsg(`Recalculado con 1 € = ${d.tasa} $: ${d.ingresos} ingresos y ${d.cuentas} cuentas por cobrar.`);
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo recalcular.");
    } finally {
      setRecalculando(false);
    }
  }

  async function guardarIva() {
    setGuardandoIva(true);
    setError(null);
    try {
      const val = parseTasa(ivaInput);
      if (val == null || val < 0) { setError("Pon un % de IVA válido (ej. 16)."); return; }
      await Promise.all([
        fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: "iva_pct", valor: String(val) }) }),
        fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: "metodos_sin_iva", valor: sinIvaInput }) }),
      ]);
      setMsg(`IVA guardado: ${val}%. Exentos: ${sinIvaInput}. Usa "Recalcular IVA" para aplicarlo a lo cargado.`);
    } catch {
      setError("No se pudo guardar el IVA.");
    } finally {
      setGuardandoIva(false);
    }
  }

  async function recalcularIVA() {
    setRecalculandoIva(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/recalcular-iva", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo recalcular el IVA.");
      setMsg(`IVA separado (${d.ivaPct}%) en ${d.ajustados} ingresos de Xetux.`);
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo recalcular el IVA.");
    } finally {
      setRecalculandoIva(false);
    }
  }

  // Los ingresos vienen en distintas monedas reales: Setux en euros, los
  // alquileres de inquilinos en dólares, etc. No se fuerzan a una sola: se
  // totaliza POR MONEDA para no distorsionar con tasas inventadas.
  const ORDEN_MONEDA = ["EUR", "USD", "Bs"];
  const totalesPorMoneda: Record<string, number> = {};
  for (const e of ingresos) {
    const k = e.moneda || "EUR";
    totalesPorMoneda[k] = (totalesPorMoneda[k] ?? 0) + (e.monto ?? 0);
  }
  const monedasPresentes = ORDEN_MONEDA.filter((k) => (totalesPorMoneda[k] ?? 0) > 0.005)
    .concat(Object.keys(totalesPorMoneda).filter((k) => !ORDEN_MONEDA.includes(k) && (totalesPorMoneda[k] ?? 0) > 0.005));
  // Desglose por MÉTODO DE PAGO, guardando el monto por moneda dentro de cada uno.
  // Así se ve por qué canal entró (Zelle/Dólar = dólares, Pago Móvil/Pto de Venta = Bs tasa euro).
  const porMetodo: Record<string, Record<string, number>> = {};
  for (const e of ingresos) {
    // Dólar (efectivo USD) y Efectivo se muestran unidos como "Efectivo". El
    // dato crudo (e.metodo) no se toca: esto solo agrupa la vista.
    const up = (e.metodo || "").trim().toUpperCase();
    const metodo = !e.metodo
      ? "Sin método"
      : up === "DOLAR" || up === "DÓLAR" || up === "EFECTIVO"
        ? "Efectivo"
        : e.metodo;
    const k = e.moneda || "EUR";
    (porMetodo[metodo] ??= {})[k] = (porMetodo[metodo][k] ?? 0) + (e.monto ?? 0);
  }
  // Ordena de mayor a menor por el total del método (sumando sus monedas).
  const desglose = Object.entries(porMetodo).sort(
    (a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0),
  );

  async function borrar(id: string) {
    try {
      await fetch(`/api/admin/ingresos?id=${id}`, { method: "DELETE" });
      setMsg("Ingreso eliminado.");
      recargar();
    } catch {
      setError("No se pudo eliminar.");
    }
  }

  const propinasMes = propinas.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const ivaMes = ingresos.reduce((s, e) => s + (Number(e.iva) || 0), 0);
  async function borrarPropina(id: string) {
    try {
      await fetch(`/api/admin/propinas?id=${id}`, { method: "DELETE" });
      setMsg("Propina eliminada.");
      recargar();
    } catch {
      setError("No se pudo eliminar la propina.");
    }
  }
  async function agregarPropina(e: React.FormEvent) {
    e.preventDefault();
    const monto = parseMonto(propMonto);
    if (monto == null || monto <= 0) { setError("Pon un monto de propina válido."); return; }
    setGuardandoProp(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/propinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: propFecha || undefined, monto, moneda: "EUR", nota: propNota.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar la propina.");
      setPropMonto("");
      setPropNota("");
      setMsg("Propina registrada.");
      recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la propina.");
    } finally {
      setGuardandoProp(false);
    }
  }

  if (modo === "form") {
    return (
      <FormIngreso
        inicial={editando}
        mes={mes}
        categorias={categorias}
        onCancelar={() => { setModo("lista"); setEditando(null); }}
        onGuardado={(esEdicion) => { setModo("lista"); setEditando(null); setMsg(esEdicion ? "Ingreso actualizado." : "Ingreso registrado."); recargar(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setCargando(true); setMes((m) => moverMes(m, -1)); }} className="rounded-lg ring-1 ring-marfil px-2.5 py-1.5 text-cacao hover:bg-marfil-soft" aria-label="Mes anterior">←</button>
          <span className="font-cinzel text-base text-cacao min-w-[9rem] text-center">{nombreMes(mes)}</span>
          <button type="button" onClick={() => { setCargando(true); setMes((m) => moverMes(m, 1)); }} className="rounded-lg ring-1 ring-marfil px-2.5 py-1.5 text-cacao hover:bg-marfil-soft" aria-label="Mes siguiente">→</button>
        </div>
        <button type="button" onClick={() => { setEditando(null); setModo("form"); }} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">+ Registrar ingreso</button>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {msg && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">{msg}</div>}

      <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">Tasa €→USD</label>
          <div className="flex items-center gap-1 text-sm text-cacao">
            1 € =
            <input inputMode="decimal" value={tasaInput} onChange={(e) => setTasaInput(e.target.value)} className="w-20 border border-marfil rounded-lg px-2 py-2 text-sm text-cacao text-center" />
            $
          </div>
        </div>
        <button type="button" onClick={guardarTasa} disabled={guardandoTasa} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{guardandoTasa ? "Guardando…" : "Guardar tasa"}</button>
        <button type="button" onClick={recalcularUSD} disabled={recalculando} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft disabled:text-cacao-mute">{recalculando ? "Recalculando…" : "Recalcular cargados"}</button>
        <p className="text-[11px] text-cacao-mute flex-1 min-w-[12rem]">Tasa fija para pasar euros a dólares. Cámbiala cuando haga falta y dale “Recalcular” para aplicarla a todo lo ya cargado.</p>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">IVA</label>
          <div className="flex items-center gap-1">
            <input inputMode="decimal" value={ivaInput} onChange={(e) => setIvaInput(e.target.value)} className="w-16 border border-marfil rounded-lg px-2 py-2 text-sm text-cacao text-center" />
            <span className="text-cacao-soft">%</span>
          </div>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">Métodos sin IVA (no facturados)</label>
          <input value={sinIvaInput} onChange={(e) => setSinIvaInput(e.target.value)} placeholder="Zelle, Dólar" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
        </div>
        <button type="button" onClick={guardarIva} disabled={guardandoIva} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{guardandoIva ? "Guardando…" : "Guardar IVA"}</button>
        <button type="button" onClick={recalcularIVA} disabled={recalculandoIva} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft disabled:text-cacao-mute">{recalculandoIva ? "Recalculando…" : "Recalcular IVA cargados"}</button>
        <p className="text-[11px] text-cacao-mute w-full">Las ventas facturadas traen el IVA incluido; se guarda el neto y el IVA aparte. Los métodos de la lista (separados por coma) no llevan IVA. “Recalcular IVA” separa el IVA de lo ya cargado (una vez).</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#0F0F0F] text-[#EDE7E0] ring-1 ring-[#0F0F0F] p-4">
          <div className="font-display text-[9px] tracking-[0.25em] uppercase text-[#9A938B]">Total del mes</div>
          {monedasPresentes.length === 0 ? (
            <div className="text-lg font-medium mt-1">—</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {monedasPresentes.map((k) => (
                <div key={k} className="text-lg font-medium leading-tight">{fmtMonto(totalesPorMoneda[k], k)}</div>
              ))}
            </div>
          )}
          {monedasPresentes.length > 1 && <div className="text-[10px] text-[#9A938B] mt-1.5">Cada moneda por separado (Xetux en €, alquileres en $).</div>}
          {/* Ingreso: total y comparación con Cocina, juntos arriba */}
          <div className="mt-2 pt-2 border-t border-[#333]">
            <div className="text-[9px] tracking-[0.2em] uppercase text-[#9A938B]">Ventas en Cocina (POS)</div>
            <div className="text-sm font-medium leading-tight mt-0.5">{fmtMonto(ventasMes[mes] ?? 0, "EUR")}</div>
            <div className="text-[10px] text-[#9A938B] mt-0.5">Para comparar (misma moneda). La diferencia con los ingresos suele ser CXC y cortesías.</div>
          </div>
          {/* No es ingreso: al fondo */}
          {(ivaMes > 0 || propinasMes > 0) && (
            <div className="mt-3 pt-2 border-t border-[#444]">
              <div className="text-[9px] tracking-[0.2em] uppercase text-[#7C766E]">No es ingreso</div>
              {ivaMes > 0 && (
                <div className="flex justify-between text-[13px] mt-1">
                  <span className="text-[#9A938B]">IVA</span>
                  <span className="text-[#EDE7E0]">{fmtMonto(ivaMes, "EUR")}</span>
                </div>
              )}
              {propinasMes > 0 && (
                <div className="flex justify-between text-[13px] mt-0.5">
                  <span className="text-[#9A938B]">Propinas</span>
                  <span className="text-[#EDE7E0]">{fmtMonto(propinasMes, "EUR")}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="sm:col-span-2 rounded-2xl bg-white ring-1 ring-marfil p-4">
          <div className="font-display text-[9px] tracking-[0.25em] uppercase text-cacao-mute mb-2">Por método de pago</div>
          {desglose.length === 0 ? (
            <p className="text-sm text-cacao-soft italic font-serif">Sin ingresos este mes.</p>
          ) : (
            <ul className="space-y-1">
              {desglose.map(([nombre, porMoneda]) => (
                <li key={nombre} className="flex justify-between gap-3 text-sm">
                  <span className="text-cacao-soft">{nombre}</span>
                  <span className="text-cacao text-right">
                    {ORDEN_MONEDA.filter((k) => (porMoneda[k] ?? 0) > 0.005).map((k) => fmtMonto(porMoneda[k], k)).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-[9px] tracking-[0.25em] uppercase text-cacao-mute">Propinas del mes (no es ingreso)</span>
          <span className="text-sm font-medium text-cacao">{fmtMonto(propinasMes, "EUR")}</span>
        </div>
        {/* Registrar propina manual (p.ej. un cliente que deja propina al pagar una CxC). */}
        <form onSubmit={agregarPropina} className="flex flex-wrap items-end gap-2 mb-3">
          <label className="text-[11px] text-cacao-soft">
            Fecha
            <input type="date" value={propFecha} onChange={(e) => setPropFecha(e.target.value)} className="mt-0.5 block rounded-lg ring-1 ring-marfil px-2 py-1 text-sm" />
          </label>
          <label className="text-[11px] text-cacao-soft">
            Monto (€)
            <input inputMode="decimal" value={propMonto} onChange={(e) => setPropMonto(e.target.value)} placeholder="0.00" className="mt-0.5 block w-24 rounded-lg ring-1 ring-marfil px-2 py-1 text-sm text-right tabular-nums" />
          </label>
          <label className="text-[11px] text-cacao-soft flex-1 min-w-[140px]">
            Nota (opcional)
            <input value={propNota} onChange={(e) => setPropNota(e.target.value)} placeholder="Ej: propina de <cliente> al pagar CxC" className="mt-0.5 block w-full rounded-lg ring-1 ring-marfil px-2 py-1 text-sm" />
          </label>
          <button type="submit" disabled={guardandoProp || !propMonto.trim()} className="rounded-lg bg-cacao text-white px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:opacity-40">
            {guardandoProp ? "Guardando…" : "+ Propina"}
          </button>
        </form>
        {propinas.length > 0 ? (
          <ul className="divide-y divide-marfil">
            {propinas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="text-cacao-soft">{fmtFecha(p.fecha)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-cacao tabular-nums">{fmtMonto(Number(p.monto) || 0, p.moneda || "EUR")}</span>
                  <button type="button" onClick={() => borrarPropina(p.id)} className="text-cacao-soft hover:text-terracotta" aria-label="Eliminar propina">✕</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-cacao-soft italic">Sin propinas registradas este mes.</p>
        )}
        <p className="text-[11px] text-cacao-mute mt-2">La propina no es ingreso: se cobra para el personal. Si borras las ventas de un día, borra también su propina aquí (son registros separados).</p>
      </div>

      <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        {cargando ? (
          <p className="p-5 text-cacao-soft italic font-serif">Cargando…</p>
        ) : ingresos.length === 0 ? (
          <p className="p-8 text-center text-cacao-soft italic font-serif">No hay ingresos en {nombreMes(mes)}.</p>
        ) : (
          <ul className="divide-y divide-marfil">
            {ingresos.map((e) => (
              <li key={e.id} className="flex items-start gap-3 p-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-cacao font-medium truncate">{e.pagador || e.concepto || e.categoria_nombre || "(ingreso)"}</span>
                    <span className="text-cacao whitespace-nowrap">{e.monto != null ? fmtMonto(e.monto, e.moneda || "Bs") : "—"}</span>
                  </div>
                  <div className="text-[11px] text-cacao-mute mt-1 flex flex-wrap gap-x-2">
                    <span>{fmtFecha(e.fecha)}</span>
                    {e.categoria_nombre && <span>· {e.categoria_nombre}</span>}
                    {e.metodo && <span>· {e.metodo}</span>}
                    {e.monto_usd != null && e.moneda !== "USD" && <span>· ≈ {fmtMonto(e.monto_usd, "USD")}</span>}
                  </div>
                  {e.concepto && e.pagador && <div className="text-xs text-cacao-soft mt-0.5">{e.concepto}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => { setEditando(e); setModo("form"); }} className="text-cacao-soft hover:text-cacao text-sm" aria-label="Editar">✎</button>
                  <button type="button" onClick={() => borrar(e.id)} className="text-cacao-soft hover:text-terracotta text-sm" aria-label="Eliminar">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FormIngreso({
  inicial,
  mes,
  categorias,
  onGuardado,
  onCancelar,
}: {
  inicial: Ingreso | null;
  mes: string;
  categorias: CategoriaIngreso[];
  onGuardado: (esEdicion: boolean) => void;
  onCancelar: () => void;
}) {
  const esEdicion = !!inicial;
  const [f, setF] = useState({
    fecha: inicial?.fecha ?? `${mes}-01`,
    categoria_id: inicial?.categoria_id ?? "",
    pagador: inicial?.pagador ?? "",
    concepto: inicial?.concepto ?? "",
    monto: inicial?.monto != null ? String(inicial.monto) : "",
    moneda: inicial?.moneda ?? "Bs",
    tasa: inicial?.tasa != null ? String(inicial.tasa) : "",
    metodo: inicial?.metodo ?? "Transferencia",
    factura: inicial?.factura ?? "",
    nota: inicial?.nota ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function set<K extends keyof typeof f>(k: K, v: string) { setF((o) => ({ ...o, [k]: v })); }

  async function guardar() {
    if (parseMonto(f.monto) == null) { setError("Pon un monto."); return; }
    setBusy(true);
    setError(null);
    try {
      const cat = categorias.find((c) => c.id === f.categoria_id);
      const cuerpo = {
        ...(esEdicion ? { id: inicial!.id } : {}),
        fecha: f.fecha,
        concepto: f.concepto,
        categoria_id: f.categoria_id || null,
        categoria_nombre: cat?.nombre ?? null,
        pagador: f.pagador,
        monto: parseMonto(f.monto),
        moneda: f.moneda,
        tasa: parseTasa(f.tasa),
        metodo: f.metodo,
        factura: f.factura,
        nota: f.nota,
      };
      const r = await fetch("/api/admin/ingresos", {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esEdicion ? cuerpo : { ingreso: cuerpo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error guardando");
      onGuardado(esEdicion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-5 max-w-lg space-y-3">
      <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">{esEdicion ? "Editar ingreso" : "Registrar ingreso"}</h2>
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-2.5 text-sm text-[#7A2419]">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
        <Campo label="Categoría">
          <select value={f.categoria_id} onChange={(e) => set("categoria_id", e.target.value)} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
            <option value="">Sin categoría</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Pagador / Inquilino (opcional)"><input value={f.pagador} onChange={(e) => set("pagador", e.target.value)} placeholder="Quién pagó" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      <Campo label="Concepto"><input value={f.concepto} onChange={(e) => set("concepto", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Monto"><input inputMode="decimal" value={f.monto} onChange={(e) => set("monto", e.target.value)} placeholder="0,00" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
        <Campo label="Moneda">
          <select value={f.moneda} onChange={(e) => set("moneda", e.target.value)} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Método">
          <select value={f.metodo} onChange={(e) => set("metodo", e.target.value)} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Recibo / Factura (opcional)"><input value={f.factura} onChange={(e) => set("factura", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      </div>
      <Campo label="Nota (opcional)"><input value={f.nota} onChange={(e) => set("nota", e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" /></Campo>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={guardar} disabled={busy} className="rounded-lg bg-cacao text-white px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={onCancelar} className="rounded-lg ring-1 ring-marfil text-cacao px-5 py-2.5 text-xs uppercase tracking-widest">Cancelar</button>
      </div>
    </div>
  );
}

function CategoriasIngresoCatalogo() {
  const [categorias, setCategorias] = useState<CategoriaIngreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/categorias-ingreso", { cache: "no-store" });
        const d = await r.json();
        if (a) setCategorias(d.categorias ?? []);
      } catch {
        if (a) setError("No se pudieron cargar las categorías.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [tick]);

  async function agregar() {
    if (!nombre.trim()) return;
    try {
      const r = await fetch("/api/admin/categorias-ingreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNombre("");
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar.");
    }
  }
  async function eliminar(id: string) {
    try {
      await fetch(`/api/admin/categorias-ingreso?id=${id}`, { method: "DELETE" });
      recargar();
    } catch {
      setError("No se pudo eliminar.");
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[10rem]">
          <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">Nueva categoría de ingreso</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregar()} placeholder="Nombre" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
        </div>
        <button type="button" onClick={agregar} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta">Agregar</button>
      </div>

      {cargando ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-5 text-cacao-soft italic font-serif">Cargando…</p>
      ) : (
        <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
          {categorias.length === 0 ? (
            <p className="p-4 text-sm text-cacao-soft italic font-serif">Ninguna todavía.</p>
          ) : (
            <ul className="divide-y divide-marfil">
              {categorias.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-cacao text-sm">{c.nombre}</span>
                  <button type="button" onClick={() => eliminar(c.id)} className="text-cacao-soft hover:text-terracotta text-sm" aria-label="Eliminar">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ── Estado de Cuenta ────────────────────────────────────────────────
// Cruza ingresos y egresos del mes (todo en USD) y saca el balance.
// No guarda nada: solo lee lo ya registrado en las otras secciones.
function SeccionEstado() {
  const [mes, setMes] = useState<string>(mesActualISO());
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Vista de moneda: todo en € (por defecto) o todo en $.
  const [vista, setVista] = useState<"eur" | "usd">("eur");
  const [eurUsd, setEurUsd] = useState(1.17); // 1 € = X $ (respaldo si no hay tasa BCV)
  const [tasasBcv, setTasasBcv] = useState<TasaBcv[]>([]); // tasas BCV del mes (por fecha)
  const [compras, setCompras] = useState<Compra[]>([]); // compras de insumos (Cocina) = egresos en $

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const [y, m] = mes.split("-").map((x) => parseInt(x, 10));
        const finMes = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
        const [ri, re, tb, cp] = await Promise.all([
          fetch(`/api/admin/ingresos?mes=${mes}`, { cache: "no-store" }),
          fetch(`/api/admin/egresos?mes=${mes}`, { cache: "no-store" }),
          listTasasBcvRango(`${mes}-01`, finMes).catch(() => [] as TasaBcv[]),
          listComprasRango(`${mes}-01`, finMes).catch(() => [] as Compra[]),
        ]);
        const [di, de] = await Promise.all([ri.json(), re.json()]);
        if (a) {
          setIngresos(di.ingresos ?? []);
          setEgresos(de.egresos ?? []);
          setTasasBcv(tb);
          setCompras(cp);
        }
      } catch {
        if (a) setError("No se pudo cargar el estado de cuenta.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [mes]);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/config", { cache: "no-store" });
        const d = await r.json();
        const v = Number(String(d.config?.tasa_eur_usd ?? "").replace(",", "."));
        if (a && isFinite(v) && v > 0) setEurUsd(v);
      } catch { /* usa el valor por defecto */ }
    })();
    return () => { a = false; };
  }, []);


  // Las compras de insumos (Cocina) son egresos en $ (precio canónico en USD).
  // Se suman al Estado de Cuenta como egresos, categoría "Insumos (Cocina)".
  const comprasEgreso: Egreso[] = compras
    .filter((c) => (c.precioTotalUsd ?? 0) > 0.005)
    .map((c) => ({
      id: c.id, fecha: c.fecha, concepto: "Compra de insumos", categoria_id: null,
      categoria_nombre: "Insumos (Cocina)", clasificacion: "variable",
      proveedor_id: null, proveedor_nombre: null,
      monto: c.precioTotalUsd, moneda: "USD", tasa: null, monto_usd: c.precioTotalUsd,
      metodo: c.modalidadPago ?? null, factura: null, nota: null, solicitud_linea_id: null,
    }) as unknown as Egreso);
  const egresosAll: Egreso[] = [...egresos, ...comprasEgreso];

  // Totales por moneda (sin forzar conversión): Setux en €, alquileres en $, etc.
  const sumaMoneda = (arr: (Ingreso | Egreso)[]) => {
    const m: Record<string, number> = {};
    for (const e of arr) { const k = e.moneda || "EUR"; m[k] = (m[k] ?? 0) + (e.monto ?? 0); }
    return m;
  };
  const ingByMon = sumaMoneda(ingresos);
  const egrByMon = sumaMoneda(egresosAll);
  const ORDEN = ["EUR", "USD", "Bs"];
  const conValor = (k: string) => (ingByMon[k] ?? 0) > 0.005 || (egrByMon[k] ?? 0) > 0.005;
  const monedas = ORDEN.filter(conValor).concat(
    [...new Set([...Object.keys(ingByMon), ...Object.keys(egrByMon)])].filter((k) => !ORDEN.includes(k) && conValor(k)),
  );

  // ── Conversión a moneda única (conserva el original abajo) ──
  // Cada registro guarda monto_usd (equivalente calculado a la tasa con que se
  // pagó). El paso €↔$ usa el CRUCE BCV REAL del día del registro
  // (eur_bs ÷ usd_bs); si falta, la última tasa disponible; si no, el 1,17 fijo.
  const crossMap = new Map<string, number>();
  let ultimoCross = eurUsd;
  for (const t of tasasBcv) {
    if (t.eurBs != null && t.usdBs > 0) { const c = t.eurBs / t.usdBs; crossMap.set(t.fecha, c); ultimoCross = c; }
  }
  const crossDe = (fecha: string): number => crossMap.get(fecha) ?? ultimoCross ?? eurUsd;
  const enUSD = (e: Ingreso | Egreso): number => {
    if (e.monto_usd != null) return e.monto_usd;
    const mon = e.moneda || "EUR";
    if (mon === "USD") return e.monto ?? 0;
    if (mon === "EUR") return (e.monto ?? 0) * crossDe(e.fecha);
    return 0; // Bs sin equivalente: no se puede convertir con fiabilidad
  };
  const enEUR = (e: Ingreso | Egreso): number => {
    const mon = e.moneda || "EUR";
    if (mon === "EUR") return e.monto ?? 0;
    const cross = crossDe(e.fecha);
    return cross > 0 ? enUSD(e) / cross : 0;
  };
  const conv = vista === "usd" ? enUSD : enEUR;
  const monedaUni = vista === "usd" ? "USD" : "EUR";
  const ingUni = ingresos.reduce((s, e) => s + conv(e), 0);
  const egrUni = egresosAll.reduce((s, e) => s + conv(e), 0);
  const balUni = ingUni - egrUni;
  // Categorías en moneda única (para la vista unificada).
  const catUni = (arr: (Ingreso | Egreso)[]): [string, number][] => {
    const o: Record<string, number> = {};
    for (const e of arr) { const c = e.categoria_nombre || "Sin categoría"; o[c] = (o[c] ?? 0) + conv(e); }
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  };
  // Composición por moneda original de los egresos (para no perder la tasa).
  const egrOrig = monedas.map((k) => ({ k, monto: egrByMon[k] ?? 0 })).filter((x) => x.monto > 0.005);
  const btn = (active: boolean) => `rounded-md px-3 py-1.5 text-[11px] uppercase tracking-widest ${active ? "bg-cacao text-white" : "text-cacao hover:bg-marfil-soft"}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => { setCargando(true); setMes((m) => moverMes(m, -1)); }} className="rounded-lg ring-1 ring-marfil px-2.5 py-1.5 text-cacao hover:bg-marfil-soft" aria-label="Mes anterior">←</button>
        <span className="font-cinzel text-base text-cacao min-w-[9rem] text-center">{nombreMes(mes)}</span>
        <button type="button" onClick={() => { setCargando(true); setMes((m) => moverMes(m, 1)); }} className="rounded-lg ring-1 ring-marfil px-2.5 py-1.5 text-cacao hover:bg-marfil-soft" aria-label="Mes siguiente">→</button>
        <div className="ml-auto flex gap-1 rounded-lg ring-1 ring-marfil p-1">
          {([["eur", "Todo en €"], ["usd", "Todo en $"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setVista(k)} className={btn(vista === k)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}

      {cargando ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-5 text-cacao-soft italic font-serif">Cargando…</p>
      ) : (
        <>
          {(
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
                  <div className="font-display text-[9px] tracking-[0.25em] uppercase text-cacao-mute">Ingresos</div>
                  <div className="mt-1 text-lg font-medium text-cacao leading-tight">{fmtMonto(ingUni, monedaUni)}</div>
                </div>
                <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
                  <div className="font-display text-[9px] tracking-[0.25em] uppercase text-cacao-mute">Egresos</div>
                  <div className="mt-1 text-lg font-medium text-cacao leading-tight">{fmtMonto(egrUni, monedaUni)}</div>
                  {egrOrig.length > 1 && <div className="text-[10px] text-cacao-mute mt-1">De: {egrOrig.map((x) => fmtMonto(x.monto, x.k)).join(" + ")}</div>}
                </div>
                <div className="rounded-2xl ring-1 p-4 bg-[#0F0F0F] text-[#EDE7E0] ring-[#0F0F0F]">
                  <div className="font-display text-[9px] tracking-[0.25em] uppercase text-[#9A938B]">Balance del mes</div>
                  <div className={`mt-1 text-lg font-medium leading-tight ${balUni < 0 ? "text-[#E7A99B]" : ""}`}>{balUni < 0 ? `− ${fmtMonto(Math.abs(balUni), monedaUni)}` : fmtMonto(balUni, monedaUni)}</div>
                  <div className="text-[10px] text-[#9A938B] mt-1.5">Convertido con la tasa BCV real de cada fecha ({crossMap.size > 0 ? `≈ 1 € = ${ultimoCross.toFixed(2)} $` : `1 € = ${eurUsd} $`}). La tasa de cada pago se conserva en su registro.</div>
                </div>
              </div>
              <div className="grid gap-4">
                <DesgloseUnico titulo="Egresos por categoría" filas={catUni(egresosAll)} moneda={monedaUni} />
              </div>
              <p className="text-[11px] text-cacao-soft italic">Cada egreso conserva su moneda y tasa originales en su registro; el detalle por moneda está en Análisis administrativo. Los pagos en Bs sin equivalente calculado no se convierten.</p>
            </>
          )}

          {ingresos.length === 0 && egresosAll.length === 0 && (
            <p className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft italic font-serif">
              Sin movimientos en {nombreMes(mes)}. Registra ingresos y egresos y aquí verás el balance.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DesgloseUnico({ titulo, filas, moneda }: { titulo: string; filas: [string, number][]; moneda: string }) {
  const total = filas.reduce((s, [, v]) => s + v, 0);
  return (
    <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
      <div className="px-4 py-2.5 font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute border-b border-marfil flex items-center justify-between">
        <span>{titulo}</span><span className="text-cacao tabular-nums normal-case tracking-normal">{fmtMonto(total, moneda)}</span>
      </div>
      {filas.length === 0 ? (
        <p className="p-4 text-sm text-cacao-soft italic font-serif">Nada este mes.</p>
      ) : (
        <ul className="divide-y divide-marfil">
          {filas.map(([nombre, v]) => (
            <li key={nombre} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-cacao-soft">{nombre}</span>
              <span className="text-cacao text-right whitespace-nowrap tabular-nums">{fmtMonto(v, moneda)}{total > 0.005 ? ` · ${((v / total) * 100).toFixed(0)}%` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


// ── Cuentas por cobrar (CXC) ────────────────────────────────────────
// ── Cuentas por cobrar (CXC) · saldos por cliente ───────────────────
// Modelo: cada cliente tiene CUENTAS (deudas) y PAGOS (cobros).
//   saldo del cliente = Σ cuentas − Σ pagos   (se calcula en el servidor)
// Todo se expresa como las ventas: en euros, con equivalente en $ a la tasa.
type CuentaMov = {
  id: string; fecha: string; descripcion: string | null; deudor: string | null; ref: string | null;
  monto: number | null; moneda: string | null; tasa: number | null; monto_usd: number | null;
  cobrada: boolean; fuente: string | null; pagado_usd?: number;
};
type Asignacion = { cuenta_id: string; ref: string | null; eur: number; usd: number };
type PagoMov = {
  id: string; cliente: string; fecha: string; monto: number | null; moneda: string | null;
  tasa: number | null; monto_usd: number | null; metodo: string | null; referencia: string | null;
  ingreso_id: string | null; nota: string | null; asignaciones: Asignacion[] | null;
};
type ClienteCXC = {
  cliente: string; key: string; saldo_usd: number; total_cuentas_usd: number; total_pagos_usd: number;
  ultima: string | null; cuentas: CuentaMov[]; pagos: PagoMov[];
};
type IncobrableUI = {
  id: string; fecha: string; deudor: string | null; ref: string | null; descripcion: string | null;
  monto: number | null; moneda: string | null; monto_usd: number | null; fecha_incobrable: string | null;
};

// Métodos de pago disponibles (los mismos que reporta el sistema/Setux).
const METODOS_COBRO = ["Efectivo", "Pago Móvil", "Zelle", "Punto de Venta", "Transferencia", "Dólar", "Tarjeta de crédito", "Tarjeta de débito", "Otro"];

// Un saldo a favor de hasta este monto (EUR) se considera sobrante de redondeo
// (pagó de más, sin vuelto) → se ofrece "Marcar sobrante" en la fila. Por encima,
// se trata como crédito real del cliente.
const SOBRANTE_MAX_EUR = 2;

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function diasHastaCierre(): number {
  const d = new Date();
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0, ultimo - d.getDate());
}

// Banner de alerta: aparece arriba del panel cuando hay clientes con saldo.
function AlertaCobrar({ refreshKey, onIr }: { refreshKey: string; onIr: () => void }) {
  const [clientes, setClientes] = useState<ClienteCXC[]>([]);
  const [tasa, setTasa] = useState(1.17);
  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/cuentas-cobrar", { cache: "no-store" });
        const d = await r.json();
        if (a) { setClientes(d.clientes ?? []); if (d.tasa) setTasa(d.tasa); }
      } catch {
        /* silencioso: la alerta es informativa */
      }
    })();
    return () => { a = false; };
  }, [refreshKey]);

  const deudores = clientes.filter((c) => c.saldo_usd > 0.005);
  if (deudores.length === 0) return null;
  const usd = deudores.reduce((s, c) => s + c.saldo_usd, 0);
  const eur = tasa > 0 ? usd / tasa : 0;

  return (
    <div className="rounded-2xl bg-[#F9EBE7] ring-1 ring-[#E0A79B] p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#C0563F] shrink-0" />
        <div>
          <p className="text-[#7A2419] font-medium">
            {deudores.length} cliente{deudores.length === 1 ? "" : "s"} con saldo pendiente · {fmtMonto(eur, "EUR")} (≈ {fmtMonto(usd, "USD")})
          </p>
          <p className="text-xs text-[#9A4C3D]">Cóbralos antes de que cierre el mes.</p>
        </div>
      </div>
      <button type="button" onClick={onIr} className="rounded-lg bg-[#7A2419] text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-[#5F1B12] shrink-0">Ver clientes</button>
    </div>
  );
}

// Estado por cuenta según lo pagado de cada una (asignaciones del servidor).
function estadosDeCuentas(cuentas: CuentaMov[]) {
  const ordenadas = [...cuentas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return ordenadas.map((c) => {
    const cu = c.monto_usd ?? 0;
    const pagado = c.pagado_usd ?? 0;
    let estado: "Pendiente" | "Parcial" | "Pagada" | "A favor" = "Pendiente";
    if (cu <= 0) estado = "A favor";
    else estado = pagado >= cu - 0.005 ? "Pagada" : pagado > 0.005 ? "Parcial" : "Pendiente";
    return { c, estado };
  });
}

function SeccionCuentasCobrar() {
  const [clientes, setClientes] = useState<ClienteCXC[]>([]);
  const [incobrables, setIncobrables] = useState<IncobrableUI[]>([]);
  const [verIncobrables, setVerIncobrables] = useState(false);
  const [tasa, setTasa] = useState(1.17);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);       // detalle del cliente (key)
  const [cobrando, setCobrando] = useState<ClienteCXC | null>(null); // modal de cobro
  const [devalInput, setDevalInput] = useState("");
  const [devalPct, setDevalPct] = useState<number | null>(null);
  const [guardandoDeval, setGuardandoDeval] = useState(false);
  const [correosInput, setCorreosInput] = useState("");
  const [guardandoCorreos, setGuardandoCorreos] = useState(false);
  const [probando, setProbando] = useState(false);
  const [verSaldados, setVerSaldados] = useState(false);
  const [mostrarAjustes, setMostrarAjustes] = useState(false);
  const [aliases, setAliases] = useState<{ alias_key: string; canonico: string }[]>([]);
  const [unirDesde, setUnirDesde] = useState<string | null>(null); // key del cliente a unir
  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const [r, ra] = await Promise.all([
          fetch("/api/admin/cuentas-cobrar", { cache: "no-store" }),
          fetch("/api/admin/cliente-alias", { cache: "no-store" }),
        ]);
        const d = await r.json();
        const da = await ra.json().catch(() => ({}));
        if (a) { setClientes(d.clientes ?? []); setIncobrables(d.incobrables ?? []); if (d.tasa) setTasa(d.tasa); setAliases(da.aliases ?? []); }
      } catch {
        if (a) setError("No se pudieron cargar las cuentas por cobrar.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, [tick]);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/config", { cache: "no-store" });
        const d = await r.json();
        const v = d.config?.devaluacion_mensual;
        if (a && v != null && v !== "") { setDevalInput(String(v)); setDevalPct(Number(String(v).replace(",", "."))); }
        if (a && d.config?.alerta_correos) setCorreosInput(String(d.config.alerta_correos));
      } catch {
        /* el ajuste es opcional */
      }
    })();
    return () => { a = false; };
  }, []);

  async function guardarCorreos() {
    setGuardandoCorreos(true); setError(null);
    try {
      const limpio = correosInput.split(",").map((s) => s.trim()).filter(Boolean).join(", ");
      await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: "alerta_correos", valor: limpio }) });
      setCorreosInput(limpio);
      setMsg(limpio ? "Correos de alerta guardados." : "Se quitaron los correos de alerta.");
    } catch { setError("No se pudieron guardar los correos."); } finally { setGuardandoCorreos(false); }
  }
  async function probarCorreo() {
    setProbando(true); setError(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/probar-correo", { method: "POST" });
      const d = await r.json();
      if (d.sinConfig) { setError("Falta la clave de Resend (RESEND_API_KEY) en Vercel."); return; }
      if (!r.ok) throw new Error(d.error || "No se pudo enviar.");
      if (d.fallidos?.length) setError(`Enviados ${d.enviados}/${d.total} (remitente: ${d.from}). Error de Resend: ${d.detalle ?? d.fallidos.join(", ")}`);
      else setMsg(`Correo de prueba enviado a ${d.enviados} correo${d.enviados === 1 ? "" : "s"} (desde ${d.from}). Revisa la bandeja (y spam).`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar."); } finally { setProbando(false); }
  }
  async function guardarDeval() {
    setGuardandoDeval(true); setError(null);
    try {
      const val = parseTasa(devalInput);
      await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: "devaluacion_mensual", valor: val != null ? String(val) : "" }) });
      setDevalPct(val);
      setMsg(val ? `Devaluación mensual estimada: ${val}%.` : "Ajuste de devaluación desactivado.");
    } catch { setError("No se pudo guardar el ajuste."); } finally { setGuardandoDeval(false); }
  }
  async function borrarPago(pagoId: string) {
    try {
      await fetch(`/api/admin/cuentas-cobrar?pago=${pagoId}`, { method: "DELETE" });
      setMsg("Pago revertido (se quitó el ingreso y volvió al saldo).");
      recargar();
    } catch { setError("No se pudo revertir el pago."); }
  }
  async function borrarCuenta(cuentaId: string) {
    try {
      await fetch(`/api/admin/cuentas-cobrar?cuenta=${cuentaId}`, { method: "DELETE" });
      recargar();
    } catch { setError("No se pudo eliminar la cuenta."); }
  }
  async function editarCuenta(cuentaId: string, montoActual: number | null, moneda: string) {
    const val = window.prompt(`Nuevo monto de la cuenta (${moneda}):`, montoActual != null ? String(montoActual) : "");
    if (val == null) return;
    const monto = parseTasa(val);
    if (monto == null || monto < 0) { setError("Monto inválido."); return; }
    setError(null);
    try {
      const r = await fetch("/api/admin/cuentas-cobrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "editar-cuenta", cuenta: cuentaId, monto }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo editar.");
      setMsg("Monto de la cuenta actualizado."); recargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo editar."); }
  }
  async function ajustarSaldo(clienteNombre: string, motivo?: "sobrante") {
    if (!motivo && !confirm("Se creará una deuda de ajuste que cuadra el pago existente y deja el saldo en cero (NO borra el pago ni su ingreso). Úsalo cuando el cliente pagó cuentas que luego se eliminaron. ¿Continuar?")) return;
    setError(null);
    try {
      const r = await fetch("/api/admin/cuentas-cobrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "ajustar", cliente: clienteNombre, motivo }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo ajustar.");
      setMsg(motivo === "sobrante" ? "Sobrante marcado; el saldo a favor pasó a cero." : "Saldo ajustado a cero."); recargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo ajustar."); }
  }
  // Sobrante de redondeo: el cliente pagó de más y no pidió vuelto. La Quinta se
  // queda el excedente (ya está en ingresos); solo se cierra el falso "a favor".
  async function marcarSobrante(c: ClienteCXC) {
    const eur = eurDe(Math.abs(c.saldo_usd));
    if (!confirm(`${c.cliente} pagó de más ${fmtMonto(eur, "EUR")} y no pidió vuelto. Se marca como sobrante (la Quinta se queda ese dinero, ya contado en ingresos) y el saldo a favor pasa a cero. ¿Continuar?`)) return;
    await ajustarSaldo(c.cliente, "sobrante");
  }
  async function marcarIncobrable(cuentaId: string) {
    if (!confirm("Marcar esta cuenta como INCOBRABLE. Sale del saldo por cobrar y se registra como pérdida (egreso “Incobrables”). ¿Continuar?")) return;
    setError(null);
    try {
      const r = await fetch("/api/admin/cuentas-cobrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "incobrable", cuenta: cuentaId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo marcar incobrable.");
      setMsg("Cuenta marcada incobrable (registrada como pérdida).");
      recargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo marcar incobrable."); }
  }
  async function reactivarIncobrable(cuentaId: string) {
    setError(null);
    try {
      const r = await fetch("/api/admin/cuentas-cobrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "reactivar", cuenta: cuentaId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo reactivar.");
      setMsg("Cuenta reactivada (se revirtió la pérdida).");
      recargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo reactivar."); }
  }
  async function unirCliente(alias: string, canonico: string) {
    setError(null);
    try {
      const r = await fetch("/api/admin/cliente-alias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alias, canonico }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo unir.");
      setUnirDesde(null);
      setMsg(`"${alias}" se unió a "${canonico}".`);
      recargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo unir."); }
  }
  async function deshacerAlias(aliasKey: string) {
    try {
      await fetch(`/api/admin/cliente-alias?alias_key=${encodeURIComponent(aliasKey)}`, { method: "DELETE" });
      setMsg("Se deshizo la unión.");
      recargar();
    } catch { setError("No se pudo deshacer."); }
  }

  const eurDe = (usd: number) => (tasa > 0 ? usd / tasa : 0);
  const deudores = clientes.filter((c) => c.saldo_usd > 0.005);
  const aFavor = clientes.filter((c) => c.saldo_usd < -0.005);
  const saldados = clientes.filter((c) => Math.abs(c.saldo_usd) <= 0.005 && (c.cuentas.length > 0 || c.pagos.length > 0));
  const totalUsd = deudores.reduce((s, c) => s + c.saldo_usd, 0);

  const diasCierre = diasHastaCierre();
  const factorEspera = devalPct && devalPct > 0 ? Math.pow(1 - devalPct / 100, diasCierre / 30) : 1;
  const perdidaTotal = devalPct && devalPct > 0 ? totalUsd * (1 - factorEspera) : 0;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {msg && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">{msg}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <ResumenCaja titulo="Por cobrar" valor={fmtMonto(eurDe(totalUsd), "EUR")} sub={`≈ ${fmtMonto(totalUsd, "USD")} · ${deudores.length} cliente${deudores.length === 1 ? "" : "s"}`} fuerte />
        <div className="sm:col-span-2 rounded-2xl bg-white ring-1 ring-marfil p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-cacao-soft">{deudores.length} cliente{deudores.length === 1 ? "" : "s"} con saldo pendiente. Selecciona uno para ver su detalle o cobrarle. El historial se conserva siempre.</p>
          <div className="flex items-center gap-2 shrink-0">
            {incobrables.length > 0 && (
              <button type="button" onClick={() => setVerIncobrables((v) => !v)} className="rounded-lg ring-1 ring-[#E8C5BC] text-[#7A2419] px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-[#F9EBE7]">{verIncobrables ? "Ocultar incobrables" : `Incobrables (${incobrables.length})`}</button>
            )}
            {saldados.length > 0 && (
              <button type="button" onClick={() => setVerSaldados((v) => !v)} className="rounded-lg ring-1 ring-marfil text-cacao px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-marfil-soft">{verSaldados ? "Ocultar saldados" : `Ver saldados (${saldados.length})`}</button>
            )}
          </div>
        </div>
      </div>

      {/* Incobrables (pérdidas) */}
      {verIncobrables && incobrables.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-[#E8C5BC] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F9EBE7] flex items-center justify-between gap-2">
            <span className="font-display text-[10px] tracking-[0.25em] uppercase text-[#7A2419]">Incobrables · pérdidas ({incobrables.length})</span>
            <span className="text-[12px] text-[#7A2419] tabular-nums">{fmtMonto(incobrables.reduce((s, x) => s + (x.monto ?? 0), 0), "EUR")}</span>
          </div>
          <ul className="divide-y divide-marfil">
            {incobrables.map((x) => (
              <li key={x.id} className="px-4 py-2 grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center text-[12px]">
                <span className="text-cacao-mute tabular-nums">{fmtFecha(x.fecha_incobrable || x.fecha)}</span>
                <span className="text-cacao min-w-0 truncate">{x.deudor || "—"}{x.ref ? ` · ${x.ref}` : ""}</span>
                <span className="text-right text-[#7A2419] tabular-nums">{x.monto != null ? fmtMonto(x.monto, x.moneda || "EUR") : "—"}</span>
                <button type="button" onClick={() => reactivarIncobrable(x.id)} className="text-cacao-soft hover:text-cacao text-[10px] uppercase tracking-widest" title="Reactivar (revierte la pérdida)">Reactivar</button>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2 text-[11px] text-cacao-mute">Cada incobrable queda registrado como egreso “Incobrables” (pérdida) en su fecha. Reactivar revierte esa pérdida y la vuelve a poner por cobrar.</p>
        </div>
      )}

      {/* Aviso de devaluación (visible; es una alerta, no un ajuste) */}
      {devalPct != null && devalPct > 0 && perdidaTotal > 0.005 && (
        <div className="rounded-2xl bg-[#FBF3E2] ring-1 ring-[#E7D3A1] p-4">
          <p className="text-[#7A5A18]">
            Si no cobras antes del cierre {diasCierre > 0 ? `(faltan ~${diasCierre} día${diasCierre === 1 ? "" : "s"})` : "(el mes cierra hoy)"}, podrías perder ≈ <strong>{fmtMonto(perdidaTotal, "USD")}</strong> por devaluación.
          </p>
        </div>
      )}

      {/* Ajustes (ocultos por defecto): devaluación, correos, clientes unidos */}
      <div>
        <button type="button" onClick={() => setMostrarAjustes((v) => !v)} className="text-[11px] uppercase tracking-widest text-cacao-mute hover:text-cacao flex items-center gap-1">
          <span className={`inline-block transition-transform ${mostrarAjustes ? "rotate-90" : ""}`}>›</span>
          Ajustes {aliases.length > 0 ? `· ${aliases.length} cliente${aliases.length === 1 ? "" : "s"} unido${aliases.length === 1 ? "" : "s"}` : ""}
        </button>
        {mostrarAjustes && (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1">Devaluación mensual estimada</label>
                <div className="flex items-center gap-1">
                  <input inputMode="decimal" value={devalInput} onChange={(e) => setDevalInput(e.target.value)} placeholder="ej. 8" className="w-24 border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
                  <span className="text-cacao-soft">%</span>
                </div>
              </div>
              <button type="button" onClick={guardarDeval} disabled={guardandoDeval} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{guardandoDeval ? "Guardando…" : "Guardar"}</button>
              <p className="text-[11px] text-cacao-mute flex-1 min-w-[12rem]">Solo se usa aquí, para estimar cuánto pierdes por tardar en cobrar. Déjalo vacío para no usarlo.</p>
            </div>

            <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-2">
              <label className="block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute">Correos para el recordatorio de cobros</label>
              <div className="flex flex-wrap items-center gap-2">
                <input value={correosInput} onChange={(e) => setCorreosInput(e.target.value)} placeholder="beatriz@…, lucia@…, tu@…" className="flex-1 min-w-[16rem] border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
                <button type="button" onClick={guardarCorreos} disabled={guardandoCorreos} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{guardandoCorreos ? "Guardando…" : "Guardar"}</button>
                <button type="button" onClick={probarCorreo} disabled={probando} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft disabled:text-cacao-mute">{probando ? "Enviando…" : "Enviar correo de prueba"}</button>
              </div>
              <p className="text-[11px] text-cacao-mute">Separados por coma. Reciben el aviso en los últimos 5 días del mes si hay clientes con saldo pendiente.</p>
            </div>

            {aliases.length > 0 && (
              <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-2">
                <span className="font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute">Clientes unidos</span>
                <ul className="flex flex-wrap gap-2">
                  {aliases.map((a) => (
                    <li key={a.alias_key} className="inline-flex items-center gap-1.5 rounded-full bg-marfil-soft ring-1 ring-marfil px-3 py-1 text-[12px] text-cacao">
                      <span className="text-cacao-mute">{a.alias_key}</span> → <span className="font-medium">{a.canonico}</span>
                      <button type="button" onClick={() => deshacerAlias(a.alias_key)} className="ml-1 text-cacao-soft hover:text-terracotta" aria-label="Deshacer unión">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de clientes */}
      <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute border-b border-marfil">
          <span>Cliente</span><span className="text-right">Saldo</span><span className="text-right hidden sm:block">Última cuenta</span><span className="text-right">Acción</span>
        </div>
        {cargando ? (
          <p className="p-5 text-cacao-soft italic font-serif">Cargando…</p>
        ) : deudores.length === 0 && aFavor.length === 0 ? (
          <p className="p-8 text-center text-cacao-soft italic font-serif">No hay clientes con saldo pendiente. Importa el reporte detallado de Zetux para empezar.</p>
        ) : (
          <ul className="divide-y divide-marfil">
            {[...deudores, ...aFavor, ...(verSaldados ? saldados : [])].map((c) => {
              const abiertoAqui = abierto === c.key;
              const enFavor = c.saldo_usd < 0;
              const estados = estadosDeCuentas(c.cuentas);
              return (
                <li key={c.key} className="text-sm">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center">
                    <button type="button" onClick={() => setAbierto(abiertoAqui ? null : c.key)} className="text-left min-w-0">
                      <span className="text-cacao font-medium truncate block">{c.cliente}</span>
                      <span className="text-[11px] text-cacao-mute">{c.cuentas.length} cuenta{c.cuentas.length === 1 ? "" : "s"}{c.pagos.length > 0 ? ` · ${c.pagos.length} pago${c.pagos.length === 1 ? "" : "s"}` : ""}</span>
                    </button>
                    <span className={`text-right tabular-nums font-medium ${enFavor ? "text-[#2F4A1F]" : "text-cacao"}`}>
                      {fmtMonto(eurDe(Math.abs(c.saldo_usd)), "EUR")}{enFavor ? " a favor" : ""}
                      <span className="block text-[10px] text-cacao-mute font-normal">≈ {fmtMonto(Math.abs(c.saldo_usd), "USD")}</span>
                    </span>
                    <span className="text-right text-cacao-mute tabular-nums hidden sm:block">{c.ultima ? fmtFecha(c.ultima) : "—"}</span>
                    <div className="flex items-center gap-2 justify-end">
                      <button type="button" onClick={() => setAbierto(abiertoAqui ? null : c.key)} className="rounded-lg ring-1 ring-marfil text-cacao px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-marfil-soft">{abiertoAqui ? "Ocultar" : "Ver"}</button>
                      {enFavor && eurDe(Math.abs(c.saldo_usd)) <= SOBRANTE_MAX_EUR && (
                        <button type="button" onClick={() => marcarSobrante(c)} title="Pagó de más y no pidió vuelto: la Quinta se queda el sobrante" className="rounded-lg ring-1 ring-[#CBD9BC] text-[#2F4A1F] px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-[#F1F4ED]">Marcar sobrante</button>
                      )}
                      {c.saldo_usd > 0.005 && <button type="button" onClick={() => setCobrando(c)} className="rounded-lg bg-cacao text-white px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-terracotta">Cobrar</button>}
                    </div>
                  </div>

                  {abiertoAqui && (
                    <div className="px-4 pb-4 pt-1 bg-marfil-soft/40 space-y-3">
                      {/* Cuentas generadas */}
                      <div className="rounded-xl bg-white ring-1 ring-marfil overflow-hidden">
                        <div className="px-3 py-2 font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute border-b border-marfil grid grid-cols-[auto_1fr_auto_auto] gap-2">
                          <span>Fecha</span><span>Referencia</span><span className="text-right">Monto</span><span className="text-right">Estado</span>
                        </div>
                        <ul className="divide-y divide-marfil">
                          {estados.map(({ c: cu, estado }) => (
                            <li key={cu.id} className="px-3 py-2 grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center">
                              <span className="text-cacao-mute tabular-nums text-[12px]">{fmtFecha(cu.fecha)}</span>
                              <span className="text-cacao text-[12px] min-w-0 truncate">{cu.ref || cu.descripcion || "Cuenta"}</span>
                              <span className="text-right text-cacao tabular-nums text-[12px]">{cu.monto != null ? fmtMonto(cu.monto, cu.moneda || "EUR") : "—"}</span>
                              <span className="text-right">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${estado === "Pagada" ? "bg-[#F1F4ED] text-[#2F4A1F]" : estado === "Parcial" ? "bg-[#FBF3E2] text-[#7A5A18]" : estado === "A favor" ? "bg-[#EAF0EA] text-[#2F4A1F]" : "bg-[#F9EBE7] text-[#7A2419]"}`}>{estado}</span>
                                {estado !== "Pagada" && <button type="button" onClick={() => marcarIncobrable(cu.id)} className="ml-2 text-cacao-soft hover:text-terracotta text-[10px] uppercase tracking-widest" title="Marcar incobrable (pérdida)">Incobrable</button>}
                                <button type="button" onClick={() => editarCuenta(cu.id, cu.monto, cu.moneda || "EUR")} className="ml-2 text-cacao-soft hover:text-terracotta text-xs" title="Editar monto" aria-label="Editar monto">✎</button>
                                <button type="button" onClick={() => borrarCuenta(cu.id)} className="ml-2 text-cacao-soft hover:text-terracotta text-xs" aria-label="Eliminar cuenta">✕</button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pagos realizados */}
                      {c.pagos.length > 0 && (
                        <div className="rounded-xl bg-white ring-1 ring-marfil overflow-hidden">
                          <div className="px-3 py-2 font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute border-b border-marfil grid grid-cols-[auto_1fr_auto_auto] gap-2">
                            <span>Fecha pago</span><span>Método</span><span className="text-right">Monto</span><span></span>
                          </div>
                          <ul className="divide-y divide-marfil">
                            {c.pagos.map((p) => (
                              <li key={p.id} className="px-3 py-2 grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center">
                                <span className="text-cacao-mute tabular-nums text-[12px]">{fmtFecha(p.fecha)}</span>
                                <span className="text-cacao text-[12px] min-w-0">{p.metodo || "—"}{p.asignaciones?.length ? <span className="text-cacao-mute"> · {p.asignaciones.map((a) => a.ref).filter(Boolean).join(", ")}</span> : p.referencia ? ` · ${p.referencia}` : ""}</span>
                                <span className="text-right text-[#2F4A1F] tabular-nums text-[12px]">− {p.monto != null ? fmtMonto(p.monto, p.moneda || "EUR") : "—"}</span>
                                <button type="button" onClick={() => borrarPago(p.id)} className="text-right text-cacao-soft hover:text-terracotta text-xs" aria-label="Revertir pago">↺</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Saldo */}
                      <div className="flex items-center justify-between text-sm px-1 gap-3 flex-wrap">
                        <span className="text-cacao-mute">Generado {fmtMonto(eurDe(c.total_cuentas_usd), "EUR")} · Pagado {fmtMonto(eurDe(c.total_pagos_usd), "EUR")}</span>
                        <span className="font-medium text-cacao">Saldo: {fmtMonto(eurDe(c.saldo_usd), "EUR")} <span className="text-cacao-mute font-normal">(≈ {fmtMonto(c.saldo_usd, "USD")})</span></span>
                      </div>
                      {enFavor && (
                        <div className="px-1 flex flex-wrap items-center gap-2">
                          {eurDe(Math.abs(c.saldo_usd)) <= SOBRANTE_MAX_EUR ? (
                            <>
                              <button type="button" onClick={() => marcarSobrante(c)} className="rounded-lg ring-1 ring-[#CBD9BC] text-[#2F4A1F] px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-[#F1F4ED]">Marcar sobrante</button>
                              <span className="text-[11px] text-cacao-mute">Pagó de más y no pidió vuelto: la Quinta se queda el sobrante (ya está en ingresos); el saldo pasa a cero.</span>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => ajustarSaldo(c.cliente)} className="rounded-lg ring-1 ring-marfil text-cacao px-3 py-1.5 text-[11px] uppercase tracking-widest hover:bg-marfil-soft">Ajustar saldo a cero</button>
                              <span className="text-[11px] text-cacao-mute">Si pagó cuentas que luego se eliminaron: cuadra el pago sin borrarlo.</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Unir con otro cliente (mismo cliente, distinto nombre en Zetux) */}
                      <div className="px-1 pt-1 flex items-center gap-2 flex-wrap">
                        {unirDesde === c.key ? (
                          <>
                            <span className="text-[12px] text-cacao-mute">Unir “{c.cliente}” con:</span>
                            <select defaultValue="" onChange={(e) => { if (e.target.value) unirCliente(c.cliente, e.target.value); }} className="border border-marfil rounded-lg px-2 py-1 text-[12px] text-cacao bg-white max-w-[12rem]">
                              <option value="">Elige el cliente…</option>
                              {[...deudores, ...aFavor, ...saldados].filter((o) => o.key !== c.key).map((o) => <option key={o.key} value={o.cliente}>{o.cliente}</option>)}
                            </select>
                            <button type="button" onClick={() => setUnirDesde(null)} className="text-[12px] text-cacao-soft hover:text-cacao">Cancelar</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setUnirDesde(c.key)} className="text-[12px] text-cacao-soft hover:text-cacao underline decoration-dotted">¿Es el mismo que otro cliente? Unir</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {cobrando && (
        <ModalCobro cliente={cobrando} tasaGlobal={tasa} onCerrar={() => setCobrando(null)} onListo={(m) => { setCobrando(null); setMsg(m); recargar(); }} />
      )}
    </div>
  );
}

// Modal de cobro: escribes el MONTO que paga el cliente y eliges a qué cuentas
// (NE) se aplica primero. Si paga de más, el excedente queda a favor.
function ModalCobro({ cliente, tasaGlobal, onCerrar, onListo }: { cliente: ClienteCXC; tasaGlobal: number; onCerrar: () => void; onListo: (msg: string) => void }) {
  const tasa = tasaGlobal > 0 ? tasaGlobal : 1.17;
  const filas = cliente.cuentas
    .map((c) => ({ c, restEur: Math.round((((c.monto_usd ?? 0) - (c.pagado_usd ?? 0)) / tasa) * 100) / 100 }))
    .filter((x) => x.restEur > 0.005)
    .sort((a, b) => a.c.fecha.localeCompare(b.c.fecha));
  const totalOpenEur = Math.round(filas.reduce((s, x) => s + x.restEur, 0) * 100) / 100;

  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(filas.map((x) => [x.c.id, true])));
  const [moneda, setMoneda] = useState<"EUR" | "USD" | "Bs">("EUR");
  const [tasaBsStr, setTasaBsStr] = useState("");
  const [montoStr, setMontoStr] = useState(totalOpenEur.toFixed(2));
  const [metodo, setMetodo] = useState("Efectivo");
  const [fecha, setFecha] = useState(hoyISO());
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seleccionadas = filas.filter((x) => sel[x.c.id]);
  const selRemEur = Math.round(seleccionadas.reduce((s, x) => s + x.restEur, 0) * 100) / 100;
  const esIncobrable = /incobrable/i.test(metodo);
  const tasaBs = parseTasa(tasaBsStr) ?? 0;
  const faltaTasaBs = moneda === "Bs" && tasaBs <= 0;
  // El $ (efectivo/Zelle) se toma 1:1 con el € → factor 1 en dólares.
  const factor = moneda === "Bs" ? tasaBs : 1;
  const monto = parseTasa(montoStr) ?? 0;
  const montoEur = moneda === "EUR" ? monto : factor > 0 ? monto / factor : 0;
  const favorEur = Math.max(0, Math.round((montoEur - totalOpenEur) * 100) / 100);
  const aplicadoEur = Math.min(montoEur, totalOpenEur);

  // Sugerir el monto (en la moneda elegida) = lo que resta de lo seleccionado.
  function sugerir(base = selRemEur, m = moneda, tb = tasaBs) {
    const f = m === "Bs" ? tb : 1; // € y $ van 1:1 con el euro
    setMontoStr(f > 0 ? (base * f).toFixed(2) : "");
  }
  function toggle(id: string) {
    setSel((s) => {
      const ns = { ...s, [id]: !s[id] };
      const base = filas.filter((x) => ns[x.c.id]).reduce((t, x) => t + x.restEur, 0);
      sugerir(Math.round(base * 100) / 100);
      return ns;
    });
  }

  // "Incobrable" como método: no entra dinero, se asume pérdida (write-off).
  async function marcarIncobrables() {
    if (seleccionadas.length === 0) { setError("Selecciona al menos una cuenta."); return; }
    setGuardando(true); setError(null);
    try {
      for (const x of seleccionadas) {
        const r = await fetch("/api/admin/cuentas-cobrar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "incobrable", cuenta: x.c.id }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "No se pudo marcar incobrable.");
      }
      onListo(`${seleccionadas.length} cuenta${seleccionadas.length === 1 ? "" : "s"} de ${cliente.cliente} marcada${seleccionadas.length === 1 ? "" : "s"} incobrable${seleccionadas.length === 1 ? "" : "s"} (pérdida de ${fmtMonto(selRemEur, "EUR")}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar incobrable.");
    } finally {
      setGuardando(false);
    }
  }

  async function cobrar() {
    if (monto <= 0) { setError("Pon el monto que paga el cliente."); return; }
    if (faltaTasaBs) { setError("Pon la tasa del día (Bs por €)."); return; }
    setGuardando(true); setError(null);
    try {
      const r = await fetch("/api/admin/cuentas-cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "cobro",
          cliente: cliente.cliente,
          monto, moneda,
          tasa: moneda === "Bs" ? tasaBs : null,
          metodo, fecha, referencia: referencia || null,
          cuentas: seleccionadas.map((x) => x.c.id),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cobrar.");
      const favor = d.favor_eur > 0.005 ? ` Quedan ${fmtMonto(d.favor_eur, "EUR")} a favor.` : "";
      onListo(`Cobro registrado: ${fmtMonto(monto, moneda)} de ${cliente.cliente} (${metodo}).${favor} Ingreso creado el ${fmtFecha(fecha)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cobrar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onCerrar}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-cacao">Cobrar a {cliente.cliente}</h3>
            <p className="text-sm text-cacao-soft">Saldo pendiente: <strong>{fmtMonto(totalOpenEur, "EUR")}</strong>. Escribe cuánto paga; si paga de más, queda a favor.</p>
          </div>
          <button type="button" onClick={onCerrar} className="text-cacao-soft hover:text-cacao text-lg" aria-label="Cerrar">✕</button>
        </div>

        {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}

        {/* Cuentas a las que se aplica (más antiguas primero) */}
        <div className="rounded-xl ring-1 ring-marfil overflow-hidden">
          <div className="px-3 py-2 font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute border-b border-marfil flex items-center justify-between">
            <span>Aplicar a estas cuentas (NE)</span><span>Queda</span>
          </div>
          <ul className="divide-y divide-marfil max-h-44 overflow-y-auto">
            {filas.map(({ c, restEur }) => (
              <li key={c.id} className={`px-3 py-2 flex items-center gap-2 ${sel[c.id] ? "" : "opacity-45"}`}>
                <input type="checkbox" checked={!!sel[c.id]} onChange={() => toggle(c.id)} className="accent-[#0F0F0F]" />
                <span className="text-cacao text-[12px] flex-1 min-w-0"><span className="font-medium">{c.ref || "Cuenta"}</span><span className="text-cacao-mute"> · {fmtFecha(c.fecha)}</span></span>
                <span className="text-cacao-mute tabular-nums text-[12px]">{fmtMonto(restEur, "EUR")}</span>
              </li>
            ))}
          </ul>
          <div className="px-3 py-1.5 border-t border-marfil text-[11px] text-cacao-mute">Seleccionado: {fmtMonto(selRemEur, "EUR")} · <button type="button" onClick={() => sugerir()} className="underline decoration-dotted hover:text-cacao">usar como monto</button></div>
        </div>

        {/* Método de pago (incluye "Incobrable" = pérdida, no entra dinero) */}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Método de pago">
            <select value={metodo} onChange={(e) => { const m = e.target.value; setMetodo(m); if (/zelle|d[oó]lar/i.test(m) && moneda !== "USD") { setMoneda("USD"); sugerir(selRemEur, "USD"); } }} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
              {METODOS_COBRO.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value="Incobrable">Incobrable (pérdida)</option>
            </select>
          </Campo>
          <Campo label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
          </Campo>
        </div>

        {!esIncobrable && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Monto que paga el cliente">
                <input inputMode="decimal" value={montoStr} onChange={(e) => setMontoStr(e.target.value)} className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao text-right" />
              </Campo>
              <Campo label="Moneda del pago">
                <select value={moneda} onChange={(e) => { const m = e.target.value as "EUR" | "USD" | "Bs"; setMoneda(m); sugerir(selRemEur, m); }} className="w-full border border-marfil rounded-lg px-2 py-2 text-sm text-cacao bg-white">
                  <option value="EUR">€ Euro</option>
                  <option value="USD">$ Dólar</option>
                  <option value="Bs">Bs Bolívares</option>
                </select>
              </Campo>
            </div>

            {moneda === "Bs" && (
              <Campo label="Tasa del día · Bs por €">
                <input inputMode="decimal" value={tasaBsStr} onChange={(e) => { setTasaBsStr(e.target.value); }} placeholder="ej. 320,00 Bs = 1 €" className="w-52 border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
              </Campo>
            )}
            {moneda === "USD" && (
              <p className="text-[11px] text-cacao-mute">El dólar se toma 1:1 con el euro ($1 abona €1).</p>
            )}

            <Campo label="Referencia (opcional)">
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="nº recibo / operación" className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao" />
            </Campo>
          </>
        )}

        {esIncobrable ? (
          <div className="rounded-lg p-3 text-sm bg-[#F9EBE7] text-[#7A2419]">
            Se asumirá como <strong>pérdida</strong> la deuda seleccionada (<strong>{fmtMonto(selRemEur, "EUR")}</strong> de {seleccionadas.length} cuenta{seleccionadas.length === 1 ? "" : "s"}). Sale del saldo por cobrar y se registra como egreso “Incobrables” el {fmtFecha(fecha)}. No entra dinero. Reversible desde el panel de incobrables.
          </div>
        ) : (
          <div className={`rounded-lg p-3 text-sm ${faltaTasaBs ? "bg-[#F9EBE7] text-[#7A2419]" : favorEur > 0.005 ? "bg-[#EAF0EA] text-[#2F4A1F]" : "bg-marfil-soft text-cacao-soft"}`}>
            {faltaTasaBs
              ? "Pon la tasa del día (Bs por €) para calcular el equivalente."
              : <>El cliente entrega <strong>{fmtMonto(monto, moneda)}</strong>{moneda !== "EUR" ? ` (= ${fmtMonto(montoEur, "EUR")})` : ""}. Abona {fmtMonto(aplicadoEur, "EUR")} a la deuda{favorEur > 0.005 ? <> y quedan <strong>{fmtMonto(favorEur, "EUR")} a favor</strong> del cliente</> : ""}. Ingreso del {fmtFecha(fecha)} · {metodo}.</>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg ring-1 ring-marfil text-cacao px-4 py-2 text-xs uppercase tracking-widest hover:bg-marfil-soft">Cancelar</button>
          {esIncobrable ? (
            <button type="button" onClick={marcarIncobrables} disabled={guardando || seleccionadas.length === 0} className="rounded-lg bg-[#7A2419] text-white px-5 py-2 text-xs uppercase tracking-widest hover:opacity-90 disabled:bg-marfil disabled:text-cacao-mute">{guardando ? "Marcando…" : "Marcar incobrable"}</button>
          ) : (
            <button type="button" onClick={cobrar} disabled={guardando || faltaTasaBs || monto <= 0} className="rounded-lg bg-cacao text-white px-5 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{guardando ? "Registrando…" : "Registrar cobro"}</button>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Históricos, comparación e indicadores ───────────────────────────
type MesHist = { mes: string; ingresos: Record<string, number>; egresos: Record<string, number> };

function mesCorto(iso: string): string {
  const [y, m] = iso.split("-").map((x) => parseInt(x, 10));
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[m - 1] ?? ""} ${String(y).slice(2)}`;
}
function pctCambio(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

// Paleta cálida (tonos tierra del tema) para los gráficos de torta/categóricos.
const PALETA_TORTA = ["#8A5A44", "#C0563F", "#D89A6A", "#7A8B6F", "#B7A17E", "#6E4B3A", "#9AA88C", "#E0A79B", "#C9A24B", "#8C7B9B", "#4E6B52", "#D4B483"];

type RebanadaTorta = { label: string; value: number };

// Dona en SVG puro (sin dependencias): cada rebanada es un arco del anillo.
function Dona({ datos }: { datos: (RebanadaTorta & { color: string })[] }) {
  const total = datos.reduce((s, d) => s + d.value, 0);
  const r = 58, cx = 70, cy = 70, C = 2 * Math.PI * r, sw = 24;
  let acc = 0;
  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0" role="img" aria-label="Gráfico de torta">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0E9E2" strokeWidth={sw} />
      {total > 0 && datos.map((d, i) => {
        const dash = (d.value / total) * C;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={sw}
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc}
            transform={`rotate(-90 ${cx} ${cy})`}>
            <title>{`${d.label}: ${fmtMonto(d.value, "USD")} (${total > 0 ? Math.round((d.value / total) * 100) : 0}%)`}</title>
          </circle>
        );
        acc += dash;
        return el;
      })}
    </svg>
  );
}

// Tarjeta con dona + leyenda. Agrupa por clave y ordena de mayor a menor.
function TortaIngresos({ titulo, datos }: { titulo: string; datos: RebanadaTorta[] }) {
  const positivos = datos.filter((d) => d.value > 0.005).sort((a, b) => b.value - a.value);
  const total = positivos.reduce((s, d) => s + d.value, 0);
  const conColor = positivos.map((d, i) => ({ ...d, color: PALETA_TORTA[i % PALETA_TORTA.length] }));
  return (
    <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
      <div className="font-display text-[9px] tracking-[0.25em] uppercase text-cacao-mute mb-3">{titulo}</div>
      {total <= 0 ? (
        <p className="text-cacao-soft italic font-serif text-sm py-6 text-center">Sin ingresos en este período.</p>
      ) : (
        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
          <Dona datos={conColor} />
          <ul className="flex-1 min-w-[10rem] space-y-1.5">
            {conColor.map((d) => (
              <li key={d.label} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-cacao min-w-0 truncate flex-1">{d.label}</span>
                <span className="text-cacao-mute tabular-nums text-[11px]">{Math.round((d.value / total) * 100)}%</span>
                <span className="text-cacao tabular-nums whitespace-nowrap">{fmtMonto(d.value, "USD")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SeccionHistorico() {
  const [meses, setMeses] = useState<MesHist[]>([]);
  const [monedas, setMonedas] = useState<string[]>([]);
  const [moneda, setMoneda] = useState<string>("");
  const [porMetodo, setPorMetodo] = useState<{ mes: string; clave: string; usd: number }[]>([]);
  const [porCategoria, setPorCategoria] = useState<{ mes: string; clave: string; usd: number }[]>([]);
  const [periodoTorta, setPeriodoTorta] = useState<string>("todo");
  const [obs, setObs] = useState<Record<string, string>>({});
  const [obsMes, setObsMes] = useState<string>("");
  const [obsTexto, setObsTexto] = useState("");
  const [guardandoObs, setGuardandoObs] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const [rh, rc] = await Promise.all([
          fetch("/api/admin/historico", { cache: "no-store" }),
          fetch("/api/admin/config", { cache: "no-store" }),
        ]);
        const [dh, dc] = await Promise.all([rh.json(), rc.json()]);
        if (!a) return;
        const ms: MesHist[] = dh.meses ?? [];
        const mons: string[] = dh.monedas ?? [];
        setMeses(ms);
        setMonedas(mons);
        setMoneda(mons[0] ?? "EUR");
        setPorMetodo(dh.porMetodo ?? []);
        setPorCategoria(dh.porCategoria ?? []);
        const observaciones: Record<string, string> = {};
        for (const [k, v] of Object.entries((dc.config ?? {}) as Record<string, string>)) {
          if (k.startsWith("obs_") && v) observaciones[k.slice(4)] = v;
        }
        setObs(observaciones);
        const ultimo = ms.length ? ms[ms.length - 1].mes : mesActualISO();
        setObsMes(ultimo);
        setObsTexto(observaciones[ultimo] ?? "");
      } catch {
        if (a) setError("No se pudo cargar el histórico.");
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, []);

  async function guardarObs() {
    setGuardandoObs(true);
    setError(null);
    try {
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave: `obs_${obsMes}`, valor: obsTexto }),
      });
      setObs((o) => ({ ...o, [obsMes]: obsTexto }));
      setMsg("Observación guardada.");
    } catch {
      setError("No se pudo guardar la observación.");
    } finally {
      setGuardandoObs(false);
    }
  }

  if (cargando) return <p className="rounded-2xl bg-white ring-1 ring-marfil p-5 text-cacao-soft italic font-serif">Cargando…</p>;

  const serie = meses.slice(-12).map((m) => {
    const ing = m.ingresos[moneda] ?? 0;
    const egr = m.egresos[moneda] ?? 0;
    return { mes: m.mes, ing, egr, bal: ing - egr };
  });
  const conMovim = serie.filter((s) => s.ing !== 0 || s.egr !== 0);
  const max = Math.max(...serie.flatMap((s) => [s.ing, s.egr]), 1);
  const promIng = conMovim.length ? conMovim.reduce((s, x) => s + x.ing, 0) / conMovim.length : 0;
  const promBal = conMovim.length ? conMovim.reduce((s, x) => s + x.bal, 0) / conMovim.length : 0;
  const mejor = conMovim.length ? conMovim.reduce((a, b) => (b.bal > a.bal ? b : a)) : null;
  const peor = conMovim.length ? conMovim.reduce((a, b) => (b.bal < a.bal ? b : a)) : null;
  const ult = serie.length ? serie[serie.length - 1] : null;
  const pen = serie.length > 1 ? serie[serie.length - 2] : null;

  // Tortas de ingresos (en USD): por método de pago y por categoría.
  const agrupaTorta = (rows: { mes: string; clave: string; usd: number }[]): RebanadaTorta[] => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (periodoTorta !== "todo" && r.mes !== periodoTorta) continue;
      m.set(r.clave, (m.get(r.clave) ?? 0) + r.usd);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  };
  const tortaMetodo = agrupaTorta(porMetodo);
  const tortaCategoria = agrupaTorta(porCategoria);
  const hayTortas = tortaMetodo.some((d) => d.value > 0.005) || tortaCategoria.some((d) => d.value > 0.005);
  const mesesTorta = [...new Set([...porMetodo, ...porCategoria].map((r) => r.mes))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}
      {msg && <div className="rounded-lg bg-[#F1F4ED] ring-1 ring-[#C9D6BC] p-3 text-sm text-[#2F4A1F]">{msg}</div>}

      {/* Selector de moneda */}
      {monedas.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-cacao-mute">Moneda:</span>
          <div className="flex gap-1 rounded-lg ring-1 ring-marfil p-1">
            {monedas.map((m) => (
              <button key={m} type="button" onClick={() => setMoneda(m)} className={`rounded-md px-3 py-1 text-xs uppercase tracking-widest ${moneda === m ? "bg-cacao text-white" : "text-cacao hover:bg-marfil-soft"}`}>{m}</button>
            ))}
          </div>
        </div>
      )}

      {conMovim.length === 0 ? (
        <p className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft italic font-serif">Aún no hay suficientes datos en {moneda} para el histórico. Registra ingresos y egresos y aquí verás la evolución.</p>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid gap-3 sm:grid-cols-4">
            <ResumenCaja titulo="Promedio ingresos" valor={fmtMonto(promIng, moneda)} fuerte />
            <ResumenCaja titulo="Promedio balance" valor={fmtMonto(promBal, moneda)} />
            <ResumenCaja titulo="Mejor mes" valor={mejor ? fmtMonto(mejor.bal, moneda) : "—"} sub={mejor ? nombreMes(mejor.mes) : undefined} />
            <ResumenCaja titulo="Peor mes" valor={peor ? fmtMonto(peor.bal, moneda) : "—"} sub={peor ? nombreMes(peor.mes) : undefined} />
          </div>

          {/* Comparación último vs anterior */}
          {ult && pen && (
            <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
              <div className="font-display text-[9px] tracking-[0.25em] uppercase text-cacao-mute mb-2">{nombreMes(pen.mes)} → {nombreMes(ult.mes)}</div>
              <div className="grid grid-cols-3 gap-3">
                <Comparacion titulo="Ingresos" cur={ult.ing} prev={pen.ing} moneda={moneda} />
                <Comparacion titulo="Egresos" cur={ult.egr} prev={pen.egr} moneda={moneda} invertir />
                <Comparacion titulo="Balance" cur={ult.bal} prev={pen.bal} moneda={moneda} />
              </div>
            </div>
          )}

          {/* Gráfico de barras */}
          <div className="rounded-2xl bg-white ring-1 ring-marfil p-4">
            <div className="flex items-center gap-4 mb-3 text-[11px] text-cacao-mute">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0F0F0F]" />Ingresos</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#C0563F]" />Egresos</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {serie.map((s) => (
                <div key={s.mes} className="flex flex-col items-center gap-1 flex-1 min-w-[2.75rem]">
                  <div className="flex items-end justify-center gap-1 h-40 w-full">
                    <div className="w-3.5 bg-[#0F0F0F] rounded-t" style={{ height: `${Math.max((s.ing / max) * 100, s.ing > 0 ? 2 : 0)}%` }} title={`Ingresos: ${fmtMonto(s.ing, moneda)}`} />
                    <div className="w-3.5 bg-[#C0563F] rounded-t" style={{ height: `${Math.max((s.egr / max) * 100, s.egr > 0 ? 2 : 0)}%` }} title={`Egresos: ${fmtMonto(s.egr, moneda)}`} />
                  </div>
                  <span className="text-[10px] text-cacao-mute whitespace-nowrap">{mesCorto(s.mes)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tortas de ingresos: por método de pago y por categoría (en USD) */}
          {hayTortas && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-display text-[11px] tracking-[0.25em] uppercase text-cacao-mute">Ingresos · repartición</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-cacao-mute">Período:</span>
                  <select value={periodoTorta} onChange={(e) => setPeriodoTorta(e.target.value)} className="border border-marfil rounded-lg px-2 py-1.5 text-sm text-cacao bg-white">
                    <option value="todo">Todo el histórico</option>
                    {mesesTorta.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-cacao-mute">Montos en $ (equivalente) para poder comparar entre monedas.</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <TortaIngresos titulo="Por método de pago" datos={tortaMetodo} />
                <TortaIngresos titulo="Por categoría" datos={tortaCategoria} />
              </div>
            </div>
          )}

          {/* Tabla */}
          <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-4 py-2.5 font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute border-b border-marfil">
              <span>Mes</span><span className="text-right">Ingresos</span><span className="text-right">Egresos</span><span className="text-right">Balance</span>
            </div>
            <ul className="divide-y divide-marfil">
              {[...serie].reverse().map((s) => (
                <li key={s.mes} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm">
                  <span className="text-cacao">{nombreMes(s.mes)}</span>
                  <span className="text-right text-cacao tabular-nums">{fmtMonto(s.ing, moneda)}</span>
                  <span className="text-right text-cacao-soft tabular-nums">{fmtMonto(s.egr, moneda)}</span>
                  <span className={`text-right tabular-nums ${s.bal < 0 ? "text-terracotta" : "text-cacao"}`}>{s.bal < 0 ? `− ${fmtMonto(Math.abs(s.bal), moneda)}` : fmtMonto(s.bal, moneda)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Observaciones del mes */}
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute">Observación del mes</label>
          <select
            value={obsMes}
            onChange={(e) => { setObsMes(e.target.value); setObsTexto(obs[e.target.value] ?? ""); }}
            className="border border-marfil rounded-lg px-2 py-1.5 text-sm text-cacao bg-white"
          >
            {(meses.length ? meses.map((m) => m.mes) : [mesActualISO()]).slice().reverse().map((m) => (
              <option key={m} value={m}>{nombreMes(m)}</option>
            ))}
          </select>
        </div>
        <textarea
          value={obsTexto}
          onChange={(e) => setObsTexto(e.target.value)}
          rows={3}
          placeholder="Notas del mes: qué pasó, por qué subió/bajó, cosas a recordar…"
          className="w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao"
        />
        <button type="button" onClick={guardarObs} disabled={guardandoObs} className="rounded-lg bg-cacao text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">{guardandoObs ? "Guardando…" : "Guardar observación"}</button>
      </div>
    </div>
  );
}

function Comparacion({ titulo, cur, prev, moneda, invertir }: { titulo: string; cur: number; prev: number; moneda: string; invertir?: boolean }) {
  const p = pctCambio(cur, prev);
  const subio = cur > prev;
  // Para egresos, subir es "malo" (invertir el color).
  const bueno = invertir ? !subio : subio;
  const color = cur === prev ? "text-cacao-mute" : bueno ? "text-[#2F4A1F]" : "text-terracotta";
  return (
    <div>
      <div className="font-display text-[9px] tracking-[0.2em] uppercase text-cacao-mute">{titulo}</div>
      <div className="text-cacao font-medium mt-0.5">{cur < 0 ? `− ${fmtMonto(Math.abs(cur), moneda)}` : fmtMonto(cur, moneda)}</div>
      <div className={`text-[11px] ${color}`}>
        {p == null ? "—" : `${subio ? "↑" : cur < prev ? "↓" : ""} ${Math.abs(p).toFixed(0)}%`}
      </div>
    </div>
  );
}
