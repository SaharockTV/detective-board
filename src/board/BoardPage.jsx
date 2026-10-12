import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBoard } from '../lib/useBoard'
import { navigate } from '../App'
import Canvas, { PENS, STAMPS } from './Canvas'
import { DESTROY } from './Destroy'
import AssetTray from './AssetTray'
import DetailPanel from './DetailPanel'
import ChatPanel from './ChatPanel'
import Library from './Library'
import NameModal from '../components/NameModal'
import { ChalkDefs } from '../components/Chalk'
import { makeItem, typeForKind, TPL } from '../assets/catalog'
import { uid, THREADS, initials, clamp } from '../lib/util'
import { newTabIdentity } from '../lib/identity'
import { CLOUD } from '../lib/backend'
import Icon from '../components/Icon'

const TOOLS = [
  { id: 'select', icon: 'select', name: 'Выбор и перемещение', key: 'V' },
  { id: 'hand', icon: 'hand', name: 'Панорама', key: 'H' },
  { id: 'pin', icon: 'pin', name: 'Игла — приколоть', key: 'P' },
  { id: 'thread', icon: 'thread', name: 'Нить — связать', key: 'T' },
]
const TOOLS2 = [
  { id: 'draw', icon: 'draw', name: 'Маркер — рисовать от руки', key: 'D' },
  { id: 'erase', icon: 'erase', name: 'Ластик — стереть рисунок, штамп, скотч', key: 'E' },
  { id: 'stamp', icon: 'stamp', name: 'Штамп на улику', key: 'S' },
  { id: 'tape', icon: 'tape', name: 'Скотч — приклеить', key: 'K' },
  { id: 'tent', icon: 'tent', name: 'Нумерованная метка улики', key: 'N' },
  { id: 'loupe', icon: 'loupe', name: 'Лупа', key: 'L' },
  { id: 'torch', icon: 'torch', name: 'Фонарик', key: 'F' },
  { id: 'uv', icon: 'uv', name: 'УФ-лампа — невидимые чернила', key: 'U' },
]
const KEYS = { v: 'select', м: 'select', h: 'hand', р: 'hand', p: 'pin', з: 'pin', t: 'thread', е: 'thread', d: 'draw', в: 'draw', e: 'erase', у: 'erase', s: 'stamp', ы: 'stamp', k: 'tape', л: 'tape', n: 'tent', т: 'tent', l: 'loupe', д: 'loupe', f: 'torch', а: 'torch', u: 'uv', г: 'uv' }

function useMobile() {
  const q = '(max-width: 760px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])
  return m
}

export default function BoardPage({ code, me, setMe }) {
  const mobile = useMobile()
  const B = useBoard(code, me)
  const [tool, setTool] = useState('select')
  const [threadKind, setThreadKind] = useState('fact')
  const [pen, setPen] = useState('red')
  const [stampKind, setStampKind] = useState('secret')
  const [layer, setLayer] = useState('main')
  const [filter, setFilter] = useState([]) // id участников; пусто = все
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('chat')
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const [views, setViews] = useState({})
  const [toasts, setToasts] = useState([])
  const [spaceDown, setSpaceDown] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [trayOpen, setTrayOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const [profile, setProfile] = useState(false)
  const canvasSize = useRef({ w: 1200, h: 800 })

  const view = views[layer] || { x: (window.innerWidth - 380) / 2, y: window.innerHeight / 2 + 40, z: 0.75 }
  const setView = useCallback((v) => setViews(vs => ({ ...vs, [layer]: typeof v === 'function' ? v(vs[layer]) : v })), [layer])

  const toast = useCallback((text, color) => {
    const id = uid()
    setToasts(t => [...t, { id, text, color }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5200)
  }, [])

  const members = useMemo(() => {
    const m = {}
    for (const x of B.members) m[x.user] = x
    for (const p of B.presence) if (!m[p.id]) m[p.id] = { user: p.id, name: p.name, color: p.color }
    return m
  }, [B.members, B.presence])
  const online = useMemo(() => new Set(B.presence.map(p => p.id)), [B.presence])

  const canEdit = layer === 'main' || layer === me.id
  const items = useMemo(() => B.items.filter(i => (i.layer || 'main') === layer), [B.items, layer])
  const threads = useMemo(() => B.threads.filter(t => (t.layer || 'main') === layer), [B.threads, layer])
  const strokes = useMemo(() => B.strokes.filter(t => (t.layer || 'main') === layer), [B.strokes, layer])
  const isDim = useCallback((x) => filter.length > 0 && !filter.includes(x.owner), [filter])
  const appends = useMemo(() => {
    const o = {}
    for (const k in B.history) {
      const a = B.history[k].filter(h => h.action === 'append').map(h => ({ ...h, color: members[h.author]?.color }))
      if (a.length) o[k] = a
    }
    return o
  }, [B.history, members])

  useEffect(() => { B.track({ layer }) }, [layer])

  // ---- действия ----
  const findItem = (id) => B.items.find(i => i.id === id)
  const log = (item, action, extra = {}) => B.put('history', { id: uid(), item, author: me.id, action, ts: Date.now(), ...extra })

  const actions = useMemo(() => ({
    raise(id) { B.put('item', { z: Date.now() }, id) },
    updateItem(id, patch, hist) {
      B.put('item', patch, id)
      if (hist) log(id, hist.action, hist)
    },
    setPin(id, pin) {
      const it = findItem(id)
      B.put('item', { pin: { x: clamp(pin.x, 0.03, 0.97), y: clamp(pin.y, 0.03, 0.97) } }, id)
      if (!it?.pin) log(id, 'pin')
    },
    unpin(id) {
      B.put('item', { pin: null }, id)
      B.threads.filter(t => t.a === id || t.b === id).forEach(t => B.put('thread', { deleted: true }, t.id))
      log(id, 'unpin')
    },
    addThread(a, b, kind) {
      if (B.threads.some(t => !t.deleted && ((t.a === a && t.b === b) || (t.a === b && t.b === a)))) { toast('Эти улики уже связаны'); return }
      B.put('thread', { id: uid(), layer, a, b, kind, label: '', owner: me.id, created: Date.now() })
      const ta = findItem(a)?.title, tb = findItem(b)?.title
      log(a, 'thread', { text: `${THREADS[kind].short}: → «${tb || 'без названия'}»` })
      log(b, 'thread', { text: `${THREADS[kind].short}: ← «${ta || 'без названия'}»` })
    },
    updateThread(id, patch) { B.put('thread', patch, id) },
    deleteThread(id) { B.put('thread', { deleted: true }, id) },
    deleteItem(id) {
      B.put('item', { deleted: true }, id)
      B.threads.filter(t => t.a === id || t.b === id).forEach(t => B.put('thread', { deleted: true }, t.id))
      setSelected(null)
    },
    destroyItem(id, mode = 'burn') {
      const it = findItem(id)
      if (!it) return
      const snap = { ...it }; delete snap._ts
      const evt = { t: 'destroy', id, mode, it: snap }
      B.send(evt); B.bus.emit(evt)
      setSelected(null)
      setTimeout(() => {
        B.put('item', { deleted: true, destroyed: mode }, id)
        B.threads.filter(t => t.a === id || t.b === id).forEach(t => B.put('thread', { deleted: true }, t.id))
        log(id, 'destroy', { text: DESTROY[mode]?.name, snap: { title: it.title, text: it.text } })
      }, Math.max(600, (DESTROY[mode]?.ms || 2000) - 500))
    },
    restoreItem(id) {
      B.put('item', { deleted: false, destroyed: null, z: Date.now() }, id)
      log(id, 'restore', { text: 'улика восстановлена из архива' })
    },
    addStroke(st) { B.put('stroke', { ...st, layer, owner: me.id, ts: Date.now() }) },
    deleteStroke(id) { B.put('stroke', { deleted: true }, id) },
    addMark(id, m) {
      const it = findItem(id)
      if (!it) return
      B.put('item', { marks: [...(it.marks || []), { ...m, id: uid(), by: me.id, ts: Date.now() }] }, id)
      if (m.t === 'stamp') log(id, 'stamp', { text: STAMPS[m.k]?.text })
    },
    removeMark(id, mid) {
      const it = findItem(id)
      if (!it) return
      B.put('item', { marks: (it.marks || []).filter(x => x.id !== mid) }, id)
    },
    addTent(pt) {
      const num = 1 + Math.max(0, ...B.items.filter(i => i.type === 'tent' && (i.layer || 'main') === layer).map(i => i.num || 0))
      const it = { id: uid(), type: 'tent', num, x: Math.round(pt.x - 32), y: Math.round(pt.y - 56), w: 64, h: 66, rot: 0, z: Date.now(), title: 'Метка №' + num, text: '', media: [], pin: null, owner: me.id, layer, created: Date.now() }
      B.put('item', it)
      log(it.id, 'create', { snap: { title: it.title, text: '' } })
    },
    addItem(type, pt, extra = {}) {
      const it = { id: uid(), ...makeItem(type, { ...pt, owner: me.id, layer, ...extra }) }
      B.put('item', it)
      log(it.id, 'create', { snap: { title: it.title, text: it.text } })
      return it
    },
    addFromTray(t, pt) {
      if (t.media) return actions.placeMedia(t.media, pt)
      if (t.photo) return actions.addItem(t.type || 'polaroid', pt, { photo: t.photo, title: t.photo.name })
      return actions.addItem(t.type, pt)
    },
    async dropFiles(files, pt) {
      if (!canEdit) return
      let i = 0
      for (const f of files) {
        setUploading(u => u + 1)
        try {
          const m = await B.upload(f)
          const at = { x: pt.x + i * 40, y: pt.y + i * 40 }
          actions.addItem(typeForKind[m.kind], at, { media: m, title: f.name.replace(/\.[^.]+$/, '').slice(0, 40) })
          i++
        } catch (e) { toast('Ошибка загрузки ' + f.name + ': ' + (e.message || e), '#e5484d') }
        setUploading(u => u - 1)
      }
    },
    async attach(id, files) {
      for (const f of files) {
        setUploading(u => u + 1)
        try {
          const m = await B.upload(f)
          const it = findItem(id)
          const media = [...(it.media || []).filter(x => !(x.id === 'art' && m.kind === 'image')), m]
          B.put('item', { media }, id)
          log(id, 'attach', { text: m.name })
        } catch (e) { toast('Ошибка загрузки: ' + (e.message || e), '#e5484d') }
        setUploading(u => u - 1)
      }
    },
    placeMedia(m, pt) {
      if (!canEdit) return
      if (!pt) { const c = center(), a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160; pt = { x: c.x + Math.cos(a) * r * 1.4, y: c.y + Math.sin(a) * r + 120 } }
      const title = (m.link?.title || m.name || '').replace(/\.[^.]{1,5}$/, '').slice(0, 40)
      return actions.addItem(typeForKind[m.kind] || 'folder', pt, { media: m, title })
    },
    attachMedia(id, list) {
      const it = findItem(id); if (!it) return
      const have = new Set((it.media || []).map(x => x.url))
      const add = list.filter(m => !have.has(m.url))
      if (!add.length) return toast('Уже прикреплено')
      const hasImg = add.some(m => m.kind === 'image')
      B.put('item', { media: [...(it.media || []).filter(x => !(x.id === 'art' && hasImg)), ...add] }, id)
      add.forEach(m => log(id, 'attach', { text: m.link?.title || m.name }))
      toast(add.length > 1 ? `Прикреплено: ${add.length}` : 'Прикреплено к «' + (it.title || 'улике') + '»')
    },
    removeFromLibrary(m) {
      B.put('media', { url: m.url, deleted: true }, 'lib_' + m.id)
    },
    removeMedia(id, mid) {
      const it = findItem(id)
      B.put('item', { media: (it.media || []).filter(m => m.id !== mid) }, id)
      log(id, 'detach')
    },
    copyToMain(id) {
      const it = findItem(id)
      const n = { ...it, id: uid(), layer: 'main', pin: null, x: it.x + 30, y: it.y + 30, z: Date.now(), copiedFrom: it.id }
      delete n._ts
      B.put('item', n)
      log(n.id, 'create', { snap: { title: n.title, text: n.text }, text: 'перенесено с личного стола' })
      toast('Копия вынесена на общую доску')
    },
    focus(id) {
      const it = findItem(id)
      if (!it) return
      if ((it.layer || 'main') !== layer) setLayer(it.layer || 'main')
      const { w, h } = canvasSize.current
      const z = 0.9
      setViews(vs => ({ ...vs, [it.layer || 'main']: { z, x: w / 2 - (it.x + it.w / 2) * z, y: h / 2 - (it.y + it.h / 2) * z } }))
      setSelected(id); setTab('card'); setPanelOpen(true)
    },
  }), [B, layer, me, canEdit])

  const center = () => {
    const { w, h } = canvasSize.current
    return { x: (w / 2 - view.x) / view.z + (Math.random() * 360 - 180), y: (h / 2 - view.y) / view.z + (Math.random() * 240 - 120) }
  }

  const fit = () => {
    if (wrap.current) { const r = wrap.current.getBoundingClientRect(); canvasSize.current = { w: r.width, h: r.height } }
    if (!items.length) { setView({ x: canvasSize.current.w / 2, y: canvasSize.current.h / 2 + 200, z: 0.7 }); return }
    let x0 = -380, y0 = -640, x1 = 380, y1 = -440
    for (const i of items) { x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y); x1 = Math.max(x1, i.x + i.w); y1 = Math.max(y1, i.y + i.h) }
    const { w, h } = canvasSize.current
    const z = clamp(Math.min((w - 80) / (x1 - x0), (h - 80) / (y1 - y0)), 0.15, 1.2)
    setView({ z, x: w / 2 - (x0 + x1) / 2 * z, y: h / 2 - (y0 + y1) / 2 * z })
  }

  const fitted = useRef({})
  const fitRef = useRef(fit); fitRef.current = fit
  useEffect(() => {
    if (B.status === 'ready' && !fitted.current[layer]) { fitted.current[layer] = true; setTimeout(() => fitRef.current(), 250) }
  }, [B.status, layer])

  // клавиши
  useEffect(() => {
    const down = (e) => {
      if (e.target.closest('input,textarea,[contenteditable]')) return
      const k = e.key.toLowerCase()
      if (e.code === 'Space') { setSpaceDown(true); e.preventDefault() }
      else if (KEYS[k] && !e.ctrlKey && !e.metaKey) setTool(KEYS[k])
      else if (k === '1') { setThreadKind('fact'); setTool('thread') }
      else if (k === '2') { setThreadKind('maybe'); setTool('thread') }
      else if (k === '3') { setThreadKind('reason'); setTool('thread') }
      else if ((k === 'delete' || k === 'backspace') && selected && canEdit) actions.destroyItem(selected, 'crumple')
      else if (k === 'escape') { setSelected(null); setTool('select') }
    }
    const up = (e) => { if (e.code === 'Space') setSpaceDown(false) }
    const paste = (e) => {
      if (e.target.closest('input,textarea')) return
      const files = [...(e.clipboardData?.files || [])]
      if (files.length && canEdit) return actions.dropFiles(files, center())
      const txt = (e.clipboardData?.getData('text') || '').trim()
      if (canEdit && /^https?:\/\/\S+$/i.test(txt)) B.addLink(txt).then(m => { actions.placeMedia(m); toast('Ссылка добавлена в библиотеку и на доску') }).catch(() => {})
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('paste', paste)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('paste', paste) }
  }, [selected, canEdit, actions, view])

  // размер холста
  const wrap = useRef(null)
  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => { canvasSize.current = { w: e.contentRect.width, h: e.contentRect.height } })
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [B.status])

  // напоминания и новые сообщения
  const seenMsgs = useRef(null)
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (B.status !== 'ready') return
    if (!seenMsgs.current) { seenMsgs.current = new Set(B.messages.map(m => m.id)); return }
    for (const m of B.messages) {
      if (seenMsgs.current.has(m.id)) continue
      seenMsgs.current.add(m.id)
      if (m.author === me.id) continue
      const who = members[m.author]?.name || 'Кто-то'
      if (m.remind && (m.remind.to === 'all' || m.remind.to === me.id) && !m.remind.at) toast(`Напоминание · ${who}: ${m.text}`, members[m.author]?.color)
      else if (!(panelOpen && tab === 'chat')) { setUnread(u => u + 1); toast(`${who}: ${m.text?.slice(0, 80) || 'файл'}`, members[m.author]?.color) }
    }
  }, [B.messages, B.status])
  useEffect(() => { if (panelOpen && tab === 'chat') setUnread(0) }, [panelOpen, tab])
  useEffect(() => {
    const iv = setInterval(() => {
      const fired = JSON.parse(localStorage.getItem('detective.fired') || '[]')
      for (const m of B.messages) {
        const r = m.remind
        if (!r?.at || r.done || fired.includes(m.id)) continue
        if ((r.to === 'all' || r.to === me.id) && new Date(r.at).getTime() <= Date.now()) {
          fired.push(m.id)
          toast(`Напоминание от ${members[m.author]?.name || '?'}: ${m.text}`, '#f59e0b')
          try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play() } catch { }
        }
      }
      localStorage.setItem('detective.fired', JSON.stringify(fired.slice(-200)))
    }, 5000)
    return () => clearInterval(iv)
  }, [B.messages, members])

  // ---- рендер ----
  if (!me.name) return <><ChalkDefs /><div className="home" /><NameModal me={me} onSave={setMe} /></>
  if (B.status === 'loading') return <div className="loading-screen"><ChalkDefs /><div className="chalk-text">Достаём дело из архива…</div></div>
  if (B.status === 'notfound') return (
    <div className="loading-screen"><ChalkDefs />
      <div className="chalk-text">Дело {code} не найдено</div>
      <p>{CLOUD ? 'Проверьте код.' : 'В локальном режиме доступны только доски, созданные в этом браузере.'}</p>
      <button className="btn primary" onClick={() => navigate('/')}>На главную</button>
    </div>
  )

  const selItem = B.items.find(i => i.id === selected)
  const archive = [...B.rows.current.values()].filter(r => r.kind === 'item' && r.data.deleted && r.data.destroyed && (r.data.layer || 'main') === layer).map(r => r.data).slice(-30).reverse()
  const layerOwner = layer === 'main' ? null : members[layer]
  const memberList = Object.values(members)
  const signSub = layer === 'main' ? `дело ${code}` : `личный стол · ${layerOwner?.name || ''}`
  const title = layer === 'main' ? B.title : (layerOwner?.name ? 'Теории: ' + layerOwner.name : 'Личный стол')

  return (
    <div className={'board-page' + (mobile ? ' is-mobile' : '')}>
      <ChalkDefs />
      <header className="topbar">
        <button className="tb-home" onClick={() => navigate('/')} title="На главную"><Icon n="back" size={16} /> Дела</button>
        <div className="tb-title" onDoubleClick={() => layer === 'main' && setRenaming(true)} title="Двойной клик — переименовать">{B.title}</div>
        <button className="tb-code" onClick={() => { navigator.clipboard?.writeText(code); toast('Код скопирован: ' + code) }} title="Скопировать код приглашения"><Icon n="key" size={14} /> {code}</button>
        <button className="tb-btn" onClick={() => { navigator.clipboard?.writeText(location.origin + '/b/' + code); toast('Ссылка скопирована') }}><Icon n="link" size={14} /> Пригласить</button>

        <nav className="layers">
          <button className={layer === 'main' ? 'on' : ''} onClick={() => setLayer('main')}>Общая доска</button>
          <button className={layer === me.id ? 'on' : ''} onClick={() => setLayer(me.id)} style={{ '--c': me.color }}>Мой стол</button>
          {memberList.filter(m => m.user !== me.id).map(m => (
            <button key={m.user} className={layer === m.user ? 'on' : ''} onClick={() => setLayer(m.user)} style={{ '--c': m.color }} title={'Личный стол: ' + m.name}>
              <i className="dot" style={{ background: m.color }} />{m.name}
            </button>
          ))}
        </nav>

        <select className="layer-select" value={layer} onChange={e => setLayer(e.target.value)}>
          <option value="main">Общая доска</option>
          <option value={me.id}>Мой стол</option>
          {memberList.filter(m => m.user !== me.id).map(m => <option key={m.user} value={m.user}>Стол: {m.name}</option>)}
        </select>
        <div className="people">
          {memberList.map(m => (
            <button key={m.user} className={'avatar' + (online.has(m.user) ? ' online' : '') + (filter.includes(m.user) ? ' on' : '')} style={{ '--c': m.color }}
              title={`${m.name}${m.role ? ' · ' + m.role : ''}${online.has(m.user) ? ' — онлайн' : ''}\nКлик — показать только заметки этого участника`}
              onClick={() => setFilter(f => f.includes(m.user) ? f.filter(x => x !== m.user) : [...f, m.user])}>
              {m.user === 'ai' ? 'ИИ' : initials(m.name)}
              {m.role && <i className="role-dot" title={m.role}>★</i>}
            </button>
          ))}
          {filter.length > 0 && <button className="tb-btn sm" onClick={() => setFilter([])}>Все заметки</button>}
        </div>
        <button className="tb-btn" onClick={() => setProfile(true)} title="Профиль: имя, цвет, роль"><Icon n="settings" size={16} /></button>
      </header>

      <div className="board-body">
        <aside className={'left' + (trayOpen ? '' : ' closed')}>
          <div className="tools">
            {TOOLS.map(t => (
              <button key={t.id} className={'tool' + (tool === t.id ? ' on' : '')} title={`${t.name} (${t.key})`} onClick={() => setTool(t.id)}><Icon n={t.icon} size={21} /></button>
            ))}
            <div className="tools-sep" />
            {TOOLS2.map(t => (
              <button key={t.id} className={'tool' + (tool === t.id ? ' on' : '')} title={`${t.name} (${t.key})`} onClick={() => setTool(tool === t.id ? 'select' : t.id)}><Icon n={t.icon} size={21} /></button>
            ))}
            <div className="thread-kinds">
              {Object.entries(THREADS).map(([k, t], i) => (
                <button key={k} className={'tkind' + (threadKind === k ? ' on' : '')} style={{ '--c': t.color }} title={`${t.name} (${i + 1})`} onClick={() => { setThreadKind(k); setTool('thread') }}><i /></button>
              ))}
            </div>
            <button className={'tool' + (trayOpen ? ' on' : '')} title="Набор улик" onClick={() => { setTrayOpen(o => !o); mobile && setPanelOpen(false) }}><Icon n="tray" size={21} /></button>
            <button className={'tool mobile-only' + (panelOpen && tab === 'card' ? ' on' : '')} title="Улика" onClick={() => { const o = !(panelOpen && tab === 'card'); setTab('card'); setPanelOpen(o); setTrayOpen(false) }}><Icon n="card" size={21} /></button>
            <button className={'tool' + (panelOpen && tab === 'lib' ? ' on' : '')} title="Библиотека материалов" onClick={() => { const o = !(panelOpen && tab === 'lib'); setTab('lib'); setPanelOpen(o); mobile && setTrayOpen(false) }}><Icon n="library" size={21} /></button>
            <button className={'tool mobile-only' + (panelOpen && tab === 'chat' ? ' on' : '')} title="Чат" onClick={() => { const o = !(panelOpen && tab === 'chat'); setTab('chat'); setPanelOpen(o); setTrayOpen(false) }}><Icon n="chat" size={21} />{unread > 0 && <b className="badge dotb">{unread}</b>}</button>
          </div>
          {trayOpen && <AssetTray canEdit={canEdit} onAdd={(t) => { actions.addFromTray(t, center()); mobile && setTrayOpen(false) }} onFiles={(f) => { actions.dropFiles(f, center()); mobile && setTrayOpen(false) }} />}
        </aside>

        <div className="canvas-wrap" ref={wrap}>
          {!canEdit && <div className="readonly-banner" style={{ '--c': layerOwner?.color }}>Личный стол «{layerOwner?.name}» — только просмотр</div>}
          {filter.length > 0 && <div className="filter-banner">Показаны заметки: {filter.map(f => members[f]?.name).join(', ')}</div>}
          {tool === 'draw' && (
            <div className="tool-opts">
              {Object.entries(PENS).map(([k, p]) => <button key={k} className={'pen-b' + (pen === k ? ' on' : '')} title={p.name} style={{ '--c': p.color, '--w': Math.min(14, p.width + 2) + 'px' }} onClick={() => setPen(k)}><i /></button>)}
              <span>{PENS[pen].name}</span>
            </div>
          )}
          {tool === 'stamp' && (
            <div className="tool-opts">
              {Object.entries(STAMPS).map(([k, st]) => <button key={k} className={'stamp-b' + (stampKind === k ? ' on' : '')} style={{ '--c': st.color }} onClick={() => setStampKind(k)}>{st.text}</button>)}
              <span>кликните по материалу</span>
            </div>
          )}
          {tool === 'tape' && <div className="tool-opts"><span>Кликните по материалу, чтобы наклеить скотч</span></div>}
          <Canvas items={items} threads={threads} strokes={strokes} pen={pen} stampKind={stampKind} members={members} me={me} tool={tool} threadKind={threadKind} canEdit={canEdit}
            view={view} setView={setView} selected={selected}
            onSelect={(id) => { setSelected(id); if (id) { setTab('card'); setPanelOpen(true); setTrayOpen(false) } else if (mobile) setPanelOpen(false) }}
            actions={actions} bus={B.bus} send={B.send} isDim={isDim} title={title} signSub={signSub}
            onRenameTitle={() => layer === 'main' && setRenaming(true)} layer={layer} appends={appends} spaceDown={spaceDown} />
          <div className="zoom">
            <button onClick={() => setView({ ...view, z: clamp(view.z / 1.2, 0.12, 3) })}>−</button>
            <span>{Math.round(view.z * 100)}%</span>
            <button onClick={() => setView({ ...view, z: clamp(view.z * 1.2, 0.12, 3) })}>+</button>
            <button onClick={fit} title="Показать всё" style={{ width: 44, fontSize: 12 }}>всё</button>
          </div>
          <div className="legend">
            {Object.values(THREADS).map(t => <span key={t.name}><i style={{ background: t.color }} />{t.name}</span>)}
          </div>
          {uploading > 0 && <div className="uploading">Загрузка файлов ({uploading})…</div>}
        </div>

        <aside className={'right' + (panelOpen ? '' : ' closed')}>
          <div className="rtabs">
            <button className={tab === 'card' ? 'on' : ''} onClick={() => { setTab('card'); setPanelOpen(true) }}>Материал</button>
            <button className={tab === 'chat' ? 'on' : ''} onClick={() => { setTab('chat'); setPanelOpen(true) }}>Чат {unread > 0 && <b className="badge">{unread}</b>}</button>
            <button className={tab === 'lib' ? 'on' : ''} onClick={() => { setTab('lib'); setPanelOpen(true) }}>Библиотека <span className="cnt">{B.library.length || ''}</span></button>
            <button className="rclose" onClick={() => setPanelOpen(o => !o)} title="Свернуть">{panelOpen ? '▸' : '◂'}</button>
          </div>
          {panelOpen && tab === 'card' && (
            selItem
              ? <DetailPanel key={selItem.id} item={selItem} me={me} members={members} history={B.history[selItem.id] || []}
                canEdit={(selItem.layer || 'main') === 'main' || selItem.layer === me.id}
                threads={B.threads.filter(t => t.a === selItem.id || t.b === selItem.id)} items={B.items}
                actions={actions} put={B.put} onClose={() => setSelected(null)} library={B.library} upload={B.upload} addLink={B.addLink} />
              : <div className="empty-panel">
                <div className="ep-icon"><Icon n="loupe" size={34} sw={1.3} /></div>
                <p>Выберите материал на доске, чтобы открыть его: дополнить, прикрепить файлы и посмотреть историю изменений.</p>
                <ul className="tips">
                  <li><b>P</b> — приколоть булавкой</li>
                  <li><b>T</b> — нить между булавками (1/2/3 — тип связи)</li>
                  <li><b>Пробел</b> + мышь — двигать доску, колесо — масштаб</li>
                  <li>Перетащите файлы с компьютера прямо на доску</li>
                  <li>Ctrl+V — вставить картинку или ссылку из буфера</li>
                  <li>Все файлы и ссылки дела — во вкладке «Библиотека»</li>
                </ul>
                {archive.length > 0 && (
                  <details className="archive">
                    <summary>Архив уничтоженных материалов ({archive.length})</summary>
                    {archive.map(a => (
                      <div key={a.id} className="arch-row">
                        <span>{DESTROY[a.destroyed]?.name}: {a.title || 'без названия'}</span>
                        {canEdit && <button className="link" onClick={() => actions.restoreItem(a.id)}>↺ вернуть</button>}
                      </div>
                    ))}
                  </details>
                )}
                <button className="btn sm" onClick={() => { const m = newTabIdentity(); setMe({ ...m }) }} title="Для проверки совместной работы в другой вкладке">Войти в этой вкладке как другой участник</button>
              </div>
          )}
          {panelOpen && tab === 'chat' && <ChatPanel me={me} members={members} messages={B.messages} put={B.put} upload={B.upload} items={B.items} focus={actions.focus} selected={selItem} library={B.library} addLink={B.addLink} />}
          {panelOpen && tab === 'lib' && <Library library={B.library} members={members} canEdit={canEdit} upload={B.upload} addLink={B.addLink}
            onRemove={actions.removeFromLibrary} onPlace={(m) => { actions.placeMedia(m); mobile && setPanelOpen(false) }}
            onAttach={(m) => actions.attachMedia(selItem.id, [m])} attachTo={selItem && ((selItem.layer || 'main') === 'main' || selItem.layer === me.id) ? selItem : null} focus={actions.focus} />}
        </aside>
      </div>

      <div className="toasts">
        {toasts.map(t => <div key={t.id} className="toast" style={{ '--c': t.color || '#f2c12e' }}>{t.text}</div>)}
      </div>
      {profile && <NameModal me={me} role={members[me.id]?.role || ''} title="Ваш профиль" onSave={(m) => {
        const { role, ...rest } = m
        setMe(rest); setProfile(false)
        if (role !== undefined && role !== (members[me.id]?.role || '')) B.put('member', { role }, B.board.id + '_' + me.id)
      }} />}
      {renaming && <RenameModal title={B.title} onClose={() => setRenaming(false)} onSave={(t) => { B.put('meta', { title: t }, B.board.id + '_meta'); setRenaming(false) }} />}
    </div>
  )
}

function RenameModal({ title, onSave, onClose }) {
  const [v, setV] = useState(title)
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal chalk-modal" onSubmit={(e) => { e.preventDefault(); v.trim() && onSave(v.trim()) }}>
        <h2>Название дела</h2>
        <input autoFocus value={v} maxLength={48} onChange={e => setV(e.target.value)} />
                <div className="row"><button type="button" className="btn" onClick={onClose}>Отмена</button><button className="btn primary">Сохранить</button></div>
      </form>
    </div>
  )
}