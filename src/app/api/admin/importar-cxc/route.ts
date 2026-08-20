import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { parseEstadoCuentas } from "@/lib/admin/cxc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST { pdf_base64 } → lee el estado de cuentas y devuelve el detalle por
// cliente (no guarda). Los saldos vienen en dólares.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const b64 = typeof b.pdf_base64 === "string" ? b.pdf_base64.replace(/^data:.*;base64,/, "") : "";
  if (!b64) return NextResponse.json({ error: "No llegó el PDF." }, { status: 400 });
  let reporte;
  try {
    reporte = parseEstadoCuentas(Buffer.from(b64, "base64"));
  } catch {
    return NextResponse.json({ error: "No pude leer el PDF." }, { status: 422 });
  }
  if (!reporte.clientes.length) {
    return NextResponse.json({ error: "No encontré clientes. ¿Es el Estado de Cuentas por cliente?" }, { status: 422 });
  }
  return NextResponse.json({ reporte });
}

// PUT { fecha, clientes:[{nombre,saldo}] } → reemplaza las cuentas por cobrar
// ABIERTAS importadas (fuente setux/estado-cuenta) por este detalle por cliente.
export async function PUT(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fecha = typeof b.fecha === "string" && b.fecha ? b.fecha : new Date().toISOString().slice(0, 10);
  const clientes = Array.isArray(b.clientes) ? (b.clientes as Record<string, unknown>[]) : [];
  // Se guardan los saldos != 0 (positivos y a favor); se omiten los de 0.
  const filas = clientes
    .map((c) => {
      const saldo = typeof c.saldo === "number" ? c.saldo : Number(c.saldo);
      const nombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
      if (!isFinite(saldo) || saldo === 0 || !nombre) return null;
      return {
        fecha,
        descripcion: `Saldo cliente${saldo < 0 ? " (a favor)" : ""}`,
        deudor: nombre,
        monto: Math.round(saldo * 100) / 100,
        moneda: "USD",
        tasa: null,
        monto_usd: Math.round(saldo * 100) / 100,
        cobrada: false,
        fuente: "estado-cuenta",
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  if (filas.length === 0) return NextResponse.json({ error: "No hay saldos que registrar." }, { status: 400 });

  // Reemplaza las ABIERTAS importadas (no toca las ya cobradas ni las manuales).
  const { error: eDel } = await sb
    .from("admin_cuenta_cobrar")
    .delete()
    .eq("cobrada", false)
    .in("fuente", ["setux", "estado-cuenta"]);
  if (eDel) return NextResponse.json({ error: eDel.message }, { status: 500 });

  const { data, error } = await sb.from("admin_cuenta_cobrar").insert(filas).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, creados: data?.length ?? 0 });
}
