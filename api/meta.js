// Превью ссылок для библиотеки: заголовок, описание и картинка страницы (og:*)
export default async function handler(req, res) {
  const url = String(req.query?.url || '')
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'url required' })
  try {
    const host = new URL(url).hostname
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return res.status(400).json({ error: 'blocked' })
    const oe = /(youtube\.com|youtu\.be)$/.test(host.replace(/^www\./, '')) ? 'https://www.youtube.com/oembed?format=json&url=' : /vimeo\.com$/.test(host) ? 'https://vimeo.com/api/oembed.json?url=' : null
    if (oe) {
      const j = await fetch(oe + encodeURIComponent(url)).then(r => r.ok ? r.json() : null).catch(() => null)
      if (j) { res.setHeader('Cache-Control', 's-maxage=86400'); return res.status(200).json({ title: j.title, description: j.author_name ? 'Автор: ' + j.author_name : undefined, image: j.thumbnail_url, site: j.provider_name }) }
    }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; DetectiveBoardBot/1.0)', 'accept-language': 'ru,en;q=0.8', accept: 'text/html,*/*' } })
    clearTimeout(t)
    const type = r.headers.get('content-type') || ''
    if (!type.includes('html')) return res.status(200).json({ type })
    const reader = r.body.getReader(); const td = new TextDecoder(); let html = "", n = 0
    while (n < 400000) { const { done, value } = await reader.read(); if (done) break; n += value.length; html += td.decode(value, { stream: true }); if (html.includes('</head>')) break }
    reader.cancel().catch(() => {})
    const dec = (s) => s && s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
    const meta = (k) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i')); return m && dec((m[0].match(/content=["']([^"']*)["']/i) || [])[1]) }
    let image = meta('og:image') || meta('twitter:image')
    if (image) try { image = new URL(image, r.url).href } catch {}
    const title = meta('og:title') || meta('twitter:title') || dec((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1])
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
    return res.status(200).json({ title: title?.slice(0, 200), description: (meta('og:description') || meta('description'))?.slice(0, 300), image, site: meta('og:site_name') })
  } catch (e) {
    return res.status(200).json({ error: String(e.message || e) })
  }
}
