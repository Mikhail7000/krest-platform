'use client'

import { useEffect, useState } from 'react'
import { pluralDays } from '@/lib/activity/streak'
import { daysUntilUnlock, blockUnlockDate, formatUnlockDate } from '@/lib/access/weekly-unlock'

const BLOCK_DAYS = 7

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
    ?.initData ?? ''
}

interface Data {
  block_unlocked_at: string | null
  block_passed_at: string | null
  can_skip: boolean
  // course_started_at — новая колонка, может отсутствовать в старых ответах
  course_started_at?: string | null
  order_num?: number | null
}

/**
 * Баннер прогресса внутри урока.
 * Если доступны course_started_at + order_num — показывает недельный отсчёт.
 * Иначе показывает внутриблочный прогресс (день N из 7) от block_unlocked_at.
 */
export function BlockProgress({ blockId }: { blockId: number }) {
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/m/block-open/${blockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (Data & { ok: boolean }) | null) => {
        if (!cancelled && d?.ok) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [blockId])

  if (!data) return null
  if (data.block_passed_at) {
    return <div className="lesson-progress-banner lesson-progress-banner--done">Блок завершён</div>
  }

  // Новая модель: отсчёт от course_started_at
  if (data.course_started_at && data.order_num != null) {
    const orderNum = data.order_num
    const days = daysUntilUnlock(data.course_started_at, orderNum)

    if (days > 0) {
      // Блок ещё заблокирован (не должно быть внутри урока, но подстрахуем)
      const unlockDate = blockUnlockDate(data.course_started_at, orderNum)
      const dateStr = formatUnlockDate(unlockDate)
      return (
        <div className="lesson-progress-banner lesson-progress-banner--locked">
          {dateStr
            ? `Блок откроется ${dateStr}`
            : `Блок откроется через ${days} ${pluralDays(days)}`}
        </div>
      )
    }

    // Блок открыт — показываем прогресс текущей недели блока
    const startMs = new Date(data.course_started_at).getTime()
    const blockStartMs = startMs + Math.max(0, orderNum - 1) * 7 * 86_400_000
    const elapsed = Math.min(
      BLOCK_DAYS,
      Math.max(0, Math.floor((Date.now() - blockStartMs) / 86_400_000)),
    )
    const left = BLOCK_DAYS - elapsed
    const dayNum = Math.min(BLOCK_DAYS, elapsed + 1)
    const pct = Math.round((elapsed / BLOCK_DAYS) * 100)

    return (
      <div className="lesson-progress-banner">
        <div className="lesson-progress-banner__label">
          <span>{left > 0 ? `Осталось ${left} ${pluralDays(left)}` : 'Можно сдавать блок'}</span>
          <span>
            День {dayNum} / {BLOCK_DAYS}
          </span>
        </div>
        <div className="lesson-progress-bar">
          <div className="lesson-progress-bar__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  // Fallback: старая модель от block_unlocked_at (пока API не отдаёт course_started_at)
  if (!data.block_unlocked_at) return null

  const elapsed = Math.min(
    BLOCK_DAYS,
    Math.max(0, Math.floor((Date.now() - new Date(data.block_unlocked_at).getTime()) / 86_400_000)),
  )
  const left = BLOCK_DAYS - elapsed
  const dayNum = Math.min(BLOCK_DAYS, elapsed + 1)
  const pct = Math.round((elapsed / BLOCK_DAYS) * 100)

  return (
    <div className="lesson-progress-banner">
      <div className="lesson-progress-banner__label">
        <span>{left > 0 ? `Осталось ${left} ${pluralDays(left)}` : 'Можно сдавать блок'}</span>
        <span>
          День {dayNum} / {BLOCK_DAYS}
        </span>
      </div>
      <div className="lesson-progress-bar">
        <div className="lesson-progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
