// Подключает GitHub-репозиторий к проекту Vercel (автодеплой при push)
import fs from 'fs'; import path from 'path'
const dir = path.join(process.env.APPDATA, 'com.vercel.cli', 'Data')
const { token } = JSON.parse(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'))
const { currentTeam } = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))
const q = currentTeam ? '?teamId=' + currentTeam : ''
const r = await fetch('https://api.vercel.com/v9/projects/prj_GyHU2Ec7CD5BgmVXt5hDCnmMFiGQ/link' + q, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'github', repo: 'SaharockTV/detective-board', productionBranch: 'main' }) })
const t = await r.text(); console.log(r.status, t.slice(0, 400))
