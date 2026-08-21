import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { getTasaEurUsd } from "@/lib/admin/tasa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function numero(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }
  return null;
}
// Equivalente en USD (misma regla que ingresos/ventas).
function equivUSD(monto: number | null, moneda: string | null, tasa: number | null): number | null {
  if (monto == null) return null;
  if (moneda === "USD") return monto;
  if (moneda === "Bs") return tasa && tasa > 0 ? monto / tasa : null;
  if (moneda === "EUR") return tasa && tasa > 0 ? monto * tasa : null;
  return null;
}
function clave(s: string | null): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}
const r2 = (n: number) => Math.round(n * 100) / 100;

type CuentaRow = {
  id: string; fecha: string; descripcion: string | null; deudor: string | null; ref: string | null;
  monto: number | null; moneda: string | null; tasa: number | null; monto_usd: number | null;
  cobrada: boolean; fuente: string | null;
};
type Asignacion = { cuenta_id: string; ref: string | null; eur: number; usd: number };
type PagoRow = {
  id: string; cliente: string; fecha: string; monto: number | null; moneda: string | null;
  tasa: number | null; monto_usd: number | null; metodo: string | null; referencia: string | null;
  ingreso_id: string | null; nota: string | null; asignaciones: Asignacion[] | null;
};

// Trae cuentas ABIERTAS (cobrada=false) y todos los pagos, agrupados por cliente.
async function cargarClientes(sb: ReturnType<typeof createServiceClient>) {
  const [{ data: cuentasD }, { data: pagosD }, { data: aliasD }] = await Promise.all([
    sb!.from("admin_cuenta_cobrar").select("*").eq("cobrada", false).order("fecha", { ascending: true }),
    sb!.from("admin_cxc_pago").select("*").order("fecha", { ascending: true }),
    sb!.from("admin_cliente_alias").select("alias_key, canonico"),
  ]);
  const cuentas = (cuentasD as CuentaRow[]) ?? [];
  const pagos = (pagosD as PagoRow[]) ?? [];
  // Alias: nombre alterno → nombre canónico (para unir clientes repetidos).
  const alias = new Map<string, string>();
  for (const a of (aliasD as { alias_key: string; canonico: string }[]) ?? []) alias.set(a.alias_key, a.canonico);
  const resolver = (nombre: string | null) => {
    const canon = alias.get(clave(nombre));
    return canon ?? (nombre ?? "").trim();
  };

  const map = new Map<string, {
    cliente: string; key: string; cuentas: CuentaRow[]; pagos: PagoRow[];
  }>();
  const get = (nombre: string | null) => {
    const display = resolver(nombre) || "—";
    const k = clave(display);
    if (!map.has(k)) map.set(k, { cliente: display, key: k, cuentas: [], pagos: [] });
    return map.get(k)!;
  };
  for (const c of cuentas) get(c.deudor).cuentas.push(c);
  for (const p of pagos) get(p.cliente).pagos.push(p);

  const clientes = [...map.values()].map((g) => {
    const totalCuentasUsd = g.cuentas.reduce((s, c) => s + (c.monto_usd ?? 0), 0);
    const totalPagosUsd = g.pagos.reduce((s, p) => s + (p.monto_usd ?? 0), 0);
    const saldoUsd = r2(totalCuentasUsd - totalPagosUsd);
    const ultima = g.cuentas.reduce<string | null>((mx, c) => (!mx || c.fecha > mx ? c.fecha : mx), null);
    // Cuánto se ha pagado de cada cuenta (por las asignaciones de los pagos).
    const pagadoPorCuenta = new Map<string, number>();
    let asignadoUsd = 0;
    for (const p of g.pagos) {
      for (const a of p.asignaciones ?? []) {
        pagadoPorCuenta.set(a.cuenta_id, (pagadoPorCuenta.get(a.cuenta_id) ?? 0) + (a.usd ?? 0));
        asignadoUsd += a.usd ?? 0;
      }
    }
    // Pagos antiguos sin asignación (a nivel cliente) se reparten FIFO.
    let poolLegacy = r2(totalPagosUsd - asignadoUsd);
    const cuentas = g.cuentas
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((c) => {
        let pagado = pagadoPorCuenta.get(c.id) ?? 0;
        if (poolLegacy > 0.005 && (c.monto_usd ?? 0) > pagado) {
          const extra = Math.min(poolLegacy, (c.monto_usd ?? 0) - pagado);
          pagado += extra; poolLegacy -= extra;
        }
        return { ...c, pagado_usd: r2(pagado) };
      });
    return {
      cliente: g.cliente,
      key: g.key,
      saldo_usd: saldoUsd,
      total_cuentas_usd: r2(totalCuentasUsd),
      total_pagos_usd: r2(totalPagosUsd),
      ultima,
      cuentas,
      pagos: g.pagos,
    };
  });
  // Solo clientes con saldo != 0 en la vista; el historial completo se conserva.
  clientes.sort((a, b) => b.saldo_usd - a.saldo_usd);
  return clientes;
}

// GET → clientes con saldo, detalle de cuentas y pagos. { clientes, tasa }
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const clientes = await cargarClientes(sb);
  const tasa = await getTasaEurUsd(sb);
  return NextResponse.json({ clientes, tasa });
}

// POST { accion: 'cobro' | 'cuenta' }
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // ── Registrar un cobro (pago) → aplica a cuentas (NE) elegidas y crea el ingreso ──
  if (b.accion === "cobro") {
    const cliente = texto(b.cliente);
    const moneda = texto(b.moneda) ?? "EUR";
    const tasaBs = numero(b.tasa); // solo para Bs: Bs por €
    const metodo = texto(b.metodo);
    const fecha = texto(b.fecha) ?? new Date().toISOString().slice(0, 10);
    const referencia = texto(b.referencia);
    const monto = numero(b.monto); // lo que ENTREGA el cliente, en la moneda del pago
    // Cuentas seleccionadas (ids) a las que se aplica el pago, más antiguas primero.
    const ids = (Array.isArray(b.cuentas) ? b.cuentas : []).map((x) => (typeof x === "string" ? x : texto((x as Record<string, unknown>)?.id))).filter(Boolean) as string[];
    if (!cliente) return NextResponse.json({ error: "Falta el cliente." }, { status: 400 });
    if (!metodo) return NextResponse.json({ error: "Elige el método de pago." }, { status: 400 });
    if (monto == null || monto <= 0) return NextResponse.json({ error: "Pon el monto que paga el cliente." }, { status: 400 });
    if (moneda === "Bs" && (tasaBs == null || tasaBs <= 0)) return NextResponse.json({ error: "Pon la tasa del día (Bs por €)." }, { status: 400 });

    const tasaEurUsd = await getTasaEurUsd(sb); // 1 € = X $
    const clientes = await cargarClientes(sb);
    const g = clientes.find((c) => c.key === clave(cliente));
    if (!g) return NextResponse.json({ error: "No encontré cuentas de ese cliente." }, { status: 400 });

    // Cuánto entrega el cliente, en euros (el euro es la referencia).
    // El dólar (efectivo/Zelle) se toma 1:1 con el euro: $1 abona €1.
    let montoEur: number;
    let tasaStore: number | null;
    if (moneda === "USD") { montoEur = monto; tasaStore = null; }
    else if (moneda === "Bs") { montoEur = monto / (tasaBs as number); tasaStore = tasaEurUsd > 0 ? Math.round(((tasaBs as number) / tasaEurUsd) * 10000) / 10000 : null; }
    else { montoEur = monto; tasaStore = tasaEurUsd; }

    // Aplica el pago a las cuentas elegidas (o a todas las abiertas si no se
    // eligió ninguna), más antiguas primero. El excedente queda a favor.
    const elegibles = (ids.length ? g.cuentas.filter((c) => ids.includes(c.id)) : g.cuentas)
      .filter((c) => (c.monto_usd ?? 0) - c.pagado_usd > 0.005)
      .sort((a, b2) => a.fecha.localeCompare(b2.fecha));
    let poolEur = montoEur;
    const asignaciones: { cuenta_id: string; ref: string | null; eur: number; usd: number }[] = [];
    for (const cu of elegibles) {
      if (poolEur <= 0.005) break;
      const restanteEur = tasaEurUsd > 0 ? ((cu.monto_usd ?? 0) - cu.pagado_usd) / tasaEurUsd : 0;
      const ap = Math.min(poolEur, restanteEur);
      if (ap > 0.005) { asignaciones.push({ cuenta_id: cu.id, ref: cu.ref, eur: r2(ap), usd: r2(ap * tasaEurUsd) }); poolEur -= ap; }
    }
    // poolEur restante (si el cliente pagó de más) queda a favor: reduce su saldo.

    const montoRecibido = r2(monto);
    const totalUsd = r2(montoEur * tasaEurUsd); // el pago completo (lo aplicado + lo que queda a favor)
    const favorEur = r2(Math.max(0, poolEur));
    const refs = asignaciones.map((a) => a.ref).filter(Boolean).join(", ");
    // 1) Un ingreso por el total recibido (fecha y método reales; sin IVA).
    const { data: ingreso, error: eIng } = await sb
      .from("admin_ingreso")
      .insert({
        fecha,
        concepto: `Cobro de cuenta por cobrar — ${cliente}${refs ? ` (${refs})` : ""}${favorEur > 0.005 ? " + a favor" : ""}`,
        categoria_nombre: "Ventas",
        pagador: cliente,
        monto: montoRecibido,
        moneda,
        tasa: tasaStore,
        monto_usd: totalUsd,
        metodo,
        factura: referencia,
        nota: favorEur > 0.005 ? `Cobro de cuenta por cobrar (queda ${favorEur} € a favor)` : "Cobro de cuenta por cobrar",
        fuente: "cxc-cobro",
      })
      .select("id")
      .single();
    if (eIng) {
      const falta = (eIng as { code?: string }).code === "42P01" || /does not exist|no existe|schema cache/i.test(eIng.message);
      return NextResponse.json({ error: falta ? "Falta preparar la base de datos. Corre el SQL de 'supabase/admin-cxc-v2.sql' en Supabase." : eIng.message }, { status: 500 });
    }

    // 2) Un pago (el cobro) enlazado al ingreso, con las asignaciones por cuenta.
    const { data: pago, error: ePago } = await sb
      .from("admin_cxc_pago")
      .insert({
        cliente,
        fecha,
        monto: montoRecibido,
        moneda,
        tasa: tasaStore,
        monto_usd: totalUsd,
        metodo,
        referencia,
        ingreso_id: ingreso.id,
        asignaciones,
        nota: null,
      })
      .select("id")
      .single();
    if (ePago) {
      await sb.from("admin_ingreso").delete().eq("id", ingreso.id);
      const falta = (ePago as { code?: string }).code === "42P01" || /does not exist|no existe|schema cache/i.test(ePago.message);
      return NextResponse.json({ error: falta ? "Falta la tabla de pagos o la columna 'asignaciones'. Corre 'supabase/admin-cxc-v2.sql' y 'supabase/admin-cxc-asignaciones.sql'." : ePago.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pago_id: pago.id, ingreso_id: ingreso.id, cobrado_eur: r2(montoEur), favor_eur: favorEur });
  }

  // ── Agregar una cuenta a mano (deuda) ──
  const cliente = texto(b.cliente);
  const monto = numero(b.monto);
  const moneda = texto(b.moneda) ?? "EUR";
  let tasa = numero(b.tasa);
  if (!cliente) return NextResponse.json({ error: "Falta el cliente." }, { status: 400 });
  if (monto == null || monto === 0) return NextResponse.json({ error: "Pon un monto." }, { status: 400 });
  if (moneda === "EUR" && (tasa == null || tasa <= 0)) tasa = await getTasaEurUsd(sb);
  const fila = {
    fecha: texto(b.fecha) ?? new Date().toISOString().slice(0, 10),
    descripcion: texto(b.descripcion) ?? "Cuenta por cobrar",
    deudor: cliente,
    ref: texto(b.ref),
    monto: r2(monto),
    moneda,
    tasa,
    monto_usd: equivUSD(monto, moneda, tasa),
    cobrada: false,
    fuente: "manual",
  };
  const { data, error } = await sb.from("admin_cuenta_cobrar").insert(fila).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cuenta_id: data.id });
}

// DELETE ?pago=id  → borra el pago y su ingreso (revierte el cobro).
// DELETE ?cuenta=id → borra una cuenta (deuda).
export async function DELETE(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const url = new URL(req.url);
  const pagoId = url.searchParams.get("pago");
  const cuentaId = url.searchParams.get("cuenta");

  if (pagoId) {
    const { data: pago } = await sb.from("admin_cxc_pago").select("ingreso_id").eq("id", pagoId).single();
    if (pago?.ingreso_id) await sb.from("admin_ingreso").delete().eq("id", pago.ingreso_id);
    const { error } = await sb.from("admin_cxc_pago").delete().eq("id", pagoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (cuentaId) {
    const { error } = await sb.from("admin_cuenta_cobrar").delete().eq("id", cuentaId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "falta pago o cuenta" }, { status: 400 });
}
