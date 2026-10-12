import React from 'react'

// SVG-фильтр «мел» подключается один раз
export function ChalkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="chalk" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="3" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.55" result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="2" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>
    </svg>
  )
}

export function ChalkBoard({ title, subtitle, onEdit, className = '', children }) {
  return (
    <div className={'chalkboard ' + className} onDoubleClick={onEdit}>
      <div className="chalk-dust" />
      <div className="chalk-text">{title || 'Без названия'}</div>
      {subtitle && <div className="chalk-sub">{subtitle}</div>}
      <div className="chalk-ledge"><span /><span /></div>
      {children}
    </div>
  )
}