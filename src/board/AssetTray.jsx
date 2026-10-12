import React, { useRef, useState } from 'react'
import { TEMPLATES } from '../assets/catalog'
import { STARTER_PHOTOS } from '../assets/art'

export default function AssetTray({ onAdd, onFiles, canEdit }) {
  const [tab, setTab] = useState('paper')
  const file = useRef(null)
  const drag = (data) => (e) => {
    e.dataTransfer.setData('application/x-detective', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <div className={'tray' + (canEdit ? '' : ' disabled')}>
      <div className="tray-tabs">
        <button className={tab === 'paper' ? 'on' : ''} onClick={() => setTab('paper')}>Бумаги</button>
        <button className={tab === 'photo' ? 'on' : ''} onClick={() => setTab('photo')}>Фото</button>
      </div>
      {tab === 'paper' && (
        <div className="tray-grid">
          {TEMPLATES.map(t => (
            <button key={t.type} className={'tray-item ti-' + t.type} draggable={canEdit} onDragStart={drag({ type: t.type })} onClick={() => canEdit && onAdd({ type: t.type })} title={'Добавить: ' + t.name}>
              <span className="ti-ic">{t.icon}</span><span>{t.name}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'photo' && (
        <div className="tray-photos">
          {STARTER_PHOTOS.map(p => (
            <button key={p.key} className="tray-photo" draggable={canEdit} onDragStart={drag({ type: 'polaroid', photo: { name: p.name, url: p.url } })} onClick={() => canEdit && onAdd({ type: 'polaroid', photo: { name: p.name, url: p.url } })} title={p.name}>
              <img src={p.url} alt="" draggable={false} /><span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <button className="upload-btn" disabled={!canEdit} onClick={() => file.current.click()}>⬆ Загрузить свои<br /><small>фото · видео · mp3 · .glb</small></button>
      <input ref={file} type="file" multiple hidden accept="image/*,video/*,audio/*,.mp3,.wav,.ogg,.m4a,.glb,.gltf,.pdf,.txt,.doc,.docx" onChange={e => { onFiles([...e.target.files]); e.target.value = '' }} />
    </div>
  )
}