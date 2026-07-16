// Utilidades de texto para búsquedas.

/**
 * Normaliza texto para búsquedas: minúsculas y SIN acentos/tildes/diéresis.
 * Así "curcuma" encuentra "Cúrcuma", "cafe" encuentra "Café" y "jamon" → "Jamón".
 *
 * Se usa en TODOS los buscadores/filtros de la app: hay que aplicarla tanto a
 * lo que escribe el usuario como al texto contra el que se compara.
 */
export function normalizarBusqueda(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
