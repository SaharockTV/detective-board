import { uid, PALETTE } from './util'

const KEY = 'detective.me'
export function getMe() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY))
    if (s?.id) return s
  } catch { }
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    if (v?.id) return v
  } catch { }
  const me = { id: uid(), name: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)] }
  localStorage.setItem(KEY, JSON.stringify(me))
  return me
}
export function saveMe(me) {
  if (sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(me))
  else localStorage.setItem(KEY, JSON.stringify(me))
}
// Новый участник только для этой вкладки (удобно проверять совместную работу)
export function newTabIdentity() {
  const me = { id: uid(), name: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)] }
  sessionStorage.setItem(KEY, JSON.stringify(me))
  return me
}

const RKEY = 'detective.recent'
export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RKEY)) || [] } catch { return [] }
}
export function pushRecent(b) {
  const list = getRecent().filter(x => x.code !== b.code)
  list.unshift({ code: b.code, title: b.title, ts: Date.now() })
  localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 12)))
}
export function removeRecent(code) {
  localStorage.setItem(RKEY, JSON.stringify(getRecent().filter(x => x.code !== code)))
}