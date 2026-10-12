import React, { useEffect, useRef, useState } from 'react'
import { getBackend } from '../lib/backend'

export function useFileUrl(url) {
  const [u, setU] = useState(url && !url.startsWith('idb:') ? url : '')
  useEffect(() => {
    let ok = true
    if (url?.startsWith('idb:')) getBackend().then(b => b.fileUrl(url)).then(v => ok && setU(v))
    else setU(url || '')
    return () => { ok = false }
  }, [url])
  return u
}

export function Img({ m, className, ...rest }) {
  const u = useFileUrl(m?.url)
  if (!u) return <div className={'img-ph ' + (className || '')} />
  return <img className={className} src={u} alt={m.name || ''} draggable={false} {...rest} />
}

export function VideoThumb({ m }) {
  const u = useFileUrl(m?.url)
  return u ? <video src={u + '#t=0.5'} muted preload="metadata" playsInline /> : null
}

let mvPromise
function loadModelViewer() {
  if (!mvPromise) mvPromise = new Promise((res) => {
    if (customElements.get('model-viewer')) return res()
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'
    s.onload = () => res()
    document.head.appendChild(s)
  })
  return mvPromise
}

export function Model({ m, interactive = true }) {
  const u = useFileUrl(m?.url)
  const [ready, setReady] = useState(!!customElements.get('model-viewer'))
  useEffect(() => { loadModelViewer().then(() => setReady(true)) }, [])
  if (!u || !ready) return <div className="model-loading">Загрузка 3D…</div>
  return React.createElement('model-viewer', {
    src: u, 'auto-rotate': '', 'shadow-intensity': '1', exposure: '1.05',
    ...(interactive ? { 'camera-controls': '' } : { 'interaction-prompt': 'none' }),
    style: { width: '100%', height: '100%', background: 'transparent', pointerEvents: interactive ? 'auto' : 'none' },
  })
}

export function MediaView({ m }) {
  const u = useFileUrl(m.url)
  if (m.kind === 'image') return <a href={u} target="_blank" rel="noreferrer"><Img m={m} className="mv-img" /></a>
  if (m.kind === 'video') return u ? <video className="mv-video" src={u} controls playsInline /> : null
  if (m.kind === 'audio') return (
    <div className="mv-audio">
      <div className="tape-mini"><i /><i /></div>
      <div className="mv-audio-body"><div className="mv-name">{m.name}</div>{u && <audio src={u} controls />}</div>
    </div>
  )
  if (m.kind === 'model') return <div className="mv-model"><Model m={m} /></div>
  return <a className="mv-file" href={u} download={m.name} target="_blank" rel="noreferrer">📎 {m.name}</a>
}

export function Thumb({ m, onClick }) {
  if (m.kind === 'image') return <Img m={m} className="thumb" onClick={onClick} />
  const ic = { video: '🎞️', audio: '📼', model: '🧊', file: '📎' }[m.kind] || '📎'
  return <div className="thumb ic" onClick={onClick} title={m.name}>{ic}</div>
}

export function useAutoGrow(value) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [value])
  return ref
}