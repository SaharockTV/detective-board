import React, { useMemo } from 'react'
import Card from './Card'

export const DESTROY = {
  burn: { name: 'Сжечь', past: 'сжёг(ла) улику', ms: 3300 },
  shred: { name: 'В шредер', past: 'пропустил(а) через шредер', ms: 2600 },
  crumple: { name: 'Скомкать', past: 'скомкал(а) и выбросил(а)', ms: 2000 },
}

const rnd = (a, b) => a + Math.random() * (b - a)

// «Призрак» улики, которая уничтожается: анимация видна всем участникам
export default function Ghost({ g, owner }) {
  const it = g.it
  const { w, h } = it
  const seed = useMemo(() => ({
    bx: rnd(25, 75), by: rnd(60, 95),
    flames: Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * 360 + rnd(-8, 8), d: rnd(0, .35), s: rnd(.7, 1.3) })),
    smoke: Array.from({ length: 7 }, () => ({ x: rnd(15, 85), d: rnd(.2, 1.4), s: rnd(.8, 1.6) })),
    ash: Array.from({ length: 26 }, () => ({ x: rnd(0, 100), y: rnd(10, 100), d: rnd(.9, 2), dx: rnd(-60, 60), r: rnd(-200, 200), s: rnd(3, 9) })),
    strips: Array.from({ length: 12 }, () => ({ r: rnd(-5, 5), d: rnd(0, .12), dx: rnd(-6, 6) })),
    toss: rnd(-1, 1) > 0 ? 1 : -1,
  }), [g.key])
  const card = <Card it={it} x={0} y={0} w={w} h={h} rot={0} owner={owner} />
  const base = { left: it.x, top: it.y, width: w, height: h, '--w': w + 'px', '--h': h + 'px' }

  if (g.mode === 'shred') {
    const n = seed.strips.length, sw = w / n, body = 64
    return (
      <div className="ghost shred" style={{ ...base, transform: `rotate(${(it.rot || 0) * 0.3}deg)` }}>
        <div className="sh-feed" style={{ height: h + 4 }}><div className="sh-card">{card}</div></div>
        <div className="shredder" style={{ top: h, height: body }}><i className="sh-slot" /><i className="sh-led" /><b>DOCU·SHRED 3000</b></div>
        <div className="sh-out" style={{ top: h + body, height: h + 60 }}>
          {seed.strips.map((s, i) => (
            <div key={i} className="sh-strip" style={{ left: i * sw, width: sw - 1, '--r': s.r + 'deg', '--dx': s.dx + 'px', animationDelay: s.d + 's', '--top': -(h + body) + 'px' }}>
              <div style={{ position: 'absolute', left: -i * sw, top: 0, width: w, height: h }}>{card}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (g.mode === 'crumple') {
    return (
      <div className="ghost crumple" style={{ ...base, transform: `rotate(${it.rot || 0}deg)`, '--toss': seed.toss }}>
        <div className="cr-card">{card}<div className="cr-creases" /></div>
        <div className="cr-ball" style={{ left: w / 2 - 45, top: h / 2 - 45 }} />
      </div>
    )
  }

  // burn
  const R = Math.hypot(Math.max(seed.bx, 100 - seed.bx) * w / 100, Math.max(seed.by, 100 - seed.by) * h / 100) 
  return (
    <div className="ghost burn" style={{ ...base, transform: `rotate(${it.rot || 0}deg)`, '--bx': seed.bx + '%', '--by': seed.by + '%', '--R': R + 'px' }}>
      <div className="scorch" />
      <div className="bn-card">{card}<div className="bn-char" /><div className="bn-glow" /></div>
      <div className="bn-clip"><div className="bn-flames" style={{ left: seed.bx + '%', top: `calc(${seed.by / 100} * var(--h) + 60px)` }}>
        {seed.flames.map((f, i) => (
          <div key={i} className="bn-arm" style={{ '--a': f.a + 'deg', animationDelay: f.d + 's' }}>
            <i className="flame" style={{ '--s': f.s, animationDelay: (f.d + i * .03) + 's' }} />
          </div>
        ))}
      </div></div>
      {seed.smoke.map((s, i) => <i key={i} className="smoke" style={{ left: s.x + '%', '--s': s.s, animationDelay: s.d + 's' }} />)}
      {seed.ash.map((a, i) => <i key={i} className="ash" style={{ left: a.x + '%', top: a.y + '%', width: a.s, height: a.s * .7, '--dx': a.dx + 'px', '--r': a.r + 'deg', animationDelay: a.d + 's' }} />)}
    </div>
  )
}
