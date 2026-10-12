// Реалистичные фотографии для стартового набора (лежат в /public/img)
const P = (k, name) => ({ name, url: `/img/${k}.webp` })

export const ART = {
  man: P('man', 'Человек в плаще'),
  woman: P('woman', 'Свидетельница'),
  house: P('house', 'Дом у реки'),
  car: P('car', 'Седан у дома'),
  print: P('print', 'Отпечаток'),
  steps: P('steps', 'Следы'),
  key: P('key', 'Ключ'),
  map: P('map', 'Карта'),
  street: P('man', 'Улица ночью'),
  phone: P('phone', 'Телефон'),
}

export const STARTER_PHOTOS = Object.entries(ART).filter(([k]) => k !== 'street').map(([k, v]) => ({ key: k, ...v }))
