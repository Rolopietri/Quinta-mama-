import { NextResponse } from "next/server";
import { parseIcsToEvents } from "@/lib/google-calendar";

// node-ical necesita el runtime de Node (no edge).
export const runtime = "nodejs";
// Cachea el feed ~10 min para no golpear a Google en cada carga.
export const revalidate = 600;

export async function GET() {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) {
    // Sin configurar: no es un error, simplemente no hay eventos de Google.
    return NextResponse.json({ configured: false, events: [] });
  }

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json({
        configured: true,
        events: [],
        error: `El feed respondió ${res.status}`,
      });
    }
    const text = await res.text();

    // Ventana: 3 meses atrás → 12 meses adelante (cubre la navegación normal).
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 13, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const events = parseIcsToEvents(text, iso(start), iso(end));
    return NextResponse.json({ configured: true, events });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      events: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
