// Деплой на Vercel через REST API (токен берётся из входа Vercel CLI)
// node scripts/deploy.mjs   [env SB_URL, SB_KEY — ключи Supabase]
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'
const dir = path.join(process.env.APPDATA, 'com.vercel.cli', 'Data')
const { token } = JSON.parse(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'))
const { currentTeam } = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))
const q = currentTeam ? `?teamId=${currentTeam}` : ''
const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
const api = async (m, p, body, extra = {}) => {
  const r = await fetch('https://api.vercel.com' + p + (p.includes('?') ? q.replace('?', '&') : q), { method: m, headers: { ...H, ...extra }, body: body && (Buffer.isBuffer(body) ? body : JSON.stringify(body)) })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (!r.ok) { const e = new Error(m + ' ' + p + ' ' + r.status + ' ' + t.slice(0, 300)); e.status = r.status; e.body = j; throw e }
  return j
}
const NAME = 'detective-board', REPO = 'SaharockTV/detective-board'
const user = await api('GET', '/v2/user'); console.log('vercel user:', user.user?.username)
let project, git = false
try { project = await api('GET', '/v9/projects/' + NAME); git = !!project.link } catch (e) { if (e.status !== 404) throw e }
if (!project) {
  try { project = await api('POST', '/v11/projects', { name: NAME, framework: 'vite', gitRepository: { type: 'github', repo: REPO } }); git = true }
  catch (e) { console.log('git link failed:', e.message.slice(0, 200)); project = await api('POST', '/v11/projects', { name: NAME, framework: 'vite' }) }
}
console.log('project:', project.id, 'git:', git)
if (process.env.SB_URL) {
  for (const [key, value] of [['VITE_SUPABASE_URL', process.env.SB_URL], ['VITE_SUPABASE_ANON_KEY', process.env.SB_KEY]])
    await api('POST', `/v10/projects/${project.id}/env?upsert=true`, { key, value, type: 'plain', target: ['production', 'preview', 'development'] })
  console.log('env set')
}
let dep
if (git) {
  dep = await api('POST', '/v13/deployments', { name: NAME, project: project.id, target: 'production', gitSource: { type: 'github', org: 'SaharockTV', repo: 'detective-board', ref: 'main' } })
} else {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..')
  const files = []
  const walk = (d) => { for (const f of fs.readdirSync(d)) { if (['node_modules', 'dist', '.git', '.vercel', '.mcp-trash', 'scripts'].includes(f) || f.startsWith('.env')) continue; const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p) } }
  walk(root)
  const list = []
  for (const p of files) {
    const buf = fs.readFileSync(p); const sha = crypto.createHash('sha1').update(buf).digest('hex')
    await api('POST', '/v2/files', buf, { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': sha, 'Content-Length': String(buf.length) })
    list.push({ file: path.relative(root, p).split(path.sep).join('/'), sha, size: buf.length })
  }
  console.log('uploaded', list.length, 'files')
  dep = await api('POST', '/v13/deployments', { name: NAME, project: project.id, target: 'production', files: list, projectSettings: { framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist', installCommand: 'npm install' } })
}
console.log('deployment:', dep.id, dep.url)
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 4000))
  const d = await api('GET', '/v13/deployments/' + dep.id)
  if (d.readyState === 'READY') { console.log('READY https://' + d.url, 'aliases:', (d.alias || []).join(' ')); break }
  if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') { console.log('FAILED', d.readyState, d.errorMessage || ''); break }
}
