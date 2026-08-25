import { NextResponse, type NextRequest } from "next/server";
import { tokenValido, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin-service";
import { getTasaEurUsd } from "@/lib/admin/tasa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const norm = (s: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const r2 = (x: number) => Math.round(x * 100) / 100;

type EgRow = { fecha: string | null; monto: number | null; moneda: string | null; monto_usd: number | null; categoria_nombre: string | null; clasificacion: string | null };

// GET ?desde&hasta → gastos operativos (admin_egreso) en € para el P&L:
//   • fijos / variables (excluye 'Insumos' → el costo de insumos sale de Cocina
//     compras, para no doble contar; excluye 'Cortesías' → es informativo).
//   • insumosEgreso y cortesias aparte (para el guard de doble conteo / info).
//   • porCategoria y el período anterior (fijos/variables) para ▲▼.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "servidor no configurado" }, { status: 500 });
  const url = new URL(req.url);
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  if (!dia.test(desde) || !dia.test(hasta)) return NextResponse.json({ error: "rango inválido" }, { status: 400 });

  // Período anterior del mismo largo.
  const d0 = new Date(desde + "T00:00"); const d1 = new Date(hasta + "T00:00");
  const dias = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
  const finPrev = new Date(d0); finPrev.setDate(finPrev.getDate() - 1);
  const iniPrev = new Date(finPrev); iniPrev.setDate(iniPrev.getDate() - (dias - 1));
  const prevDesde = `${iniPrev.getFullYear()}-${String(iniPrev.getMonth() + 1).padStart(2, "0")}-${String(iniPrev.getDate()).padStart(2, "0")}`;
  const prevHasta = `${finPrev.getFullYear()}-${String(finPrev.getMonth() + 1).padStart(2, "0")}-${String(finPrev.getDate()).padStart(2, "0")}`;

  const tasa = await getTasaEurUsd(sb); // € → $
  const eurDe = (e: EgRow) => ((e.moneda ?? "EUR") === "EUR" ? n(e.monto) : (tasa > 0 ? n(e.monto_usd) / tasa : n(e.monto_usd)));
  const esCortesia = (e: EgRow) => norm(e.categoria_nombre).includes("cortesia");
  const esInsumo = (e: EgRow) => norm(e.categoria_nombre) === "insumos";
  const esFijo = (e: EgRow) => norm(e.clasificacion) === "fija" || norm(e.clasificacion) === "fijo";

  const [cur, prev] = await Promise.all([
    sb.from("admin_egreso").select("fecha, monto, moneda, monto_usd, categoria_nombre, clasificacion").gte("fecha", desde).lte("fecha", hasta),
    sb.from("admin_egreso").select("fecha, monto, moneda, monto_usd, categoria_nombre, clasificacion").gte("fecha", prevDesde).lte("fecha", prevHasta),
  ]);
  if (cur.error) return NextResponse.json({ error: cur.error.message }, { status: 500 });

  const rows = (cur.data ?? []) as EgRow[];
  let fijos = 0, variables = 0, insumosEgreso = 0, cortesias = 0;
  const porCat = new Map<string, { categoria: string; clasificacion: string; eur: number }>();
  for (const e of rows) {
    const eur = eurDe(e);
    if (esCortesia(e)) { cortesias += eur; continue; }
    if (esInsumo(e)) { insumosEgreso += eur; continue; }
    if (esFijo(e)) fijos += eur; else variables += eur;
    const key = norm(e.categoria_nombre) || "otros";
    const cell = porCat.get(key) ?? { categoria: e.categoria_nombre || "Otros", clasificacion: esFijo(e) ? "fija" : "variable", eur: 0 };
    cell.eur += eur; porCat.set(key, cell);
  }
  let pFijos = 0, pVariables = 0;
  for (const e of (prev.data ?? []) as EgRow[]) {
    if (esCortesia(e) || esInsumo(e)) continue;
    if (esFijo(e)) pFijos += eurDe(e); else pVariables += eurDe(e);
  }

  return NextResponse.json({
    desde, hasta,
    fijos: r2(fijos), variables: r2(variables), insumosEgreso: r2(insumosEgreso), cortesias: r2(cortesias),
    porCategoria: Array.from(porCat.values()).map((c) => ({ ...c, eur: r2(c.eur) })).sort((a, b) => b.eur - a.eur),
    prev: { fijos: r2(pFijos), variables: r2(pVariables) },
  });
}
