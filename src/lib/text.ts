// Utilidades de texto para busquedas.

/**
 * Normaliza texto para busquedas: minusculas y SIN acentos/tildes/dieresis.
 * Asi "curcuma" encuentra "Curcuma", "cafe" encuentra "Cafe", etc.
 *
 * Se usa en TODOS los buscadores/filtros de la app: hay que aplicarla tanto a
 * lo que escribe el usuario como al texto contra el que se compara.
 */
export function normalizarBusqueda(s: string): string {
  // El rango \u0300-\u036f son las marcas diacriticas combinantes (las tildes
  // que NFD separa de la letra). Se escribe con codigo Unicode explicito, NO con
  // el caracter literal, porque el minificador del build puede corromperlo.
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
