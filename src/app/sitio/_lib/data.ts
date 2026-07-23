/**
 * Datos y configuración del sitio público de Quinta Mamá.
 * Textos aprobados por el cliente (ver 01-CONTENIDO del paquete de traspaso).
 * No reescribir sin consultar.
 *
 * PENDIENTE de producción: sustituir por datos de Supabase (tablas aliados,
 * espacios, solicitudes) cuando estén disponibles los logotipos, fotos y
 * coordenadas reales.
 */

export type Area = "Cultura" | "Bienestar";

export interface Aliado {
  /** nombre */
  n: string;
  /** logo (url); vacío = mostrar marcador punteado */
  logo: string;
  /** subtítulo / categoría */
  s: string;
  /** piso */
  p: string;
  /** descripción para el modal */
  d: string;
}

export const CULTURA: Aliado[] = [
  {
    n: "Casa Payasa",
    logo: "",
    s: "Probadora de segunda mano",
    p: "PB",
    d: "Probadora de segunda mano. Selección, curaduría y venta de prendas con historia, en un espacio pensado para probar sin prisa.",
  },
  {
    n: "Archivo Público",
    logo: "",
    s: "Probadora de segunda mano",
    p: "PB",
    d: "Probadora de segunda mano. Archivo vivo de prendas seleccionadas que vuelven a circular entre quienes visitan la casa.",
  },
  {
    n: "Mercadillo del Buen Gusto",
    logo: "",
    s: "Exposición y reconstrucción de muebles",
    p: "Piso 1",
    d: "Salón de exposición y reconstrucción de muebles de moda. Piezas recuperadas, restauradas y puestas nuevamente en circulación.",
  },
  {
    n: "Yany Bastidas",
    logo: "",
    s: "Diseñadora de moda · Taller showroom",
    p: "Piso 1",
    d: "Diseñadora de moda. Taller y showroom donde el proceso de confección queda a la vista del visitante.",
  },
];

export const BIENESTAR: Aliado[] = [
  {
    n: "ARKO",
    logo: "",
    s: "Actividades holísticas",
    p: "Piso 2",
    d: "Prácticas holísticas orientadas a la salud mental y emocional. Sesiones grupales e individuales.",
  },
  {
    n: "Dani Pilates",
    logo: "",
    s: "Estiramiento y fuerza",
    p: "Piso 1",
    d: "Pilates enfocado en movilidad, estiramiento y fuerza controlada. Grupos reducidos.",
  },
  {
    n: "Nexo",
    logo: "",
    s: "Fuerza y movimiento",
    p: "PB",
    d: "Entrenamiento funcional centrado en fuerza y movimiento. Clases recurrentes con cupo limitado.",
  },
];

/** Colores de marca, usados en JS para pintar placeholders y acentos. */
export const C = {
  marfil: "#E3DCD2",
  marfilCl: "#EFEAE3",
  cacao: "#6B3319",
  terracota: "#9F3E2E",
  oliva: "#608955",
  olivaT: "#416138",
  azul: "#89AFBB",
  azulT: "#3C6572",
  tinta: "#2E1A10",
  hueco: "#F4EFE8",
} as const;

/** Niveles del recorrido vertical del hero. */
export const NIVELES = [
  { n: "00", l: "Luz cenital" },
  { n: "02", l: "Piso 2 · Bienestar" },
  { n: "01", l: "Piso 1 · Cultura" },
  { n: "PB", l: "PB · Eventos" },
] as const;

/**
 * Lógica encadenada del formulario: el tipo de evento filtra los espacios.
 * PENDIENTE: sustituir por espacios reales (código, capacidad, tarifa).
 */
export const ESPACIOS_POR_TIPO: Record<string, string[]> = {
  "Privado / social": [
    "B1 — Salón circular (PB)",
    "C2 — Terraza (Piso 1)",
    "C6 — Jardín posterior",
  ],
  Corporativo: ["B3 — Sala de juntas (Piso 2)", "B1 — Salón circular (PB)"],
  Cultural: ["B1 — Salón circular (PB)", "C2 — Terraza (Piso 1)"],
  Bienestar: ["C2 — Terraza (Piso 1)", "B3 — Sala (Piso 2)"],
  Educativo: ["B3 — Sala de juntas (Piso 2)", "C6 — Jardín posterior"],
  Otro: [
    "B1 — Salón circular (PB)",
    "B3 — Sala de juntas (Piso 2)",
    "C2 — Terraza (Piso 1)",
    "C6 — Jardín posterior",
    "Aún no lo sé",
  ],
};

export const TIPOS_EVENTO = Object.keys(ESPACIOS_POR_TIPO);

/** Correo de destino de las solicitudes. PENDIENTE: correo real de Quinta Mamá. */
export const CORREO_EVENTOS = "eventos@quintamama.com";

/**
 * Ubicación. PENDIENTE: coordenadas exactas o Place ID de Google Business.
 * Mientras tanto abre la búsqueda genérica en Google Maps.
 */
export const UBICACION = {
  lat: null as number | null,
  lng: null as number | null,
  direccion: "Quinta Mamá, Chacao, Caracas, Venezuela",
  placeId: "",
};

export function mapsUrl(): string {
  if (UBICACION.placeId) {
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(UBICACION.direccion) +
      "&query_place_id=" +
      UBICACION.placeId
    );
  }
  if (UBICACION.lat !== null && UBICACION.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${UBICACION.lat},${UBICACION.lng}`;
  }
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(UBICACION.direccion)
  );
}
