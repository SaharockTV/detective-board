import React, { memo } from 'react'
import { Img, VideoThumb, Model } from '../components/Media'
import { initials } from '../lib/util'

const STAMP_TEXT = { secret: ['СЕКРЕТНО', '#b91c1c'], ok: ['ПОДТВЕРЖДЕНО', '#15803d'], lie: ['ЛОЖЬ', '#b91c1c'], checked: ['ПРОВЕРЕНО', '#1d4ed8'], alibi: ['АЛИБИ', '#7c3aed'], closed: ['ЗАКРЫТО', '#334155'] }

const firstImg = (it) => it.media?.find(m => m.kind === 'image')
const ofKind = (it, k) => it.media?.find(m => m.kind === k)

function Photo({ it, cls = 'ph' }) {
  const m = firstImg(it)
  return <div className={cls}>{m ? <Img m={m} /> : <div className="img-ph"><span>фото не прикреплено</span></div>}</div>
}

function Text({ it, cls = 'tx' }) {
  return it.text ? <div className={cls}>{it.text}</div> : null
}

const fmtD = (t) => new Date(t || Date.now()).toLocaleDateString('ru-RU')
const caseNo = () => (location.pathname.split('/b/')[1] || '').toUpperCase()

function Faces({ it }) {
  switch (it.type) {
    case 'polaroid': return <><div className="gloss-wrap"><Photo it={it} cls="pol-photo" /></div><div className="pol-cap pen">{it.title}</div></>
    case 'photo': return <><Photo it={it} cls="photo-img" />{it.title && <div className="photo-cap pen">{it.title}</div>}</>
    case 'torn': return <><div className="spiral" /><div className="pen title">{it.title}</div><Text it={it} cls="pen tx" /></>
    case 'sticky': return <div className="pen big">{it.title && <b>{it.title}<br /></b>}{it.text}</div>
    case 'index': return <><div className="pen title">{it.title}</div><Text it={it} cls="pen tx" /></>
    case 'suspect': return (
      <>
        <div className="sus-photo-wrap"><Photo it={it} cls="sus-photo" /><i className="paperclip" /></div>
        <div className="sus-body">
          <div className="sus-head">УСТАНОВОЧНЫЕ ДАННЫЕ</div>
          <div className="sus-name">{it.title}</div>
          {(it.fields || []).map(([k, v], i) => <div className="sus-f" key={i}><span>{k}</span><b className="pen">{v}</b></div>)}
        </div>
      </>
    )
    case 'newspaper': {
      const m = it.media?.find(m => m.kind === 'image' && m.id !== 'art')
      return <><div className="np-mast"><span>ПЕЧАТНЫЙ ИСТОЧНИК</span><span>{fmtD(it.created)}</span></div><div className="np-head">{it.title}</div>{m && <Img m={m} className="np-img" />}<Text it={it} cls="np-text" /></>
    }
    case 'report': return <><div className="rp-head"><span>Дело № {caseNo()}</span><span>Лист 1</span></div><div className="rp-title">{it.title}</div><Text it={it} cls="rp-text" /><div className="rp-sign">Подпись ____________</div></>
    case 'evidence': return (
      <>
        <div className="ev-seal">ВЕЩЕСТВЕННОЕ ДОКАЗАТЕЛЬСТВО</div>
        <div className="ev-win"><Photo it={it} cls="ev-photo" /></div>
        <div className="ev-label">
          <div><span>Дело №</span><b>{caseNo()}</b></div>
          <div><span>Описание</span><b className="pen">{it.title}</b></div>
          <div><span>Изъято</span><b className="pen">{fmtD(it.created)}</b></div>
        </div>
      </>
    )
    case 'map': return <><Photo it={it} cls="map-img" /><div className="map-folds" /><div className="map-cap pen">{it.title}</div></>
    case 'receipt': return <><div className="rc-head">{it.title}</div><Text it={it} cls="rc-text" /><div className="rc-zig" /></>
    case 'folder': return <><div className="fd-tab">{it.title}</div><div className="fd-body"><div className="fd-num">Дело № {caseNo()}</div><div className="fd-title pen">{it.title}</div><Text it={it} cls="fd-text pen" />{it.media?.length > 0 && <div className="fd-files">Вложений: {it.media.length}</div>}</div></>
    case 'audio': {
      const a = ofKind(it, 'audio')
      return (
        <>
          <div className="au-head"><span>АУДИОЗАПИСЬ</span><span>{fmtD(it.created)}</span></div>
          <div className="au-title pen">{it.title}</div>
          <div className="au-wave">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: 8 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * .45)) * 34 + 'px' }} />)}</div>
          <div className="au-file">{a ? '▶ ' + a.name : 'файл не прикреплён'}</div>
        </>
      )
    }
    case 'video': {
      const v = ofKind(it, 'video')
      return <><div className="cctv">{v ? <VideoThumb m={v} /> : <div className="cctv-empty">НЕТ ЗАПИСИ</div>}<div className="cctv-osd"><span>CAM 01</span><span>{new Date(it.created || Date.now()).toLocaleString('ru-RU')}</span></div>{v && <div className="cctv-play">▶</div>}</div><div className="cctv-cap pen">{it.title}</div></>
    }
    case 'model': {
      const m = ofKind(it, 'model')
      return <><div className="md-box">{m ? <Model m={m} interactive={false} /> : <div className="md-empty">3D<small>загрузите .glb</small></div>}</div><div className="md-cap">{it.title}</div></>
    }
    case 'tent': return <div className="tent"><div className="tent-face"><b>{it.num || '?'}</b></div><div className="tent-side" /></div>
    case 'question': return <div className="q-mark pen">{it.title || '?'}<small>{it.text}</small></div>
    default: return <div className="pen">{it.title}</div>
  }
}

function Card({ it, x, y, w, h, rot, owner, selected, dim, showHandles, appends, lifted }) {
  const now = Date.now()
  const extra = (it.media || []).filter(m => m.id !== 'art')
  const showClip = !['polaroid', 'photo', 'suspect', 'evidence', 'map', 'video', 'audio', 'model', 'newspaper', 'tent'].includes(it.type) && extra.some(m => m.kind === 'image')
  return (
    <div
      className={`card c-${it.type}${it.pin ? ' pinned' : ' loose'}${selected ? ' sel' : ''}${dim ? ' dim' : ''}${lifted ? ' lifted' : ''}`}
      data-item={it.id}
      style={{ left: x, top: y, width: w, height: h, transform: `rotate(${rot}deg)`, zIndex: selected ? 99999 : undefined, '--own': owner?.color || '#888' }}
    >
      <Faces it={it} />
      {showClip && <div className="clip-photo"><Img m={extra.find(m => m.kind === 'image')} /></div>}
      {appends?.length > 0 && ['torn', 'sticky', 'index', 'report', 'folder', 'receipt'].includes(it.type) && (
        <div className="appends pen">
          {appends.slice(0, 2).map(a => <div key={a.id} style={{ color: a.color }}>+ {a.text}</div>)}
        </div>
      )}
      {it.uv && <div className="uv-ink">{it.uv}</div>}
      {(it.marks || []).map(m => m.t === 'tape'
        ? <div key={m.id} data-mark={it.id + '|' + m.id} className={'mark tape-m' + (now - m.ts < 1500 ? ' fresh' : '')} style={{ left: m.x * 100 + '%', top: m.y * 100 + '%', '--r': m.rot + 'deg' }} />
        : <div key={m.id} data-mark={it.id + '|' + m.id} className={'mark stamp-m' + (now - m.ts < 1500 ? ' fresh' : '')} style={{ left: m.x * 100 + '%', top: m.y * 100 + '%', '--r': m.rot + 'deg', '--sc': STAMP_TEXT[m.k]?.[1] || '#b91c1c' }}>{STAMP_TEXT[m.k]?.[0] || m.k}</div>)}
      <div className="own-chip" title={'Автор: ' + (owner?.name || '?')}>{initials(owner?.name)}</div>
      {extra.length > 0 && <div className="att-badge">+{extra.length}</div>}
      {showHandles && <>
        <div className="h-resize" data-handle="resize" />
        <div className="h-rotate" data-handle="rotate" title="Повернуть" />
      </>}
    </div>
  )
}
export default memo(Card)