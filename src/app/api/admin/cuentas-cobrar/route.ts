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
type PagoRow = {
  id: string; cliente: string; fecha: string; monto: number | null; moneda: string | null;
  tasa: number | null; monto_usd: number | null; metodo: string | null; referencia: string | null;
  ingreso_id: string | null; nota: string | null;
};

// Trae cuentas ABIERTAS (cobrada=false) y todos los pagos, agrupados por cliente.
async function cargarClientes(sb: ReturnType<typeof createServiceClient>) {
  const [{ data: cuentasD }, { data: pagosD }] = await Promise.all([
    sb!.from("admin_cuenta_cobrar").select("*").eq("cobrada", false).order("fecha", { ascending: true }),
    sb!.from("admin_cxc_pago").select("*").order("fecha", { ascending: true }),
  ]);
  const cuentas = (cuentasD as CuentaRow[]) ?? [];
  const pagos = (pagosD as PagoRow[]) ?? [];

  const map = new Map<string, {
    cliente: string; key: string; cuentas: CuentaRow[]; pagos: PagoRow[];
  }>();
  const get = (nombre: string | null) => {
    const k = clave(nombre);
    if (!map.has(k)) map.set(k, { cliente: (nombre ?? "").trim() || "—", key: k, cuentas: [], pagos: [] });
    return map.get(k)!;
  };
  for (const c of cuentas) get(c.deudor).cuentas.push(c);
  for (const p of pagos) get(p.cliente).pagos.push(p);

  const clientes = [...map.values()].map((g) => {
    const totalCuentasUsd = g.cuentas.reduce((s, c) => s + (c.monto_usd ?? 0), 0);
    const totalPagosUsd = g.pagos.reduce((s, p) => s + (p.monto_usd ?? 0), 0);
    const saldoUsd = r2(totalCuentasUsd - totalPagosUsd);
    const ultima = g.cuentas.reduce<string | null>((mx, c) => (!mx || c.fecha > mx ? c.fecha : mx), null);
    return {
      cliente: g.cliente,
      key: g.key,
      saldo_usd: saldoUsd,
      total_cuentas_usd: r2(totalCuentasUsd),
      total_pagos_usd: r2(totalPagosUsd),
      ultima,
      cuentas: g.cuentas,
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

  // ── Registrar un cobro (pago) → crea el ingreso y descuenta del saldo ──
  if (b.accion === "cobro") {
    const cliente = texto(b.cliente);
    const monto = numero(b.monto);
    const moneda = texto(b.moneda) ?? "EUR";
    let tasa = numero(b.tasa);
    const metodo = texto(b.metodo);
    const fecha = texto(b.fecha) ?? new Date().toISOString().slice(0, 10);
    const referencia = texto(b.referencia);
    if (!cliente) return NextResponse.json({ error: "Falta el cliente." }, { status: 400 });
    if (monto == null || monto <= 0) return NextResponse.json({ error: "Pon un monto a cobrar mayor que 0." }, { status: 400 });
    if (!metodo) return NextResponse.json({ error: "Elige el método de pago." }, { status: 400 });
    if (moneda === "EUR" && (tasa == null || tasa <= 0)) tasa = await getTasaEurUsd(sb);
    if (moneda === "Bs" && (tasa == null || tasa <= 0)) return NextResponse.json({ error: "Pon la tasa Bs→$ del cobro." }, { status: 400 });
    const montoUsd = equivUSD(monto, moneda, tasa);
    if (montoUsd == null) return NextResponse.json({ error: "No pude calcular el equivalente en $." }, { status: 400 });

    // Validación: el cobro no puede superar el saldo pendiente del cliente.
    const clientes = await cargarClientes(sb);
    const g = clientes.find((c) => c.key === clave(cliente));
    const saldoUsd = g?.saldo_usd ?? 0;
    if (r2(montoUsd) > r2(saldoUsd) + 0.01) {
      return NextResponse.json({ error: `El cobro (≈ $${r2(montoUsd)}) supera el saldo pendiente (≈ $${r2(saldoUsd)}).`, saldoUsd }, { status: 400 });
    }

    // 1) Crear el ingreso (dinero que ENTRA), con la fecha y el método reales.
    //    Sin separar IVA (las CXC se dejan completas), como las ventas por lo demás.
    const { data: ingreso, error: eIng } = await sb
      .from("admin_ingreso")
      .insert({
        fecha,
        concepto: `Cobro de cuenta por cobrar — ${cliente}`,
        categoria_nombre: "Ventas",
        pagador: cliente,
        monto: r2(monto),
        moneda,
        tasa,
        monto_usd: r2(montoUsd),
        metodo,
        factura: referencia,
        nota: "Cobro de cuenta por cobrar",
        fuente: "cxc-cobro",
      })
      .select("id")
      .single();
    if (eIng) return NextResponse.json({ error: eIng.message }, { status: 500 });

    // 2) Registrar el pago, enlazado al ingreso (para no duplicar).
    const { data: pago, error: ePago } = await sb
      .from("admin_cxc_pago")
      .insert({
        cliente,
        fecha,
        monto: r2(monto),
        moneda,
        tasa,
        monto_usd: r2(montoUsd),
        metodo,
        referencia,
        ingreso_id: ingreso.id,
        nota: null,
      })
      .select("id")
      .single();
    if (ePago) {
      // Si el pago falla, deshace el ingreso para no dejarlo huérfano.
      await sb.from("admin_ingreso").delete().eq("id", ingreso.id);
      return NextResponse.json({ error: ePago.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pago_id: pago.id, ingreso_id: ingreso.id, saldo_nuevo_usd: r2(saldoUsd - montoUsd) });
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
