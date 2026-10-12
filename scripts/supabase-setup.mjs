// Создаёт проект Supabase, применяет schema.sql и пишет .env.local
// Запуск: SB_TOKEN=sbp_... node scripts/supabase-setup.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
const T = process.env.SB_TOKEN
if (!T) { console.error('Нужен SB_TOKEN'); process.exit(1) }
const api = async (p, opt = {}) => {
  const r = await fetch('https://api.supabase.com' + p, { ...opt, headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json', ...(opt.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(r.status + ' ' + p + ': ' + t.slice(0, 400))
  return t ? JSON.parse(t) : null
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const orgs = await api('/v1/organizations')
console.log('Организации:', orgs.map(o => o.name).join(', '))
const projects = await api('/v1/projects')
let p = projects.find(x => x.name === 'detective-board')
if (!p) {
  const pass = crypto.randomBytes(18).toString('base64url')
  fs.writeFileSync('.supabase-db-pass.txt', pass)
  p = await api('/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'detective-board', organization_id: orgs[0].id, region: 'eu-central-1', db_pass: pass }) })
  console.log('Создан проект', p.id)
} else console.log('Найден проект', p.id, p.status)
const ref = p.id || p.ref
for (let i = 0; i < 90; i++) {
  const s = await api('/v1/projects/' + ref)
  if (s.status === 'ACTIVE_HEALTHY') break
  if (i % 6 === 0) console.log('статус:', s.status)
  await sleep(10000)
}
const sql = fs.readFileSync('supabase/schema.sql', 'utf8')
for (let i = 0; ; i++) {
  try { await api(`/v1/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query: sql }) }); console.log('Схема применена'); break }
  catch (e) { if (i > 12) throw e; console.log('повтор схемы…', e.message.slice(0, 120)); await sleep(10000) }
}
const keys = await api(`/v1/projects/${ref}/api-keys`)
const anon = keys.find(k => k.name === 'anon')?.api_key
const url = `https://${ref}.supabase.co`
fs.writeFileSync('.env.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${anon}\n`)
console.log('URL=' + url)
console.log('KEY=' + anon)
