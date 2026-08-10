import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { parseReporteSetux, nombreMetodo } from "@/lib/admin/setux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST { pdf_base64 } → lee el PDF y devuelve la vista previa (no guarda nada).
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const b64 = typeof b.pdf_base64 === "string" ? b.pdf_base64.replace(/^data:.*;base64,/, "") : "";
  if (!b64) return NextResponse.json({ error: "No llegó el PDF." }, { status: 400 });
  let reporte;
  try {
    reporte = parseReporteSetux(Buffer.from(b64, "base64"));
  } catch {
    return NextResponse.json({ error: "No pude leer el PDF." }, { status: 422 });
  }
  if (!reporte.lineas.length) {
    return NextResponse.json(
      { error: "No encontré la tabla de ventas por forma de pago. ¿Es el consolidado de Setux?" },
      { status: 422 },
    );
  }
  return NextResponse.json({
    reporte: {
      ...reporte,
      lineas: reporte.lineas.map((l) => ({ ...l, metodoBonito: nombreMetodo(l.metodo) })),
    },
  });
}

// PUT { fecha, tasa, categoria_id, lineas:[{metodo,total,cantidad}], reemplazar }
//   → crea un ingreso por método (moneda EUR) con fuente='setux'.
export async function PUT(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fecha = typeof b.fecha === "string" ? b.fecha : null;
  if (!fecha) return NextResponse.json({ error: "falta la fecha" }, { status: 400 });
  const tasa = typeof b.tasa === "number" && isFinite(b.tasa) && b.tasa > 0 ? b.tasa : null;
  const categoriaId = typeof b.categoria_id === "string" && b.categoria_id ? b.categoria_id : null;
  const categoriaNombre = typeof b.categoria_nombre === "string" ? b.categoria_nombre : null;
  const lineas = Array.isArray(b.lineas) ? (b.lineas as Record<string, unknown>[]) : [];
  if (lineas.length === 0) return NextResponse.json({ error: "No hay métodos que registrar." }, { status: 400 });

  // Dedupe: ¿ya hay ventas de Setux para ese día?
  const { data: previos, error: eSel } = await sb
    .from("admin_ingreso")
    .select("id")
    .eq("fuente", "setux")
    .eq("fecha", fecha);
  if (eSel) return NextResponse.json({ error: eSel.message }, { status: 500 });
  if (previos && previos.length > 0 && b.reemplazar !== true) {
    return NextResponse.json({ yaExiste: true, cuantos: previos.length }, { status: 409 });
  }
  if (previos && previos.length > 0 && b.reemplazar === true) {
    await sb.from("admin_ingreso").delete().eq("fuente", "setux").eq("fecha", fecha);
  }

  const filas = lineas
    .map((l) => {
      const total = typeof l.total === "number" ? l.total : Number(l.total);
      if (!isFinite(total)) return null;
      const metodo = typeof l.metodo === "string" ? l.metodo : "";
      const cantidad = typeof l.cantidad === "number" ? l.cantidad : null;
      const usd = tasa ? Math.round(total * tasa * 100) / 100 : null;
      return {
        fecha,
        concepto: `Ventas ${metodo}`.trim(),
        categoria_id: categoriaId,
        categoria_nombre: categoriaNombre,
        pagador: null,
        monto: total,
        moneda: "EUR",
        tasa,
        monto_usd: usd,
        metodo,
        factura: null,
        nota: cantidad != null ? `${cantidad} transacciones (Setux)` : "Setux",
        fuente: "setux",
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  if (filas.length === 0) return NextResponse.json({ error: "No hay montos válidos." }, { status: 400 });
  const { data, error } = await sb.from("admin_ingreso").insert(filas).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, creados: data?.length ?? 0 });
}
