import React, { useState } from 'react'
import { PALETTE } from '../lib/util'

export default function NameModal({ me, onSave, title = 'Кто вы, детектив?' }) {
  const [name, setName] = useState(me.name || '')
  const [color, setColor] = useState(me.color)
  const ok = name.trim().length > 0
  return (
    <div className="modal-back">
      <form className="modal paper-modal" onSubmit={(e) => { e.preventDefault(); ok && onSave({ ...me, name: name.trim(), color }) }}>
        <div className="stamp">ДОПУСК</div>
        <h2>{title}</h2>
        <label>Позывной
          <input autoFocus value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Например, Шерлок" />
        </label>
        <label>Цвет ваших заметок</label>
        <div className="swatches">
          {PALETTE.map(c => <button type="button" key={c} className={'sw' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />)}
        </div>
        <button className="btn primary" disabled={!ok}>Войти в дело</button>
      </form>
    </div>
  )
}