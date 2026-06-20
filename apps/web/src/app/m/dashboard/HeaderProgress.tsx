'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

interface TodayStatus {
  cross: boolean
  prayer: boolean
  recitationAudio: boolean
  recitationVideo: boolean
  trainer: boolean
}

interface BlockStatusResponse {
  ok: boolean
  closedDays: number
  target: number
  today: TodayStatus
  quiz: boolean
  friday: boolean
}

interface Props {
  /** % завершения курса (0–100), вычислен в BlockList */
  coursePct: number
  /** ID текущего (первого незавершённого) блока; null — нет активного */
  currentBlockId: number | null
  /** Стрик (дни подряд) */
  streak: number | null
}

/**
 * Компактный виджет в правом верхнем углу шапки:
 * – мини-кольцо «N%» — общий прогресс по курсу (подпись «курс»)
 * – «Дней X/7» — закрытых дней в текущем блоке из block-status (подпись «блок»)
 * – стрик (дней подряд) если > 0
 * Кликабелен — ведёт на /m/lesson/[currentBlockId]
 */
export function HeaderProgress({ coursePct, currentBlockId, streak }: Props) {
  // Закрыто дней в текущем блоке (closedDays) и цель (target=7) из block-status
  const [closedDays, setClosedDays] = useState<number | null>(null)
  const [target, setTarget] = useState(7)

  useEffect(() => {
    if (!currentBlockId) {
      setClosedDays(0)
      return
    }
    let cancelled = false
    fetch(`/api/m/block-status/${currentBlockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BlockStatusResponse | null) => {
        if (cancelled || !d?.ok) return
        setClosedDays(d.closedDays)
        setTarget(d.target || 7)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentBlockId])

  // Мини-кольцо: радиус 10, circumference = 2π*10 ≈ 62.83
  const CIRC = 62.83
  const filled = CIRC * (coursePct / 100)

  const href = currentBlockId ? `/m/lesson/${currentBlockId}` : '/m/dashboard'
  const daysDisplay = closedDays === null ? '…' : `${closedDays}/${target}`

  return (
    <Link
      href={href}
      className="hp-widget"
      aria-label={`Прогресс курса ${coursePct}%, в текущем блоке закрыто ${daysDisplay} дней`}
    >
      {/* Мини-кольцо прогресса по курсу */}
      <svg
        className="hp-widget__ring"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="hp-widget__ring-track"
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="2.5"
        />
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

      {/* Текстовый блок */}
      <span className="hp-widget__text">
        <span className="hp-widget__pct">
          {coursePct}%
          <span className="hp-widget__label">курс</span>
        </span>
        <span className="hp-widget__today">
          <span className="hp-widget__days">Дней {daysDisplay}</span>
          <span className="hp-widget__label">блок</span>
        </span>
        {streak !== null && streak > 0 && (
          <span className="hp-widget__streak">{streak} дн. подряд</span>
        )}
      </span>
    </Link>
  )
}
