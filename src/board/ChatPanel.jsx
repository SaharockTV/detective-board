import React, { useEffect, useRef, useState } from 'react'
import { Thumb, MediaView } from '../components/Media'
import { uid, fmtTime, initials } from '../lib/util'

export default function ChatPanel({ me, members, messages, put, upload, items, focus, selected }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [remind, setRemind] = useState(false)
  const [to, setTo] = useState('all')
  const [at, setAt] = useState('')
  const [ref, setRef] = useState(false)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null)
  const list = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { list.current?.scrollTo(0, list.current.scrollHeight) }, [messages.length])

  async function send(e) {
    e?.preventDefault()
    if (!text.trim() && !files.length) return
    setBusy(true)
    const up = []
    for (const f of files) { try { up.push(await upload(f)) } catch (err) { alert('Не загрузилось: ' + f.name) } }
    put('message', {
      id: uid(), author: me.id, text: text.trim(), ts: Date.now(), files: up,
      remind: remind ? { to, at: at || null, done: false } : null,
      item: ref && selected ? { id: selected.id, title: selected.title } : null,
    })
    setText(''); setFiles([]); setRemind(false); setAt(''); setRef(false); setBusy(false)
  }

  const mine = messages.filter(m => m.remind && !m.remind.done && (m.remind.to === 'all' || m.remind.to === me.id))
  const others = Object.values(members).filter(m => m.user !== me.id)

  return (
    <div className="chat">
      {mine.length > 0 && (
        <div className="reminders">
          <div className="rm-h">⏰ Напоминания для вас</div>
          {mine.slice(-4).map(m => (
            <div key={m.id} className="rm-i">
              <span><b style={{ color: members[m.author]?.color }}>{members[m.author]?.name}</b>: {m.text}{m.remind.at && <em> · {fmtTime(new Date(m.remind.at).getTime())}</em>}</span>
              <button title="Готово" onClick={() => put('message', { remind: { ...m.remind, done: true, doneBy: me.id } }, m.id)}>✓</button>
            </div>
          ))}
        </div>
      )}
      <div className="msgs" ref={list}>
        {messages.length === 0 && <div className="empty-chat">Пока тихо. Оставьте напарникам записку.</div>}
        {messages.map(m => {
          const a = members[m.author]
          const self = m.author === me.id
          return (
            <div key={m.id} className={'msg' + (self ? ' self' : '') + (m.remind ? ' remind' : '')} style={{ '--c': a?.color }}>
              <div className="msg-av">{initials(a?.name)}</div>
              <div className="msg-b">
                <div className="msg-h"><b>{a?.name || '?'}</b><span>{fmtTime(m.ts)}</span></div>
                {m.remind && <div className={'msg-rem' + (m.remind.done ? ' done' : '')}>⏰ Напоминание {m.remind.to === 'all' ? 'всем' : 'для ' + (members[m.remind.to]?.name || '?')}{m.remind.at && ' · ' + fmtTime(new Date(m.remind.at).getTime())}{m.remind.done && ' · выполнено'}</div>}
                {m.text && <div className="msg-t">{m.text}</div>}
                {m.item && <button className="msg-ref" onClick={() => focus(m.item.id)}>📌 {m.item.title || 'улика'}</button>}
                {m.files?.length > 0 && <div className="msg-files">{m.files.map(f => <Thumb key={f.id} m={f} onClick={() => setOpen(f)} />)}</div>}
              </div>
            </div>
          )
        })}
      </div>
      {open && <div className="lightbox" onClick={() => setOpen(null)}><div onClick={e => e.stopPropagation()}><MediaView m={open} /></div></div>}
      <form className="composer" onSubmit={send}>
        {files.length > 0 && <div className="cf">{files.map((f, i) => <span key={i}>📎 {f.name} <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></span>)}</div>}
        {remind && (
          <div className="rem-opts">
            <select value={to} onChange={e => setTo(e.target.value)}>
              <option value="all">Всем</option>
              <option value={me.id}>Себе</option>
              {others.map(o => <option key={o.user} value={o.user}>{o.name}</option>)}
            </select>
            <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} title="Когда напомнить (необязательно)" />
          </div>
        )}
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Сообщение напарникам…" rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <div className="cbar">
          <button type="button" title="Файлы" onClick={() => fileRef.current.click()}>📎</button>
          <button type="button" className={remind ? 'on' : ''} title="Напоминание" onClick={() => setRemind(r => !r)}>⏰</button>
          {selected && <button type="button" className={ref ? 'on' : ''} title={'Сослаться на «' + (selected.title || 'улику') + '»'} onClick={() => setRef(r => !r)}>📌</button>}
          <span className="grow" />
          <button className="btn primary sm" disabled={busy}>{busy ? '…' : 'Отправить'}</button>
        </div>
        <input ref={fileRef} type="file" multiple hidden onChange={e => { setFiles([...files, ...e.target.files]); e.target.value = '' }} />
      </form>
    </div>
  )
}