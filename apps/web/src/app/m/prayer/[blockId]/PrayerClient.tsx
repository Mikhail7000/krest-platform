'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatRuDate } from '@/lib/time/format'
import { invalidateBlockStatus } from '@/lib/m/block-status-cache'

interface DayEntry {
  day_index: number
  date: string
  prayed: boolean
}

interface PrayerApiResponse {
  ok: boolean
  today_index: number
  today_date: string
  days: DayEntry[]
  completed_count: number
  days_required: number
  test_mode?: boolean
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface Props { blockId: number }

export function PrayerClient({ blockId }: Props) {
  const [view, setView] = useState<'loading' | 'error' | 'idle'>('loading')
  const [days, setDays] = useState<DayEntry[]>([])
  const [todayDate, setTodayDate] = useState('')
  const [completed, setCompleted] = useState(0)
  const [required, setRequired] = useState(7)
  const [testMode, setTestMode] = useState(false)
  const [marking, setMarking] = useState(false)

  const apply = useCallback((data: PrayerApiResponse) => {
    setDays(data.days)
    setTodayDate(data.today_date)
    setCompleted(data.completed_count)
    setRequired(data.days_required)
    setTestMode(Boolean(data.test_mode))
  }, [])

  const load = useCallback(async () => {
    setView('loading')
    try {
      const res = await fetch(`/api/m/prayer/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData() }),
      })
      if (!res.ok) { setView('error'); return }
      apply(await res.json() as PrayerApiResponse)
      setView('idle')
    } catch {
      setView('error')
    }
  }, [blockId, apply])

  useEffect(() => { load() }, [load])

  const markToday = async () => {
    const alreadyPrayed = days.some((d) => d.date === todayDate && d.prayed)
    if (marking || alreadyPrayed) return
    setMarking(true)

    // Оптимистично: галочка «сегодня» загорается мгновенно. Счётчик дней и
    // статус закрытия дня остаются за сервером — при ошибке откатываем.
    const prevDays = days
    const prevCompleted = completed
    setDays((ds) => ds.map((d) => (d.date === todayDate ? { ...d, prayed: true } : d)))
    setCompleted((c) => Math.min(required, c + 1))

    try {
      const res = await fetch(`/api/m/prayer/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), mark: true }),
      })
      if (res.ok) {
        // Сервер — источник истины: применяем его ответ.
        apply((await res.json()) as PrayerApiResponse)
        // День мог закрыться — сбросить кэш статуса блока, чтобы дашборд/урок
        // показали свежее «день закрыт».
        invalidateBlockStatus(blockId)
      } else {
        setDays(prevDays)
        setCompleted(prevCompleted)
      }
    } catch {
      setDays(prevDays)
      setCompleted(prevCompleted)
    } finally {
      setMarking(false)
    }
  }

  if (view === 'loading') return <p className="prayer-loading">Загрузка…</p>
  if (view === 'error') {
    return (
      <div className="prayer-error">
        <p>Не удалось загрузить.</p>
        <button type="button" className="prayer-btn" onClick={load}>Повторить</button>
      </div>
    )
  }

  const todayPrayed = days.some((d) => d.date === todayDate && d.prayed)
  const progressPct = Math.min(100, Math.round((completed / required) * 100))

  return (
    <div>
      <div className="prayer-progress-label">{completed} / {required} дней</div>
      <div className="prayer-progress-bar">
        <div className="prayer-progress-bar__fill" style={{ width: `${progressPct}%` }} />
      </div>

      {testMode && (
        <div className="prayer-test-banner">
          🧪 Тестовый режим: система засчитала вам всю неделю автоматически.
        </div>
      )}

      <div className="prayer-days">
        {days.map((d) => (
          <div key={d.day_index} className={`prayer-day${d.prayed ? ' prayer-day--done' : ''}`}>
            <span className="prayer-day__num">День {d.day_index}</span>
            <span className="prayer-day__date">{formatRuDate(d.date)}</span>
            <span className="prayer-day__status">{d.prayed ? '✓ Помолился' : '—'}</span>
          </div>
        ))}
      </div>

      {!todayPrayed ? (
        <button type="button" className="prayer-mark-btn" onClick={markToday} disabled={marking}>
          {marking ? 'Отмечаем…' : '🙏 Я помолился по кресту сегодня'}
        </button>
      ) : (
        <div className="prayer-done-row">✓ Сегодня отмечено. Возвращайся завтра.</div>
      )}
    </div>
  )
}
