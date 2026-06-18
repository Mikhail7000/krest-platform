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

const TODAY_KEYS: (keyof TodayStatus)[] = [
  'cross',
  'prayer',
  'recitationAudio',
  'recitationVideo',
  'trainer',
]

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
 * – «N%» прогресс курса (мини-кольцо через stroke-dasharray)
 * – «Сегодня: K осталось» из block-status текущего блока
 * – стрик (дней подряд) если > 0
 * Кликабелен — ведёт на /m/lesson/[currentBlockId]
 */
export function HeaderProgress({ coursePct, currentBlockId, streak }: Props) {
  const [todayLeft, setTodayLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!currentBlockId) {
      setTodayLeft(0)
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
        const left = TODAY_KEYS.filter((k) => !d.today[k]).length
        setTodayLeft(left)
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
  const todayDisplay = todayLeft === null ? '…' : String(todayLeft)

  return (
    <Link href={href} className="hp-widget" aria-label={`Прогресс курса ${coursePct}%, сегодня осталось ${todayDisplay}`}>
      {/* Мини-кольцо прогресса */}
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
        <span className="hp-widget__pct">{coursePct}%</span>
        <span className="hp-widget__today">
          {todayLeft === 0 ? 'День закрыт' : `Сегодня: ${todayDisplay}`}
        </span>
        {streak !== null && streak > 0 && (
          <span className="hp-widget__streak">{streak} дн. подряд</span>
        )}
      </span>
    </Link>
  )
}
