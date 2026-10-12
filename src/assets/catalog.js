import { ART } from './art'

// Набор «бумажек». size — базовый размер карточки, face — вариант оформления
export const TEMPLATES = [
  { type: 'polaroid', name: 'Полароид', icon: '📷', w: 200, h: 240, title: 'Снимок', photo: ART.street },
  { type: 'photo', name: 'Фото', icon: '🖼️', w: 230, h: 180, title: 'Фото с места', photo: ART.house },
  { type: 'torn', name: 'Вырванный лист', icon: '📄', w: 230, h: 260, title: 'Заметка', text: 'Что я видел...' },
  { type: 'sticky', name: 'Стикер', icon: '🟨', w: 170, h: 170, title: '', text: 'Проверить!' },
  { type: 'index', name: 'Карточка', icon: '🗂️', w: 260, h: 160, title: 'Улика', text: '' },
  { type: 'suspect', name: 'Подозреваемый', icon: '🕵️', w: 280, h: 200, title: 'Неизвестный', photo: ART.man, fields: [['Возраст', '?'], ['Алиби', 'нет'], ['Мотив', '?']] },
  { type: 'newspaper', name: 'Вырезка', icon: '📰', w: 260, h: 230, title: 'ЗАГОЛОВОК', text: 'Текст статьи...' },
  { type: 'report', name: 'Протокол', icon: '🧾', w: 250, h: 300, title: 'ПРОТОКОЛ ОСМОТРА', text: '' },
  { type: 'evidence', name: 'Вещдок', icon: '🧷', w: 210, h: 250, title: 'Вещдок №1', photo: ART.key },
  { type: 'map', name: 'Карта', icon: '🗺️', w: 280, h: 220, title: 'Район', photo: ART.map },
  { type: 'receipt', name: 'Чек', icon: '🧾', w: 150, h: 240, title: 'Кафе «Луна»', text: 'Кофе ×2 ..... 380\nПирог ....... 220\n23:14' },
  { type: 'folder', name: 'Папка дела', icon: '📁', w: 260, h: 190, title: 'ДЕЛО №', text: 'Секретно' },
  { type: 'audio', name: 'Аудио', icon: '📼', w: 230, h: 150, title: 'Запись допроса' },
  { type: 'video', name: 'Видео', icon: '🎞️', w: 260, h: 200, title: 'Камера наблюдения' },
  { type: 'model', name: '3D-улика', icon: '🧊', w: 220, h: 220, title: '3D-модель' },
  { type: 'question', name: 'Вопрос', icon: '❓', w: 150, h: 150, title: '?', text: 'Кто?' },
]
export const TPL = Object.fromEntries(TEMPLATES.map(t => [t.type, t]))

// Тип карточки по загружаемому файлу
export const typeForKind = { image: 'polaroid', video: 'video', audio: 'audio', model: 'model', file: 'folder' }

export const PHOTO_TYPES = new Set(['polaroid', 'photo', 'suspect', 'evidence', 'map'])

export function makeItem(type, { x, y, owner, layer, photo, media, title, text, z }) {
  const t = TPL[type] || TPL.torn
  const m = media ? [media] : (photo || t.photo) ? [{ id: 'art', url: (photo || t.photo).url, name: (photo || t.photo).name, mime: 'image/svg+xml', kind: 'image' }] : []
  return {
    type, x: Math.round(x - t.w / 2), y: Math.round(y - t.h / 2), w: t.w, h: t.h,
    rot: +(Math.random() * 6 - 3).toFixed(1), z: z ?? Date.now(),
    title: title ?? t.title ?? '', text: text ?? t.text ?? '', fields: t.fields ? t.fields.map(f => [...f]) : undefined,
    media: m, pin: null, owner, layer, created: Date.now(),
  }
}