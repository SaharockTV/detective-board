import React from 'react'

// Строгие линейные иконки (24×24, stroke = currentColor)
const P = {
  select: <path d="M5 3l14 8-6 1.6L10 19z" />,
  hand: <><path d="M8 13V5.5a1.5 1.5 0 013 0V12" /><path d="M11 11.5V4a1.5 1.5 0 013 0v7.5" /><path d="M14 11.5V6a1.5 1.5 0 013 0v8c0 4-2.5 7-6.5 7S5 19 4 16l-1.5-3.5a1.4 1.4 0 012.4-1.4L8 14" /></>,
  pin: <><circle cx="12" cy="7" r="4" /><path d="M12 11v10" /><path d="M9 10.5h6" /></>,
  thread: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M6.5 7.3C10 12 11 14 17.5 16.8" /></>,
  draw: <><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></>,
  erase: <><path d="M8 20h12" /><path d="M5.5 15.5l9-9a2 2 0 012.8 0l1.2 1.2a2 2 0 010 2.8L12 17H8z" /><path d="M9 12l4 4" /></>,
  stamp: <><path d="M9 12V9a3 3 0 116 0v3" /><path d="M5 12h14v4H5z" /><path d="M4 20h16" /></>,
  tape: <><path d="M4 9l3-3 13 13-3 3z" /><path d="M7 6l1.5 1.5M10 9l1.5 1.5M13 12l1.5 1.5" /></>,
  tent: <><path d="M6 20L9 6h6l3 14z" /><path d="M10.5 14h3M12 11v5" /></>,
  loupe: <><circle cx="10" cy="10" r="6" /><path d="M14.5 14.5L20 20" /></>,
  torch: <><path d="M9 3h6v5l-1.5 3v10h-3V11L9 8z" /><path d="M9 6h6" /></>,
  uv: <><path d="M8 3h8v6H8z" /><path d="M10 9v3M14 9v3" /><path d="M5 21l3-7h8l3 7" opacity=".6" /></>,
  tray: <><path d="M3 7h18v13H3z" /><path d="M3 7l2-4h14l2 4" /><path d="M9 11h6" /></>,
  card: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h7" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  upload: <><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  folder: <path d="M3 6h7l2 2h9v11H3z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  clip: <path d="M8 12l6-6a3 3 0 014 4l-8 8a5 5 0 01-7-7l7-7" />,
  fire: <path d="M12 21c-4 0-6-2.5-6-6 0-4 4-6 4-11 3 2 7 6 7 11 0 3.5-2 6-5 6z" />,
  archive: <><path d="M3 4h18v4H3z" /><path d="M5 8v12h14V8" /><path d="M10 12h4" /></>,
  library: <><path d="M4 4h4v16H4z" /><path d="M10 4h4v16h-4z" /><path d="M16.5 4.5l3.6 1 -3.9 14.5-3.6-1z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
}

export default function Icon({ n, size = 20, sw = 1.7, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      {P[n] || null}
    </svg>
  )
}
