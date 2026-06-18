'use client'

import Link from 'next/link'

interface Props {
  blockId: number
  title: string
  subtitle: string | null
  color: string | null
}

/**
 * Карточка вводного модуля «Подготовка к обучению» (Блок 0, order_num=0).
 * Всегда открыта, располагается выше чипов и сетки основных блоков.
 */
export function PrepBlockCard({ blockId, title, subtitle, color }: Props) {
  const accent = color ?? '#7C5CFF'

  return (
    <Link
      href={`/m/lesson/${blockId}`}
      className="db-prep-card"
      style={
        {
          '--prep-accent': accent,
        } as React.CSSProperties
      }
    >
      <span className="db-prep-card__badge">Вводный модуль</span>
      <span className="db-prep-card__title">{title}</span>
      {subtitle && <span className="db-prep-card__subtitle">{subtitle}</span>}
      <span className="db-prep-card__cta">Начать ›</span>
    </Link>
  )
}
