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

const COL = {
  black: '#000000',
  gold: '#B8923B',
  goldSoft: '#D8C081',
  red: '#B23A2E',
  grid: '#DED7C4',
  text: '#7C7A6E',
}

const axisStyle = { fontSize: 11, fill: COL.text, fontFamily: 'DM Mono, monospace' }

function eurAxis(v) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`
  return `${Math.round(v)}`
}

// --- Gráfico de cascada -------------------------------------
// Ventas → −CMV → −Nómina → −Otros fijos → EBITDA
export function Waterfall({ modelo }) {
  const { ventas, cmv, nomina, otrosFijos, ebitda } = modelo
  let run = 0
  const step = (name, delta, type) => {
    const y0 = run
    const y1 = run + delta
    run = y1
    return {
      name,
      base: Math.min(y0, y1),
      span: Math.abs(y1 - y0),
      type,
      valor: delta,
    }
  }
  const data = [
    step('Ventas', ventas, 'total'),
    step('−CMV', -cmv, 'down'),
    step('−Nómina', -nomina, 'down'),
    step('−Otros fijos', -otrosFijos, 'down'),
  ]
  // EBITDA como barra total desde 0
  data.push({
    name: 'EBITDA',
    base: Math.min(0, ebitda),
    span: Math.abs(ebitda),
    type: ebitda >= 0 ? 'total' : 'neg',
    valor: ebitda,
  })

  const color = (t) =>
    t === 'total' ? COL.gold : t === 'down' ? COL.goldSoft : t === 'neg' ? COL.red : COL.black

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COL.grid} vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: COL.grid }} tickLine={false} interval={0} />
        <YAxis tickFormatter={eurAxis} tick={axisStyle} axisLine={false} tickLine={false} width={38} />
        <Tooltip
          cursor={{ fill: 'rgba(184,146,59,0.08)' }}
          formatter={(v, _n, p) => [fEur(p.payload.valor), p.payload.name]}
          labelFormatter={() => ''}
          contentStyle={tooltipStyle}
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
export function ScenarioChart({ escenarios }) {
  const data = escenarios.map((e) => ({
    nombre: e.nombre,
    Ventas: Math.round(e.ventas),
    EBITDA: Math.round(e.ebitda),
  }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COL.grid} vertical={false} />
        <XAxis dataKey="nombre" tick={axisStyle} axisLine={{ stroke: COL.grid }} tickLine={false} />
        <YAxis tickFormatter={eurAxis} tick={axisStyle} axisLine={false} tickLine={false} width={38} />
        <Tooltip
          cursor={{ fill: 'rgba(184,146,59,0.08)' }}
          formatter={(v) => fEur(v)}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
        <Bar dataKey="Ventas" fill={COL.goldSoft} radius={[2, 2, 0, 0]} />
        <Bar dataKey="EBITDA" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.EBITDA >= 0 ? COL.gold : COL.red} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Proyección a 12 meses ----------------------------------
export function ProjectionChart({ meses }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={meses} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COL.grid} vertical={false} />
        <XAxis dataKey="mes" tick={axisStyle} axisLine={{ stroke: COL.grid }} tickLine={false} />
        <YAxis tickFormatter={eurAxis} tick={axisStyle} axisLine={false} tickLine={false} width={38} />
        <Tooltip formatter={(v) => fEur(v)} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
        <Bar dataKey="ventas" name="Ventas" fill={COL.goldSoft} radius={[2, 2, 0, 0]} />
        <Line dataKey="ebitda" name="EBITDA" stroke={COL.gold} strokeWidth={2} dot={false} />
        <Line
          dataKey="acumulado"
          name="EBITDA acumulado"
          stroke={COL.black}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

const tooltipStyle = {
  background: '#FCFAF3',
  border: `1px solid ${COL.grid}`,
  borderRadius: 6,
  fontFamily: 'DM Mono, monospace',
  fontSize: 12,
  color: COL.black,
}
