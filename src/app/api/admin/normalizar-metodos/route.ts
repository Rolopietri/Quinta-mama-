import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { canonMetodo } from "@/lib/admin/factura";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST → normaliza el método de pago de los ingresos ya cargados a su nombre
// canónico (Dólar, Punto de Venta, Pago Móvil…), unificando los duplicados de
// meses anteriores. Renombra por valor distinto (una UPDATE por método viejo).
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });

  const { data, error } = await sb.from("admin_ingreso").select("metodo").not("metodo", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const distintos = [...new Set((data ?? []).map((r) => (r.metodo as string) ?? "").filter(Boolean))];
  let cambios = 0;
  const detalle: { de: string; a: string }[] = [];
  for (const viejo of distintos) {
    const canon = canonMetodo(viejo);
    if (canon === viejo) continue;
    const { error: eUp } = await sb.from("admin_ingreso").update({ metodo: canon }).eq("metodo", viejo);
    if (eUp) return NextResponse.json({ error: eUp.message }, { status: 500 });
    cambios++;
    detalle.push({ de: viejo, a: canon });
  }
  return NextResponse.json({ ok: true, renombrados: cambios, detalle });
}
