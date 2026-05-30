'use client'

import { useEffect, useState } from 'react'
import { pluralDays } from '@/lib/activity/streak'

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
}

// Отмечает открытие блока (старт 7-дневного отсчёта) и показывает плашку «осталось дней».
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
