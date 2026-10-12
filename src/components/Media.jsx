import React, { useEffect, useRef, useState } from 'react'
import { getBackend } from '../lib/backend'
import { mediaCat, isGltf } from '../lib/util'

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
  if (m && !isGltf(m)) return <div className="model-loading">3D · {(m.name || '').split('.').pop().toUpperCase()}<small>просмотр — для .glb/.gltf</small></div>
  return <ModelGl u={u} interactive={interactive} />
}
function ModelGl({ u, interactive }) {
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
  if (m.kind === 'model') return isGltf(m) ? <div className="mv-model"><Model m={m} /></div> : <a className="mv-file" href={u} download={m.name} target="_blank" rel="noreferrer">3D-модель: {m.name}</a>
  if (m.kind === 'link') return <LinkView m={m} />
  return <a className="mv-file" href={u} download={m.name} target="_blank" rel="noreferrer">{m.name}</a>
}

export function LinkView({ m, compact }) {
  const L = m.link || {}
  if (L.embed && !compact) return (
    <div className="mv-link">
      <div className="mv-embed"><iframe src={L.embed} title={m.name} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" /></div>
      <a href={m.url} target="_blank" rel="noreferrer" className="mv-link-row"><Favicon host={L.host} /><span>{L.title || m.name}</span></a>
    </div>
  )
  return (
    <a className="mv-link card-link" href={m.url} target="_blank" rel="noreferrer">
      {L.thumb && <img className="mv-link-img" src={L.thumb} alt="" referrerPolicy="no-referrer" />}
      <span className="mv-link-row"><Favicon host={L.host} /><b>{L.title || m.name}</b></span>
      {L.desc && <span className="mv-link-desc">{L.desc}</span>}
      <span className="mv-link-url">{m.url}</span>
    </a>
  )
}
export const Favicon = ({ host }) => host ? <img className="fav" src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" referrerPolicy="no-referrer" /> : null

export const CAT = { image: 'Фото', gif: 'GIF', video: 'Видео', audio: 'Аудио', model: '3D', link: 'Ссылка', file: 'Документ' }
const LBL = { video: 'ВИДЕО', audio: 'АУДИО', model: '3D', link: 'URL', file: 'DOC', gif: 'GIF' }

// Превью для сеток (чат, библиотека)
export function Thumb({ m, onClick, big }) {
  const c = mediaCat(m)
  const cls = 'thumb t-' + c + (big ? ' big' : '')
  if (m.kind === 'image') return <div className={cls} onClick={onClick} title={m.name}><Img m={m} />{c === 'gif' && <i className="t-tag">GIF</i>}</div>
  if (m.kind === 'video' && big) return <div className={cls} onClick={onClick} title={m.name}><VideoThumb m={m} /><i className="t-play" /></div>
  if (m.kind === 'link' && big && m.link?.thumb) return <div className={cls} onClick={onClick} title={m.name}><img src={m.link.thumb} alt="" referrerPolicy="no-referrer" /><i className="t-tag"><Favicon host={m.link.host} />{m.link.provider === 'web' ? 'URL' : m.link.provider}</i></div>
  if (m.kind === 'link' && big) return <div className={cls + ' ic'} onClick={onClick} title={m.url}><Favicon host={m.link?.host} /><b>URL</b></div>
  if (m.kind === 'audio' && big) return <div className={cls + ' ic'} onClick={onClick} title={m.name}><span className="t-wave">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: 4 + Math.abs(Math.sin(i * 1.9) * Math.cos(i * .5)) * 22 }} />)}</span></div>
  return <div className={cls + ' ic'} onClick={onClick} title={m.name}><b>{LBL[c] || 'DOC'}</b>{big && <span className="t-ext">{(m.name || '').split('.').pop().slice(0, 5)}</span>}</div>
}

export function useAutoGrow(value) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [value])
  return ref
}