// ============================================================
//  Quinta Mamá · Modelo financiero
//  Toda la lógica de cálculo vive aquí (funciones puras).
// ============================================================

export const SEM_MES = 4.33 // semanas por mes (constante)

// --- Valores por defecto del modelo --------------------------
// Los campos que el usuario edita se guardan como TEXTO (string)
// para permitir edición fluida (decimales, campo vacío, etc.).
// Los porcentajes se guardan en su forma "humana" (55 = 55%).
export const DEFAULTS = {
  // 01 General
  diasSem: '6',
  tasa: '0', // Bs por €

  // 02 Aforo y rotación
  plazasF: '32',
  plazasI: '12',
  rotDesF: '1.2',
  rotDesI: '1.0',
  rotAlmF: '1.5',
  rotAlmI: '1.2',
  ocup: '55', // % ocupación media

  // 03 Ticket y food cost
  tkDes: '7',
  fcDes: '32', // % food cost desayuno
  tkAlm: '14',
  fcAlm: '35', // % food cost almuerzo

  // 04 Nómina paramétrica
  roles: [
    { name: 'Jefe de cocina', n: '1', s: '525', com: '50', bon: '60', carg: '22' },
    { name: 'Cocinero auxiliar', n: '1', s: '320', com: '50', bon: '45', carg: '22' },
    { name: 'Ayudante de cocina', n: '2', s: '205', com: '50', bon: '35', carg: '22' },
    { name: 'Mesero/a', n: '3', s: '230', com: '50', bon: '70', carg: '22' },
    { name: 'Cajero/anfitrión', n: '1', s: '250', com: '50', bon: '45', carg: '22' },
  ],

  // 05 Fijos e inversión
  otrosFijos: '610',
  inversion: '15000',

  // 06 Factores de escenario
  fCons: '0.8',
  fOpt: '1.3',

  // Extra: proyección a 12 meses
  crecMensual: '0', // % crecimiento mensual de ventas
}

// --- Helpers de parseo --------------------------------------
// Convierte texto a número admitiendo coma o punto decimal.
// Texto vacío o inválido => 0 (para no romper los cálculos).
export function num(v) {
  if (v === null || v === undefined) return 0
  const s = String(v).trim().replace(',', '.')
  if (s === '' || s === '-' || s === '.') return 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// Porcentaje "humano" (55) -> fracción (0.55)
const pct = (v) => num(v) / 100

// --- Cálculo de un solo rol de nómina (costo cargado €/mes) --
export function costoRol(rol) {
  const n = num(rol.n)
  const base = num(rol.s) + num(rol.com) + num(rol.bon)
  const carg = pct(rol.carg)
  return n * (base * (1 + carg))
}

// --- Modelo completo ----------------------------------------
export function calcular(state) {
  const diasSem = num(state.diasSem)
  const diasMes = diasSem * SEM_MES
  const tasa = num(state.tasa)

  // Aforo y rotación
  const plazasF = num(state.plazasF)
  const plazasI = num(state.plazasI)
  const ocup = pct(state.ocup)
  const desDia = (plazasF * num(state.rotDesF) + plazasI * num(state.rotDesI)) * ocup
  const almDia = (plazasF * num(state.rotAlmF) + plazasI * num(state.rotAlmI)) * ocup
  const comensalesDia = desDia + almDia
  const comensalesMes = comensalesDia * diasMes

  // Ticket y food cost
  const tkDes = num(state.tkDes)
  const tkAlm = num(state.tkAlm)
  const fcDes = pct(state.fcDes)
  const fcAlm = pct(state.fcAlm)

  // Ingresos
  const ingDes = desDia * tkDes * diasMes
  const ingAlm = almDia * tkAlm * diasMes
  const ventas = ingDes + ingAlm

  // Costo de alimentos (CMV)
  const cmv = ingDes * fcDes + ingAlm * fcAlm
  const margenBruto = ventas - cmv

  // Nómina
  const roles = (state.roles || []).map((r) => ({ ...r, costo: costoRol(r) }))
  const nomina = roles.reduce((acc, r) => acc + r.costo, 0)
  const personas = roles.reduce((acc, r) => acc + num(r.n), 0)

  // Fijos e inversión
  const otrosFijos = num(state.otrosFijos)
  const inversion = num(state.inversion)
  const costosFijos = nomina + otrosFijos

  // Resultado
  const ebitda = margenBruto - costosFijos
  const margenOperativo = ventas > 0 ? ebitda / ventas : null

  // Punto de equilibrio
  const margenContribucion = ventas > 0 ? margenBruto / ventas : null
  const puntoEquilibrio =
    margenContribucion && margenContribucion > 0 ? costosFijos / margenContribucion : null
  const bePct = puntoEquilibrio && ventas > 0 ? puntoEquilibrio / ventas : null
  const margenSeguridad = bePct != null ? 1 - bePct : null

  // Retorno
  const payback = ebitda > 0 ? inversion / ebitda : null
  const roiAnual = inversion > 0 ? (ebitda * 12) / inversion : null

  // Peso de la nómina sobre ventas
  const nominaPct = ventas > 0 ? nomina / ventas : null

  // Escenarios (escala ventas y CMV; fijos NO escalan)
  const factores = {
    Conservador: num(state.fCons),
    Base: 1,
    Optimista: num(state.fOpt),
  }
  const escenarios = Object.entries(factores).map(([nombre, f]) => {
    const v = ventas * f
    const c = cmv * f
    const mb = v - c
    const e = mb - costosFijos
    return {
      nombre,
      factor: f,
      ventas: v,
      cmv: c,
      margenBruto: mb,
      ebitda: e,
      margenPct: v > 0 ? e / v : null,
      payback: e > 0 ? inversion / e : null,
    }
  })

  return {
    diasMes,
    tasa,
    desDia,
    almDia,
    comensalesDia,
    comensalesMes,
    ingDes,
    ingAlm,
    ventas,
    cmv,
    margenBruto,
    roles,
    nomina,
    personas,
    otrosFijos,
    inversion,
    costosFijos,
    ebitda,
    margenOperativo,
    margenContribucion,
    puntoEquilibrio,
    bePct,
    margenSeguridad,
    payback,
    roiAnual,
    nominaPct,
    escenarios,
  }
}

// --- Proyección a 12 meses ----------------------------------
// Las ventas crecen un % cada mes; el CMV mantiene su proporción
// sobre ventas; los costos fijos no cambian.
export function proyeccion12(state, modelo) {
  const crec = num(state.crecMensual) / 100
  const ratioCmv = modelo.ventas > 0 ? modelo.cmv / modelo.ventas : 0
  const meses = []
  let acumulado = 0
  for (let i = 0; i < 12; i++) {
    const factor = Math.pow(1 + crec, i)
    const ventas = modelo.ventas * factor
    const cmv = ventas * ratioCmv
    const ebitda = ventas - cmv - modelo.costosFijos
    acumulado += ebitda
    meses.push({
      mes: `M${i + 1}`,
      ventas,
      ebitda,
      acumulado,
    })
  }
  return meses
}

// --- Formateadores ------------------------------------------
const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const eur1 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 1,
})
const numFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const num1Fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export function fEur(v, decimals = 0) {
  if (v == null || !Number.isFinite(v)) return '—'
  return decimals ? eur1.format(v) : eur.format(v)
}

export function fBs(v, tasa) {
  if (v == null || !Number.isFinite(v) || !tasa || tasa <= 0) return '— Bs'
  return numFmt.format(v * tasa) + ' Bs'
}

export function fPct(v, decimals = 1) {
  if (v == null || !Number.isFinite(v)) return '—'
  return (v * 100).toFixed(decimals).replace('.', ',') + ' %'
}

export function fNum(v, decimals = 0) {
  if (v == null || !Number.isFinite(v)) return '—'
  return decimals ? num1Fmt.format(v) : numFmt.format(v)
}

export function fMeses(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return num1Fmt.format(v) + (v === 1 ? ' mes' : ' meses')
}
