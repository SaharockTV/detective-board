import { uid, fileKind } from './util'

// Локальный режим: IndexedDB + BroadcastChannel (синхронизация между вкладками браузера)
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('detective-board', 1)
    r.onupgradeneeded = () => {
      const db = r.result
      db.createObjectStore('boards', { keyPath: 'id' }).createIndex('code', 'code', { unique: true })
      db.createObjectStore('rows', { keyPath: 'id' }).createIndex('board_id', 'board_id')
      db.createObjectStore('files', { keyPath: 'id' })
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

export function createLocalBackend() {
  const dbp = openDB()
  const store = async (name, mode = 'readonly') => (await dbp).transaction(name, mode).objectStore(name)
  const urlCache = new Map()

  return {
    mode: 'local',
    async createBoard(b) { await req((await store('boards', 'readwrite')).put(b)) },
    async getBoardByCode(code) { return (await req((await store('boards')).index('code').get(code))) || null },
    async listRows(boardId) { return req((await store('rows')).index('board_id').getAll(boardId)) },
    async putRow(row) { await req((await store('rows', 'readwrite')).put(row)) },
    async putRows(rows) {
      const s = await store('rows', 'readwrite')
      await Promise.all(rows.map(r => req(s.put(r))))
    },
    async upload(boardId, file) {
      const id = uid()
      await req((await store('files', 'readwrite')).put({ id, board_id: boardId, blob: file, name: file.name, mime: file.type }))
      return { id, url: 'idb:' + id, name: file.name, mime: file.type, size: file.size, kind: fileKind(file.type, file.name) }
    },
    async fileUrl(url) {
      if (!url?.startsWith('idb:')) return url
      if (urlCache.has(url)) return urlCache.get(url)
      const rec = await req((await store('files')).get(url.slice(4)))
      if (!rec) return ''
      const u = URL.createObjectURL(rec.blob)
      urlCache.set(url, u)
      return u
    },
    join(boardId, presence, { onEph, onPresence }) {
      const ch = new BroadcastChannel('detective:' + boardId)
      let me = { ...presence }
      const peers = new Map()
      const emitPresence = () => onPresence([me, ...[...peers.values()].map(p => p.state)])
      const beat = () => ch.postMessage({ t: 'presence', state: me })
      ch.onmessage = (e) => {
        const m = e.data
        if (m.t === 'presence') {
          const isNew = !peers.has(m.state.id)
          peers.set(m.state.id, { state: m.state, ts: Date.now() })
          if (isNew) beat()
          emitPresence()
        } else if (m.t === 'bye') { peers.delete(m.id); emitPresence() }
        else if (m.t === 'eph') onEph(m.evt)
      }
      beat(); emitPresence()
      const iv = setInterval(() => {
        beat()
        let ch2 = false
        for (const [k, p] of peers) if (Date.now() - p.ts > 7000) { peers.delete(k); ch2 = true }
        if (ch2) emitPresence()
      }, 2500)
      const bye = () => ch.postMessage({ t: 'bye', id: me.id })
      window.addEventListener('beforeunload', bye)
      return {
        send(evt) { ch.postMessage({ t: 'eph', evt }) },
        track(state) { me = { ...me, ...state }; beat(); emitPresence() },
        leave() { bye(); clearInterval(iv); window.removeEventListener('beforeunload', bye); ch.close() },
      }
    },
  }
}