'use client'

import Link from 'next/link'

/**
 * Вход в ИИ-тренажёр с главного экрана — компактная карточка под прогрессом курса.
 * Ведёт в чат «Учиться вместе с ИИ» — накопительный квиз по всем открытым блокам.
 */
export function AiTrainerEntry({ blockId }: { blockId: number }) {
  return (
    <Link href={`/m/trainer/${blockId}/ai`} className="db-ai-entry">
      <span className="db-ai-entry__spark">✨</span>
      <span className="db-ai-entry__text">
        <span className="db-ai-entry__title">Учиться вместе с ИИ</span>
        <span className="db-ai-entry__sub">ИИ прогонит по открытым блокам — смысл и стихи</span>
      </span>
      <span className="db-ai-entry__arrow">›</span>
    </Link>
  )
}
