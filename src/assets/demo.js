import { ART } from './art'
import { makeItem } from './catalog'
import { uid } from '../lib/util'

// Стартовое «дело» с примером: карточки, булавки и нити
export function demoRows(owner) {
  const L = 'main'
  const mk = (type, x, y, o = {}) => ({ ...makeItem(type, { x, y, owner, layer: L, ...o }), id: uid(), pin: { x: 0.5, y: 0.07 } })
  const a = mk('suspect', -380, -60, { title: 'Харуки Кацура', photo: ART.man })
  a.fields = [['Возраст', '42'], ['Алиби', 'кафе «Луна» до 23:00'], ['Мотив', 'долги?']]
  const b = mk('polaroid', 20, -90, { title: 'Дом у реки', photo: ART.house, text: 'Свет горел всю ночь' })
  const c = mk('torn', 380, -40, { title: 'Свидетель', text: 'Соседка слышала машину около 23:40. Номер не разглядела.' })
  const d = mk('newspaper', -60, 260, { title: 'ИСЧЕЗНОВЕНИЕ В КАЦУРЕ', text: 'Местный бизнесмен не вернулся домой в ночь на пятницу. Полиция просит откликнуться свидетелей.' })
  const e = mk('evidence', 360, 300, { title: 'Ключ от гаража', photo: ART.key })
  const f = mk('receipt', -400, 280, { title: 'Кафе «Луна»', text: 'Кофе ×2 ..... 380\nПирог ....... 220\n\n23:14  Касса 2' })
  const g = mk('sticky', 640, 120, { text: 'Почему ДВА кофе?' })
  const h = mk('photo', 700, -260, { title: 'Машина у дома', photo: ART.car })
  const items = [a, b, c, d, e, f, g, h]
  const th = (x, y, kind, label = '') => ({ id: uid(), layer: L, a: x.id, b: y.id, kind, label, owner, created: Date.now() })
  const threads = [
    th(a, b, 'fact', 'живёт здесь'),
    th(a, f, 'fact', 'чек в кармане'),
    th(c, h, 'maybe', 'та же машина?'),
    th(b, e, 'reason', 'гараж за домом'),
    th(f, g, 'reason'),
    th(d, a, 'fact'),
  ]
  return [
    ...items.map(d => ({ kind: 'item', data: d })),
    ...threads.map(d => ({ kind: 'thread', data: d })),
    ...items.map(it => ({ kind: 'history', data: { id: uid(), item: it.id, author: owner, action: 'create', ts: Date.now(), snap: { title: it.title, text: it.text } } })),
    { kind: 'message', data: { id: uid(), author: owner, text: 'Дело открыто. Кидайте сюда всё, что найдёте 🔎', ts: Date.now(), files: [] } },
  ]
}