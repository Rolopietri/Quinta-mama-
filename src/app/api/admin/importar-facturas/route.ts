import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { parseReporteFacturas } from "@/lib/admin/factura";
import { getTasaEurUsd } from "@/lib/admin/tasa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const clave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

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

  return NextResponse.json({
    reporte: { desde, hasta, dias: reporte.dias, totales: reporte.totales, porMetodo: reporte.porMetodo, cxcDetalle: reporte.cxcDetalle },
  });
}

// PUT { file_base64 } → GUARDA el reporte por factura, REEMPLAZANDO su rango.
// Escribe (fechado por fecha de orden):
//   • Ingresos (contado) → admin_ingreso, fuente 'setux' (neto real + IVA real).
//   • CXC → admin_cuenta_cobrar, fuente 'factura' (bruto), por factura.
//   • RPP → admin_egreso categoría 'Cortesías', fuente 'factura' (bruto).
//   • Propina por día → admin_propina, fuente 'factura'.
//   • Tickets por día → admin_ticket_dia.
// Solo toca lo que carga este importador (fuente 'factura' / 'setux') dentro del
// rango: NO altera CXC/RPP históricos cargados por otros medios (agosto queda).
export async function PUT(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = typeof b.file_base64 === "string" ? b.file_base64 : typeof b.pdf_base64 === "string" ? b.pdf_base64 : "";
  const b64 = raw.replace(/^data:.*;base64,/, "");
  if (!b64) return NextResponse.json({ error: "No llegó el archivo." }, { status: 400 });

  let reporte;
  try {
    reporte = parseReporteFacturas(Buffer.from(b64, "base64"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude leer el archivo." }, { status: 422 });
  }
  const { desde, hasta, filas, dias } = reporte;
  if (!desde || !hasta) return NextResponse.json({ error: "El reporte no tiene fechas válidas." }, { status: 422 });

  const tasa = await getTasaEurUsd(sb);
  const usd = (eur: number) => r2(eur * tasa);

  // ── Ingresos (contado): 1 fila por (día, forma de pago) con neto+IVA reales ──
  const ingMap = new Map<string, { fecha: string; metodo: string; net: number; iva: number }>();
  for (const f of filas) {
    if (f.categoria !== "INGRESO") continue;
    const k = `${f.fecha}||${f.formaPago}`;
    const cur = ingMap.get(k) ?? { fecha: f.fecha, metodo: f.formaPago, net: 0, iva: 0 };
    cur.net += f.ventaNeta; cur.iva += f.impuesto;
    ingMap.set(k, cur);
  }
  const ingresos = Array.from(ingMap.values()).map((g) => ({
    fecha: g.fecha,
    concepto: `Ventas ${g.metodo}`.trim(),
    categoria_id: null,
    categoria_nombre: "Ventas",
    pagador: null,
    monto: r2(g.net),
    iva: r2(g.iva),
    moneda: "EUR",
    tasa,
    monto_usd: usd(g.net),
    metodo: g.metodo,
    factura: null,
    nota: "Reporte por factura",
    fuente: "setux",
  }));

  // ── CXC → cuentas por cobrar (una por factura, bruto) ──
  const cxc = filas.filter((f) => f.categoria === "CXC").map((f) => {
    const ref = f.nro || f.orden || null;
    return {
      fecha: f.fecha,
      descripcion: ref ? `Venta a crédito ${ref}` : "Venta a crédito",
      deudor: f.cliente || "—",
      ref,
      monto: r2(f.total),
      moneda: "EUR",
      tasa,
      monto_usd: usd(f.total),
      cobrada: false,
      fuente: "factura",
      import_hash: `factura|${ref ? ref.toLowerCase() : `${clave(f.cliente)}|${f.fecha}|${f.total}`}`,
    };
  });

  // ── RPP → egresos (cortesías, bruto) ──
  const rpp = filas.filter((f) => f.categoria === "RPP").map((f) => {
    const ref = f.nro || f.orden || null;
    return {
      fecha: f.fecha,
      concepto: `Cortesías (RPP)${ref ? ` ${ref}` : ""}`,
      categoria_id: null,
      categoria_nombre: "Cortesías",
      clasificacion: "variable",
      proveedor_id: null,
      proveedor_nombre: null,
      monto: r2(f.total),
      moneda: "EUR",
      tasa,
      monto_usd: usd(f.total),
      metodo: "RPP",
      factura: ref,
      nota: f.cliente ? `Cortesía a ${f.cliente}` : "Cortesía",
      fuente: "factura",
    };
  });

  // ── Propina y tickets por día ──
  const propinas = dias.filter((d) => d.propina > 0.005).map((d) => ({
    fecha: d.fecha, monto: r2(d.propina), moneda: "EUR", fuente: "factura", nota: "Propina del reporte por factura",
  }));
  const ticketsDia = dias.map((d) => ({
    fecha: d.fecha,
    tickets: d.tickets,
    total_bruto: r2(d.ingresoBruto + d.cxcBruto + d.rppBruto),
    total_neto: r2(d.ingresoNeto + d.cxcNeto + d.rppNeto),
    propina: r2(d.propina),
    moneda: "EUR",
    fuente: "factura",
  }));

  // ── Reemplazo por RANGO (solo lo de este importador) ──
  try {
    await sb.from("admin_ingreso").delete().eq("fuente", "setux").gte("fecha", desde).lte("fecha", hasta);
    await sb.from("admin_propina").delete().in("fuente", ["setux", "factura"]).gte("fecha", desde).lte("fecha", hasta);
    await sb.from("admin_cuenta_cobrar").delete().eq("fuente", "factura").gte("fecha", desde).lte("fecha", hasta);
    await sb.from("admin_egreso").delete().eq("fuente", "factura").eq("categoria_nombre", "Cortesías").gte("fecha", desde).lte("fecha", hasta);
    await sb.from("admin_ticket_dia").delete().gte("fecha", desde).lte("fecha", hasta);

    if (ingresos.length) { const { error } = await sb.from("admin_ingreso").insert(ingresos); if (error) throw error; }
    if (cxc.length) { const { error } = await sb.from("admin_cuenta_cobrar").insert(cxc); if (error) throw error; }
    if (rpp.length) { const { error } = await sb.from("admin_egreso").insert(rpp); if (error) throw error; }
    if (propinas.length) { const { error } = await sb.from("admin_propina").insert(propinas); if (error) throw error; }
    if (ticketsDia.length) {
      const { error } = await sb.from("admin_ticket_dia").insert(ticketsDia);
      if (error) {
        const falta = (error as { code?: string }).code === "42P01" || /admin_ticket_dia|schema cache|relation/i.test(error.message);
        if (!falta) throw error; // si falta la tabla, seguimos sin bloquear el resto
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, desde, hasta,
    ingresos: ingresos.length, cxc: cxc.length, rpp: rpp.length,
    propinas: propinas.length, dias: ticketsDia.length,
    ticketPromedio: reporte.totales.ticketPromedioBruto,
    tickets: reporte.totales.tickets,
  });
}
