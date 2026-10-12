export const uid = () => {
  try { return crypto.randomUUID().replace(/-/g, '').slice(0, 20) } catch { }
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12))
}

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function genCode() {
  let s = ''
  for (let i = 0; i < 8; i++) {
    s += ALPH[Math.floor(Math.random() * ALPH.length)]
    if (i === 3) s += '-'
  }
  return s
}
export const normCode = (c) => {
  const s = (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : s
}

export const PALETTE = ['#e5484d', '#3b82f6', '#22a565', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16']

export const THREADS = {
  fact: { color: '#b3141c', name: 'Установленный факт', short: 'Факт' },
  maybe: { color: '#d9a521', name: 'Не подтверждено', short: 'Под вопросом' },
  reason: { color: '#2f7d46', name: 'Версия / рассуждение', short: 'Версия' },
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000
  if (d < 45) return 'только что'
  if (d < 3600) return Math.round(d / 60) + ' мин назад'
  if (d < 86400) return Math.round(d / 3600) + ' ч назад'
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export const fmtTime = (ts) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function fileKind(mime = '', name = '') {
  const n = name.toLowerCase()
  if (/\.(glb|gltf)$/.test(n) || mime.includes('gltf')) return 'model'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(n)) return 'audio'
  return 'file'
}
export const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ'

export function throttle(fn, ms) {
  let last = 0, t = null, lastArgs
  return (...args) => {
    lastArgs = args
    const n = Date.now()
    if (n - last >= ms) { last = n; fn(...args) }
    else if (!t) t = setTimeout(() => { t = null; last = Date.now(); fn(...lastArgs) }, ms - (n - last))
  }
}

export const initials = (name = '?') => name.trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?'

// Мир → точка булавки с учётом поворота карточки
export function pinWorld(it) {
  if (!it?.pin) return null
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2
  const lx = it.pin.x * it.w - it.w / 2, ly = it.pin.y * it.h - it.h / 2
  const r = (it.rot || 0) * Math.PI / 180
  return { x: cx + lx * Math.cos(r) - ly * Math.sin(r), y: cy + lx * Math.sin(r) + ly * Math.cos(r) }
}
export function worldToLocal(it, p) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2
  const r = -(it.rot || 0) * Math.PI / 180
  const dx = p.x - cx, dy = p.y - cy
  const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r)
  return { x: (lx + it.w / 2) / it.w, y: (ly + it.h / 2) / it.h }
}