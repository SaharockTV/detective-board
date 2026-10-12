import React, { useEffect, useMemo, useRef, useState } from 'react'
import Card from './Card'
import { ChalkBoard } from '../components/Chalk'
import { pinWorld, worldToLocal, clamp, THREADS, throttle } from '../lib/util'

const SIGN = { x: -380, y: -640, w: 760, h: 200 }

function threadPath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  const sag = Math.min(90, d * 0.13)
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag }
  return { d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`, mid: { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 } }
}

export default function Canvas(p) {
  const { items, threads, members, me, tool, threadKind, canEdit, view, setView, selected, onSelect, actions, bus, send, isDim, title, signSub, onRenameTitle, layer, appends, spaceDown } = p
  const root = useRef(null)
  const g = useRef(null) // текущий жест
  const [local, setLocal] = useState({}) // мои перетаскивания
  const remote = useRef({})
  const [rv, force] = useState(0)
  const [pending, setPending] = useState(null) // { from, to }
  const [threadPop, setThreadPop] = useState(null)
  const viewRef = useRef(view); viewRef.current = view
  const lastSign = useRef(0)

  // удалённые перетаскивания
  useEffect(() => bus.on((e) => {
    if (e.t === 'drag') { remote.current[e.id] = e; force(v => v + 1) }
    else if (e.t === 'rowapplied' && remote.current[e.row.id]) { delete remote.current[e.row.id]; force(v => v + 1) }
  }), [bus])

  const shown = useMemo(() => items.map(it => ({ ...it, ...(remote.current[it.id] ? pick(remote.current[it.id]) : null), ...(local[it.id] || null) })), [items, local, rv])
  const byId = useMemo(() => Object.fromEntries(shown.map(i => [i.id, i])), [shown])

  const toWorld = (e) => {
    const r = root.current.getBoundingClientRect(), v = viewRef.current
    return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }
  }

  const sendDrag = useMemo(() => throttle((d) => send({ t: 'drag', ...d }), 45), [send])
  const sendCursor = useMemo(() => throttle((c) => send({ t: 'cursor', ...c }), 50), [send])

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
    const handle = e.target.closest('[data-handle]')
    const itemEl = e.target.closest('[data-item]')
    const threadEl = e.target.closest('[data-thread]')
    root.current.setPointerCapture?.(e.pointerId)

    if (e.button === 1 || tool === 'hand' || spaceDown) { g.current = { type: 'pan', sx: e.clientX, sy: e.clientY, v: viewRef.current }; return }

    if (tool === 'thread' && canEdit) {
      const id = pinEl?.dataset.pin || itemEl?.dataset.item
      if (id && byId[id]) {
        const it = byId[id]
        if (!it.pin) actions.setPin(id, worldToLocal(it, w))
        if (!pending) setPending({ from: id, to: w })
        else if (pending.from !== id) {
          actions.addThread(pending.from, id, threadKind)
          setPending(e.shiftKey ? { from: id, to: w } : null)
        }
        g.current = null
        return
      }
      if (pending) { setPending(null); return }
    }

    if (pending && tool === 'select') {
      const id = pinEl?.dataset.pin || itemEl?.dataset.item
      if (id && byId[id] && id !== pending.from) {
        if (!byId[id].pin) actions.setPin(id, worldToLocal(byId[id], w))
        actions.addThread(pending.from, id, threadKind)
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
      actions.setPin(id, worldToLocal(byId[id], w))
      return
    }

    if (pinEl && tool === 'select' && canEdit) {
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
        if (!s.moved && s.canMove) actions.raise(s.id)
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
    if (tpl) { canEdit && actions.addFromTray(JSON.parse(tpl), w); return }
    if (e.dataTransfer.files?.length && canEdit) actions.dropFiles([...e.dataTransfer.files], w)
  }

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { setPending(null); setThreadPop(null) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  useEffect(() => { if (tool !== 'thread' && tool !== 'select') setPending(null) }, [tool])

  const v = view
  const bgSize = 560 * v.z
  const pendingFrom = pending && byId[pending.from] && pinWorld(byId[pending.from])
  const tp = threadPop && threads.find(t => t.id === threadPop.id)

  return (
    <div
      ref={root}
      className={`canvas tool-${spaceDown ? 'hand' : tool}${pending ? ' threading' : ''}`}
      style={{ backgroundPosition: `${v.x}px ${v.y}px`, backgroundSize: `${bgSize}px ${bgSize}px` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="world" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.z})` }}>
        <div className="board-sign" style={{ left: SIGN.x, top: SIGN.y, width: SIGN.w, height: SIGN.h }}>
          <ChalkBoard title={title} subtitle={signSub} onEdit={onRenameTitle} />
        </div>

        {shown.map(it => (
          <Card key={it.id} it={it} x={it.x} y={it.y} w={it.w} h={it.h} rot={it.rot || 0}
            owner={members[it.owner]} selected={selected === it.id} dim={isDim(it)}
            showHandles={selected === it.id && canEdit && tool === 'select'} appends={appends[it.id]} />
        ))}

        <svg className="threads" width="1" height="1">
          <defs>
            <filter id="thr-sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          {threads.map(t => {
            const A = byId[t.a] && pinWorld(byId[t.a]), B = byId[t.b] && pinWorld(byId[t.b])
            if (!A || !B) return null
            const { d, mid } = threadPath(A, B)
            const col = THREADS[t.kind]?.color || '#c00'
            return (
              <g key={t.id} className={'thread' + (isDim(t) ? ' dim' : '') + (threadPop?.id === t.id ? ' on' : '')} data-thread={t.id}>
                <path d={d} transform="translate(4 7)" stroke="rgba(0,0,0,.35)" strokeWidth="3" fill="none" filter="url(#thr-sh)" />
                <path d={d} stroke={col} strokeWidth="3.2" fill="none" strokeLinecap="round" />
                <path d={d} stroke="rgba(255,255,255,.35)" strokeWidth="1" fill="none" strokeDasharray="2 4" />
                <path d={d} className="thread-hit" stroke="transparent" strokeWidth="16" fill="none" />
                {t.label && (
                  <foreignObject x={mid.x - 90} y={mid.y - 14} width="180" height="30" style={{ overflow: 'visible' }}>
                    <div className="thread-label" style={{ '--c': col }}>{t.label}</div>
                  </foreignObject>
                )}
              </g>
            )
          })}
          {pendingFrom && (
            <path d={threadPath(pendingFrom, pending.to).d} stroke={THREADS[threadKind].color} strokeWidth="3" fill="none" strokeDasharray="8 5" className="pending" />
          )}
        </svg>

        {shown.filter(it => it.pin).map(it => {
          const P = pinWorld(it)
          return (
            <div key={it.id} className={'pin' + (isDim(it) ? ' dim' : '') + (pending?.from === it.id ? ' active' : '')} data-pin={it.id}
              style={{ left: P.x, top: P.y, '--pc': members[it.owner]?.color || '#d62828' }} title="Ушко иглы — кликните, чтобы тянуть нить">
              <svg width="34" height="44" viewBox="0 0 34 44">
                <ellipse cx="23" cy="39" rx="6" ry="2.4" fill="rgba(0,0,0,.35)" />
                <path d="M17 18 L23 38" stroke="#9aa3ab" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="17" cy="13" r="9" fill="var(--pc)" />
                <circle cx="17" cy="13" r="9" fill="url(#pinShade)" />
                <ellipse cx="14" cy="10" rx="3" ry="2.2" fill="rgba(255,255,255,.7)" />
                <circle cx="17" cy="13" r="2.4" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.3" />
              </svg>
            </div>
          )
        })}
        <svg width="0" height="0" style={{ position: 'absolute' }}><defs><radialGradient id="pinShade" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient></defs></svg>

        <Cursors bus={bus} layer={layer} me={me} z={v.z} />
      </div>

      {pending && <div className="hint-bar">Нить «{THREADS[threadKind].name}»: кликните по следующей игле или карточке · Shift — цепочка · Esc — отмена</div>}
      {!pending && tool === 'pin' && <div className="hint-bar">Игла: кликните по карточке в месте, где её приколоть</div>}
      {!pending && tool === 'thread' && <div className="hint-bar">Нить: кликните по ушку иглы, затем по следующей</div>}

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
          <div className="tp-meta">Протянул(а): <b style={{ color: members[tp.owner]?.color }}>{members[tp.owner]?.name || '?'}</b></div>
          {canEdit && <button className="tk del" onClick={() => { actions.deleteThread(tp.id); setThreadPop(null) }}>✂ Обрезать нить</button>}
        </div>
      )}
    </div>
  )
}

function pick(d) {
  const o = {}
  for (const k of ['x', 'y', 'w', 'h', 'rot']) if (d[k] !== undefined) o[k] = d[k]
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