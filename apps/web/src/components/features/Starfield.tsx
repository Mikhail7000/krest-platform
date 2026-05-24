'use client'

import { useMemo } from 'react'
import './starfield.css'

// Генерируем набор «звёзд» как box-shadow точек на области 2000×2000px.
// Слой дублируется со сдвигом по Y для бесшовного зацикливания при движении.
function buildShadow(count: number, area = 2000): string {
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * area)
    const y = Math.floor(Math.random() * area)
    parts.push(`${x}px ${y}px #FFF`)
  }
  return parts.join(', ')
}

interface Props {
  /** Плотность звёзд (по умолчанию средняя) */
  density?: number
}

export function Starfield({ density = 1 }: Props) {
  // useMemo + client-only → стабильно в пределах сессии, не прыгает между ре-рендерами
  const small = useMemo(() => buildShadow(Math.round(160 * density)), [density])
  const medium = useMemo(() => buildShadow(Math.round(50 * density)), [density])
  const large = useMemo(() => buildShadow(Math.round(18 * density)), [density])

  return (
    <div className="starfield" aria-hidden="true">
      <div className="starfield__layer starfield__layer--sm" style={{ boxShadow: small }} />
      <div className="starfield__layer starfield__layer--md" style={{ boxShadow: medium }} />
      <div className="starfield__layer starfield__layer--lg" style={{ boxShadow: large }} />
    </div>
  )
}
