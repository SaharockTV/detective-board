import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { getBackend } from './backend'
import { uid } from './util'
import { pushRecent } from './identity'

// Простой эмиттер для частых событий (курсоры, перетаскивание)
function emitter() {
  const subs = new Set()
  return { on(f) { subs.add(f); return () => subs.delete(f) }, emit(e) { subs.forEach(f => f(e)) } }
}

export function useBoard(code, me) {
  const [status, setStatus] = useState('loading')
  const [board, setBoard] = useState(null)
  const [ver, setVer] = useState(0)
  const [presence, setPresence] = useState([])
  const rows = useRef(new Map())
  const session = useRef(null)
  const backend = useRef(null)
  const bus = useRef(emitter()).current
  const meRef = useRef(me); meRef.current = me

  const bump = useMemo(() => {
    let raf = 0
    return () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setVer(v => v + 1) }) }
  }, [])

  const merge = useCallback((row) => {
    const cur = rows.current.get(row.id)
    if (cur && cur.updated_at > row.updated_at) return false
    rows.current.set(row.id, row)
    bus.emit({ t: 'rowapplied', row })
    bump()
    return true
  }, [])

  useEffect(() => {
    if (!me?.name) return
    let alive = true, sess
    ;(async () => {
      const be = await getBackend()
      backend.current = be
      const b = await be.getBoardByCode(code).catch(e => { console.error(e); return null })
      if (!alive) return
      if (!b) { setStatus('notfound'); return }
      setBoard(b)
      pushRecent(b)
      const list = await be.listRows(b.id)
      if (!alive) return
      list.forEach(r => rows.current.set(r.id, r))
      sess = be.join(b.id, { id: me.id, name: me.name, color: me.color, layer: 'main' }, {
        onRow: merge,
        onEph: (e) => { if (e.t === 'row') merge(e.row); else bus.emit(e) },
        onPresence: (p) => alive && setPresence(p),
      })
      session.current = sess
      setStatus('ready'); bump()
    })()
    return () => { alive = false; sess?.leave(); session.current = null; rows.current = new Map() }
  }, [code, me?.id, !!me?.name])

  // участник
  useEffect(() => {
    if (status !== 'ready' || !board) return
    put('member', { user: me.id, name: me.name, color: me.color, joined: rows.current.get(board.id + '_' + me.id)?.data?.joined || Date.now() }, board.id + '_' + me.id)
    session.current?.track({ name: me.name, color: me.color })
  }, [status, me.name, me.color])

  const put = useCallback((kind, data, id) => {
    if (!board && !backend.current) return
    const b = boardRef.current
    const rid = id || data.id || uid()
    const prev = rows.current.get(rid)
    const row = { id: rid, board_id: b.id, kind, data: { ...(prev?.data || {}), ...data, id: rid }, updated_at: Date.now() }
    merge(row)
    backend.current.putRow(row)
    session.current?.send({ t: 'row', row })
    return row
  }, [board])
  const boardRef = useRef(null); boardRef.current = board

  const putMany = useCallback((list) => {
    const b = boardRef.current
    const out = list.map(({ kind, data }) => {
      const rid = data.id || uid()
      return { id: rid, board_id: b.id, kind, data: { ...data, id: rid }, updated_at: Date.now() }
    })
    out.forEach(merge)
    backend.current.putRows(out)
    out.forEach(row => session.current?.send({ t: 'row', row }))
  }, [board])

  const send = useCallback((evt) => session.current?.send(evt), [])
  const track = useCallback((st) => session.current?.track(st), [])
  const upload = useCallback((file) => backend.current.upload(boardRef.current.id, file), [])

  const derived = useMemo(() => {
    const items = [], threads = [], messages = [], members = [], history = {}
    let meta = null
    for (const r of rows.current.values()) {
      const d = r.data
      if (d.deleted) continue
      if (r.kind === 'item') items.push({ ...d, _ts: r.updated_at })
      else if (r.kind === 'thread') threads.push(d)
      else if (r.kind === 'message') messages.push({ ...d, _ts: r.updated_at })
      else if (r.kind === 'member') members.push(d)
      else if (r.kind === 'history') (history[d.item] ||= []).push({ ...d, _ts: r.updated_at })
      else if (r.kind === 'meta') meta = d
    }
    items.sort((a, b) => (a.z || 0) - (b.z || 0))
    messages.sort((a, b) => a.ts - b.ts)
    members.sort((a, b) => a.joined - b.joined)
    for (const k in history) history[k].sort((a, b) => b.ts - a.ts)
    return { items, threads, messages, members, history, meta }
  }, [ver])

  const title = derived.meta?.title || board?.title || ''

  return { status, board, title, ...derived, presence, put, putMany, send, track, upload, bus, rows, backend }
}