import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";

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
    const n = Number(v.replace(",", "."));
    return isFinite(n) ? n : null;
  }
  return null;
}
function equivUSD(monto: number | null, moneda: string | null, tasa: number | null): number | null {
  if (monto == null) return null;
  if (moneda === "USD") return monto;
  if (moneda === "Bs") return tasa && tasa > 0 ? monto / tasa : null;
  if (moneda === "EUR") return tasa && tasa > 0 ? monto * tasa : null;
  return null;
}

// GET ?abiertas=1 → solo por cobrar; sin filtro → todas (recientes primero).
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  let q = sb.from("admin_cuenta_cobrar").select("*").order("fecha", { ascending: false });
  if (new URL(req.url).searchParams.get("abiertas") === "1") q = q.eq("cobrada", false);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cuentas: data ?? [] });
}

// POST → crea una cuenta por cobrar a mano.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const monto = numero(b.monto);
  const moneda = texto(b.moneda) ?? "EUR";
  const tasa = numero(b.tasa);
  if (monto == null) return NextResponse.json({ error: "Pon un monto." }, { status: 400 });
  const fila = {
    fecha: texto(b.fecha) ?? undefined,
    descripcion: texto(b.descripcion),
    deudor: texto(b.deudor),
    monto,
    moneda,
    tasa,
    monto_usd: equivUSD(monto, moneda, tasa),
  };
  const { data, error } = await sb.from("admin_cuenta_cobrar").insert(fila).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cuenta: data });
}

// PATCH { id, accion } → 'cobrar' (crea ingreso + marca cobrada) | 'reabrir' | edición de tasa.
export async function PATCH(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = texto(b.id);
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const { data: cuenta, error: eSel } = await sb.from("admin_cuenta_cobrar").select("*").eq("id", id).single();
  if (eSel) return NextResponse.json({ error: eSel.message }, { status: 500 });

  if (b.accion === "cobrar") {
    if (cuenta.cobrada) return NextResponse.json({ error: "Ya está cobrada." }, { status: 400 });
    const fechaCobro = texto(b.fecha_cobro) ?? cuenta.fecha;
    const tasa = numero(b.tasa) ?? cuenta.tasa;
    const usd = equivUSD(cuenta.monto, cuenta.moneda, tasa);
    // 1) crear el ingreso
    const { data: ingreso, error: eIng } = await sb
      .from("admin_ingreso")
      .insert({
        fecha: fechaCobro,
        concepto: cuenta.descripcion ?? "Cobro de cuenta por cobrar",
        categoria_nombre: "Ventas",
        pagador: cuenta.deudor,
        monto: cuenta.monto,
        moneda: cuenta.moneda,
        tasa,
        monto_usd: usd,
        metodo: "Cobro CXC",
        nota: "Cobro de cuenta por cobrar (Setux)",
        fuente: "cxc",
      })
      .select("id")
      .single();
    if (eIng) return NextResponse.json({ error: eIng.message }, { status: 500 });
    // 2) marcar la cuenta como cobrada
    const { data, error } = await sb
      .from("admin_cuenta_cobrar")
      .update({ cobrada: true, fecha_cobro: fechaCobro, tasa, monto_usd: usd, ingreso_id: ingreso.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cuenta: data });
  }

  if (b.accion === "reabrir") {
    if (cuenta.ingreso_id) await sb.from("admin_ingreso").delete().eq("id", cuenta.ingreso_id);
    const { data, error } = await sb
      .from("admin_cuenta_cobrar")
      .update({ cobrada: false, fecha_cobro: null, ingreso_id: null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cuenta: data });
  }

  // Edición simple (tasa/descripcion/deudor).
  const cambios: Record<string, unknown> = {};
  if (b.tasa !== undefined) { cambios.tasa = numero(b.tasa); cambios.monto_usd = equivUSD(cuenta.monto, cuenta.moneda, numero(b.tasa)); }
  if (b.descripcion !== undefined) cambios.descripcion = texto(b.descripcion);
  if (b.deudor !== undefined) cambios.deudor = texto(b.deudor);
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: "nada que cambiar" }, { status: 400 });
  const { data, error } = await sb.from("admin_cuenta_cobrar").update(cambios).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cuenta: data });
}

export async function DELETE(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });
  const { error } = await sb.from("admin_cuenta_cobrar").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
