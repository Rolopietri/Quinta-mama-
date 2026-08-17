import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { parseReporteSetux, nombreMetodo } from "@/lib/admin/setux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Clasifica cada método del reporte:
//  - 'excluir': RPP (cortesías, no son ingreso)
//  - 'cobrar' : CXC (ventas a crédito → cuentas por cobrar)
//  - 'ingreso': el resto (ventas del día)
type Destino = "ingreso" | "cobrar" | "excluir";
function destinoDe(metodo: string): Destino {
  const k = metodo.trim().toUpperCase();
  if (k === "RPP") return "excluir";
  if (k.includes("NOTA DE CREDITO") || k.includes("NOTA DE CRÉDITO")) return "excluir";
  if (k.startsWith("CXC")) return "cobrar";
  return "ingreso";
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
      lineas: reporte.lineas.map((l) => ({
        ...l,
        metodoBonito: nombreMetodo(l.metodo),
        destino: destinoDe(l.metodo),
      })),
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

  const usdDe = (total: number) => (tasa ? Math.round(total * tasa * 100) / 100 : null);

  // Dedupe: ¿ya hay algo de Setux para ese día (ingresos o cuentas por cobrar)?
  const [{ data: prevIng, error: e1 }, { data: prevCxc, error: e2 }] = await Promise.all([
    sb.from("admin_ingreso").select("id").eq("fuente", "setux").eq("fecha", fecha),
    sb.from("admin_cuenta_cobrar").select("id").eq("fuente", "setux").eq("fecha", fecha),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 });
  const yaCuantos = (prevIng?.length ?? 0) + (prevCxc?.length ?? 0);
  if (yaCuantos > 0 && b.reemplazar !== true) {
    return NextResponse.json({ yaExiste: true, cuantos: yaCuantos }, { status: 409 });
  }
  if (yaCuantos > 0 && b.reemplazar === true) {
    await sb.from("admin_ingreso").delete().eq("fuente", "setux").eq("fecha", fecha);
    // no borra cuentas por cobrar ya cobradas (tienen ingreso enlazado)
    await sb.from("admin_cuenta_cobrar").delete().eq("fuente", "setux").eq("fecha", fecha).eq("cobrada", false);
  }

  // Separar según destino (RPP se ignora; CXC va a cuentas por cobrar).
  const ingresos: Record<string, unknown>[] = [];
  const cobrar: Record<string, unknown>[] = [];
  for (const l of lineas) {
    const total = typeof l.total === "number" ? l.total : Number(l.total);
    if (!isFinite(total)) continue;
    const metodo = typeof l.metodo === "string" ? l.metodo : "";
    if (destinoDe(metodo) === "excluir") continue;
    const cantidad = typeof l.cantidad === "number" ? l.cantidad : null;
    if (destinoDe(metodo) === "cobrar") {
      cobrar.push({
        fecha,
        descripcion: `Ventas a crédito (CXC) del ${fecha}`,
        monto: total,
        moneda: "EUR",
        tasa,
        monto_usd: usdDe(total),
        fuente: "setux",
      });
    } else {
      ingresos.push({
        fecha,
        concepto: `Ventas ${metodo}`.trim(),
        categoria_id: categoriaId,
        categoria_nombre: categoriaNombre,
        pagador: null,
        monto: total,
        moneda: "EUR",
        tasa,
        monto_usd: usdDe(total),
        metodo,
        factura: null,
        nota: cantidad != null ? `${cantidad} transacciones (Setux)` : "Setux",
        fuente: "setux",
      });
    }
  }

  if (ingresos.length === 0 && cobrar.length === 0) {
    return NextResponse.json({ error: "No hay montos válidos." }, { status: 400 });
  }
  if (ingresos.length) {
    const { error } = await sb.from("admin_ingreso").insert(ingresos);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (cobrar.length) {
    const { error } = await sb.from("admin_cuenta_cobrar").insert(cobrar);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, creados: ingresos.length, porCobrar: cobrar.length });
}
