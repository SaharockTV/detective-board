import React, { useEffect, useMemo, useRef, useState } from 'react'
import Card from './Card'
import { ChalkBoard } from '../components/Chalk'
import Ghost, { DESTROY } from './Destroy'
import { pinWorld, itemPins, worldToLocal, clamp, THREADS, throttle, uid } from '../lib/util'

export const PENS = {
  red: { name: 'Красный маркер', color: '#c1121f', width: 5 },
  black: { name: 'Чёрный маркер', color: '#1b1b1b', width: 4 },
  blue: { name: 'Синяя ручка', color: '#1d4ed8', width: 3 },
  hl: { name: 'Жёлтый выделитель', color: '#ffe600', width: 22, alpha: .45 },
  chalk: { name: 'Мел', color: '#f4f1e8', width: 6 },
}
export const STAMPS = {
  secret: { text: 'СЕКРЕТНО', color: '#b91c1c' },
  ok: { text: 'ПОДТВЕРЖДЕНО', color: '#15803d' },
  lie: { text: 'ЛОЖЬ', color: '#b91c1c' },
  checked: { text: 'ПРОВЕРЕНО', color: '#1d4ed8' },
  alibi: { text: 'АЛИБИ', color: '#7c3aed' },
  closed: { text: 'ЗАКРЫТО', color: '#334155' },
}
const SEL_TOOLS = new Set(['select', 'loupe', 'torch', 'uv'])

function strokePath(pts) {
  if (!pts?.length) return ''
  if (pts.length < 3) return `M${pts[0][0]},${pts[0][1]} L${pts[pts.length - 1][0] + .1},${pts[pts.length - 1][1]}`
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2
    d += ` Q${pts[i][0]},${pts[i][1]} ${mx.toFixed(1)},${my.toFixed(1)}`
  }
  const l = pts[pts.length - 1]
  return d + ` L${l[0]},${l[1]}`
}

const SIGN = { x: -380, y: -640, w: 760, h: 200 }

function threadPath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  const sag = Math.min(90, d * 0.13)
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag }
  return { d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`, mid: { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 } }
}

export default function Canvas(p) {
  const { items, threads, strokes = [], pen = 'red', stampKind = 'secret', members, me, tool, threadKind, canEdit, view, setView, selected, onSelect, actions, bus, send, isDim, title, signSub, onRenameTitle, layer, appends, spaceDown } = p
  const root = useRef(null)
  const g = useRef(null) // текущий жест
  const [local, setLocal] = useState({}) // мои перетаскивания
  const remote = useRef({})
  const [rv, force] = useState(0)
  const [pending, setPending] = useState(null) // { from, to }
  const [threadPop, setThreadPop] = useState(null)
  const viewRef = useRef(view); viewRef.current = view
  const lastSign = useRef(0)
  const [ghosts, setGhosts] = useState({})
  const [lifted, setLifted] = useState(null)
  const [drawing, setDrawing] = useState(null)
  const liveStrokes = useRef({})
  const [ptr, setPtr] = useState(null)
  const sel = SEL_TOOLS.has(tool)
  const optics = tool === 'loupe' || tool === 'torch' || tool === 'uv'

  // удалённые перетаскивания
  useEffect(() => bus.on((e) => {
    if (e.t === 'drag') { remote.current[e.id] = e; force(v => v + 1) }
    else if (e.t === 'rowapplied' && remote.current[e.row.id]) { delete remote.current[e.row.id]; force(v => v + 1) }
    else if (e.t === 'rowapplied' && liveStrokes.current[e.row.id]) { delete liveStrokes.current[e.row.id]; force(v => v + 1) }
    else if (e.t === 'sl') { liveStrokes.current[e.id] = e; force(v => v + 1) }
    else if (e.t === 'destroy' && e.it) {
      const key = e.id + ':' + Date.now()
      setGhosts(g => ({ ...g, [e.id]: { ...e, key } }))
      setTimeout(() => setGhosts(g => { if (g[e.id]?.key !== key) return g; const n = { ...g }; delete n[e.id]; return n }), (DESTROY[e.mode]?.ms || 2500) + 200)
    }
  }), [bus])

  const shown = useMemo(() => items.filter(it => !ghosts[it.id]).map(it => ({ ...it, ...(remote.current[it.id] ? pick(remote.current[it.id]) : null), ...(local[it.id] || null) })), [items, local, rv, ghosts])
  const byId = useMemo(() => Object.fromEntries(shown.map(i => [i.id, i])), [shown])

  const toWorld = (e) => {
    const r = root.current.getBoundingClientRect(), v = viewRef.current
    return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }
  }

  const sendDrag = useMemo(() => throttle((d) => send({ t: 'drag', ...d }), 45), [send])
  const sendCursor = useMemo(() => throttle((c) => send({ t: 'cursor', ...c }), 50), [send])
  const sendLive = useMemo(() => throttle((d) => send({ t: 'sl', ...d }), 90), [send])

  // колесо: масштаб вокруг курсора; тачпад-скролл — панорама
  useEffect(() => {
    const el = root.current
    const onWheel = (e) => {
      if (e.target.closest('.no-wheel')) return
      e.preventDefault()
      const v = viewRef.current
      const r = el.getBoundingClientRect()
      const isPinch = e.ctrlKey
      const isMouse = (Math.abs(e.deltaY) >= 50 && e.deltaX === 0) || e.deltaMode === 1
      if (!isPinch && !isMouse) { setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }); return }
      const k = Math.exp(-e.deltaY * (isPinch ? 0.01 : 0.0015))
      const z = clamp(v.z * k, 0.12, 3)
      const mx = e.clientX - r.left, my = e.clientY - r.top
      setView({ z, x: mx - (mx - v.x) * (z / v.z), y: my - (my - v.y) * (z / v.z) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function eraseAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const st = el?.closest?.('[data-stroke]'), mk = el?.closest?.('[data-mark]')
    if (st) actions.deleteStroke(st.dataset.stroke)
    else if (mk) { const [iid, mid] = mk.dataset.mark.split('|'); actions.removeMark(iid, mid) }
  }

  const pts = useRef(new Map()) // активные касания для щипка
  function onDown(e) {
    if (e.button === 2) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      // два пальца: масштаб + панорама, отменяем текущий жест
      if (g.current?.id) setLocal(l => { const n = { ...l }; delete n[g.current.id]; return n })
      const [a, b] = [...pts.current.values()]
      g.current = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v: viewRef.current }
      root.current.setPointerCapture?.(e.pointerId)
      return
    }
    if (pts.current.size > 2) return
    setThreadPop(null)
    const w = toWorld(e)
    const pinEl = e.target.closest('[data-pin]')
    const markEl = e.target.closest('[data-mark]')
    const handle = e.target.closest('[data-handle]')
    const itemEl = e.target.closest('[data-item]')
    const threadEl = e.target.closest('[data-thread]')
    root.current.setPointerCapture?.(e.pointerId)

    if (e.button === 1 || tool === 'hand' || spaceDown) { g.current = { type: 'pan', sx: e.clientX, sy: e.clientY, v: viewRef.current }; return }

    if (canEdit && ((pinEl && !pending && (sel || tool === 'pin')) || (markEl && (sel || tool === 'stamp' || tool === 'tape')))) {
      const [id, mid] = markEl ? markEl.dataset.mark.split('|') : [pinEl.dataset.pin, pinEl.dataset.pinId]
      const it = byId[id]
      const point = markEl ? it?.marks?.find(m => m.id === mid) : itemPins(it).find(p => p.id === mid)
      if (point) {
        g.current = { type: markEl ? 'mark' : 'pinMove', id, mid, sw: w, it: { ...it }, start: worldToLocal(it, w), point, moved: false }
        return
      }
    }
    if (tool === 'draw' && canEdit) {
      const P = PENS[pen] || PENS.red
      g.current = { type: 'draw', id: uid(), pen, color: P.color, width: P.width, alpha: P.alpha || 1, pts: [[Math.round(w.x), Math.round(w.y)]] }
      setDrawing({ ...g.current })
      return
    }
    if (tool === 'erase' && canEdit) { g.current = { type: 'erase' }; eraseAt(e); return }
    if ((tool === 'stamp' || tool === 'tape') && canEdit) {
      if (itemEl) {
        const id = itemEl.dataset.item, L = worldToLocal(byId[id], w)
        actions.addMark(id, { t: tool, k: tool === 'stamp' ? stampKind : 'tape', x: +clamp(L.x, 0, 1).toFixed(3), y: +clamp(L.y, 0, 1).toFixed(3), rot: Math.round(Math.random() * 30 - 15) })
      }
      g.current = null
      return
    }
    if (tool === 'tent' && canEdit) { actions.addTent(w); return }

    if (tool === 'thread' && canEdit) {
      const id = pinEl?.dataset.pin || itemEl?.dataset.item
      if (id && byId[id]) {
        const it = byId[id]
        if (!itemPins(it).length) actions.setPin(id, worldToLocal(it, w))
        const pid = pinEl?.dataset.pinId || itemPins(it)[0]?.id || 'legacy'
        if (!pending) setPending({ from: id, fromPin: pid, to: w })
        else if (pending.from !== id) {
          actions.addThread(pending.from, id, threadKind, pending.fromPin, pid)
          setPending(e.shiftKey ? { from: id, fromPin: pid, to: w } : null)
        }
        g.current = null
        return
      }
      if (pending) { setPending(null); return }
    }

    if (pending && sel) {
      const id = pinEl?.dataset.pin || itemEl?.dataset.item
      if (id && byId[id] && id !== pending.from) {
        if (!itemPins(byId[id]).length) actions.setPin(id, worldToLocal(byId[id], w))
        actions.addThread(pending.from, id, threadKind, pending.fromPin, pinEl?.dataset.pinId || itemPins(byId[id])[0]?.id || 'legacy')
      }
      setPending(null)
      return
    }

    if (threadEl && !itemEl) {
      const r = root.current.getBoundingClientRect()
      setThreadPop({ id: threadEl.dataset.thread, x: e.clientX - r.left, y: e.clientY - r.top })
      return
    }

    if (tool === 'pin' && itemEl && canEdit) {
      const id = itemEl.dataset.item
      actions.addPin(id, worldToLocal(byId[id], w))
      return
    }

    if (pinEl && sel && canEdit) {
      // клик по ушку иглы в режиме выбора — тоже начинает нить
      setPending({ from: pinEl.dataset.pin, to: w })
      return
    }

    if (itemEl) {
      const id = itemEl.dataset.item
      const it = byId[id]
      if (handle && canEdit) {
        g.current = { type: handle.dataset.handle, id, sw: w, it: { ...it } }
        return
      }
      g.current = { type: 'move', id, sw: w, it: { ...it }, moved: false, canMove: canEdit }
      return
    }
    g.current = { type: 'pan', sx: e.clientX, sy: e.clientY, v: viewRef.current, click: true, sign: !!e.target.closest('.board-sign') }
  }

  function onMove(e) {
    const w = toWorld(e)
    sendCursor({ id: me.id, name: me.name, color: me.color, layer, x: w.x, y: w.y })
    if (pending) setPending(pp => pp && { ...pp, to: w })
    if (optics) { const r = root.current.getBoundingClientRect(); setPtr({ x: e.clientX - r.left, y: e.clientY - r.top, wx: w.x, wy: w.y }) }
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const s = g.current
    if (!s) return
    if (s.type === 'pinch') {
      if (pts.current.size < 2) return
      const [a, b] = [...pts.current.values()]
      const r = root.current.getBoundingClientRect()
      const d = Math.hypot(a.x - b.x, a.y - b.y), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const z = clamp(s.v.z * d / s.d, 0.12, 3)
      const ox = s.c.x - r.left, oy = s.c.y - r.top
      const wx = (ox - s.v.x) / s.v.z, wy = (oy - s.v.y) / s.v.z
      setView({ z, x: c.x - r.left - wx * z, y: c.y - r.top - wy * z })
      return
    }
    if (s.type === 'draw') {
      const l = s.pts[s.pts.length - 1]
      if (Math.hypot(w.x - l[0], w.y - l[1]) < 2.5 / viewRef.current.z) return
      s.pts.push([Math.round(w.x), Math.round(w.y)])
      setDrawing({ ...s, pts: s.pts.slice() })
      sendLive({ id: s.id, layer, color: s.color, width: s.width, alpha: s.alpha, pts: s.pts })
      return
    }
    if (s.type === 'erase') { eraseAt(e); return }
    if (s.type === 'mark' || s.type === 'pinMove') {
      if (Math.hypot(w.x - s.sw.x, w.y - s.sw.y) < 4 / viewRef.current.z && !s.moved) return
      s.moved = true
      const L = worldToLocal(s.it, w)
      s.position = { x: +clamp(s.point.x + L.x - s.start.x, .03, .97).toFixed(4), y: +clamp(s.point.y + L.y - s.start.y, .03, .97).toFixed(4) }
      const patch = s.type === 'mark'
        ? { marks: (s.it.marks || []).map(m => m.id === s.mid ? { ...m, ...s.position } : m) }
        : s.mid === 'legacy' ? { pin: { ...s.it.pin, ...s.position } } : { pins: (s.it.pins || []).map(p => p.id === s.mid ? { ...p, ...s.position } : p) }
      setLocal(l => ({ ...l, [s.id]: patch }))
      sendDrag({ id: s.id, ...patch })
      return
    }
    if (s.type === 'pan') {
      const dx = e.clientX - s.sx, dy = e.clientY - s.sy
      if (Math.abs(dx) + Math.abs(dy) > 3) s.click = false
      setView({ ...s.v, x: s.v.x + dx, y: s.v.y + dy })
      return
    }
    const dx = w.x - s.sw.x, dy = w.y - s.sw.y
    let patch
    if (s.type === 'move') {
      if (Math.abs(dx) + Math.abs(dy) > 3 / viewRef.current.z) {
        if (!s.moved && s.canMove) { actions.raise(s.id); setLifted(s.id) }
        s.moved = true
      }
      if (!s.canMove || !s.moved) return
      patch = { x: Math.round(s.it.x + dx), y: Math.round(s.it.y + dy) }
    } else if (s.type === 'resize') {
      patch = { w: Math.round(Math.max(110, s.it.w + dx)), h: Math.round(Math.max(90, s.it.h + dy)) }
    } else if (s.type === 'rotate') {
      const cx = s.it.x + s.it.w / 2, cy = s.it.y + s.it.h / 2
      let a = Math.atan2(w.y - cy, w.x - cx) * 180 / Math.PI + 90
      if (a > 180) a -= 360
      if (e.shiftKey) a = Math.round(a / 15) * 15
      patch = { rot: +a.toFixed(1) }
    }
    s.patch = patch
    setLocal(l => ({ ...l, [s.id]: patch }))
    sendDrag({ id: s.id, ...patch })
  }

  function onUp(e) {
    pts.current.delete(e?.pointerId)
    const s = g.current
    if (s?.type === 'pinch') { if (pts.current.size === 0) g.current = null; return }
    g.current = null
    if (!s) return
    setLifted(null)
    if (e?.type === 'pointercancel') {
      setDrawing(null)
      if (s.id) {
        setLocal(l => { const n = { ...l }; delete n[s.id]; return n })
        if (s.type === 'mark' || s.type === 'pinMove') sendDrag({ id: s.id, pin: s.it.pin, pins: s.it.pins || [], marks: s.it.marks || [] })
      }
      return
    }
    if (s.type === 'mark' || s.type === 'pinMove') {
      if (s.moved && s.position) {
        if (s.type === 'mark') actions.moveMark(s.id, s.mid, s.position)
        else actions.movePin(s.id, s.mid, s.position)
      } else if (s.type === 'pinMove' && sel) setPending({ from: s.id, fromPin: s.mid, to: pinWorld(s.it, s.mid) })
      setLocal(l => { const n = { ...l }; delete n[s.id]; return n })
      return
    }
    if (s.type === 'draw') {
      setDrawing(null)
      if (s.pts.length > 1) actions.addStroke({ id: s.id, pen: s.pen, color: s.color, width: s.width, alpha: s.alpha, pts: s.pts })
      return
    }
    if (s.type === 'erase') return
    if (s.type === 'pan') {
      if (s.click) {
        if (s.sign) { if (Date.now() - lastSign.current < 450) onRenameTitle?.(); lastSign.current = Date.now() }
        onSelect(null)
      }
      return
    }
    if (s.patch) {
      actions.updateItem(s.id, s.patch)
      setTimeout(() => setLocal(l => { const n = { ...l }; delete n[s.id]; return n }), 0)
    }
    if (s.type === 'move' && !s.moved) onSelect(s.id)
  }

  // перетаскивание файлов и шаблонов на доску
  function onDrop(e) {
    e.preventDefault()
    const w = toWorld(e)
    const tpl = e.dataTransfer.getData('application/x-detective')
    if (tpl) {
      if (!canEdit) return
      const t = JSON.parse(tpl)
      const onCard = t.media && e.target.closest?.('[data-item]')?.dataset.item
      if (onCard) actions.attachMedia(onCard, [t.media]); else actions.addFromTray(t, w)
      return
    }
    if (e.dataTransfer.files?.length && canEdit) actions.dropFiles([...e.dataTransfer.files], w)
  }

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { setPending(null); setThreadPop(null) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  useEffect(() => { if (tool !== 'thread' && !SEL_TOOLS.has(tool)) setPending(null); if (!optics) setPtr(null) }, [tool])

  const v = view
  const scene = (lens) => (
    <>
        {shown.map(it => (
          <Card key={it.id} it={it} lifted={!lens && lifted === it.id} x={it.x} y={it.y} w={it.w} h={it.h} rot={it.rot || 0}
            owner={members[it.owner]} selected={selected === it.id} dim={isDim(it)}
            showHandles={selected === it.id && canEdit && tool === 'select'} appends={appends[it.id]} />
        ))}

        <svg className="strokes" width="1" height="1">
          {strokes.map(st => (
            <path key={st.id} data-stroke={st.id} className={'stroke p-' + st.pen + (isDim(st) ? ' dim' : '')} d={strokePath(st.pts)} stroke={st.color} strokeWidth={st.width} strokeOpacity={st.alpha || 1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {!lens && Object.values(liveStrokes.current).filter(l => l.layer === layer).map(l => (
            <path key={l.id} d={strokePath(l.pts)} stroke={l.color} strokeWidth={l.width} strokeOpacity={l.alpha || 1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {!lens && drawing && <path d={strokePath(drawing.pts)} className={'stroke p-' + drawing.pen} stroke={drawing.color} strokeWidth={drawing.width} strokeOpacity={drawing.alpha} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>

        <svg className="threads" width="1" height="1">
          <defs>
            <filter id="thr-sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8" /></filter>
          </defs>
          {threads.map(t => {
            const A = byId[t.a] && pinWorld(byId[t.a], t.aPin), B = byId[t.b] && pinWorld(byId[t.b], t.bPin)
            if (!A || !B) return null
            const { d, mid } = threadPath(A, B)
            const col = THREADS[t.kind]?.color || '#c00'
            return (
              <g key={t.id} className={'thread' + (isDim(t) ? ' dim' : '') + (threadPop?.id === t.id ? ' on' : '')} data-thread={t.id}>
                <path d={d} className="tdraw" pathLength="1" transform="translate(3 6)" stroke="rgba(0,0,0,.32)" strokeWidth="2.6" fill="none" filter="url(#thr-sh)" />
                <path d={d} className="tdraw" pathLength="1" stroke={col} strokeWidth="2.6" fill="none" strokeLinecap="round" />
                <path d={d} className="yarn" stroke="rgba(0,0,0,.38)" strokeWidth="2.6" fill="none" strokeDasharray="1.3 2.2" />
                <path d={d} className="yarn" stroke="rgba(255,255,255,.22)" strokeWidth=".8" fill="none" strokeDasharray="1 2.5" transform="translate(0 -.6)" />
                <path d={d} className="thread-hit" stroke="transparent" strokeWidth="16" fill="none" />
                {t.label && (
                  <foreignObject x={mid.x - 90} y={mid.y - 14} width="180" height="30" style={{ overflow: 'visible' }}>
                    <div className="thread-label" style={{ '--c': col }}>{t.label}</div>
                  </foreignObject>
                )}
              </g>
            )
          })}
          {!lens && pendingFrom && (
            <path d={threadPath(pendingFrom, pending.to).d} stroke={THREADS[threadKind].color} strokeWidth="3" fill="none" strokeDasharray="8 5" className="pending" />
          )}
        </svg>

        {shown.flatMap(it => itemPins(it).map(pin => {
          const P = pinWorld(it, pin.id)
          return (
            <div key={it.id + ':' + pin.id} className={'pin' + (isDim(it) ? ' dim' : '') + (pending?.from === it.id && pending?.fromPin === pin.id ? ' active' : '')} data-pin={it.id} data-pin-id={pin.id}
              style={{ left: P.x, top: P.y, '--pc': members[it.owner]?.color || '#d62828' }} title="Потяните, чтобы переместить. Клик — протянуть нить">
              <svg width="34" height="44" viewBox="0 0 34 44">
                <ellipse cx="24" cy="38" rx="7" ry="2.6" fill="rgba(0,0,0,.32)" filter="url(#pinBlur)" />
                <path d="M17 20 L21.5 37" stroke="url(#pinSteel)" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M11 16.5 Q17 21 23 16.5 L22 12 L12 12 Z" fill="var(--pc)" />
                <path d="M11 16.5 Q17 21 23 16.5 L22 12 L12 12 Z" fill="url(#pinShade)" />
                <ellipse cx="17" cy="11" rx="8.5" ry="5" fill="var(--pc)" />
                <ellipse cx="17" cy="11" rx="8.5" ry="5" fill="url(#pinTop)" />
                <ellipse cx="14" cy="9.5" rx="3.2" ry="1.4" fill="rgba(255,255,255,.55)" />
              </svg>
            </div>
          )
        }))}
        <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
          <linearGradient id="pinShade" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></linearGradient>
          <radialGradient id="pinTop" cx="38%" cy="35%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></radialGradient>
          <linearGradient id="pinSteel" x1="0" x2="1"><stop offset="0" stopColor="#e9edf0" /><stop offset="1" stopColor="#7d858c" /></linearGradient>
          <filter id="pinBlur"><feGaussianBlur stdDeviation="1.2" /></filter>
        </defs></svg>

    </>
  )
  const bgSize = 560 * v.z
  const pendingFrom = pending && byId[pending.from] && pinWorld(byId[pending.from], pending.fromPin)
  const tp = threadPop && threads.find(t => t.id === threadPop.id)

  return (
    <div
      ref={root}
      className={`canvas tool-${spaceDown ? 'hand' : tool}${pending ? ' threading' : ''}${tool === 'uv' ? ' uv-on' : ''}`}
      style={{ backgroundPosition: `${v.x}px ${v.y}px`, backgroundSize: `${bgSize}px ${bgSize}px` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => optics && setPtr(null)}
      onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="world" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.z})` }}>
        <div className="board-sign" style={{ left: SIGN.x, top: SIGN.y, width: SIGN.w, height: SIGN.h }}>
          <ChalkBoard title={title} subtitle={signSub} onEdit={onRenameTitle} />
        </div>

        {ghosts && Object.values(ghosts).filter(g => (g.it.layer || 'main') === layer).map(g => <Ghost key={g.key} g={g} owner={members[g.it.owner]} />)}
        {scene(false)}
        <Cursors bus={bus} layer={layer} me={me} z={v.z} />
      </div>

      {tool === 'loupe' && ptr && (() => {
        const Z = v.z * 2.4, R = 130
        return (
          <div className="loupe" style={{ left: ptr.x - R, top: ptr.y - R, width: R * 2, height: R * 2 }}>
            <div className="loupe-bg" style={{ backgroundPosition: `${R - ptr.wx * Z}px ${R - ptr.wy * Z}px`, backgroundSize: `${560 * Z}px ${560 * Z}px` }} />
            <div className="world" style={{ transform: `translate(${R - ptr.wx * Z}px, ${R - ptr.wy * Z}px) scale(${Z})` }}>{scene(true)}</div>
            <i className="loupe-glass" />
          </div>
        )
      })()}
      {(tool === 'torch' || tool === 'uv') && <div className={'darkness ' + tool} style={{ '--px': (ptr ? ptr.x : -999) + 'px', '--py': (ptr ? ptr.y : -999) + 'px' }} />}

      {pending && <div className="hint-bar">Нить «{THREADS[threadKind].name}»: кликните по следующей булавке или материалу · Shift — цепочка · Esc — отмена</div>}
      {!pending && tool === 'pin' && <div className="hint-bar">Клик по материалу — новая булавка. Потяните за булавку, чтобы передвинуть её</div>}
      {!pending && tool === 'thread' && <div className="hint-bar">Нить: кликните по булавке, затем по следующей</div>}
      {tool === 'erase' && <div className="hint-bar">Ластик: проведите по пометке, штампу или скотчу</div>}
      {tool === 'tent' && <div className="hint-bar">Метка: кликните по доске, чтобы поставить нумерованную табличку</div>}
      {tool === 'uv' && <div className="hint-bar uv">УФ-лампа: проявляет скрытые пометки</div>}

      {tp && (
        <div className="thread-pop" style={{ left: threadPop.x, top: threadPop.y }} onPointerDown={e => e.stopPropagation()}>
          <div className="tp-row">
            {Object.entries(THREADS).map(([k, t]) => (
              <button key={k} disabled={!canEdit} className={'tk' + (tp.kind === k ? ' on' : '')} style={{ '--c': t.color }} onClick={() => actions.updateThread(tp.id, { kind: k })}>{t.short}</button>
            ))}
          </div>
          <input disabled={!canEdit} placeholder="подпись нити…" defaultValue={tp.label} key={tp.id}
            onKeyDown={e => { if (e.key === 'Enter') { actions.updateThread(tp.id, { label: e.target.value }); setThreadPop(null) } }}
            onBlur={e => e.target.value !== (tp.label || '') && actions.updateThread(tp.id, { label: e.target.value })} />
          <div className="tp-meta">Связь добавил(а): <b style={{ color: members[tp.owner]?.color }}>{members[tp.owner]?.name || '?'}</b></div>
          {canEdit && <button className="tk del" onClick={() => { actions.deleteThread(tp.id); setThreadPop(null) }}>Снять нить</button>}
        </div>
      )}
    </div>
  )
}

function pick(d) {
  const o = {}
  for (const k of ['x', 'y', 'w', 'h', 'rot', 'pin', 'pins', 'marks']) if (d[k] !== undefined) o[k] = d[k]
  return o
}

function Cursors({ bus, layer, me, z }) {
  const [cs, setCs] = useState({})
  useEffect(() => bus.on((e) => {
    if (e.t === 'cursor' && e.id !== me.id) setCs(c => ({ ...c, [e.id]: { ...e, ts: Date.now() } }))
  }), [bus])
  useEffect(() => {
    const iv = setInterval(() => setCs(c => {
      const n = {}; let ch = false
      for (const k in c) { if (Date.now() - c[k].ts < 6000) n[k] = c[k]; else ch = true }
      return ch ? n : c
    }), 2000)
    return () => clearInterval(iv)
  }, [])
  return Object.values(cs).filter(c => c.layer === layer).map(c => (
    <div key={c.id} className="cursor" style={{ left: c.x, top: c.y, transform: `scale(${1 / z})`, '--c': c.color }}>
      <svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1 L1 17 L5.5 13 L8.5 20.5 L11.5 19.2 L8.6 12 L15 12 Z" fill="var(--c)" stroke="#fff" strokeWidth="1.4" /></svg>
      <span>{c.name}</span>
    </div>
  ))
}