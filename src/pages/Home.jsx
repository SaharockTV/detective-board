import React, { useEffect, useState } from 'react'
import { navigate } from '../App'
import { ChalkBoard, ChalkDefs } from '../components/Chalk'
import { getBackend, CLOUD } from '../lib/backend'
import { genCode, uid, normCode, PALETTE } from '../lib/util'
import { getRecent, removeRecent } from '../lib/identity'
import { PRESETS, presetRows } from '../assets/presets'

const IDEAS = ['Дело № 1', 'Проверка по заявлению', 'Материалы расследования']

export default function Home({ me, setMe }) {
  const [title, setTitle] = useState('')
  const [name, setName] = useState(me.name || '')
  const [preset, setPreset] = useState('empty')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState(null)
  const [recent, setRecent] = useState(getRecent)
  const [ph] = useState(() => IDEAS[Math.floor(Math.random() * IDEAS.length)])

  const ensureName = () => {
    const n = name.trim() || me.name || 'Детектив'
    if (n !== me.name) setMe({ ...me, name: n })
    return { ...me, name: n }
  }

  async function create(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const who = ensureName()
      const be = await getBackend()
      const board = { id: uid(), code: genCode(), title: title.trim() || ph, created_by: who.id, created_at: Date.now() }
      await be.createBoard(board)
      const now = Date.now()
      const rows = [
        { kind: 'meta', data: { id: board.id + '_meta', title: board.title } },
        { kind: 'member', data: { id: board.id + '_' + who.id, user: who.id, name: who.name, color: who.color, joined: now } },
        ...presetRows(preset, who.id),
      ].map(r => ({ id: r.data.id, board_id: board.id, kind: r.kind, data: r.data, updated_at: now }))
      await be.putRows(rows)
      setCreated(board)
    } catch (e) { setErr('Не удалось создать доску: ' + (e.message || e)) }
    setBusy(false)
  }

  async function join(e) {
    e.preventDefault()
    const c = normCode(code)
    if (c.length < 9) { setErr('Код выглядит как XXXX-XXXX'); return }
    setBusy(true); setErr('')
    const be = await getBackend()
    const b = await be.getBoardByCode(c).catch(() => null)
    setBusy(false)
    if (!b) { setErr('Дело с таким кодом не найдено' + (CLOUD ? '' : ' (в локальном режиме доступны только доски этого браузера)')); return }
    ensureName()
    navigate('/b/' + c)
  }

  const link = created ? location.origin + '/b/' + created.code : ''

  return (
    <div className="home">
      <ChalkDefs />
            <header className="home-head">
        <ChalkBoard title={title.trim() || 'Доска расследований'} subtitle={new Date().toLocaleDateString('ru-RU')} className="home-chalk" />
      </header>

      <main className="home-grid">
        <section className="case-card paper">
          <div className="clip" />
          <div className="folder-label">НОВОЕ ДЕЛО</div>
          {!created ? (
            <form onSubmit={create}>
              <label>Название дела
                <input value={title} maxLength={48} onChange={e => setTitle(e.target.value)} placeholder={ph} />
              </label>
              <label>Ваше имя
                <input value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Детектив" />
              </label>
              <div className="row-colors">
                {PALETTE.slice(0, 8).map(c => <button type="button" key={c} className={'sw small' + (me.color === c ? ' on' : '')} style={{ background: c }} onClick={() => setMe({ ...me, color: c })} />)}
              </div>
              <div className="presets-h">Шаблон</div>
              <div className="presets">
                {PRESETS.map(p => (
                  <button type="button" key={p.id} className={'preset' + (preset === p.id ? ' on' : '')} onClick={() => setPreset(p.id)}>
                    <b>{p.name}</b><span>{p.desc}</span>
                  </button>
                ))}
              </div>
              <button className="btn primary big" disabled={busy}>{busy ? 'Заводим дело…' : 'Завести дело'}</button>
            </form>
          ) : (
            <div className="created">
              <p>Дело <b>«{created.title}»</b> заведено. Код доступа:</p>
              <div className="code-big">{created.code}</div>
              <div className="row">
                <button className="btn" onClick={() => navigator.clipboard?.writeText(created.code)}>Копировать код</button>
                <button className="btn" onClick={() => navigator.clipboard?.writeText(link)}>Копировать ссылку</button>
              </div>
              <button className="btn primary big" onClick={() => navigate('/b/' + created.code)}>Войти на доску →</button>
            </div>
          )}
        </section>

        <section className="case-card paper dark">
          <div className="folder-label">ДОСТУП ПО КОДУ</div>
          <form onSubmit={join}>
            <input className="code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" maxLength={9} />
            <label>Ваше имя
              <input value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Детектив" />
            </label>
            <button className="btn primary big" disabled={busy}>Войти</button>
          </form>
          {err && <p className="err">{err}</p>}
          {recent.length > 0 && <>
            <h3>Недавние дела</h3>
            <div className="recent">
              {recent.map(r => (
                <div key={r.code} className="folder-tab" onClick={() => navigate('/b/' + r.code)}>
                  <span className="ft-title">{r.title}</span><span className="ft-code">{r.code}</span>
                  <button title="Убрать из списка" onClick={(e) => { e.stopPropagation(); removeRecent(r.code); setRecent(getRecent()) }}>×</button>
                </div>
              ))}
            </div>
          </>}
        </section>

        <section className="features">
          <div className="feat"><b>Пробковая доска без границ</b><span>Фото, документы, протоколы, видео, аудио и 3D — перетащите файлы прямо на доску.</span></div>
          <div className="feat"><b>Булавки и нити</b><span><i className="lg" style={{ background: '#b3141c' }} />факт · <i className="lg" style={{ background: '#d9a521' }} />не подтверждено · <i className="lg" style={{ background: '#2f7d46' }} />версия</span></div>
          <div className="feat"><b>Работа группой</b><span>Онлайн-курсоры, чат, напоминания, личные столы, роли и полная история правок.</span></div>
        </section>
      </main>
      <footer className="home-foot">{CLOUD ? '● Защищённое облачное хранилище · синхронизация в реальном времени' : '○ Локальный режим: данные в этом браузере, синхронизация между вкладками. Подключите Supabase для работы командой — см. README.'}</footer>
    </div>
  )
}