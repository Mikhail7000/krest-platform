'use client'

import { useEffect, useState } from 'react'

const CROSS_DAYS_REQUIRED = 7
const PRAYER_DAYS_REQUIRED = 7

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
    ?.initData ?? ''
}

interface Data {
  block_passed_at: string | null
  can_skip: boolean
  quiz_passed_at?: string | null
  recitation_audio_passed_at?: string | null
  recitation_videos_passed_at?: string | null
  trainer_passed_at?: string | null
  cross_days?: number
  prayer_days?: number
  friday_done?: boolean
}

interface CheckItem {
  label: string
  done: boolean
  /** Если recurring — отображать «N / target» вместо ✓/○ */
  progress?: { done: number; target: number }
}

/**
 * Баннер прогресса внутри урока — накопительная модель (7 условий).
 * Показывает: квиз, аудио и кружки местописаний, тренажёр,
 * дни фото креста, дни молитвы, эпоха пятницы.
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
    return (
      <div className="lesson-progress-banner lesson-progress-banner--done">
        Блок завершён ✓
      </div>
    )
  }

  const crossDays = data.cross_days ?? 0
  const prayerDays = data.prayer_days ?? 0
  const fridayDone = data.friday_done ?? false
  const crossPct = Math.round((Math.min(crossDays, CROSS_DAYS_REQUIRED) / CROSS_DAYS_REQUIRED) * 100)

  const items: CheckItem[] = [
    { label: 'Квиз', done: !!data.quiz_passed_at },
    { label: 'Аудио местописаний', done: !!data.recitation_audio_passed_at },
    { label: 'Кружки местописаний', done: !!data.recitation_videos_passed_at },
    { label: 'Тренажёр', done: !!data.trainer_passed_at },
    {
      label: 'Фото креста',
      done: crossDays >= CROSS_DAYS_REQUIRED,
      progress: { done: crossDays, target: CROSS_DAYS_REQUIRED },
    },
    {
      label: 'Молитва',
      done: prayerDays >= PRAYER_DAYS_REQUIRED,
      progress: { done: prayerDays, target: PRAYER_DAYS_REQUIRED },
    },
    { label: 'Эпоха пятницы', done: fridayDone },
  ]

  const allDone = items.every((i) => i.done)

  return (
    <div className="lesson-progress-banner">
      {/* Прогресс-бар по дням креста (основной recurring маркер) */}
      <div className="lesson-progress-banner__label">
        <span>
          {allDone ? 'Можно сдавать блок' : `Дней с фото креста: ${crossDays} / ${CROSS_DAYS_REQUIRED}`}
        </span>
        <span>{crossDays >= CROSS_DAYS_REQUIRED ? '✓' : `${crossPct}%`}</span>
      </div>
      <div className="lesson-progress-bar">
        <div className="lesson-progress-bar__fill" style={{ width: `${crossPct}%` }} />
      </div>

      {/* Чеклист всех 7 условий */}
      <div className="lesson-progress-checklist">
        {items.map((item) => (
          <span
            key={item.label}
            className={`lesson-progress-check${item.done ? ' lesson-progress-check--done' : ''}`}
          >
            {item.done ? '✓' : '○'}{' '}
            {item.label}
            {item.progress && !item.done
              ? ` ${item.progress.done}/${item.progress.target}`
              : null}
          </span>
        ))}
      </div>
    </div>
  )
}
