import React, { memo } from 'react'
import { Img, VideoThumb, Model } from '../components/Media'
import { initials } from '../lib/util'

const firstImg = (it) => it.media?.find(m => m.kind === 'image')
const ofKind = (it, k) => it.media?.find(m => m.kind === k)

function Photo({ it, cls = 'ph' }) {
  const m = firstImg(it)
  return <div className={cls}>{m ? <Img m={m} /> : <div className="img-ph"><span>перетащите фото</span></div>}</div>
}

function Text({ it, cls = 'tx' }) {
  return it.text ? <div className={cls}>{it.text}</div> : null
}

function Faces({ it }) {
  switch (it.type) {
    case 'polaroid': return <><Photo it={it} cls="pol-photo" /><div className="pol-cap">{it.title}</div></>
    case 'photo': return <><Photo it={it} cls="photo-img" /><div className="tape t1" />{it.title && <div className="photo-cap">{it.title}</div>}</>
    case 'torn': return <><div className="torn-edge" /><div className="hand title">{it.title}</div><Text it={it} cls="hand tx" /></>
    case 'sticky': return <><div className="sticky-fold" /><div className="hand big">{it.title && <b>{it.title}<br /></b>}{it.text}</div></>
    case 'index': return <><div className="hand title">{it.title}</div><Text it={it} cls="hand tx" /></>
    case 'suspect': return (
      <>
        <Photo it={it} cls="sus-photo" />
        <div className="sus-body">
          <div className="sus-head">ПОДОЗРЕВАЕМЫЙ</div>
          <div className="sus-name">{it.title}</div>
          {(it.fields || []).map(([k, v], i) => <div className="sus-f" key={i}><span>{k}:</span> <b>{v}</b></div>)}
        </div>
        <div className="stamp-red">РОЗЫСК</div>
      </>
    )
    case 'newspaper': {
      const m = it.media?.find(m => m.kind === 'image' && m.id !== 'art')
      return <><div className="np-mast">ГОРОДСКИЕ ВЕСТИ · {new Date(it.created || Date.now()).toLocaleDateString('ru-RU')}</div><div className="np-head">{it.title}</div>{m && <Img m={m} className="np-img" />}<Text it={it} cls="np-text" /></>
    }
    case 'report': return <><div className="rp-head">ОТДЕЛ РАССЛЕДОВАНИЙ</div><div className="rp-title">{it.title}</div><Text it={it} cls="rp-text" /><div className="stamp-red sm">СЕКРЕТНО</div></>
    case 'evidence': return <><div className="ev-zip" /><Photo it={it} cls="ev-photo" /><div className="ev-label"><span>ВЕЩДОК</span>{it.title}</div></>
    case 'map': return <><Photo it={it} cls="map-img" /><div className="map-folds" /><div className="map-cap">{it.title}</div></>
    case 'receipt': return <><div className="rc-head">{it.title}</div><Text it={it} cls="rc-text" /><div className="rc-zig" /></>
    case 'folder': return <><div className="fd-tab">{it.title}</div><div className="fd-body"><div className="fd-title">{it.title}</div><Text it={it} cls="fd-text" />{it.media?.length > 0 && <div className="fd-files">📎 {it.media.length} файл(ов)</div>}</div></>
    case 'audio': return (
      <div className="cassette">
        <div className="cs-label">{it.title}</div>
        <div className="cs-window"><i className="reel" /><i className="reel" /></div>
        <div className="cs-bottom">{ofKind(it, 'audio') ? '▶ ' + ofKind(it, 'audio').name : 'нет записи'}</div>
      </div>
    )
    case 'video': {
      const v = ofKind(it, 'video')
      return <><div className="tv"><div className="tv-screen">{v ? <VideoThumb m={v} /> : <div className="tv-noise">НЕТ СИГНАЛА</div>}<div className="tv-rec">● REC</div>{v && <div className="tv-play">▶</div>}</div></div><div className="tv-cap">{it.title}</div></>
    }
    case 'model': {
      const m = ofKind(it, 'model')
      return <><div className="md-box">{m ? <Model m={m} interactive={false} /> : <div className="md-empty">3D<br /><small>загрузите .glb</small></div>}</div><div className="md-cap">{it.title}</div></>
    }
    case 'question': return <div className="q-mark">{it.title || '?'}<small>{it.text}</small></div>
    default: return <div className="hand">{it.title}</div>
  }
}

function Card({ it, x, y, w, h, rot, owner, selected, dim, showHandles, appends }) {
  const extra = (it.media || []).filter(m => m.id !== 'art')
  const showClip = !['polaroid', 'photo', 'suspect', 'evidence', 'map', 'video', 'audio', 'model', 'newspaper'].includes(it.type) && extra.some(m => m.kind === 'image')
  return (
    <div
      className={`card c-${it.type}${it.pin ? ' pinned' : ' loose'}${selected ? ' sel' : ''}${dim ? ' dim' : ''}`}
      data-item={it.id}
      style={{ left: x, top: y, width: w, height: h, transform: `rotate(${rot}deg)`, zIndex: selected ? 99999 : undefined, '--own': owner?.color || '#888' }}
    >
      <Faces it={it} />
      {showClip && <div className="clip-photo"><Img m={extra.find(m => m.kind === 'image')} /></div>}
      {appends?.length > 0 && ['torn', 'sticky', 'index', 'report', 'folder', 'receipt'].includes(it.type) && (
        <div className="appends">
          {appends.slice(0, 2).map(a => <div key={a.id} style={{ color: a.color }}>+ {a.text}</div>)}
        </div>
      )}
      <div className="own-chip" title={'Автор: ' + (owner?.name || '?')}>{initials(owner?.name)}</div>
      {extra.length > 0 && <div className="att-badge">📎{extra.length}</div>}
      {showHandles && <>
        <div className="h-resize" data-handle="resize" />
        <div className="h-rotate" data-handle="rotate" title="Повернуть" />
      </>}
    </div>
  )
}
export default memo(Card)