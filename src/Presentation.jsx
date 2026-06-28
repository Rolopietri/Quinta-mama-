import { useEffect, useState, useRef } from 'react'
import { fEur, fPct, fMeses, fNum, fBs } from './lib.js'
import { Field } from './ui.jsx'
import { Waterfall, ScenarioChart } from './charts.jsx'

// ============================================================
//  Modo presentación — diapositivas navegables con datos en vivo
// ============================================================
export default function Presentation({ state, set, modelo, onClose }) {
  const [i, setI] = useState(0)
  const touch = useRef(null)

  const slides = buildSlides({ state, set, modelo })
  const n = slides.length
  const go = (d) => setI((v) => Math.max(0, Math.min(n - 1, v + d)))

  // Teclado: flechas para navegar, Esc para salir
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n])

  // Deslizar con el dedo (iPad / iPhone)
  const onTouchStart = (e) => {
    touch.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
    touch.current = null
  }

  return (
    <div className="pres" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Barra superior */}
      <div className="pres-top">
        <span className="pres-brand">QUINTA MAMÁ</span>
        <span className="pres-count">
          {i + 1} / {n}
        </span>
        <button className="pres-close" onClick={onClose} aria-label="Salir">
          ✕ Salir
        </button>
      </div>

      {/* Diapositiva actual */}
      <div className="pres-stage" key={i}>
        {slides[i]}
      </div>

      {/* Navegación */}
      <button
        className="pres-arrow left"
        onClick={() => go(-1)}
        disabled={i === 0}
        aria-label="Anterior"
      >
        ‹
      </button>
      <button
        className="pres-arrow right"
        onClick={() => go(1)}
        disabled={i === n - 1}
        aria-label="Siguiente"
      >
        ›
      </button>

      {/* Puntos */}
      <div className="pres-dots">
        {slides.map((_, k) => (
          <button
            key={k}
            className={`dot ${k === i ? 'on' : ''}`}
            onClick={() => setI(k)}
            aria-label={`Ir a diapositiva ${k + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

// --- KPI compacto para las diapositivas ---
function PK({ label, value, sub, neg }) {
  return (
    <div className="pk">
      <div className="pk-label">{label}</div>
      <div className={`pk-value ${neg ? 'neg' : ''}`}>{value}</div>
      {sub && <div className="pk-sub">{sub}</div>}
    </div>
  )
}

// --- Definición de las diapositivas ---
function buildSlides({ state, set, modelo }) {
  const ebitdaNeg = modelo.ebitda < 0

  return [
    // 1 · Portada
    <div className="slide cover" key="cover">
      <span className="kicker">Comedor · Modelo de negocio</span>
      <h1 className="cover-title">Quinta Mamá</h1>
      <div className="cover-line" />
      <p className="cover-sub">
        Un comedor de barrio: desayunos y almuerzos de calidad, rentable y con alma.
      </p>
      <p className="cover-hint">Desliza para avanzar →</p>
    </div>,

    // 2 · La oportunidad
    <div className="slide" key="oport">
      <span className="kicker">01 · La oportunidad</span>
      <h2>Demanda diaria, márgenes sanos</h2>
      <ul className="big-list">
        <li>Desayuno y almuerzo todos los días, con público fiel de barrio.</li>
        <li>Dos ambientes: mesa formal y una zona de sofá más informal.</li>
        <li>
          El negocio es rentable si se controlan dos palancas: <b>food cost</b> y{' '}
          <b>nómina</b>.
        </li>
      </ul>
    </div>,

    // 3 · El concepto (aforo en vivo)
    <div className="slide" key="concepto">
      <span className="kicker">02 · El concepto</span>
      <h2>Cómo está pensado el local</h2>
      <div className="concept-grid">
        <div className="concept-card">
          <div className="concept-num">{fNum(state.plazasF)}</div>
          <div className="concept-lbl">plazas · mesa formal</div>
        </div>
        <div className="concept-card">
          <div className="concept-num">{fNum(state.plazasI)}</div>
          <div className="concept-lbl">plazas · sofá / informal</div>
        </div>
        <div className="concept-card">
          <div className="concept-num">2</div>
          <div className="concept-lbl">franjas: desayuno y almuerzo</div>
        </div>
        <div className="concept-card">
          <div className="concept-num">{fNum(modelo.diasMes, 0)}</div>
          <div className="concept-lbl">días de servicio al mes</div>
        </div>
      </div>
    </div>,

    // 4 · Cómo se llena (control en vivo)
    <div className="slide" key="ocupacion">
      <span className="kicker">03 · El modelo operativo</span>
      <h2>Cómo se llena el comedor</h2>
      <p className="lead">
        Mueve la ocupación y mira cómo cambian los comensales. Así de sensible es el negocio.
      </p>
      <div className="live-row">
        <div className="live-control">
          <Field label="Ocupación media" suffix="%" value={state.ocup} onChange={set('ocup')} />
          <Field
            label="Ticket almuerzo"
            suffix="€"
            value={state.tkAlm}
            onChange={set('tkAlm')}
          />
        </div>
        <div className="live-kpis">
          <PK label="Desayuno / día" value={fNum(modelo.desDia, 0)} sub="comensales" />
          <PK label="Almuerzo / día" value={fNum(modelo.almDia, 0)} sub="comensales" />
          <PK label="Total / día" value={fNum(modelo.comensalesDia, 0)} sub="comensales" />
          <PK label="Total / mes" value={fNum(modelo.comensalesMes, 0)} sub="comensales" />
        </div>
      </div>
    </div>,

    // 5 · Los números (en vivo + cascada)
    <div className="slide" key="numeros">
      <span className="kicker">04 · Los números, en vivo</span>
      <h2>De las ventas al beneficio</h2>
      <div className="num-grid">
        <div className="num-kpis">
          <PK label="Ventas / mes" value={fEur(modelo.ventas)} sub={fBs(modelo.ventas, modelo.tasa)} />
          <PK
            label="EBITDA / mes"
            value={fEur(modelo.ebitda)}
            sub={`Margen ${fPct(modelo.margenOperativo)}`}
            neg={ebitdaNeg}
          />
          <PK
            label="Punto de equilibrio"
            value={fEur(modelo.puntoEquilibrio)}
            sub={modelo.bePct != null ? `${fPct(modelo.bePct)} de ventas` : '—'}
          />
          <PK
            label="Payback"
            value={fMeses(modelo.payback)}
            sub={modelo.roiAnual != null ? `ROI ${fPct(modelo.roiAnual)}` : '—'}
          />
        </div>
        <div className="num-chart">
          <Waterfall modelo={modelo} />
        </div>
      </div>
    </div>,

    // 6 · Escenarios (control en vivo)
    <div className="slide" key="escenarios">
      <span className="kicker">05 · Escenarios</span>
      <h2>Conservador, base y optimista</h2>
      <div className="scen-live">
        <div className="scen-chart">
          <ScenarioChart escenarios={modelo.escenarios} />
        </div>
        <div className="scen-controls">
          <Field label="Factor conservador" suffix="×" value={state.fCons} onChange={set('fCons')} />
          <Field label="Factor optimista" suffix="×" value={state.fOpt} onChange={set('fOpt')} />
          <p className="hint light">
            La nómina y los fijos no bajan con las ventas: por eso, si caen las ventas, el margen
            se comprime.
          </p>
        </div>
      </div>
    </div>,

    // 7 · La propuesta (the ask)
    <div className="slide dark-slide" key="propuesta">
      <span className="kicker gold">06 · La propuesta</span>
      <h2 className="on-dark">Qué pedimos y qué devuelve</h2>
      <div className="ask-grid">
        <PK label="Inversión inicial" value={fEur(modelo.inversion)} />
        <PK label="Se recupera en" value={fMeses(modelo.payback)} />
        <PK label="ROI anual" value={modelo.roiAnual != null ? fPct(modelo.roiAnual) : '—'} />
        <PK label="Margen de seguridad" value={fPct(modelo.margenSeguridad)} />
      </div>
      <p className="ask-text">
        Con una inversión de <b>{fEur(modelo.inversion)}</b>, el comedor alcanza su punto de
        equilibrio en <b>{fEur(modelo.puntoEquilibrio)}</b> de ventas mensuales y recupera la
        inversión en <b>{fMeses(modelo.payback)}</b>.
      </p>
    </div>,

    // 8 · Cierre
    <div className="slide cover" key="cierre">
      <span className="kicker">Gracias</span>
      <h1 className="cover-title">Quinta Mamá</h1>
      <div className="cover-line" />
      <p className="cover-sub">Hagámoslo realidad.</p>
    </div>,
  ]
}
