import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}

type Fila = { fecha: string | null; moneda: string | null; monto: number | null };

// GET → totales por mes y por moneda de ingresos y egresos (todo el histórico).
// { meses: [{ mes:"2026-08", ingresos:{EUR:.., USD:..}, egresos:{..} }], monedas:[..] }
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });

  const [ingR, egrR] = await Promise.all([
    sb.from("admin_ingreso").select("fecha, moneda, monto"),
    sb.from("admin_egreso").select("fecha, moneda, monto"),
  ]);
  if (ingR.error || egrR.error) {
    return NextResponse.json({ error: (ingR.error || egrR.error)!.message }, { status: 500 });
  }

  const meses = new Map<string, { mes: string; ingresos: Record<string, number>; egresos: Record<string, number> }>();
  const monedas = new Set<string>();
  const acumular = (filas: Fila[], lado: "ingresos" | "egresos") => {
    for (const f of filas) {
      if (!f.fecha) continue;
      const mes = f.fecha.slice(0, 7); // YYYY-MM
      const moneda = f.moneda || "EUR";
      monedas.add(moneda);
      if (!meses.has(mes)) meses.set(mes, { mes, ingresos: {}, egresos: {} });
      const registro = meses.get(mes)!;
      registro[lado][moneda] = (registro[lado][moneda] ?? 0) + (f.monto ?? 0);
    }
  };
  acumular((ingR.data as Fila[]) ?? [], "ingresos");
  acumular((egrR.data as Fila[]) ?? [], "egresos");

  const lista = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  const ORDEN = ["EUR", "USD", "Bs"];
  const monedasOrden = ORDEN.filter((m) => monedas.has(m)).concat([...monedas].filter((m) => !ORDEN.includes(m)));
  return NextResponse.json({ meses: lista, monedas: monedasOrden });
}
