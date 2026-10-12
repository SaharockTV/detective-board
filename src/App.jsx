import React, { useEffect, useState } from 'react'
import Home from './pages/Home'
import BoardPage from './board/BoardPage'
import { getMe, saveMe } from './lib/identity'

export function navigate(path) {
  history.pushState(null, '', path)
  window.dispatchEvent(new Event('popstate'))
}

export default function App() {
  const [path, setPath] = useState(location.pathname)
  const [me, setMeState] = useState(getMe)
  useEffect(() => {
    const f = () => setPath(location.pathname)
    window.addEventListener('popstate', f)
    return () => window.removeEventListener('popstate', f)
  }, [])
  const setMe = (m) => { saveMe(m); setMeState(m) }
  const m = path.match(/^\/b\/([A-Za-z0-9-]+)/)
  if (m) return <BoardPage key={m[1]} code={m[1].toUpperCase()} me={me} setMe={setMe} />
  return <Home me={me} setMe={setMe} />
}