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
    logo: "/sitio/aliados/casa-payasa.jpg",
    s: "Probadora de segunda mano",
    p: "PB",
    d: "Probadora de segunda mano. Selección, curaduría y venta de prendas con historia, en un espacio pensado para probar sin prisa.",
  },
  {
    n: "Archivo Público",
    logo: "/sitio/aliados/archivo-publico.jpg",
    s: "Probadora de segunda mano",
    p: "PB",
    d: "Probadora de segunda mano. Archivo vivo de prendas seleccionadas que vuelven a circular entre quienes visitan la casa.",
  },
  {
    n: "Mercadillo del Buen Gusto",
    logo: "/sitio/aliados/mercadillo-buen-gusto.jpg",
    s: "Exposición y reconstrucción de muebles",
    p: "Piso 1",
    d: "Salón de exposición y reconstrucción de muebles de moda. Piezas recuperadas, restauradas y puestas nuevamente en circulación.",
  },
  {
    n: "Yany Bastidas",
    logo: "/sitio/aliados/yany-bastidas.jpg",
    s: "Diseñadora de moda · Taller showroom",
    p: "Piso 1",
    d: "Diseñadora de moda. Taller y showroom donde el proceso de confección queda a la vista del visitante.",
  },
];

export const BIENESTAR: Aliado[] = [
  {
    n: "ARKO",
    logo: "/sitio/aliados/arko.jpg",
    s: "Actividades holísticas",
    p: "Piso 2",
    d: "Prácticas holísticas orientadas a la salud mental y emocional. Sesiones grupales e individuales.",
  },
  {
    n: "Dani Pilates",
    logo: "/sitio/aliados/dani-pilates.jpg",
    s: "Estiramiento y fuerza",
    p: "Piso 1",
    d: "Pilates enfocado en movilidad, estiramiento y fuerza controlada. Grupos reducidos.",
  },
  {
    n: "Nexo",
    logo: "/sitio/aliados/nexo.jpg",
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

/** Tipos de evento (para el formulario de solicitud). */
export const TIPOS_EVENTO = [
  "Privado / social",
  "Corporativo",
  "Cultural",
  "Bienestar",
  "Educativo",
  "Otro",
] as const;

/** Espacios alquilables de la casa. */
export const ESPACIOS = [
  "Jardín",
  "A1 — Galería",
  "A2 — Comedor",
  "B1 — Salón terraza",
  "Terraza piso 2",
  "Canchas",
  "Cowork",
  "Otros",
] as const;

/** Opciones de servicio de catering. */
export const CATERING = ["No, gracias", "Sí, me interesa"] as const;

/** Correo de destino de las solicitudes de evento. */
export const CORREO_EVENTOS = "info@quintamama.com";

/** Datos de contacto de Quinta Mamá. */
export const CONTACTO = {
  telefono: "+58 422 333 1955",
  whatsapp: "https://wa.me/584223331955",
  correo: "info@quintamama.com",
};

/** Ubicación de Quinta Mamá (coordenadas exactas confirmadas por el cliente). */
export const UBICACION = {
  lat: 10.499694 as number | null,
  lng: -66.868556 as number | null,
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

/** URL de direcciones ("Cómo llegar") hacia Quinta Mamá. */
export function directionsUrl(): string {
  const base = "https://www.google.com/maps/dir/?api=1&destination=";
  if (UBICACION.lat !== null && UBICACION.lng !== null) {
    return `${base}${UBICACION.lat},${UBICACION.lng}`;
  }
  return base + encodeURIComponent(UBICACION.direccion);
}
