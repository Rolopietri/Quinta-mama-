import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
} from 'recharts'
import { fEur } from './lib.js'

// Paleta por defecto (calculadora) — dorado + crema
const GOLD = {
  primary: '#B8923B',
  secondary: '#D8C081',
  neg: '#B23A2E',
  total: '#B8923B',
  black: '#000000',
  grid: '#DED7C4',
  text: '#7C7A6E',
  font: 'DM Mono, monospace',
}

// Paleta monocroma (presentación) — negro / gris, sin acentos
const MONO = {
  primary: '#111111',
  secondary: '#B5B5B5',
  neg: '#111111',
  total: '#111111',
  black: '#000000',
  grid: '#E2E2E2',
  text: '#888888',
  font: "'Futura', 'Century Gothic', 'Twentieth Century', sans-serif",
}

const pal = (mono) => (mono ? MONO : GOLD)

function eurAxis(v) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`
  return `${Math.round(v)}`
}

const tip = (c) => ({
  background: c.font.includes('Futura') ? '#FFFFFF' : '#FCFAF3',
  border: `1px solid ${c.grid}`,
  borderRadius: 6,
  fontFamily: c.font,
  fontSize: 12,
  color: c.black,
})

// --- Gráfico de cascada -------------------------------------
// Ventas → −CMV → −Nómina → −Otros fijos → EBITDA
export function Waterfall({ modelo, mono }) {
  const c = pal(mono)
  const axisStyle = { fontSize: 11, fill: c.text, fontFamily: c.font }
  const { ventas, cmv, nomina, otrosFijos, ebitda } = modelo
  let run = 0
  const step = (name, delta, type) => {
    const y0 = run
    const y1 = run + delta
    run = y1
    return { name, base: Math.min(y0, y1), span: Math.abs(y1 - y0), type, valor: delta }
  }
  const data = [
    step('Ventas', ventas, 'total'),
    step('−CMV', -cmv, 'down'),
    step('−Nómina', -nomina, 'down'),
    step('−Otros fijos', -otrosFijos, 'down'),
  ]
  data.push({
    name: 'EBITDA',
    base: Math.min(0, ebitda),
    span: Math.abs(ebitda),
    type: ebitda >= 0 ? 'total' : 'neg',
    valor: ebitda,
  })

  const color = (t) =>
    t === 'total' ? c.total : t === 'down' ? c.secondary : t === 'neg' ? c.neg : c.black

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: c.grid }} tickLine={false} interval={0} />
        <YAxis tickFormatter={eurAxis} tick={axisStyle} axisLine={false} tickLine={false} width={38} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
          formatter={(v, _n, p) => [fEur(p.payload.valor), p.payload.name]}
          labelFormatter={() => ''}
          contentStyle={tip(c)}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="span" stackId="a" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={color(d.type)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Gráfico de barras de escenarios ------------------------
export function ScenarioChart({ escenarios, mono }) {
  const c = pal(mono)
  const axisStyle = { fontSize: 11, fill: c.text, fontFamily: c.font }
  const data = escenarios.map((e) => ({
    nombre: e.nombre,
    Ventas: Math.round(e.ventas),
    EBITDA: Math.round(e.ebitda),
  }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="nombre" tick={axisStyle} axisLine={{ stroke: c.grid }} tickLine={false} />
        <YAxis tickFormatter={eurAxis} tick={axisStyle} axisLine={false} tickLine={false} width={38} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(v) => fEur(v)} contentStyle={tip(c)} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: c.font }} />
        <Bar dataKey="Ventas" fill={c.secondary} radius={[2, 2, 0, 0]} />
        <Bar dataKey="EBITDA" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.EBITDA >= 0 ? c.primary : c.neg} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Proyección a 12 meses ----------------------------------
export function ProjectionChart({ meses, mono }) {
  const c = pal(mono)
  const axisStyle = { fontSize: 11, fill: c.text, fontFamily: c.font }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={meses} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="mes" tick={axisStyle} axisLine={{ stroke: c.grid }} tickLine={false} />
        <YAxis tickFormatter={eurAxis} tick={axisStyle} axisLine={false} tickLine={false} width={38} />
        <Tooltip formatter={(v) => fEur(v)} contentStyle={tip(c)} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: c.font }} />
        <Bar dataKey="ventas" name="Ventas" fill={c.secondary} radius={[2, 2, 0, 0]} />
        <Line dataKey="ebitda" name="EBITDA" stroke={c.primary} strokeWidth={2} dot={false} />
        <Line
          dataKey="acumulado"
          name="EBITDA acumulado"
          stroke={c.black}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
