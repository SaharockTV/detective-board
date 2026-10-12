import React, { useRef } from 'react'
import { TEMPLATES } from '../assets/catalog'
import Icon from '../components/Icon'

export default function AssetTray({ onAdd, onFiles, canEdit }) {
  const file = useRef(null)
  const drag = (data) => (e) => {
    e.dataTransfer.setData('application/x-detective', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <div className={'tray' + (canEdit ? '' : ' disabled')}>
      <div className="tray-h">Бланки и носители</div>
      <div className="tray-grid">
        {TEMPLATES.map(t => (
          <button key={t.type} className="tray-item" draggable={canEdit} onDragStart={drag({ type: t.type })} onClick={() => canEdit && onAdd({ type: t.type })} title={'Добавить: ' + t.name}>
            <span className={'mini mini-' + t.type}><i /></span><span className="ti-n">{t.name}</span>
          </button>
        ))}
      </div>
      <button className="upload-btn" disabled={!canEdit} onClick={() => file.current.click()}><Icon n="upload" size={18} /> Загрузить материалы<small>фото · видео · аудио · PDF · .glb</small></button>
      <input ref={file} type="file" multiple hidden accept="image/*,video/*,audio/*,.mp3,.wav,.ogg,.m4a,.glb,.gltf,.pdf,.txt,.doc,.docx" onChange={e => { onFiles([...e.target.files]); e.target.value = '' }} />
    </div>
  )
}
