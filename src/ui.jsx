import { useState, useId } from 'react'

// --- Campo numérico con edición fluida ----------------------
// Guarda el texto tal cual lo escribe el usuario (incluye vacío
// y decimales). El valor se convierte a número solo al calcular.
export function Field({ label, value, onChange, suffix, info, step, min, width }) {
  return (
    <label className="field" style={width ? { width } : undefined}>
      <span className="field-label">
        {label}
        {info && <Info text={info} />}
      </span>
      <span className="field-input">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={label}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
    </label>
  )
}

// --- Tooltip educativo "ⓘ" ----------------------------------
// Funciona con hover (desktop) y con toque (móvil/iPad).
export function Info({ text }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className="info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault()
        setOpen((o) => !o)
      }}
    >
      <span className="info-mark" aria-describedby={id}>
        ⓘ
      </span>
      {open && (
        <span className="info-bubble" role="tooltip" id={id}>
          {text}
        </span>
      )}
    </span>
  )
}

// --- Sección numerada del panel de supuestos ----------------
export function Section({ num, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="sec">
      <button className="sec-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="sec-num">{num}</span>
        <span className="sec-title">{title}</span>
        <span className="sec-toggle">{open ? '–' : '+'}</span>
      </button>
      {open && <div className="sec-body">{children}</div>}
    </section>
  )
}

// --- Tarjeta con borde superior de acento -------------------
export function Card({ title, accent, children, className = '' }) {
  return (
    <div className={`card ${className}`} style={accent ? { borderTopColor: accent } : undefined}>
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  )
}

// --- KPI grande ---------------------------------------------
export function Kpi({ label, value, sub, negative, accent }) {
  return (
    <div className="kpi" style={accent ? { borderTopColor: accent } : undefined}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${negative ? 'neg' : ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}
