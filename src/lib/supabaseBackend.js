import { createClient } from '@supabase/supabase-js'
import { uid, fileKind } from './util'

export function createSupabaseBackend(url, key) {
  const sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 40 } } })
  const T = 'board_rows'
  return {
    mode: 'cloud',
    async createBoard(b) {
      const { error } = await sb.from('boards').insert({ id: b.id, code: b.code, title: b.title, created_by: b.created_by })
      if (error) throw error
    },
    async getBoardByCode(code) {
      const { data, error } = await sb.from('boards').select('*').eq('code', code).maybeSingle()
      if (error) throw error
      return data
    },
    async listRows(boardId) {
      const all = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from(T).select('*').eq('board_id', boardId).range(from, from + 999)
        if (error) throw error
        all.push(...data)
        if (data.length < 1000) break
      }
      return all
    },
    async putRow(row) {
      const { error } = await sb.from(T).upsert(row)
      if (error) console.error('putRow', error)
    },
    async putRows(rows) {
      const { error } = await sb.from(T).upsert(rows)
      if (error) console.error('putRows', error)
    },
    async upload(boardId, file) {
      const id = uid()
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
      const path = `${boardId}/${id}-${safe}`
      const { error } = await sb.storage.from('files').upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (error) throw error
      const { data } = sb.storage.from('files').getPublicUrl(path)
      return { id, url: data.publicUrl, name: file.name, mime: file.type, size: file.size, kind: fileKind(file.type, file.name) }
    },
    async fileUrl(u) { return u },
    join(boardId, presence, { onRow, onEph, onPresence }) {
      const ch = sb.channel('board:' + boardId, { config: { presence: { key: presence.id }, broadcast: { self: false } } })
      let me = { ...presence }
      ch.on('postgres_changes', { event: '*', schema: 'public', table: T, filter: 'board_id=eq.' + boardId }, (p) => { if (p.new?.id) onRow(p.new) })
      ch.on('broadcast', { event: 'eph' }, ({ payload }) => onEph(payload))
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState()
        onPresence(Object.values(st).map(a => a[a.length - 1]))
      })
      ch.subscribe((s) => { if (s === 'SUBSCRIBED') ch.track(me) })
      return {
        send(evt) { ch.send({ type: 'broadcast', event: 'eph', payload: evt }) },
        track(state) { me = { ...me, ...state }; ch.track(me) },
        leave() { sb.removeChannel(ch) },
      }
    },
  }
}