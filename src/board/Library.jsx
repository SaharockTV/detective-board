import React, { useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { Thumb, MediaView, CAT } from '../components/Media'
import { mediaCat, fmtSize, timeAgo } from '../lib/util'

const FILTERS = [['all', 'Все'], ['image', 'Фото'], ['gif', 'GIF'], ['video', 'Видео'], ['audio', 'Аудио'], ['model', '3D'], ['link', 'Ссылки'], ['file', 'Документы']]
export const ACCEPT = 'image/*,video/*,audio/*,.gif,.mp3,.wav,.ogg,.m4a,.aac,.flac,.glb,.gltf,.obj,.stl,.fbx,.usdz,.pdf,.txt,.doc,.docx,.xls,.xlsx'

/**
 * Библиотека материалов дела.
 * mode 'panel' — вкладка справа; mode 'pick' — выбор (onPick(list)).
 */
export default function Library({ library, members = {}, canEdit, upload, addLink, onRemove, onPlace, onAttach, attachTo, mode = 'panel', onPick, onClose, focus }) {
  const [f, setF] = useState('all')
  const [q, setQ] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(0)
  const [over, setOver] = useState(false)
  const [open, setOpen] = useState(null)
  const [picked, setPicked] = useState([])
  const fileRef = useRef(null)

  const counts = useMemo(() => { const c = { all: library.length }; library.forEach(m => { const k = mediaCat(m); c[k] = (c[k] || 0) + 1 }); return c }, [library])
  const list = library.filter(m => (f === 'all' || mediaCat(m) === f) && (!q || (m.name + ' ' + (m.link?.title || '') + ' ' + (m.url || '')).toLowerCase().includes(q.toLowerCase())))
  const cur = open && library.find(m => m.url === open)

  async function files(fs) {
    for (const file of fs) {
      setBusy(b => b + 1)
      try { await upload(file) } catch (e) { alert('Не загрузилось: ' + file.name + '\n' + (e.message || e)) }
      setBusy(b => b - 1)
    }
  }
  async function link(e) {
    e.preventDefault()
    if (!url.trim()) return
    try { await addLink(url); setUrl('') } catch (err) { alert(err.message || err) }
  }
  const toggle = (m) => setPicked(p => p.some(x => x.url === m.url) ? p.filter(x => x.url !== m.url) : [...p, m])
  const drag = (m) => (e) => {
    const { used, by, ts, _ts, ...clean } = m
    e.dataTransfer.setData('application/x-detective', JSON.stringify({ media: clean }))
    e.dataTransfer.setData('application/x-media', JSON.stringify(clean))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className={'lib lib-' + mode + (over ? ' over' : '')}
      onDragOver={e => { if (canEdit && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { if (e.dataTransfer.files?.length && canEdit) { e.preventDefault(); e.stopPropagation(); setOver(false); files([...e.dataTransfer.files]) } }}>
      {mode === 'pick' && <div className="lib-top"><b>Библиотека дела</b><button className="x" onClick={onClose}><Icon n="close" size={18} /></button></div>}
      <div className="lib-add">
        <button className="btn sm primary" disabled={!canEdit} onClick={() => fileRef.current.click()}><Icon n="upload" size={16} /> Загрузить</button>
        <form onSubmit={link} className="lib-url">
          <Icon n="link" size={16} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Вставьте ссылку: YouTube, сайт, файл…" disabled={!canEdit} />
          {url && <button className="btn sm">Добавить</button>}
        </form>
        <input ref={fileRef} type="file" multiple hidden accept={ACCEPT} onChange={e => { files([...e.target.files]); e.target.value = '' }} />
      </div>
      <div className="lib-filters">
        {FILTERS.map(([k, n]) => (counts[k] || k === 'all') ? <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{n} <span>{counts[k] || 0}</span></button> : null)}
      </div>
      {library.length > 6 && <input className="lib-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по названию…" />}
      {busy > 0 && <div className="lib-busy">Загрузка ({busy})…</div>}

      {cur && mode === 'panel' && (
        <div className="lib-open">
          <div className="lib-prev"><MediaView m={cur} /></div>
          <div className="lib-meta">
            <b>{cur.link?.title || cur.name}</b>
            <span>{CAT[mediaCat(cur)]}{cur.size ? ' · ' + fmtSize(cur.size) : ''}{cur.by && members[cur.by] ? ' · ' + members[cur.by].name : ''}{cur.ts ? ' · ' + timeAgo(cur.ts) : ''}</span>
            {cur.used?.filter(u => u.item).length > 0 && <span className="lib-used">На доске: {cur.used.filter(u => u.item).map((u, i) => <button key={i} className="link" onClick={() => focus?.(u.item)}>{u.title || 'улика'}</button>)}</span>}
          </div>
          <div className="lib-acts">
            {canEdit && <button className="btn sm primary" onClick={() => onPlace(cur)}><Icon n="plus" size={15} /> На доску</button>}
            {canEdit && attachTo && <button className="btn sm" onClick={() => onAttach(cur)}><Icon n="clip" size={15} /> К «{(attachTo.title || 'улика').slice(0, 18)}»</button>}
            <a className="btn sm" href={cur.url} target="_blank" rel="noreferrer" download={cur.kind === 'link' ? undefined : cur.name}>Открыть</a>
            {canEdit && <button className="btn sm quiet" title="Убрать из библиотеки (с доски не исчезнет)" onClick={() => { onRemove(cur); setOpen(null) }}>Убрать</button>}
          </div>
        </div>
      )}

      <div className="lib-grid">
        {list.map(m => {
          const sel = mode === 'pick' ? picked.some(x => x.url === m.url) : open === m.url
          return (
            <div key={m.url} className={'lib-tile' + (sel ? ' sel' : '')} draggable={canEdit && mode === 'panel'} onDragStart={drag(m)}
              onClick={() => mode === 'pick' ? toggle(m) : setOpen(o => o === m.url ? null : m.url)} title={m.link?.title || m.name}>
              <Thumb m={m} big />
              <span className="lib-n">{m.link?.title || m.name}</span>
              {m.used?.some(u => u.item) && <i className="lib-on" title="Уже на доске" />}
              {mode === 'pick' && sel && <i className="lib-check">✓</i>}
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="lib-empty">
            {library.length ? 'Ничего не найдено' : <>Библиотека пуста.<br />Перетащите сюда фото, видео, GIF, аудио, 3D-модели (.glb) или документы — или вставьте ссылку. Всё, что прикрепляют к уликам и в чат, тоже появляется здесь.</>}
          </div>
        )}
      </div>
      {mode === 'panel' && library.length > 0 && <div className="lib-hint">Перетащите материал на доску или на улику, либо выберите и нажмите «На доску».</div>}
      {mode === 'pick' && (
        <div className="lib-pickbar">
          <span>Выбрано: {picked.length}</span>
          <button className="btn sm" onClick={onClose}>Отмена</button>
          <button className="btn sm primary" disabled={!picked.length} onClick={() => onPick(picked.map(({ used, by, ts, _ts, ...m }) => m))}>Прикрепить</button>
        </div>
      )}
    </div>
  )
}

export function LibraryModal(props) {
  return <div className="modal-back lib-modal" onMouseDown={e => e.target === e.currentTarget && props.onClose()}><Library {...props} mode="pick" /></div>
}
