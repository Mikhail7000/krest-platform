'use client'

import { useMemo } from 'react'
import './starfield.css'

// Детерминированный PRNG (mulberry32) — одинаковые координаты на сервере и
// клиенте, чтобы не было hydration mismatch и звёзды не «прыгали».
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Набор «звёзд» как box-shadow точек на области area×area.
// Слой дублируется со сдвигом по Y (::after) для бесшовного зацикливания.
function buildShadow(count: number, seed: number, area = 2000): string {
  const rand = mulberry32(seed)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * area)
    const y = Math.floor(rand() * area)
    parts.push(`${x}px ${y}px #FFF`)
  }
  return parts.join(', ')
}

interface Props {
  /** Плотность звёзд (по умолчанию средняя) */
  density?: number
}

export function Starfield({ density = 1 }: Props) {
  const small = useMemo(() => buildShadow(Math.round(800 * density), 1), [density])
  const medium = useMemo(() => buildShadow(Math.round(240 * density), 2), [density])
  const large = useMemo(() => buildShadow(Math.round(70 * density), 3), [density])

  return (
    <div className="starfield" aria-hidden="true">
      <div className="starfield__layer starfield__layer--sm" style={{ boxShadow: small }} />
      <div className="starfield__layer starfield__layer--md" style={{ boxShadow: medium }} />
      <div className="starfield__layer starfield__layer--lg" style={{ boxShadow: large }} />
    </div>
  )
}
