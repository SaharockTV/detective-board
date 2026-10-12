import React, { useEffect, useRef, useState } from 'react'
import { TPL } from '../assets/catalog'
import { MediaView, useAutoGrow } from '../components/Media'
import { DESTROY } from './Destroy'
import { LibraryModal } from './Library'
import { THREADS, timeAgo, fmtTime, uid, initials } from '../lib/util'

const ACT = { create: 'создал(а) улику', edit: 'изменил(а) текст', append: 'дописал(а)', attach: 'прикрепил(а) файл', detach: 'убрал(а) файл', pin: 'приколол(а) иглой', unpin: 'снял(а) с иглы', thread: 'протянул(а) нить', restore: 'восстановил(а)', destroy: 'уничтожил(а) улику', stamp: 'поставил(а) штамп' }

export default function DetailPanel({ item, me, members, history, canEdit, threads, items, actions, put, onClose, library = [], upload, addLink }) {
  const [libOpen, setLibOpen] = useState(false)
  const [title, setTitle] = useState(item.title || '')
  const [text, setText] = useState(item.text || '')
  const [fields, setFields] = useState(item.fields || null)
  const [add, setAdd] = useState('')
  const [htab, setHtab] = useState('notes')
  const [over, setOver] = useState(false)
  const [uv, setUv] = useState(item.uv || '')
  const uvT = useRef(null)
  const [kill, setKill] = useState(false)
  const fileRef = useRef(null)
  const timer = useRef(null)
  const dirty = useRef(false)
  const textRef = useAutoGrow(text)
  const owner = members[item.owner]
  const tpl = TPL[item.type] || {}

  // принимать удалённые изменения, пока мы не печатаем
  useEffect(() => {
    if (dirty.current) return
    setTitle(item.title || ''); setText(item.text || ''); setFields(item.fields || null)
  }, [item.title, item.text, JSON.stringify(item.fields)])

  const schedule = (patch) => {
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(patch), 700)
  }
  const latest = useRef({}); latest.current = { title, text, fields }
  function commit() {
    dirty.current = false
    const snap = { ...latest.current }
    put('item', snap, item.id)
    // склеиваем серию правок одного автора в одну версию (3 минуты)
    const last = history.find(h => h.action === 'edit')
    if (last && last.author === me.id && Date.now() - last.ts < 180000 && history[0]?.id === last.id) put('history', { snap, ts: Date.now() }, last.id)
    else put('history', { id: uid(), item: item.id, author: me.id, action: 'edit', ts: Date.now(), snap })
  }
  useEffect(() => () => { if (dirty.current) { clearTimeout(timer.current); commit() } }, [])

  const sendAppend = () => {
    if (!add.trim()) return
    put('history', { id: uid(), item: item.id, author: me.id, action: 'append', ts: Date.now(), text: add.trim() })
    setAdd('')
  }
  const restore = (h) => {
    const s = h.snap || {}
    setTitle(s.title || ''); setText(s.text || ''); if (s.fields) setFields(s.fields)
    put('item', { title: s.title || '', text: s.text || '', ...(s.fields ? { fields: s.fields } : {}) }, item.id)
    put('history', { id: uid(), item: item.id, author: me.id, action: 'restore', ts: Date.now(), snap: s, text: 'версия от ' + fmtTime(h.ts) })
  }

  const appends = history.filter(h => h.action === 'append').slice().reverse()
  const media = (item.media || [])
  const other = (id) => items.find(i => i.id === id)

  const onDrop = (e) => {
    e.preventDefault(); setOver(false)
    const lm = e.dataTransfer.getData('application/x-media')
    if (canEdit && lm) return actions.attachMedia(item.id, [JSON.parse(lm)])
    if (canEdit && e.dataTransfer.files?.length) actions.attach(item.id, [...e.dataTransfer.files])
  }

  return (
    <div className={'detail' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <div className="dt-head">
        <span className="dt-type">{tpl.icon} {tpl.name}</span>
        <span className="dt-owner" style={{ '--c': owner?.color }}><i>{initials(owner?.name)}</i>{owner?.name || '?'}</span>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <div className="dt-sub">заведено {fmtTime(item.created || item._ts)} · {item.pin ? 'приколото' : 'не приколото'}</div>

      <div className={'dt-paper p-' + item.type}>
        <input className="dt-title" value={title} disabled={!canEdit} placeholder="Заголовок" onChange={e => { setTitle(e.target.value); schedule() }} />
        {fields && (
          <div className="dt-fields">
            {fields.map(([k, v], i) => (
              <div key={i} className="dt-field">
                <input value={k} disabled={!canEdit} onChange={e => { const f = fields.map(x => [...x]); f[i][0] = e.target.value; setFields(f); schedule() }} />
                <input value={v} disabled={!canEdit} onChange={e => { const f = fields.map(x => [...x]); f[i][1] = e.target.value; setFields(f); schedule() }} />
                {canEdit && <button onClick={() => { setFields(fields.filter((_, j) => j !== i)); schedule() }}>×</button>}
              </div>
            ))}
            {canEdit && <button className="link" onClick={() => { setFields([...fields, ['Поле', '']]); schedule() }}>+ поле</button>}
          </div>
        )}
        <textarea ref={textRef} className="dt-text" value={text} disabled={!canEdit} placeholder={canEdit ? 'Пишите здесь… всё сохраняется автоматически' : ''} onChange={e => { setText(e.target.value); schedule() }} />
        {appends.length > 0 && (
          <div className="dt-appends">
            {appends.map(a => (
              <div key={a.id} className="dt-append" style={{ '--c': members[a.author]?.color }}>
                <span className="who">{members[a.author]?.name || '?'} · {timeAgo(a.ts)}</span>
                <div>{a.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dt-add">
        <textarea value={add} onChange={e => setAdd(e.target.value)} placeholder="Дописать от себя… (видно, кто дописал)" rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendAppend() }} />
        <button className="btn primary sm" onClick={sendAppend} disabled={!add.trim()}>Дописать</button>
      </div>

      <section className="dt-sec uv-sec">
        <div className="dt-sec-h">Невидимые чернила <span>видно только под УФ-лампой</span></div>
        <textarea value={uv} disabled={!canEdit} rows={2} placeholder={canEdit ? 'Тайная пометка… проявится под УФ (U)' : ''}
          onChange={e => { const v = e.target.value; setUv(v); clearTimeout(uvT.current); uvT.current = setTimeout(() => put('item', { uv: v }, item.id), 600) }} />
      </section>

      {item.marks?.length > 0 && (
        <section className="dt-sec">
          <div className="dt-sec-h">Штампы и скотч <span>{item.marks.length}</span></div>
          <div className="marks-list">
            {item.marks.map(m => (
              <span key={m.id} className="mk-chip" style={{ '--c': members[m.by]?.color }}>{m.t === 'tape' ? 'скотч' : ({ secret: 'СЕКРЕТНО', ok: 'ПОДТВЕРЖДЕНО', lie: 'ЛОЖЬ', checked: 'ПРОВЕРЕНО', alibi: 'АЛИБИ', closed: 'ЗАКРЫТО' }[m.k] || m.k)}
                {canEdit && <button onClick={() => actions.removeMark(item.id, m.id)}>×</button>}</span>
            ))}
          </div>
        </section>
      )}

      <section className="dt-sec">
        <div className="dt-sec-h">Материалы <span>{media.filter(m => m.id !== 'art').length}</span>
          {canEdit && <span className="dt-btns"><button className="btn sm" onClick={() => setLibOpen(true)}>Из библиотеки</button><button className="btn sm" onClick={() => fileRef.current.click()}>Файл</button></span>}
        </div>
        <input ref={fileRef} type="file" multiple hidden onChange={e => { actions.attach(item.id, [...e.target.files]); e.target.value = '' }} />
        <div className="dt-media">
          {media.map(m => (
            <div key={m.id} className={'dt-m k-' + m.kind}>
              <MediaView m={m} />
              {canEdit && <button className="rm" title="Убрать" onClick={() => actions.removeMedia(item.id, m.id)}>×</button>}
            </div>
          ))}
          {media.length === 0 && <div className="dt-drop">Перетащите сюда фото, видео, GIF, аудио, .glb-модель — или материал из библиотеки</div>}
        </div>
      </section>

      {threads.length > 0 && (
        <section className="dt-sec">
          <div className="dt-sec-h">Связи <span>{threads.length}</span></div>
          {threads.map(t => {
            const o = other(t.a === item.id ? t.b : t.a)
            return (
              <div key={t.id} className="dt-link" onClick={() => o && actions.focus(o.id)} style={{ '--c': THREADS[t.kind]?.color }}>
                <i />{THREADS[t.kind]?.short} → <b>{o?.title || 'без названия'}</b>{t.label && <em> «{t.label}»</em>}
              </div>
            )
          })}
        </section>
      )}

      <section className="dt-sec">
        <div className="dt-sec-h">История <span>{history.length}</span>
          <div className="seg">
            <button className={htab === 'notes' ? 'on' : ''} onClick={() => setHtab('notes')}>все</button>
            <button className={htab === 'versions' ? 'on' : ''} onClick={() => setHtab('versions')}>версии</button>
          </div>
        </div>
        <div className="timeline">
          {history.filter(h => htab === 'notes' || h.snap).map(h => (
            <div key={h.id} className="tl" style={{ '--c': members[h.author]?.color }}>
              <div className="tl-h"><b>{members[h.author]?.name || '?'}</b> {ACT[h.action] || h.action} <span>{timeAgo(h.ts)}</span></div>
              {h.text && <div className="tl-t">{h.text}</div>}
              {h.snap && h.action !== 'append' && (
                <details>
                  <summary>текст версии</summary>
                  <div className="tl-snap"><b>{h.snap.title}</b>{'\n'}{h.snap.text}</div>
                  {canEdit && <button className="link" onClick={() => restore(h)}>↺ Восстановить эту версию</button>}
                </details>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="dt-actions">
        {canEdit && item.pin && <button className="btn sm" onClick={() => actions.unpin(item.id)}>Снять с иглы</button>}
        {(item.layer && item.layer !== 'main') && item.owner === me.id && <button className="btn sm" onClick={() => actions.copyToMain(item.id)}>⇪ На общую доску</button>}
        {canEdit && !kill && <button className="btn sm danger" onClick={() => setKill(true)}>Уничтожить…</button>}
        {canEdit && kill && (
          <div className="kill-menu">
            {Object.entries(DESTROY).map(([k, d]) => <button key={k} className="btn sm danger" onClick={() => actions.destroyItem(item.id, k)}>{d.name}</button>)}
            <button className="btn sm" onClick={() => setKill(false)}>Отмена</button>
          </div>
        )}
      </div>
      {libOpen && <LibraryModal library={library} members={members} canEdit={canEdit} upload={upload} addLink={addLink} onClose={() => setLibOpen(false)} onPick={(l) => { actions.attachMedia(item.id, l); setLibOpen(false) }} />}
    </div>
  )
}