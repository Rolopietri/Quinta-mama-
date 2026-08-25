import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { parseReporteFacturas } from "@/lib/admin/factura";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const norm = (s: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const r2 = (x: number) => Math.round(x * 100) / 100;

// POST { file_base64 } → lee el "Reporte Detallado por Factura" (Excel/CSV) y
// devuelve, SIN GUARDAR: el agregado por día del reporte (Ingresos/CXC/RPP,
// tickets, ticket promedio) JUNTO con lo que ya está cargado en Administración
// para el mismo rango, para mostrar el CUADRE (qué cambiaría) antes de aplicar.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = typeof b.file_base64 === "string" ? b.file_base64 : typeof b.pdf_base64 === "string" ? b.pdf_base64 : "";
  const b64 = raw.replace(/^data:.*;base64,/, "");
  if (!b64) return NextResponse.json({ error: "No llegó el archivo." }, { status: 400 });
  const buf = Buffer.from(b64, "base64");

  let reporte;
  try {
    reporte = parseReporteFacturas(buf);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude leer el archivo." }, { status: 422 });
  }
  const { desde, hasta } = reporte;

  // Lo ya cargado en Administración para el mismo rango (por día).
  const sb = createServiceClient();
  let cargado: { porDia: Record<string, { ingreso: number; cxc: number; rpp: number }>; totales: { ingreso: number; cxc: number; rpp: number } } | null = null;
  if (sb && desde && hasta) {
    const [ingR, egrR, cxcR] = await Promise.all([
      sb.from("admin_ingreso").select("fecha, monto, moneda, fuente").gte("fecha", desde).lte("fecha", hasta),
      sb.from("admin_egreso").select("fecha, monto, moneda, categoria_nombre").gte("fecha", desde).lte("fecha", hasta),
      sb.from("admin_cuenta_cobrar").select("fecha, monto, moneda").gte("fecha", desde).lte("fecha", hasta),
    ]);
    const porDia: Record<string, { ingreso: number; cxc: number; rpp: number }> = {};
    const get = (f: string) => (porDia[f] ??= { ingreso: 0, cxc: 0, rpp: 0 });
    for (const e of ingR.data ?? []) {
      if (e.fuente === "setux" && (e.moneda ?? "EUR") === "EUR" && e.fecha) get(String(e.fecha)).ingreso += n(e.monto);
    }
    for (const e of egrR.data ?? []) {
      if (norm(e.categoria_nombre).includes("cortesia") && (e.moneda ?? "EUR") === "EUR" && e.fecha) get(String(e.fecha)).rpp += n(e.monto);
    }
    for (const c of cxcR.data ?? []) {
      if ((c.moneda ?? "EUR") === "EUR" && c.fecha) get(String(c.fecha)).cxc += n(c.monto);
    }
    const tot = { ingreso: 0, cxc: 0, rpp: 0 };
    for (const f of Object.keys(porDia)) {
      porDia[f] = { ingreso: r2(porDia[f].ingreso), cxc: r2(porDia[f].cxc), rpp: r2(porDia[f].rpp) };
      tot.ingreso += porDia[f].ingreso; tot.cxc += porDia[f].cxc; tot.rpp += porDia[f].rpp;
    }
    cargado = { porDia, totales: { ingreso: r2(tot.ingreso), cxc: r2(tot.cxc), rpp: r2(tot.rpp) } };
  }

  return NextResponse.json({
    reporte: { desde, hasta, dias: reporte.dias, totales: reporte.totales },
    cargado,
  });
}
