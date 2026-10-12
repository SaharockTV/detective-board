// Бланки и носители улик. Без постановочных фото — только реальные материалы пользователя.
export const TEMPLATES = [
  { type: 'polaroid', name: 'Фотоснимок', w: 210, h: 250, title: '' },
  { type: 'photo', name: 'Фото 10×15', w: 260, h: 190, title: '' },
  { type: 'index', name: 'Карточка', w: 270, h: 170, title: 'Заголовок', text: '' },
  { type: 'torn', name: 'Лист блокнота', w: 230, h: 270, title: 'Заметка', text: '' },
  { type: 'sticky', name: 'Стикер', w: 170, h: 170, title: '', text: '' },
  { type: 'suspect', name: 'Карточка лица', w: 300, h: 210, title: 'Фамилия Имя Отчество', fields: [['Дата рожд.', ''], ['Адрес', ''], ['Телефон', ''], ['Роль', '']] },
  { type: 'report', name: 'Протокол', w: 260, h: 320, title: 'ПРОТОКОЛ', text: '' },
  { type: 'evidence', name: 'Пакет вещдока', w: 220, h: 270, title: 'Вещественное доказательство' },
  { type: 'newspaper', name: 'Вырезка / распечатка', w: 260, h: 230, title: 'Заголовок', text: '' },
  { type: 'map', name: 'Карта / схема', w: 300, h: 220, title: 'Схема места' },
  { type: 'receipt', name: 'Чек / выписка', w: 160, h: 250, title: 'Чек', text: '' },
  { type: 'folder', name: 'Папка документов', w: 270, h: 200, title: 'Документы', text: '' },
  { type: 'audio', name: 'Аудиозапись', w: 260, h: 160, title: 'Аудиозапись' },
  { type: 'video', name: 'Кадр с камеры', w: 290, h: 210, title: 'Камера наблюдения' },
  { type: 'model', name: '3D-объект', w: 230, h: 230, title: '3D-модель' },
  { type: 'question', name: 'Вопрос', w: 180, h: 140, title: '?', text: '' },
]
export const TPL = Object.fromEntries(TEMPLATES.map(t => [t.type, t]))
TPL.tent = { type: 'tent', name: 'Метка' }
TPL.link = { type: 'link', name: 'Ссылка', w: 280, h: 230, title: '' }

export const typeForKind = { image: 'photo', video: 'video', audio: 'audio', model: 'model', file: 'folder', link: 'link' }
export const PHOTO_TYPES = new Set(['polaroid', 'photo', 'suspect', 'evidence', 'map'])

export function makeItem(type, { x, y, owner, layer, photo, media, title, text, z, fields }) {
  const t = TPL[type] || TPL.torn
  const m = media ? [media] : photo ? [{ id: 'art', url: photo.url, name: photo.name, mime: 'image/webp', kind: 'image' }] : []
  return {
    type, x: Math.round(x - t.w / 2), y: Math.round(y - t.h / 2), w: t.w, h: t.h,
    rot: +(Math.random() * 3 - 1.5).toFixed(1), z: z ?? Date.now(),
    title: title ?? t.title ?? '', text: text ?? t.text ?? '', fields: fields || (t.fields ? t.fields.map(f => [...f]) : undefined),
    media: m, pin: null, owner, layer, created: Date.now(),
  }
}
