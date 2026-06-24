'use client'

import Link from 'next/link'
import { useBlockStatus, type BlockStatusData } from '@/lib/m/block-status-cache'

type Today = BlockStatusData['today']

const TASK_LABELS: { key: keyof Today; label: string }[] = [
  { key: 'cross', label: 'Крест' },
  { key: 'prayer', label: 'Молитва' },
  { key: 'pereskaz', label: 'Пересказ' },
  { key: 'mestopisaniya', label: 'Местописания' },
]

interface Props {
  coursePct: number
  currentBlockId: number | null
  streak: number | null
}

/**
 * Виджет прогресса в правом верхнем углу: кольцо «N% курса», «Дней X/7» в текущем
 * блоке и что осталось закрыть сегодня (или «день закрыт»). Кликабелен → блок.
 */
export function HeaderProgress({ coursePct, currentBlockId, streak }: Props) {
  const status = useBlockStatus(currentBlockId)

  const closedDays = currentBlockId == null ? 0 : status?.closedDays ?? null
  const target = status?.target || 7
  const remaining = status
    ? TASK_LABELS.filter((t) => !status.today[t.key]).map((t) => t.label)
    : null

  const CIRC = 62.83
  const filled = CIRC * (coursePct / 100)
  const href = currentBlockId ? `/m/lesson/${currentBlockId}` : '/m/dashboard'
  const daysDisplay = closedDays === null ? '…' : `${closedDays}/${target}`

  return (
    <Link
      href={href}
      className="hp-widget"
      aria-label={`Прогресс курса ${coursePct}%, в блоке закрыто ${daysDisplay} дней`}
    >
      <svg className="hp-widget__ring" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="hp-widget__ring-track" cx="12" cy="12" r="10" fill="none" strokeWidth="2.5" />
        <circle
          className="hp-widget__ring-fill"
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="2.5"
          strokeDasharray={`${filled} ${CIRC}`}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
        />
      </svg>

      <span className="hp-widget__text">
        <span className="hp-widget__pct">
          {coursePct}%<span className="hp-widget__label">курс</span>
        </span>
        <span className="hp-widget__today">
          <span className="hp-widget__days">Дней {daysDisplay}</span>
          <span className="hp-widget__label">блок</span>
        </span>
        {remaining !== null &&
          (remaining.length === 0 ? (
            <span className="hp-widget__remain hp-widget__remain--done">✓ день закрыт</span>
          ) : (
            <span className="hp-widget__remain">осталось: {remaining.join(', ')}</span>
          ))}
        {streak !== null && streak > 0 && (
          <span className="hp-widget__streak">{streak} дн. подряд</span>
        )}
      </span>
    </Link>
  )
}
