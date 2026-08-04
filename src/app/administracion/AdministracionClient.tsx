"use client";

// Administración financiera · cliente
// La puerta con contraseña la maneja el servidor: este cliente solo pide la
// clave, y todo lo financiero se lee/escribe por /api/admin/* (que exige el
// token). Si no hay sesión, no se carga ningún número.

import { useCallback, useEffect, useMemo, useState } from "react";

const CAT_GASTO = ["Proveedor puntual", "Servicios fijos", "Nómina", "Insumos", "Otros"];
const CAT_INGRESO = ["Eventos", "Inquilinos", "Comedor", "Cafetín", "Otros"];
const PERSONAS = ["Roló", "Lucía", "Inés", "Óscar", "Norberto"];

type Movimiento = {
  id: string;
  tipo: "gasto" | "ingreso";
  fecha: string;
  mes: string;
  monto_usd: number | string;
  monto_original: number | string | null;
  moneda_original: string | null;
  categoria: string;
  subcategoria: string | null;
  proveedor: string | null;
  pagado_por: string | null;
  descripcion: string | null;
  factura_path: string | null;
};

function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMes(mes: string): string {
  const d = new Date(mes + "-01T12:00:00");
  return d.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
}
function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const [mes, setMes] = useState(mesActual());
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<"mes" | "historia">("mes");
  const [cerrando, setCerrando] = useState(false);

  const [tick, setTick] = useState(0);
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const r = await fetch(`/api/admin/movimientos?mes=${mes}`);
        if (!activo) return;
        if (r.status === 401) { onSalir(); return; }
        const d = await r.json();
        if (activo) setMovs(d.movimientos ?? []);
      } catch {
        if (activo) setError("No se pudieron cargar los movimientos.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [mes, tick, onSalir]);

  const totales = useMemo(() => {
    let ingresos = 0, gastos = 0;
    const porCat: Record<string, number> = {};
    for (const m of movs) {
      const monto = Number(m.monto_usd) || 0;
      if (m.tipo === "ingreso") ingresos += monto;
      else gastos += monto;
      const clave = `${m.tipo === "ingreso" ? "＋" : "−"} ${m.categoria}`;
      porCat[clave] = (porCat[clave] ?? 0) + monto;
    }
    return { ingresos, gastos, resultado: ingresos - gastos, porCat };
  }, [movs]);

  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    onSalir();
  }
  async function borrar(id: string) {
    if (!confirm("¿Borrar este movimiento?")) return;
    await fetch(`/api/admin/movimientos?id=${id}`, { method: "DELETE" });
    recargar();
  }
  async function verFactura(path: string) {
    const r = await fetch(`/api/admin/factura?path=${encodeURIComponent(path)}`);
    const d = await r.json();
    if (d.url) window.open(d.url, "_blank");
  }
  async function cerrarMes() {
    if (!confirm(`¿Guardar el cierre de ${fmtMes(mes)}? Congela el resumen del mes para la historia y las comparaciones. Puedes recalcularlo después si registras más movimientos.`)) return;
    setCerrando(true);
    try {
      const r = await fetch("/api/admin/cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "No se pudo cerrar el mes."); }
    } finally {
      setCerrando(false);
    }
  }

  // Últimos 24 meses para el selector
  const meses = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 24; i++) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {([["mes", "Movimientos"], ["historia", "Historia"]] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest ${vista === v ? "bg-cacao text-white" : "ring-1 ring-marfil text-cacao-soft hover:bg-marfil-soft"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={salir} className="text-[11px] uppercase tracking-widest text-cacao-soft hover:text-terracotta">Salir</button>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-3 text-sm text-[#7A2419]">{error}</div>}

      {vista === "historia" ? (
        <Historia />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute">Mes</label>
              <select value={mes} onChange={(e) => setMes(e.target.value)} className="border border-marfil rounded-lg px-3 py-1.5 text-sm text-cacao capitalize">
                {meses.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}
              </select>
            </div>
            <button type="button" onClick={cerrarMes} disabled={cerrando} className="text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full ring-1 ring-marfil text-cacao-soft hover:bg-marfil-soft disabled:opacity-50">
              {cerrando ? "Guardando…" : "✓ Cerrar mes"}
            </button>
          </div>

      {/* Tablero del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-marfil ring-1 ring-marfil rounded-2xl overflow-hidden">
        <div className="bg-white p-5">
          <div className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute mb-1">Ingresos</div>
          <div className="font-cinzel text-2xl text-cacao">{usd(totales.ingresos)}</div>
        </div>
        <div className="bg-white p-5">
          <div className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute mb-1">Gastos</div>
          <div className="font-cinzel text-2xl text-cacao">{usd(totales.gastos)}</div>
        </div>
        <div className="bg-white p-5">
          <div className="font-display text-[10px] tracking-[0.25em] uppercase text-cacao-mute mb-1">Resultado</div>
          <div className={`font-cinzel text-2xl ${totales.resultado < 0 ? "text-terracotta" : "text-cacao"}`}>{usd(totales.resultado)}</div>
        </div>
      </div>

      <FormMovimiento mes={mes} onGuardado={recargar} />

      {/* Lista de movimientos */}
      <section className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
        <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute p-5 border-b border-marfil">
          Movimientos de {fmtMes(mes)} <span className="text-cacao-soft normal-case tracking-normal">· {movs.length}</span>
        </h2>
        {cargando ? (
          <p className="p-5 text-cacao-soft italic font-serif">Cargando…</p>
        ) : movs.length === 0 ? (
          <p className="p-8 text-center text-cacao-soft italic font-serif">Sin movimientos este mes. Registra el primero arriba.</p>
        ) : (
          <ul className="divide-y divide-marfil">
            {movs.map((m) => (
              <li key={m.id} className="p-4 flex items-start gap-3">
                <span className={`mt-1 inline-block w-2 h-2 rounded-full flex-none ${m.tipo === "ingreso" ? "bg-[#5C7A3F]" : "bg-terracotta"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-cacao text-sm">
                    {m.categoria}{m.subcategoria ? ` · ${m.subcategoria}` : ""}
                    {m.proveedor ? <span className="text-cacao-soft"> · {m.proveedor}</span> : null}
                  </div>
                  <div className="text-xs text-cacao-soft mt-0.5">
                    {m.fecha}
                    {m.pagado_por ? ` · pagó ${m.pagado_por}` : ""}
                    {m.descripcion ? ` · ${m.descripcion}` : ""}
                  </div>
                  <div className="mt-1 flex gap-3">
                    {m.factura_path && (
                      <button type="button" onClick={() => verFactura(m.factura_path!)} className="text-[11px] uppercase tracking-widest text-cacao-soft hover:text-cacao">Ver factura</button>
                    )}
                    <button type="button" onClick={() => borrar(m.id)} className="text-[11px] uppercase tracking-widest text-cacao-soft hover:text-terracotta">Borrar</button>
                  </div>
                </div>
                <div className={`text-right font-medium ${m.tipo === "ingreso" ? "text-cacao" : "text-terracotta"}`}>
                  {m.tipo === "ingreso" ? "＋" : "−"}{usd(Number(m.monto_usd) || 0)}
                  {m.monto_original ? <div className="text-[10px] text-cacao-mute font-normal">{Number(m.monto_original).toLocaleString("es-VE")} {m.moneda_original}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      )}
    </div>
  );
}

type Cierre = { mes: string; total_ingresos: number | string; total_gastos: number | string; resultado: number | string };

function Historia() {
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/cierre");
        const d = await r.json();
        if (a) setCierres(d.cierres ?? []);
      } finally {
        if (a) setCargando(false);
      }
    })();
    return () => { a = false; };
  }, []);

  const anios = useMemo(() => {
    const g: Record<string, Cierre[]> = {};
    for (const c of cierres) (g[c.mes.slice(0, 4)] ??= []).push(c);
    return Object.entries(g).sort((x, y) => y[0].localeCompare(x[0]));
  }, [cierres]);

  if (cargando) return <p className="text-cacao-soft italic font-serif">Cargando…</p>;
  if (cierres.length === 0)
    return (
      <div className="rounded-2xl bg-white ring-1 ring-marfil p-8 text-center text-cacao-soft italic font-serif">
        Aún no has cerrado ningún mes. En la pestaña Movimientos, usa “✓ Cerrar mes” para guardar el resumen y empezar a comparar año contra año.
      </div>
    );

  return (
    <div className="space-y-6">
      {anios.map(([anio, lista]) => {
        const ordenados = [...lista].sort((x, y) => y.mes.localeCompare(x.mes));
        const ti = ordenados.reduce((s, c) => s + Number(c.total_ingresos), 0);
        const tg = ordenados.reduce((s, c) => s + Number(c.total_gastos), 0);
        return (
          <section key={anio} className="rounded-2xl bg-white ring-1 ring-marfil overflow-hidden">
            <h2 className="font-display text-xs tracking-[0.3em] uppercase text-cacao-mute p-5 border-b border-marfil flex justify-between">
              <span>{anio}</span>
              <span className={`normal-case tracking-normal font-medium ${ti - tg < 0 ? "text-terracotta" : "text-cacao"}`}>Resultado {usd(ti - tg)}</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-cacao-mute text-[10px] uppercase tracking-widest">
                    <th className="text-left font-medium p-3">Mes</th>
                    <th className="text-right font-medium p-3">Ingresos</th>
                    <th className="text-right font-medium p-3">Gastos</th>
                    <th className="text-right font-medium p-3">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((c) => {
                    const res = Number(c.resultado);
                    return (
                      <tr key={c.mes} className="border-t border-marfil">
                        <td className="p-3 text-cacao capitalize">{fmtMes(c.mes)}</td>
                        <td className="p-3 text-right text-cacao">{usd(Number(c.total_ingresos))}</td>
                        <td className="p-3 text-right text-cacao">{usd(Number(c.total_gastos))}</td>
                        <td className={`p-3 text-right font-medium ${res < 0 ? "text-terracotta" : "text-cacao"}`}>{usd(res)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-marfil bg-marfil-soft">
                    <td className="p-3 font-medium text-cacao">Total {anio}</td>
                    <td className="p-3 text-right font-medium text-cacao">{usd(ti)}</td>
                    <td className="p-3 text-right font-medium text-cacao">{usd(tg)}</td>
                    <td className={`p-3 text-right font-medium ${ti - tg < 0 ? "text-terracotta" : "text-cacao"}`}>{usd(ti - tg)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FormMovimiento({ mes, onGuardado }: { mes: string; onGuardado: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [fecha, setFecha] = useState(mes === mesActual() ? hoy : `${mes}-01`);
  const [categoria, setCategoria] = useState(CAT_GASTO[0]);
  const [subcategoria, setSubcategoria] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [pagadoPor, setPagadoPor] = useState("");
  const [monto, setMonto] = useState("");
  const [montoOrig, setMontoOrig] = useState("");
  const [monedaOrig, setMonedaOrig] = useState("Bs");
  const [descripcion, setDescripcion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = tipo === "gasto" ? CAT_GASTO : CAT_INGRESO;

  function cambiarTipo(t: "gasto" | "ingreso") {
    setTipo(t);
    setCategoria((t === "gasto" ? CAT_GASTO : CAT_INGRESO)[0]);
  }

  async function guardar() {
    if (!monto || Number(monto) <= 0) { setError("Pon un monto en USD."); return; }
    setBusy(true);
    setError(null);
    try {
      let factura_path: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const fr = await fetch("/api/admin/factura", { method: "POST", body: fd });
        const fd2 = await fr.json();
        if (!fr.ok) throw new Error(fd2.error || "Error subiendo la factura");
        factura_path = fd2.path;
      }
      const r = await fetch("/api/admin/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, fecha, monto_usd: Number(monto),
          monto_original: montoOrig || null, moneda_original: montoOrig ? monedaOrig : null,
          categoria, subcategoria, proveedor: tipo === "gasto" ? proveedor : "",
          pagado_por: tipo === "gasto" ? pagadoPor : "", descripcion, factura_path,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error guardando");
      setMonto(""); setMontoOrig(""); setSubcategoria(""); setProveedor(""); setDescripcion(""); setFile(null);
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const inp = "w-full border border-marfil rounded-lg px-3 py-2 text-sm text-cacao";
  const lbl = "block font-display text-[10px] tracking-[0.2em] uppercase text-cacao-mute mb-1";

  return (
    <section className="rounded-2xl bg-white ring-1 ring-marfil p-5 space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => cambiarTipo("gasto")} className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest ${tipo === "gasto" ? "bg-terracotta text-white" : "ring-1 ring-marfil text-cacao-soft"}`}>Gasto</button>
        <button type="button" onClick={() => cambiarTipo("ingreso")} className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest ${tipo === "ingreso" ? "bg-cacao text-white" : "ring-1 ring-marfil text-cacao-soft"}`}>Ingreso</button>
      </div>

      {error && <div className="rounded-lg bg-[#F9EBE7] ring-1 ring-[#E8C5BC] p-2.5 text-sm text-[#7A2419]">{error}</div>}

      <div className="grid sm:grid-cols-3 gap-3">
        <div><label className={lbl}>Fecha</label><input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><label className={lbl}>{tipo === "gasto" ? "Tipo de gasto" : "Fuente"}</label>
          <select className={inp} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Detalle {tipo === "gasto" ? "(servicio/producto)" : "(opcional)"}</label><input className={inp} value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} placeholder={tipo === "gasto" ? "Seguridad, Corpoelec…" : ""} /></div>
      </div>

      {tipo === "gasto" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={lbl}>Proveedor</label><input className={inp} value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></div>
          <div><label className={lbl}>¿Quién pagó?</label>
            <select className={inp} value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)}>
              <option value="">—</option>
              {PERSONAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <div><label className={lbl}>Monto (USD)</label><input type="number" step="0.01" className={inp} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></div>
        <div><label className={lbl}>Monto original (opcional)</label><input type="number" step="0.01" className={inp} value={montoOrig} onChange={(e) => setMontoOrig(e.target.value)} placeholder="en Bs" /></div>
        <div><label className={lbl}>Moneda original</label>
          <select className={inp} value={monedaOrig} onChange={(e) => setMonedaOrig(e.target.value)}>
            <option value="Bs">Bs</option><option value="USD">USD</option><option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div><label className={lbl}>Descripción</label><input className={inp} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div><label className={lbl}>Factura (PDF o foto, opcional)</label><input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-cacao-soft" /></div>
        <button type="button" onClick={guardar} disabled={busy} className="rounded-lg bg-cacao text-white px-6 py-2.5 text-xs uppercase tracking-widest hover:bg-terracotta disabled:bg-marfil disabled:text-cacao-mute">
          {busy ? "Guardando…" : "Registrar"}
        </button>
      </div>
    </section>
  );
}
