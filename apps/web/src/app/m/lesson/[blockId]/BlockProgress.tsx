'use client'

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
  mestopisaniya: boolean
  pereskaz: boolean
}

interface BlockStatusResponse {
  ok: boolean
  closedDays: number
  target: number
  today: TodayStatus
  quiz: boolean
  friday: boolean
}

interface DayTask {
  key: keyof TodayStatus
  label: string
}

const DAY_TASKS: DayTask[] = [
  { key: 'cross', label: 'Фото Креста' },
  { key: 'prayer', label: 'Молитва' },
  { key: 'mestopisaniya', label: 'Местописания' },
  { key: 'pereskaz', label: 'Пересказ' },
]

/**
 * Баннер прогресса урока — дневная модель.
 * Показывает: N/7 закрытых дней + чеклист «сегодня» (5 задач) + квиз + пятница.
 */
export function BlockProgress({ blockId }: { blockId: number }) {
  const [data, setData] = useState<BlockStatusResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/m/block-status/${blockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BlockStatusResponse | null) => {
        if (!cancelled && d?.ok) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [blockId])

  if (!data) return null

  const { closedDays, target, today } = data
  const pct = Math.round((Math.min(closedDays, target) / target) * 100)

  const todayAllDone = DAY_TASKS.every((t) => today[t.key])
  const pendingTasks = DAY_TASKS.filter((t) => !today[t.key])
  const blockComplete = closedDays >= target

  if (blockComplete) {
    return (
      <div className="lesson-progress-banner lesson-progress-banner--done">
        Блок выполнен — все условия соблюдены ✓
      </div>
    )
  }

  return (
    <div className="lesson-progress-banner">
      {/* Прогресс-бар «Закрыто дней» */}
      <div className="lesson-progress-banner__label">
        <span>Закрыто дней: {closedDays} / {target}</span>
        <span>{closedDays >= target ? '✓' : `${pct}%`}</span>
      </div>
      <div className="lesson-progress-bar">
        <div className="lesson-progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>

      {/* «Сегодня» — блок */}
      {closedDays < target && (
        <div className="lesson-progress-today">
          {todayAllDone ? (
            <span className="lesson-progress-today__done">День закрыт!</span>
          ) : (
            <>
              <span className="lesson-progress-today__hint">
                Сегодня закрой день — осталось:
              </span>
              <ul className="lesson-progress-checklist">
                {DAY_TASKS.map((t) => (
                  <li
                    key={t.key}
                    className={`lesson-progress-check${today[t.key] ? ' lesson-progress-check--done' : ''}`}
                  >
                    <span className="lesson-progress-check__marker">
                      {today[t.key] ? '✓' : '○'}
                    </span>
                    <span className="lesson-progress-check__label">{t.label}</span>
                  </li>
                ))}
              </ul>
              <span className="lesson-progress-today__count">
                Осталось: {pendingTasks.length} из {DAY_TASKS.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
