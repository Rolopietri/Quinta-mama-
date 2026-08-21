import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { parseEstadoCuentas } from "@/lib/admin/cxc";
import { getTasaEurUsd } from "@/lib/admin/tasa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
// clave de cliente para agrupar/deduplicar (sin acentos ni mayúsculas)
function claveCliente(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

// POST { pdf_base64 } → lee el estado de cuentas y devuelve el detalle por
// cliente con sus documentos individuales (no guarda). Montos en euros (como
// las ventas: el número de "Saldo Divisas" es el valor de referencia en €).
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
  // Solo clientes con al menos un documento (saldo != 0).
  const clientes = reporte.clientes.filter((c) => c.documentos.length > 0);
  if (!clientes.length) {
    return NextResponse.json({ error: "No encontré cuentas. ¿Es el Estado de Cuentas por cliente?" }, { status: 422 });
  }
  return NextResponse.json({ reporte: { fecha: reporte.fecha, clientes } });
}

// PUT { fecha, clientes:[{nombre, documentos:[{fecha,ref,monto}]}] }
//   → ACUMULA: inserta cada documento como una cuenta por cobrar individual,
//     deduplicando por (cliente + referencia) para no duplicar al reimportar.
//     No borra nada existente. Montos en euros, con tasa fija → equivalente USD.
export async function PUT(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fechaReporte = typeof b.fecha === "string" && b.fecha ? b.fecha : new Date().toISOString().slice(0, 10);
  const clientes = Array.isArray(b.clientes) ? (b.clientes as Record<string, unknown>[]) : [];
  const tasa = await getTasaEurUsd(sb);
  const usdDe = (eur: number) => Math.round(eur * tasa * 100) / 100;

  type Fila = {
    fecha: string; descripcion: string; deudor: string; ref: string | null;
    monto: number; moneda: string; tasa: number; monto_usd: number;
    cobrada: boolean; fuente: string; import_hash: string;
  };
  const filas: Fila[] = [];
  for (const c of clientes) {
    const nombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
    if (!nombre) continue;
    const docs = Array.isArray(c.documentos) ? (c.documentos as Record<string, unknown>[]) : [];
    for (const d of docs) {
      const monto = typeof d.monto === "number" ? d.monto : Number(d.monto);
      if (!isFinite(monto) || Math.abs(monto) < 0.005) continue;
      const ref = typeof d.ref === "string" && d.ref.trim() ? d.ref.trim() : null;
      const fdoc = typeof d.fecha === "string" && d.fecha ? d.fecha : fechaReporte;
      // hash de dedupe: cliente + referencia (o cliente+fecha+monto si no hay ref).
      const import_hash = ref
        ? `${claveCliente(nombre)}|${ref.toLowerCase()}`
        : `${claveCliente(nombre)}|${fdoc}|${monto}`;
      filas.push({
        fecha: fdoc,
        descripcion: ref ? `Venta a crédito ${ref}` : "Venta a crédito",
        deudor: nombre,
        ref,
        monto: Math.round(monto * 100) / 100,
        moneda: "EUR",
        tasa,
        monto_usd: usdDe(monto),
        cobrada: false,
        fuente: "estado-cuenta",
        import_hash,
      });
    }
  }
  if (filas.length === 0) return NextResponse.json({ error: "No hay cuentas que registrar." }, { status: 400 });

  // Dedupe contra lo ya importado: descarta las cuentas cuyo hash ya existe.
  const hashes = filas.map((f) => f.import_hash);
  const { data: prev, error: ePrev } = await sb
    .from("admin_cuenta_cobrar")
    .select("import_hash")
    .in("import_hash", hashes);
  if (ePrev) return NextResponse.json({ error: ePrev.message }, { status: 500 });
  const existentes = new Set((prev ?? []).map((r) => r.import_hash as string));
  // Dedupe también dentro del mismo lote (por si el PDF repite una referencia).
  const vistos = new Set<string>();
  const nuevas = filas.filter((f) => {
    if (existentes.has(f.import_hash) || vistos.has(f.import_hash)) return false;
    vistos.add(f.import_hash);
    return true;
  });
  const duplicadas = filas.length - nuevas.length;

  if (nuevas.length === 0) {
    return NextResponse.json({ ok: true, creados: 0, duplicadas, mensaje: "Todo ya estaba importado; no se duplicó nada." });
  }
  const { data, error } = await sb.from("admin_cuenta_cobrar").insert(nuevas).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, creados: data?.length ?? 0, duplicadas });
}
