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

interface Today {
  cross: boolean
  prayer: boolean
  pereskaz: boolean
  mestopisaniya: boolean
}
interface Status {
  ok: boolean
  closedDays: number
  target: number
  today: Today
}

const TASKS: { key: keyof Today; label: string }[] = [
  { key: 'cross', label: 'Фото Креста' },
  { key: 'prayer', label: 'Молитва' },
  { key: 'pereskaz', label: 'Пересказ' },
  { key: 'mestopisaniya', label: 'Местописания' },
]

/**
 * Крупный заметный блок вверху дашборда: сколько дней закрыто (X/7) в текущем
 * блоке и статус сегодняшнего дня. Если день закрыт — «возвращайся завтра».
 * Данные — из /api/m/block-status (тот же источник, что и экран блока).
 */
export function DayProgressBanner({ currentBlockId }: { currentBlockId: number | null }) {
  const [s, setS] = useState<Status | null>(null)

  useEffect(() => {
    if (!currentBlockId) return
    let cancelled = false
    fetch(`/api/m/block-status/${currentBlockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => {
        if (!cancelled && d?.ok) setS(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentBlockId])

  if (!currentBlockId || !s) return null

  const today = s.today
  const todayClosed = today.cross && today.prayer && today.pereskaz && today.mestopisaniya
  const remaining = TASKS.filter((t) => !today[t.key])

  return (
    <Link
      href={`/m/lesson/${currentBlockId}`}
      className={`day-banner${todayClosed ? ' day-banner--done' : ''}`}
    >
      <div className="day-banner__row">
        <span className="day-banner__label">Закрыто дней</span>
        <span className="day-banner__count">
          {s.closedDays}<span className="day-banner__slash"> / {s.target}</span>
        </span>
      </div>
      {todayClosed ? (
        <div className="day-banner__status day-banner__status--done">
          ✓ Сегодня день закрыт. Возвращайся завтра — снова откроются местописания, пересказ и молитва.
        </div>
      ) : (
        <div className="day-banner__status">
          Сегодня закрой день — осталось {remaining.length}: {remaining.map((t) => t.label).join(', ')}
        </div>
      )}
    </Link>
  )
}
