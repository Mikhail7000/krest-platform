'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatRuDate } from '@/lib/time/format'
import { invalidateBlockStatus } from '@/lib/m/block-status-cache'
import { IconCheck, IconLock } from '@/app/m/_components/icons'

type DayState = 'done' | 'today' | 'waiting' | 'future'

interface DayEntry {
  index: number
  state: DayState
  date: string | null
}

interface PrayerApiResponse {
  ok: boolean
  closed_days: number
  target: number
  block_complete: boolean
  today: string
  today_prayed: boolean
  can_mark_today: boolean
  next_day_locked: boolean
  prayed_days: number
  days: DayEntry[]
  test_mode?: boolean
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface Props { blockId: number }

export function PrayerClient({ blockId }: Props) {
  const [view, setView] = useState<'loading' | 'error' | 'idle'>('loading')
  const [data, setData] = useState<PrayerApiResponse | null>(null)
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setView('loading')
    try {
      const res = await fetch(`/api/m/prayer/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData() }),
      })
      if (!res.ok) { setView('error'); return }
      setData(await res.json() as PrayerApiResponse)
      setView('idle')
    } catch {
      setView('error')
    }
  }, [blockId])

  useEffect(() => { load() }, [load])

  const markToday = async () => {
    if (marking || !data?.can_mark_today) return
    setMarking(true)
    setMarkError(null)
    try {
      const res = await fetch(`/api/m/prayer/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), mark: true }),
      })
      const body = (await res.json().catch(() => ({}))) as PrayerApiResponse & {
        error?: { message?: string }
      }
      if (res.ok) {
        // Сервер — источник истины: применяем его ответ.
        setData(body as PrayerApiResponse)
        // День мог закрыться — сбросить кэш статуса блока (урок/дашборд).
        invalidateBlockStatus(blockId)
      } else {
        // Раньше ошибка глушилась молча — теперь показываем.
        setMarkError(body?.error?.message ?? `Не удалось отметить (ошибка ${res.status}).`)
      }
    } catch {
      setMarkError('Сеть недоступна. Попробуй ещё раз.')
    } finally {
      setMarking(false)
    }
  }

  if (view === 'loading') return <p className="prayer-loading">Загрузка…</p>
  if (view === 'error' || !data) {
    return (
      <div className="prayer-error">
        <p>Не удалось загрузить.</p>
        <button type="button" className="prayer-btn" onClick={load}>Повторить</button>
      </div>
    )
  }

  const progressPct = Math.min(100, Math.round((data.prayed_days / data.target) * 100))

  return (
    <div>
      <div className="prayer-progress-label">{data.prayed_days} / {data.target} дней</div>
      <div className="prayer-progress-bar">
        <div className="prayer-progress-bar__fill" style={{ width: `${progressPct}%` }} />
      </div>

      {data.test_mode && (
        <div className="prayer-test-banner">
          🧪 Тестовый режим: система засчитала вам всю неделю автоматически.
        </div>
      )}

      <div className="prayer-days">
        {data.days.map((d) => (
          <div
            key={d.index}
            className={`prayer-day${d.state === 'done' ? ' prayer-day--done' : ''}`}
          >
            <span className="prayer-day__num">День {d.index}</span>
            <span className="prayer-day__date">{d.date ? formatRuDate(d.date) : ''}</span>
            <span className="prayer-day__status">
              {d.state === 'done' ? (
                <>
                  <IconCheck className="prayer-status-icon prayer-status-icon--done" /> Помолился
                </>
              ) : d.state === 'today' ? (
                'сегодня'
              ) : d.state === 'waiting' ? (
                <IconLock className="prayer-status-icon prayer-status-icon--lock" />
              ) : (
                '—'
              )}
            </span>
          </div>
        ))}
      </div>

      {data.block_complete ? (
        <div className="prayer-done-row">✓ Все 7 дней закрыты.</div>
      ) : data.can_mark_today ? (
        <button type="button" className="prayer-mark-btn" onClick={markToday} disabled={marking}>
          {marking ? 'Отмечаем…' : '🙏 Я помолился по кресту сегодня'}
        </button>
      ) : data.today_prayed ? (
        <div className="prayer-done-row">✓ Сегодня отмечено. Следующий день откроется в 00:00.</div>
      ) : (
        <div className="prayer-done-row">Следующий день откроется в 00:00 по твоему времени.</div>
      )}

      {markError && <p className="prayer-mark-error">{markError}</p>}
    </div>
  )
}
