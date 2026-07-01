import { useEffect, useState, useRef } from 'react'
import { fEur, fPct, fMeses, fNum, fBs, num } from './lib.js'
import { Field } from './ui.jsx'
import { Waterfall, ScenarioChart } from './charts.jsx'

// ============================================================
//  Modo presentación — estética minimalista (negro / blanco / gris)
//  Diapositivas navegables con datos en vivo.
// ============================================================
export default function Presentation({ state, set, modelo, onClose }) {
  const [i, setI] = useState(0)
  const touch = useRef(null)

  const slides = buildSlides({ state, set, modelo })
  const n = slides.length
  const go = (d) => setI((v) => Math.max(0, Math.min(n - 1, v + d)))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n])

  const onTouchStart = (e) => {
    touch.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
    touch.current = null
  }

  const cur = slides[i]

  return (
    <div className="pres" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="pres-top">
        <span className="pres-brand">QUINTA MAMÁ</span>
        <span className="pres-count">
          {i + 1} / {n}
        </span>
        <button className="pres-close" onClick={onClose} aria-label="Salir">
          ✕ Salir
        </button>
      </div>

      <div
        className={`pres-stage ${cur.bg ? 'has-bg' : ''} ${cur.light ? 'light' : ''} ${cur.dark ? 'dark' : ''}`}
        key={i}
      >
        {cur.bg && <div className="stage-bg" style={{ backgroundImage: `url(${cur.bg})` }} />}
        {cur.bg && <div className="stage-veil" />}
        <div className="stage-inner">{cur.render}</div>
      </div>

      <button className="pres-arrow left" onClick={() => go(-1)} disabled={i === 0} aria-label="Anterior">
        ‹
      </button>
      <button className="pres-arrow right" onClick={() => go(1)} disabled={i === n - 1} aria-label="Siguiente">
        ›
      </button>

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

// --- KPI compacto ---
function PK({ label, value, sub }) {
  return (
    <div className="pk">
      <div className="pk-label">{label}</div>
      <div className="pk-value">{value}</div>
      {sub && <div className="pk-sub">{sub}</div>}
    </div>
  )
}

// --- Definición de las diapositivas ---
function buildSlides({ state, set, modelo }) {
  return [
    // 1 · Portada
    {
      key: 'portada',
      render: (
        <div className="slide cover">
          <span className="cover-kicker">modelo de negocio</span>
          <h1 className="cover-comedor">COMEDOR</h1>
          <p className="cover-place">Espacio A2, Área común de la Quinta Mamá</p>
        </div>
      ),
    },

    // 2 · Problema / Oportunidad
    {
      key: 'problema',
      render: (
        <div className="slide text-left">
          <h2 className="s-title">Problema</h2>
          <p className="s-body">
            «No hay un motivo para quedarse, conversar o consumir en la Quinta Mamá.»
          </p>
          <div className="s-gap" />
          <h2 className="s-title">Oportunidad</h2>
          <ul className="s-list">
            <li>Crear un espacio cálido que prolonga la estadía y la convierte en consumo.</li>
            <li>
              Capturar un flujo de personas que ya está dentro de las instalaciones y que hoy se
              marcha sin convertirse en venta.
            </li>
          </ul>
        </div>
      ),
    },

    // 3 · Target
    {
      key: 'target',
      render: (
        <div className="slide text-left">
          <h2 className="s-title">Target</h2>
          <ul className="s-list">
            <li>
              <b>1. Clientes que ya están aquí.</b> Quienes vienen a sus terapias o a comprar los
              productos de nuestros inquilinos. Buscan desayunar después de su clase o almorzar
              después de entrenar. No hay que atraerlos: ya cruzaron la puerta.
            </li>
            <li>
              <b>2. Eventos.</b> El mismo espacio se convierte en sede de eventos corporativos con
              servicio de comida, cenas culturales y charlas nocturnas. Una segunda fuente de
              ingresos sobre la misma infraestructura.
            </li>
          </ul>
        </div>
      ),
    },

    // 4 · Concepto (fondo: plano)
    {
      key: 'concepto',
      bg: '/img/plano.jpg',
      light: true,
      render: (
        <div className="slide">
          <h2 className="s-title">El concepto</h2>
          <p className="s-lead">Cómo está pensado el local.</p>
          <div className="concept-grid">
            <div className="concept-card">
              <div className="concept-num">{fNum(num(state.plazasF))}</div>
              <div className="concept-lbl">plazas · mesa formal</div>
            </div>
            <div className="concept-card">
              <div className="concept-num">{fNum(num(state.plazasI))}</div>
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
        </div>
      ),
    },

    // 5 · Modelo operativo (fondo: salón sofá)
    {
      key: 'operativo',
      bg: '/img/salon-sofa.jpg',
      render: (
        <div className="slide">
          <h2 className="s-title">El modelo operativo</h2>
          <p className="s-lead">
            Escribe cuántos comensales esperas en desayuno y almuerzo. El total y la ocupación se
            calculan solos.
          </p>
          <div className="live-row">
            <div className="live-control">
              <Field label="Comensales desayuno / día" value={state.desDia} onChange={set('desDia')} />
              <Field label="Comensales almuerzo / día" value={state.almDia} onChange={set('almDia')} />
            </div>
            <div className="live-kpis">
              <PK label="Total / día" value={fNum(modelo.comensalesDia, 0)} sub="comensales" />
              <PK label="Total / mes" value={fNum(modelo.comensalesMes, 0)} sub="× 26 días" />
              <PK label="Ocupación media" value={fPct(modelo.ocup)} sub="se calcula sola" />
              <PK label="Ventas comedor / mes" value={fEur(modelo.ventasComedor)} sub={fBs(modelo.ventasComedor, modelo.tasa)} />
            </div>
          </div>
        </div>
      ),
    },

    // 6 · Catering — segunda rama de ingresos (fondo: salón madera 2)
    {
      key: 'catering',
      bg: '/img/salon-madera-2.jpg',
      render: (
        <div className="slide">
          <h2 className="s-title">Catering para eventos</h2>
          <p className="s-lead">
            La segunda rama: platos para los eventos que ya ocurren en la Quinta Mamá. Misma cocina,
            ingreso adicional.
          </p>
          <div className="live-row">
            <div className="live-control">
              <Field label="Eventos / mes" value={state.catEventos} onChange={set('catEventos')} />
              <Field label="Personas / evento" value={state.catPersonas} onChange={set('catPersonas')} />
              <Field label="Precio por plato" suffix="€" value={state.catTicket} onChange={set('catTicket')} />
            </div>
            <div className="live-kpis">
              <PK label="Ventas catering / mes" value={fEur(modelo.ventasCat)} sub={fBs(modelo.ventasCat, modelo.tasa)} />
              <PK label="Margen de ganancia" value={fPct(modelo.margenCatPct)} sub="sobre el precio" />
              <PK
                label="% del total"
                value={modelo.ventas > 0 ? fPct(modelo.ventasCat / modelo.ventas) : '—'}
                sub="de las ventas"
              />
              <PK
                label="Aporte / mes"
                value={fEur(modelo.ventasCat - modelo.cmvCat - modelo.nominaExtra)}
                sub="tras comida y horas extra"
              />
            </div>
          </div>
        </div>
      ),
    },

    // 7 · Los números en vivo (fondo: salón madera 1)
    {
      key: 'numeros',
      bg: '/img/salon-madera-1.jpg',
      render: (
        <div className="slide">
          <h2 className="s-title">Los números, en vivo</h2>
          <div className="num-grid">
            <div className="num-kpis">
              <PK label="Ventas / mes" value={fEur(modelo.ventas)} sub={fBs(modelo.ventas, modelo.tasa)} />
              <PK label="EBITDA / mes" value={fEur(modelo.ebitda)} sub={`Margen ${fPct(modelo.margenOperativo)}`} />
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
              <Waterfall modelo={modelo} mono />
            </div>
          </div>
        </div>
      ),
    },

    // 7 · Escenarios (fondo: salón madera 2)
    {
      key: 'escenarios',
      bg: '/img/salon-madera-2.jpg',
      render: (
        <div className="slide">
          <h2 className="s-title">Tres escenarios</h2>
          <div className="scen-live">
            <div className="scen-chart">
              <ScenarioChart escenarios={modelo.escenarios} mono />
            </div>
            <div className="scen-controls">
              <Field label="Factor conservador" suffix="×" value={state.fCons} onChange={set('fCons')} />
              <Field label="Factor optimista" suffix="×" value={state.fOpt} onChange={set('fOpt')} />
              <p className="s-note">
                La nómina y los fijos no bajan con las ventas: por eso, si caen las ventas, el margen
                se comprime.
              </p>
            </div>
          </div>
        </div>
      ),
    },

    // 8 · La propuesta (sin imagen)
    {
      key: 'propuesta',
      dark: true,
      render: (
        <div className="slide">
          <h2 className="s-title on-dark">La propuesta</h2>
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
        </div>
      ),
    },
  ]
}
