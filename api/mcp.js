// MCP-сервер «Доска детектива» (Streamable HTTP, stateless JSON-RPC).
// Подключение: https://<домен>/api/mcp  — ИИ получает доступ к делу по его коду.
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const AI = { user: 'ai', name: 'ИИ-напарник', color: '#7c5cff' }
const THREADS = { fact: 'Точный факт', maybe: 'Неточный факт', reason: 'Рассуждение' }
const TYPES = ['polaroid', 'photo', 'torn', 'sticky', 'index', 'suspect', 'newspaper', 'report', 'evidence', 'map', 'receipt', 'folder', 'question']
const SIZE = { link: [280, 230], video: [290, 210], audio: [260, 160], model: [230, 230], polaroid: [200, 240], photo: [230, 180], torn: [230, 260], sticky: [170, 170], index: [260, 160], suspect: [280, 200], newspaper: [260, 230], report: [250, 300], evidence: [210, 250], map: [280, 220], receipt: [150, 240], folder: [260, 190], question: [150, 150] }
const STAMPS = { secret: 'СЕКРЕТНО', ok: 'ПОДТВЕРЖДЕНО', lie: 'ЛОЖЬ', checked: 'ПРОВЕРЕНО', alibi: 'АЛИБИ', closed: 'ЗАКРЫТО' }

const CATS = { image: 'фото', gif: 'gif', video: 'видео', audio: 'аудио', model: '3d', link: 'ссылка', file: 'документ' }
const cat = (m) => m.kind === 'image' && /gif/i.test((m.mime || '') + (m.name || '')) ? 'gif' : (m.kind || 'file')
const CARD_FOR = { image: 'photo', video: 'video', audio: 'audio', model: 'model', link: 'link', file: 'folder' }
function kindOf(url) {
  const p = url.toLowerCase().split(/[?#]/)[0]
  if (/\.(glb|gltf|obj|stl|fbx|usdz)$/.test(p)) return 'model'
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(p)) return 'image'
  if (/\.(mp4|webm|mov|m4v)$/.test(p)) return 'video'
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(p)) return 'audio'
  return 'link'
}
function linkInfo(url) {
  const u = new URL(url), host = u.hostname.replace(/^www\./, '')
  const yt = /youtube\.com$/.test(host) ? u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/) || [])[2] : host === 'youtu.be' ? u.pathname.slice(1) : null
  if (yt) return { provider: 'youtube', host, embed: 'https://www.youtube.com/embed/' + yt, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` }
  const vm = /vimeo\.com$/.test(host) && u.pathname.match(/\/(\d+)/)
  if (vm) return { provider: 'vimeo', host, embed: 'https://player.vimeo.com/video/' + vm[1] }
  return { provider: 'web', host }
}
function library(all) {
  const hidden = new Set(all.filter(r => r.kind === 'media' && r.data.deleted).map(r => r.data.url))
  const lib = new Map()
  const add = (m, used) => { if (!m?.url || m.id === 'art' || hidden.has(m.url)) return; const c = lib.get(m.url) || { ...m, used: [] }; if (used) c.used.push(used); lib.set(m.url, c) }
  live(all).filter(r => r.kind === 'media').forEach(r => add(r.data))
  live(all).filter(r => r.kind === 'item').forEach(r => (r.data.media || []).forEach(m => add(m, r.data.id)))
  live(all).filter(r => r.kind === 'message').forEach(r => (r.data.files || []).forEach(m => add(m)))
  return [...lib.values()]
}
const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 12))
const normCode = (c) => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : s }

async function sb(path, opt = {}) {
  if (!SB_URL || !SB_KEY) throw new Error('Сервер не подключён к Supabase (нет SUPABASE_URL/KEY)')
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...opt,
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', ...(opt.headers || {}) },
  })
  const t = await r.text()
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + t.slice(0, 300))
  return t ? JSON.parse(t) : null
}
async function board(code) {
  const c = normCode(code)
  const b = (await sb('boards?select=*&code=eq.' + encodeURIComponent(c)))[0]
  if (!b) throw new Error('Дело с кодом ' + c + ' не найдено')
  return b
}
async function rows(boardId) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const part = await sb(`board_rows?select=*&board_id=eq.${boardId}`, { headers: { Range: `${from}-${from + 999}` } })
    all.push(...part)
    if (part.length < 1000) break
  }
  return all
}
async function upsert(list) {
  await sb('board_rows', { method: 'POST', body: JSON.stringify(list), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } })
}
const row = (b, kind, data, prev) => ({ id: data.id, board_id: b.id, kind, data: { ...(prev?.data || {}), ...data }, updated_at: Date.now() })
async function ensureAI(b, all) {
  const id = b.id + '_ai'
  if (all.find(r => r.id === id)) return []
  return [row(b, 'member', { id, ...AI, role: 'Аналитик', joined: Date.now() })]
}
function live(all) { return all.filter(r => !r.data?.deleted) }

function caseView(b, all, { layer = 'main' } = {}) {
  const L = live(all)
  const items = L.filter(r => r.kind === 'item' && (r.data.layer || 'main') === layer).map(r => r.data)
  const byId = Object.fromEntries(items.map(i => [i.id, i]))
  const members = L.filter(r => r.kind === 'member').map(r => r.data)
  const mname = (id) => members.find(m => m.user === id)?.name || id
  const meta = L.find(r => r.kind === 'meta')?.data
  return {
    code: b.code, title: meta?.title || b.title, layer,
    members: members.map(m => ({ id: m.user, name: m.name, role: m.role || null })),
    items: items.map(i => ({
      id: i.id, type: i.type, title: i.title, text: i.text || undefined,
      fields: i.fields?.length ? Object.fromEntries(i.fields) : undefined,
      invisible_ink: i.uv || undefined, stamps: (i.marks || []).filter(m => m.t === 'stamp').map(m => STAMPS[m.k] || m.k),
      pinned: !!i.pin, author: mname(i.owner), files: (i.media || []).filter(m => m.id !== 'art').map(m => ({ name: m.link?.title || m.name, type: CATS[cat(m)], url: m.url })),
      x: i.x, y: i.y,
    })),
    threads: L.filter(r => r.kind === 'thread' && (r.data.layer || 'main') === layer && byId[r.data.a] && byId[r.data.b]).map(r => ({
      id: r.data.id, kind: THREADS[r.data.kind] || r.data.kind, from: byId[r.data.a].title, to: byId[r.data.b].title, from_id: r.data.a, to_id: r.data.b, label: r.data.label || undefined, author: mname(r.data.owner),
    })),
    notes: L.filter(r => r.kind === 'history' && r.data.action === 'append').slice(-40).map(r => ({ item: byId[r.data.item]?.title, author: mname(r.data.author), text: r.data.text })),
    chat: L.filter(r => r.kind === 'message').map(r => r.data).sort((a, b) => a.ts - b.ts).slice(-60).map(m => ({ author: mname(m.author), text: m.text, at: new Date(m.ts).toISOString() })),
  }
}

function place(all, near) {
  const items = live(all).filter(r => r.kind === 'item' && (r.data.layer || 'main') === 'main').map(r => r.data)
  if (near) { const n = items.find(i => i.id === near); if (n) return { x: n.x + n.w + 60 + Math.random() * 40, y: n.y + Math.random() * 60 - 30 } }
  if (!items.length) return { x: 0, y: 0 }
  const maxX = Math.max(...items.map(i => i.x + i.w)), minY = Math.min(...items.map(i => i.y))
  return { x: maxX + 80, y: minY + Math.random() * 300 }
}

const S = (props, req) => ({ type: 'object', properties: props, required: req })
const code = { type: 'string', description: 'Код дела, например ABCD-1234' }
const TOOLS = [
  { name: 'get_case', description: 'Прочитать всё дело: улики (карточки), нити-связи, участников и их роли, заметки и чат. Начинайте с этого.', inputSchema: S({ code, layer: { type: 'string', description: 'main (общая доска) или id участника (личный стол)' } }, ['code']) },
  { name: 'create_case', description: 'Создать новое дело. Возвращает код приглашения.', inputSchema: S({ title: { type: 'string' } }, ['title']) },
  { name: 'add_card', description: 'Добавить улику на общую доску.', inputSchema: S({ code, type: { type: 'string', enum: TYPES, description: 'вид бумажки: sticky — стикер, torn — заметка, index — карточка, suspect — подозреваемый, question — вопрос, report — протокол и т.п.' }, title: { type: 'string' }, text: { type: 'string' }, fields: { type: 'object', description: 'для suspect: {"Возраст":"42","Алиби":"..."}', additionalProperties: { type: 'string' } }, invisible_ink: { type: 'string', description: 'текст, видимый только под УФ-лампой' }, near_item_id: { type: 'string', description: 'положить рядом с этой уликой' }, pin: { type: 'boolean', description: 'сразу приколоть иглой (нужно для нитей)' } }, ['code', 'title']) },
  { name: 'update_card', description: 'Изменить улику: заголовок/текст, или дописать заметку от ИИ.', inputSchema: S({ code, item_id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' }, append: { type: 'string', description: 'дописать строку (видно, что дописал ИИ)' } }, ['code', 'item_id']) },
  { name: 'add_thread', description: 'Протянуть нить между двумя уликами (обе будут приколоты иглами).', inputSchema: S({ code, from_item_id: { type: 'string' }, to_item_id: { type: 'string' }, kind: { type: 'string', enum: Object.keys(THREADS), description: 'fact — красная (точный факт), maybe — жёлтая (неточный), reason — зелёная (рассуждение)' }, label: { type: 'string' } }, ['code', 'from_item_id', 'to_item_id']) },
  { name: 'list_library', description: 'Библиотека материалов дела: все загруженные фото, GIF, видео, аудио, 3D-модели, документы и ссылки (в т.ч. прикреплённые к уликам и в чате).', inputSchema: S({ code, type: { type: 'string', enum: Object.values(CATS), description: 'фильтр по виду' } }, ['code']) },
  { name: 'add_to_library', description: 'Добавить ссылку в библиотеку дела (страница, YouTube/Vimeo, прямой URL картинки/видео/аудио/.glb). Можно сразу положить на доску или прикрепить к улике.', inputSchema: S({ code, url: { type: 'string' }, title: { type: 'string' }, place_on_board: { type: 'boolean' }, attach_to_item_id: { type: 'string' } }, ['code', 'url']) },
  { name: 'attach_media', description: 'Прикрепить материал из библиотеки (по url или id) к улике, либо выложить его на доску отдельной карточкой (если item_id не указан).', inputSchema: S({ code, media: { type: 'string', description: 'url или id материала из list_library' }, item_id: { type: 'string' } }, ['code', 'media']) },
  { name: 'stamp_card', description: 'Поставить штамп на улику.', inputSchema: S({ code, item_id: { type: 'string' }, stamp: { type: 'string', enum: Object.keys(STAMPS) } }, ['code', 'item_id', 'stamp']) },
  { name: 'post_message', description: 'Написать в чат дела от имени «ИИ-напарник» (подсказки, версии, вопросы команде).', inputSchema: S({ code, text: { type: 'string' }, item_id: { type: 'string', description: 'сослаться на улику' } }, ['code', 'text']) },
  { name: 'assign_role', description: 'Назначить участнику роль в расследовании (видна у его аватара).', inputSchema: S({ code, member: { type: 'string', description: 'имя или id участника' }, role: { type: 'string', description: 'например: Ведущий детектив, Криминалист, Аналитик' } }, ['code', 'member', 'role']) },
]

const PROMPTS = [{ name: 'detective_partner', description: 'Стать ИИ-напарником следственной группы', arguments: [{ name: 'code', description: 'код дела', required: true }] }]

async function call(name, a) {
  if (name === 'create_case') {
    const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let c = ''; for (let i = 0; i < 8; i++) { c += ALPH[Math.floor(Math.random() * ALPH.length)]; if (i === 3) c += '-' }
    const id = uid()
    await sb('boards', { method: 'POST', body: JSON.stringify({ id, code: c, title: a.title || 'Новое дело', created_by: 'ai' }), headers: { Prefer: 'return=minimal' } })
    return { code: c, url: 'https://detective-board-psi.vercel.app/b/' + c }
  }
  const b = await board(a.code)
  const all = await rows(b.id)
  const by = (id) => all.find(r => r.id === id)
  const extra = await ensureAI(b, all)
  const hist = (item, action, x = {}) => row(b, 'history', { id: uid(), item, author: 'ai', action, ts: Date.now(), ...x })
  if (name === 'get_case') return caseView(b, all, a)
  if (name === 'add_card') {
    const type = TYPES.includes(a.type) ? a.type : 'sticky'
    const [w, h] = SIZE[type]
    const p = place(all, a.near_item_id)
    const id = uid()
    const it = { id, type, x: Math.round(p.x), y: Math.round(p.y), w, h, rot: +(Math.random() * 6 - 3).toFixed(1), z: Date.now(), title: a.title, text: a.text || '', fields: a.fields ? Object.entries(a.fields) : (type === 'suspect' ? [['Возраст', '?'], ['Алиби', '?'], ['Мотив', '?']] : undefined), uv: a.invisible_ink || undefined, media: [], pin: a.pin ? { x: .5, y: .06 } : null, owner: 'ai', layer: 'main', created: Date.now() }
    await upsert([...extra, row(b, 'item', it), hist(id, 'create', { snap: { title: it.title, text: it.text } })])
    return { ok: true, item_id: id }
  }
  if (name === 'update_card') {
    const r = by(a.item_id); if (!r || r.kind !== 'item') throw new Error('Улика не найдена')
    const out = [...extra]
    const patch = {}
    if (a.title !== undefined) patch.title = a.title
    if (a.text !== undefined) patch.text = a.text
    if (Object.keys(patch).length) { out.push(row(b, 'item', { id: r.id, ...patch }, r)); out.push(hist(r.id, 'edit', { snap: { title: patch.title ?? r.data.title, text: patch.text ?? r.data.text } })) }
    if (a.append) out.push(hist(r.id, 'append', { text: a.append }))
    await upsert(out)
    return { ok: true }
  }
  if (name === 'add_thread') {
    const A = by(a.from_item_id), B = by(a.to_item_id)
    if (!A || !B) throw new Error('Улика не найдена')
    const kind = THREADS[a.kind] ? a.kind : 'reason'
    const out = [...extra]
    for (const r of [A, B]) if (!r.data.pin) out.push(row(b, 'item', { id: r.id, pin: { x: .5, y: .06 } }, r))
    out.push(row(b, 'thread', { id: uid(), layer: A.data.layer || 'main', a: A.id, b: B.id, kind, label: a.label || '', owner: 'ai', created: Date.now() }))
    out.push(hist(A.id, 'thread', { text: `${THREADS[kind]}: → «${B.data.title}»` }), hist(B.id, 'thread', { text: `${THREADS[kind]}: ← «${A.data.title}»` }))
    await upsert(out)
    return { ok: true }
  }
  if (name === 'list_library') {
    const usedTitle = (id) => by(id)?.data?.title
    return library(all).filter(m => !a.type || CATS[cat(m)] === a.type).map(m => ({ id: m.id, type: CATS[cat(m)], name: m.link?.title || m.name, url: m.url, size: m.size, on_cards: m.used.map(usedTitle).filter(Boolean) }))
  }
  const mediaCard = (m, near) => {
    const type = CARD_FOR[m.kind] || 'folder', [w, h] = SIZE[type] || [260, 220], p = place(all, near), id = uid()
    return [row(b, 'item', { id, type, x: Math.round(p.x), y: Math.round(p.y), w, h, rot: +(Math.random() * 4 - 2).toFixed(1), z: Date.now(), title: (m.link?.title || m.name || '').slice(0, 60), text: '', media: [m], pin: null, owner: 'ai', layer: 'main', created: Date.now() }), hist(id, 'create', { snap: { title: m.name } })]
  }
  const attachTo = (r, m) => [row(b, 'item', { id: r.id, media: [...(r.data.media || []).filter(x => x.url !== m.url), m] }, r), hist(r.id, 'attach', { text: m.link?.title || m.name })]
  if (name === 'add_to_library') {
    let url = String(a.url).trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const kind = kindOf(url), id = uid()
    const m = kind === 'link' ? { id, url, name: a.title || new URL(url).hostname, mime: 'text/uri-list', kind, link: { ...linkInfo(url), title: a.title } } : { id, url, name: a.title || decodeURIComponent(url.split(/[?#]/)[0].split('/').pop()), mime: '', kind, src: 'link' }
    const out = [...extra, row(b, 'media', { ...m, by: 'ai', ts: Date.now() }, null)]
    out[out.length - 1].id = 'lib_' + id
    if (a.attach_to_item_id) { const r = by(a.attach_to_item_id); if (!r) throw new Error('Улика не найдена'); out.push(...attachTo(r, m)) }
    else if (a.place_on_board) out.push(...mediaCard(m))
    await upsert(out)
    return { ok: true, media_id: id, type: CATS[cat(m)] }
  }
  if (name === 'attach_media') {
    const m0 = library(all).find(m => m.url === a.media || m.id === a.media); if (!m0) throw new Error('Материал не найден в библиотеке')
    const { used, by: _b, ts, ...m } = m0
    const out = [...extra]
    if (a.item_id) { const r = by(a.item_id); if (!r || r.kind !== 'item') throw new Error('Улика не найдена'); out.push(...attachTo(r, m)) }
    else out.push(...mediaCard(m))
    await upsert(out)
    return { ok: true }
  }
  if (name === 'stamp_card') {
    const r = by(a.item_id); if (!r) throw new Error('Улика не найдена')
    const marks = [...(r.data.marks || []), { id: uid(), t: 'stamp', k: STAMPS[a.stamp] ? a.stamp : 'checked', x: .5 + Math.random() * .2 - .1, y: .55, rot: Math.round(Math.random() * 24 - 12), by: 'ai', ts: Date.now() }]
    await upsert([...extra, row(b, 'item', { id: r.id, marks }, r), hist(r.id, 'stamp', { text: STAMPS[a.stamp] })])
    return { ok: true }
  }
  if (name === 'post_message') {
    const it = a.item_id && by(a.item_id)
    await upsert([...extra, row(b, 'message', { id: uid(), author: 'ai', text: a.text, ts: Date.now(), files: [], remind: null, item: it ? { id: it.id, title: it.data.title } : null })])
    return { ok: true }
  }
  if (name === 'assign_role') {
    const q = String(a.member).toLowerCase()
    const m = live(all).find(r => r.kind === 'member' && (r.data.user === a.member || (r.data.name || '').toLowerCase() === q))
      || live(all).find(r => r.kind === 'member' && (r.data.name || '').toLowerCase().includes(q))
    if (!m) throw new Error('Участник не найден')
    await upsert([...extra, row(b, 'member', { id: m.id, role: a.role }, m), row(b, 'message', { id: uid(), author: 'ai', text: `🎖 ${m.data.name} назначен(а): ${a.role}`, ts: Date.now(), files: [], remind: null, item: null })])
    return { ok: true }
  }
  throw new Error('Неизвестный инструмент ' + name)
}

async function handle(msg) {
  const { id, method, params = {} } = msg
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  try {
    if (method === 'initialize') return ok({ protocolVersion: params.protocolVersion || '2025-03-26', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'detective-board', version: '1.0.0' }, instructions: 'Вы — ИИ-напарник следственной группы на «Доске детектива». Получите дело через get_case по коду, анализируйте улики и нити, предлагайте версии в чате (post_message), добавляйте улики и связи, назначайте роли.' })
    if (method === 'ping') return ok({})
    if (method === 'tools/list') return ok({ tools: TOOLS })
    if (method === 'prompts/list') return ok({ prompts: PROMPTS })
    if (method === 'prompts/get') return ok({ messages: [{ role: 'user', content: { type: 'text', text: `Подключись к делу ${params.arguments?.code} через get_case. Изучи улики, нити, заметки и чат. Найди противоречия и пробелы, предложи 2–3 версии, задай вопросы команде через post_message и, если уверен, добавь недостающие связи (add_thread).` } }] })
    if (method === 'resources/list') return ok({ resources: [] })
    if (method === 'tools/call') {
      try {
        const res = await call(params.name, params.arguments || {})
        return ok({ content: [{ type: 'text', text: JSON.stringify(res, null, 1) }] })
      } catch (e) { return ok({ content: [{ type: 'text', text: 'Ошибка: ' + e.message }], isError: true }) }
    }
    if (id === undefined) return null
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } }
  } catch (e) { return { jsonrpc: '2.0', id, error: { code: -32603, message: e.message } } }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method === 'GET') {
    if ((req.headers.accept || '').includes('text/event-stream')) return res.status(405).end()
    return res.status(200).json({ name: 'detective-board MCP', transport: 'streamable-http', endpoint: '/api/mcp', tools: TOOLS.map(t => t.name), supabase: !!(SB_URL && SB_KEY) })
  }
  if (req.method === 'DELETE') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()
  let body = req.body
  if (typeof body === 'string') body = JSON.parse(body || 'null')
  if (!body) { const chunks = []; for await (const c of req) chunks.push(c); body = JSON.parse(Buffer.concat(chunks).toString() || 'null') }
  const batch = Array.isArray(body)
  const out = (await Promise.all((batch ? body : [body]).map(handle))).filter(Boolean)
  if (!out.length) return res.status(202).end()
  res.setHeader('Content-Type', 'application/json')
  return res.status(200).send(JSON.stringify(batch ? out : out[0]))
}
