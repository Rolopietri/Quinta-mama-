/**
 * Cron diario del Sistema Operativo: envía por correo (Resend) los avisos de
 * asignación y vencimiento de tareas, sin duplicar.
 *
 * Config del cron en vercel.json (07:00 hora Caracas). Requiere en Vercel:
 *   - SUPABASE_SERVICE_ROLE_KEY  (leer/escribir sin sesión de usuario)
 *   - RESEND_API_KEY             (enviar correos)
 *   - RESEND_FROM                (remitente, ej. "Quinta Mamá <operaciones@quintamama.com>")
 *   - CRON_SECRET                (opcional; si está, se exige en el header)
 *
 * Si falta RESEND_API_KEY, la ruta no hace nada (no rompe el deploy).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TareaRow = {
  id: string; titulo: string; sub_eje_id: string; vence: string | null;
  creada: string; estado: string;
};
type RespRow = { tarea_id: string; persona_id: string };
type PersonaRow = { id: string; nombre: string; correo: string | null };

function caracasHoy(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs - 4 * 60 * 60_000).toISOString().slice(0, 10);
}
function diffDias(a: string, b: string): number {
  return Math.round((new Date(a + "T12:00:00Z").getTime() - new Date(b + "T12:00:00Z").getTime()) / 86_400_000);
}

async function enviarResend(key: string, from: string, to: string, subject: string, text: string): Promise<boolean> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  return r.ok;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ skipped: "RESEND_API_KEY no configurada" });
  }
  const from = process.env.RESEND_FROM || "Quinta Mamá <onboarding@resend.dev>";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase (service role) no configurado" }, { status: 500 });
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const [tareasR, respR, personasR, notifR] = await Promise.all([
    sb.from("so_tarea").select("id, titulo, sub_eje_id, vence, creada, estado").eq("estado", "pendiente"),
    sb.from("so_tarea_responsable").select("tarea_id, persona_id"),
    sb.from("so_persona").select("id, nombre, correo"),
    sb.from("so_notificacion").select("clave"),
  ]);
  if (tareasR.error || respR.error || personasR.error || notifR.error) {
    return NextResponse.json({ error: "error leyendo datos" }, { status: 500 });
  }

  const tareas = (tareasR.data as TareaRow[]) ?? [];
  const personas = new Map((personasR.data as PersonaRow[]).map((p) => [p.id, p]));
  const respPorTarea = new Map<string, string[]>();
  for (const r of respR.data as RespRow[]) {
    (respPorTarea.get(r.tarea_id) ?? respPorTarea.set(r.tarea_id, []).get(r.tarea_id)!).push(r.persona_id);
  }
  const yaEnviadas = new Set((notifR.data as { clave: string }[]).map((x) => x.clave));

  const hoy = caracasHoy();
  let enviadas = 0;
  const errores: string[] = [];

  for (const t of tareas) {
    for (const pid of respPorTarea.get(t.id) ?? []) {
      const persona = personas.get(pid);
      if (!persona?.correo) continue;

      const items: { tipo: "creada" | "vence"; clave: string }[] = [];
      const dCreada = diffDias(t.creada, hoy);
      if (dCreada <= 0 && dCreada >= -7) items.push({ tipo: "creada", clave: `${t.id}|creada|${pid}` });
      if (t.vence && diffDias(t.vence, hoy) <= 1) items.push({ tipo: "vence", clave: `${t.id}|vence|${pid}` });

      for (const it of items) {
        if (yaEnviadas.has(it.clave)) continue;
        const subject = `${it.tipo === "vence" ? "Vence" : "Nueva tarea"} · ${t.id} · ${t.titulo}`;
        const text = [
          it.tipo === "vence" ? "Tienes una tarea que vence pronto." : "Se te asignó una tarea.",
          "",
          `Tarea: ${t.titulo}`,
          `Identificador: ${t.id}`,
          `Sub-eje: ${t.sub_eje_id}`,
          `Vence: ${t.vence ?? "sin fecha"}`,
          "",
          "— Sistema Operativo · Quinta Mamá",
        ].join("\n");

        const ok = await enviarResend(resendKey, from, persona.correo, subject, text);
        if (!ok) { errores.push(it.clave); continue; }
        await sb.from("so_notificacion").upsert(
          { clave: it.clave, tarea_id: t.id, persona_id: pid, tipo: it.tipo },
          { onConflict: "clave" },
        );
        yaEnviadas.add(it.clave);
        enviadas++;
      }
    }
  }

  return NextResponse.json({ enviadas, errores: errores.length });
}
