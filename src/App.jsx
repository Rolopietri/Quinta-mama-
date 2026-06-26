import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULTS,
  calcular,
  proyeccion12,
  num,
  fEur,
  fBs,
  fPct,
  fNum,
  fMeses,
} from './lib.js'
import { Field, Info, Section, Card, Kpi } from './ui.jsx'
import { Waterfall, ScenarioChart, ProjectionChart } from './charts.jsx'

const STORAGE_KEY = 'quinta-mama-modelo-v1'
const ACCENT = '#B8923B'

// Carga inicial desde localStorage (o valores por defecto)
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      // Mezcla con DEFAULTS por si se añadieron campos nuevos
      return { ...DEFAULTS, ...saved, roles: saved.roles || DEFAULTS.roles }
    }
  } catch (e) {
    // ignora datos corruptos
  }
  return structuredClone(DEFAULTS)
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [showAssumptions, setShowAssumptions] = useState(false) // móvil
  const fileRef = useRef(null)

  // Persistencia en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      /* almacenamiento lleno o bloqueado: se ignora */
    }
  }, [state])

  const modelo = useMemo(() => calcular(state), [state])
  const meses = useMemo(() => proyeccion12(state, modelo), [state, modelo])

  // --- helpers de actualización ---
  const set = (key) => (val) => setState((s) => ({ ...s, [key]: val }))

  const setRol = (i, key, val) =>
    setState((s) => {
      const roles = s.roles.map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
      return { ...s, roles }
    })

  const addRol = () =>
    setState((s) => ({
      ...s,
      roles: [...s.roles, { name: 'Nuevo rol', n: '1', s: '0', com: '0', bon: '0', carg: '22' }],
    }))

  const delRol = (i) => setState((s) => ({ ...s, roles: s.roles.filter((_, idx) => idx !== i) }))

  const reset = () => {
    if (confirm('¿Restablecer todos los valores a los predeterminados?')) {
      setState(structuredClone(DEFAULTS))
    }
  }

  // --- Guardar / cargar escenario en JSON ---
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'escenario-quinta-mama.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJSON = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result)
        setState({ ...DEFAULTS, ...obj, roles: obj.roles || DEFAULTS.roles })
      } catch (err) {
        alert('No se pudo leer el archivo: no es un escenario válido.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const ebitdaNeg = modelo.ebitda < 0

  return (
    <div className="app">
      {/* ---------- Header ---------- */}
      <header className="header">
        <div className="header-strip">
          <span className="brand">QUINTA MAMÁ</span>
          <span className="brand-sub">Calculadora financiera</span>
        </div>
        <div className="header-line" />
        <div className="header-bar no-print">
          <p className="header-tag">
            Modelo operativo del comedor · edita los supuestos y observa el resultado en vivo
          </p>
          <div className="header-actions">
            <button className="btn ghost" onClick={() => window.print()}>
              Exportar a PDF
            </button>
            <button className="btn ghost" onClick={exportJSON}>
              Guardar escenario
            </button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              Cargar escenario
            </button>
            <button className="btn danger" onClick={reset}>
              Restablecer
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={importJSON}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </header>

      {/* Botón colapsable de supuestos (solo móvil) */}
      <button
        className="assumptions-toggle no-print"
        onClick={() => setShowAssumptions((v) => !v)}
      >
        {showAssumptions ? '▲ Ocultar supuestos' : '▼ Editar supuestos'}
      </button>

      <div className="layout">
        {/* ================= IZQUIERDA: SUPUESTOS ================= */}
        <aside className={`assumptions no-print ${showAssumptions ? 'open' : ''}`}>
          <Section num="01" title="General">
            <div className="grid2">
              <Field label="Días operativos / semana" value={state.diasSem} onChange={set('diasSem')} />
              <Field label="Tasa euro" suffix="Bs/€" value={state.tasa} onChange={set('tasa')} />
            </div>
            <p className="hint">Semanas/mes: 4,33 (constante) · Días/mes: {fNum(modelo.diasMes, 1)}</p>
          </Section>

          <Section num="02" title="Aforo y rotación">
            <div className="grid2">
              <Field label="Plazas mesa formal" value={state.plazasF} onChange={set('plazasF')} />
              <Field label="Plazas sofá / informal" value={state.plazasI} onChange={set('plazasI')} />
            </div>
            <div className="grid2">
              <Field
                label="Rotación desayuno · mesa"
                info="Rotación: veces que un mismo asiento se ocupa en esa franja."
                value={state.rotDesF}
                onChange={set('rotDesF')}
              />
              <Field label="Rotación desayuno · sofá" value={state.rotDesI} onChange={set('rotDesI')} />
            </div>
            <div className="grid2">
              <Field label="Rotación almuerzo · mesa" value={state.rotAlmF} onChange={set('rotAlmF')} />
              <Field label="Rotación almuerzo · sofá" value={state.rotAlmI} onChange={set('rotAlmI')} />
            </div>
            <Field label="Ocupación media" suffix="%" value={state.ocup} onChange={set('ocup')} />
          </Section>

          <Section num="03" title="Ticket y food cost">
            <div className="grid2">
              <Field
                label="Ticket desayuno"
                suffix="€"
                info="Ticket: gasto promedio de una persona por visita (1 persona = 1 ticket)."
                value={state.tkDes}
                onChange={set('tkDes')}
              />
              <Field
                label="Food cost desayuno"
                suffix="%"
                info="Food cost: costo de ingredientes como % del precio de venta (ideal 28–35%)."
                value={state.fcDes}
                onChange={set('fcDes')}
              />
            </div>
            <div className="grid2">
              <Field label="Ticket almuerzo" suffix="€" value={state.tkAlm} onChange={set('tkAlm')} />
              <Field label="Food cost almuerzo" suffix="%" value={state.fcAlm} onChange={set('fcAlm')} />
            </div>
          </Section>

          <Section num="04" title="Nómina paramétrica">
            <div className="payroll">
              <div className="payroll-head">
                <span>Rol</span>
                <span>N°</span>
                <span>Sueldo</span>
                <span>Comida</span>
                <span>Bono</span>
                <span>Cargas %</span>
                <span>Costo</span>
                <span></span>
              </div>
              {state.roles.map((r, i) => (
                <div className="payroll-row" key={i}>
                  <input
                    className="p-name"
                    value={r.name}
                    onChange={(e) => setRol(i, 'name', e.target.value)}
                    aria-label="Nombre del rol"
                  />
                  <input value={r.n} onChange={(e) => setRol(i, 'n', e.target.value)} inputMode="decimal" aria-label="Personas" />
                  <input value={r.s} onChange={(e) => setRol(i, 's', e.target.value)} inputMode="decimal" aria-label="Sueldo" />
                  <input value={r.com} onChange={(e) => setRol(i, 'com', e.target.value)} inputMode="decimal" aria-label="Comida" />
                  <input value={r.bon} onChange={(e) => setRol(i, 'bon', e.target.value)} inputMode="decimal" aria-label="Bono" />
                  <input value={r.carg} onChange={(e) => setRol(i, 'carg', e.target.value)} inputMode="decimal" aria-label="Cargas" />
                  <span className="p-cost">{fEur(modelo.roles[i]?.costo)}</span>
                  <button className="p-del" onClick={() => delRol(i)} aria-label="Eliminar rol" title="Eliminar">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="payroll-foot">
              <button className="btn small" onClick={addRol}>
                + Añadir rol
              </button>
              <span className="payroll-total">
                {fNum(modelo.personas)} personas · <strong>{fEur(modelo.nomina)}/mes</strong>
              </span>
            </div>
          </Section>

          <Section num="05" title="Fijos e inversión">
            <div className="grid2">
              <Field label="Otros costos fijos" suffix="€/mes" value={state.otrosFijos} onChange={set('otrosFijos')} />
              <Field label="Inversión inicial (CapEx)" suffix="€" value={state.inversion} onChange={set('inversion')} />
            </div>
            <p className="hint">
              Otros fijos: gas, electricidad, agua, desechables, limpieza, mantenimiento,
              administrativos y marketing.
            </p>
          </Section>

          <Section num="06" title="Factores de escenario">
            <div className="grid2">
              <Field label="Factor conservador" suffix="×" value={state.fCons} onChange={set('fCons')} />
              <Field label="Factor optimista" suffix="×" value={state.fOpt} onChange={set('fOpt')} />
            </div>
            <Field
              label="Crecimiento mensual (proyección 12m)"
              suffix="%"
              value={state.crecMensual}
              onChange={set('crecMensual')}
            />
            <p className="hint">Base = 1,0×. La nómina y otros fijos no escalan con el escenario.</p>
          </Section>
        </aside>

        {/* ================= DERECHA: RESULTADOS ================= */}
        <main className="results">
          {/* KPIs */}
          <div className="kpis">
            <Kpi
              label="Ventas / mes"
              accent={ACCENT}
              value={fEur(modelo.ventas)}
              sub={fBs(modelo.ventas, modelo.tasa)}
            />
            <Kpi
              label="EBITDA / mes"
              accent={ACCENT}
              negative={ebitdaNeg}
              value={fEur(modelo.ebitda)}
              sub={`Margen operativo ${fPct(modelo.margenOperativo)}`}
            />
            <Kpi
              label="Punto de equilibrio"
              accent={ACCENT}
              value={fEur(modelo.puntoEquilibrio)}
              sub={modelo.bePct != null ? `${fPct(modelo.bePct)} de las ventas` : '—'}
            />
            <Kpi
              label="Payback"
              accent={ACCENT}
              value={fMeses(modelo.payback)}
              sub={modelo.roiAnual != null ? `ROI anual ${fPct(modelo.roiAnual)}` : '—'}
            />
          </div>

          {/* Comensales por día */}
          <Card title="Comensales por día" accent={ACCENT}>
            <div className="diners">
              <div>
                <span className="d-num">{fNum(modelo.desDia, 1)}</span>
                <span className="d-lbl">Desayuno</span>
              </div>
              <div>
                <span className="d-num">{fNum(modelo.almDia, 1)}</span>
                <span className="d-lbl">Almuerzo</span>
              </div>
              <div>
                <span className="d-num">{fNum(modelo.comensalesDia, 1)}</span>
                <span className="d-lbl">Total / día</span>
              </div>
              <div>
                <span className="d-num">{fNum(modelo.comensalesMes)}</span>
                <span className="d-lbl">Total / mes</span>
              </div>
            </div>
          </Card>

          {/* Cascada */}
          <Card title="De las ventas al EBITDA" accent={ACCENT}>
            <Waterfall modelo={modelo} />
          </Card>

          {/* Escenarios */}
          <Card title="Escenarios" accent={ACCENT}>
            <ScenarioChart escenarios={modelo.escenarios} />
            <div className="scen-cards">
              {modelo.escenarios.map((e) => (
                <div className={`scen ${e.nombre === 'Base' ? 'base' : ''}`} key={e.nombre}>
                  <div className="scen-name">{e.nombre}</div>
                  <div className="scen-row">
                    <span>Ventas</span>
                    <span>{fEur(e.ventas)}</span>
                  </div>
                  <div className="scen-row">
                    <span>EBITDA</span>
                    <span className={e.ebitda < 0 ? 'neg' : ''}>{fEur(e.ebitda)}</span>
                  </div>
                  <div className="scen-row">
                    <span>Margen</span>
                    <span className={e.margenPct < 0 ? 'neg' : ''}>{fPct(e.margenPct)}</span>
                  </div>
                  <div className="scen-row">
                    <span>Payback</span>
                    <span>{fMeses(e.payback)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Proyección 12 meses */}
          <Card title="Proyección a 12 meses" accent={ACCENT}>
            <ProjectionChart meses={meses} />
            <p className="hint">
              Ventas con crecimiento mensual de {state.crecMensual || '0'}%. El EBITDA acumulado
              (línea negra punteada) cruza la inversión de {fEur(modelo.inversion)} cuando el negocio
              se ha pagado a sí mismo.
            </p>
          </Card>

          {/* Lectura para accionistas */}
          <div className="shareholders">
            <h3>Lectura para accionistas</h3>
            <ShareholderText modelo={modelo} />
          </div>

          <footer className="foot no-print">
            Quinta Mamá · herramienta de modelado financiero · los valores se guardan
            automáticamente en este dispositivo.
          </footer>
        </main>
      </div>
    </div>
  )
}

// --- Texto narrativo dinámico para accionistas --------------
function ShareholderText({ modelo }) {
  const { ventas, ebitda, puntoEquilibrio, margenSeguridad, nominaPct, payback, escenarios } = modelo

  if (!(ventas > 0)) {
    return <p>Introduce supuestos de aforo y ticket para generar la lectura del negocio.</p>
  }

  const cons = escenarios.find((e) => e.nombre === 'Conservador')
  const rentable = ebitda > 0

  return (
    <div className="sh-text">
      <p>
        En el escenario base, el comedor factura <strong>{fEur(ventas)}</strong> al mes y genera un
        EBITDA de <strong className={ebitda < 0 ? 'neg-light' : ''}>{fEur(ebitda)}</strong>{' '}
        ({fPct(modelo.margenOperativo)} sobre ventas).{' '}
        {rentable
          ? `La inversión inicial se recupera en ${fMeses(payback)}.`
          : 'Con estos supuestos el negocio aún no cubre sus costos fijos.'}
      </p>
      <p>
        El <strong>punto de equilibrio</strong> está en {fEur(puntoEquilibrio)} de ventas mensuales:
        a partir de ahí, cada euro adicional empieza a dejar beneficio. Esto deja un{' '}
        <strong>margen de seguridad del {fPct(margenSeguridad)}</strong>
        {margenSeguridad != null && margenSeguridad > 0
          ? `, es decir, las ventas pueden caer hasta ese porcentaje antes de entrar en pérdidas.`
          : `, lo que indica que las ventas están por debajo del umbral de rentabilidad.`}
      </p>
      <p>
        La <strong>nómina representa el {fPct(nominaPct)}</strong> de las ventas, la partida de costo
        más sensible del modelo. En un escenario conservador (ventas ×{cons?.factor}), el EBITDA
        sería de <strong className={cons && cons.ebitda < 0 ? 'neg-light' : ''}>{fEur(cons?.ebitda)}</strong>: como los costos fijos no
        bajan con las ventas, el margen se comprime y muestra la sensibilidad real del negocio.
      </p>
    </div>
  )
}
