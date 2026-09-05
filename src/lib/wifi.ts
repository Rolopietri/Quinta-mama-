// WiFi de invitados · tipos y validaciones compartidas (cliente y servidor).

export type WifiInvitado = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string | null;
  acepta_promos: boolean;
  visitas: number;
  origen: string | null;
  primera_visita: string;
  ultima_visita: string;
};

export type WifiConfig = {
  ssid: string;
  clave: string;
  mensaje: string;
};

export type RegistroInvitado = {
  nombre: string;
  email: string;
  telefono: string;
  nacimiento: string; // yyyy-mm-dd
  promos: boolean;
  origen?: string | null;
};

/** Correo en minúsculas y sin espacios. */
export function normalizarEmail(v: string): string {
  return v.trim().toLowerCase();
}

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
}

/** Deja solo dígitos y el "+" inicial: "0414 123 45 67" → "+584141234567". */
export function normalizarTelefono(v: string): string {
  const limpio = v.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (limpio.startsWith("0")) return `+58${limpio.slice(1)}`;
  return limpio;
}

export function telefonoValido(v: string): boolean {
  const digitos = normalizarTelefono(v).replace(/\D/g, "");
  return digitos.length >= 7 && digitos.length <= 15;
}

/** Fecha yyyy-mm-dd real, no futura, y de una persona de 5 a 110 años. */
export function nacimientoValido(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const anios = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return anios >= 5 && anios <= 110;
}

/** Errores de un registro; vacío = válido. */
export function validarRegistro(r: Partial<RegistroInvitado>): string[] {
  const errores: string[] = [];
  if (!r.nombre || r.nombre.trim().length < 3) errores.push("Escribe tu nombre completo.");
  if (!r.email || !emailValido(r.email)) errores.push("Escribe un correo válido.");
  if (!r.telefono || !telefonoValido(r.telefono)) errores.push("Escribe un teléfono válido.");
  if (!r.nacimiento || !nacimientoValido(r.nacimiento))
    errores.push("Escribe tu fecha de nacimiento.");
  return errores;
}

/**
 * Texto del QR que hace que el teléfono se conecte solo a la red.
 * Solo para uso interno del equipo — el invitado recibe la clave después
 * de registrarse.
 */
export function qrDeRed(ssid: string, clave: string): string {
  const esc = (s: string) => s.replace(/([\;,":])/g, "\\$1");
  return `WIFI:T:WPA;S:${esc(ssid)};P:${esc(clave)};;`;
}

/** Cumpleaños del mes (1-12) a partir de la lista de invitados. */
export function cumplenEsteMes(invitados: WifiInvitado[], mes: number): WifiInvitado[] {
  return invitados.filter((i) => {
    if (!i.fecha_nacimiento) return false;
    return Number(i.fecha_nacimiento.slice(5, 7)) === mes;
  });
}
