'use client'

import { useEffect, useState } from 'react'
import { pluralDays } from '@/lib/activity/streak'

interface Row {
  id: string
  name: string
  is_self: boolean
  role: string
  block: number
  total: number
  pct: number
  days_left: number
  streak: number
  opened_today: boolean
  days: boolean[]
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
  )
}

export function TrackingClient() {
  const [list, setList] = useState<Row[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/m/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x: { list: Row[] }) => {
        if (!cancelled) setList(x.list ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="tr-empty">Не удалось загрузить трекинг</p>
  if (!list) return <p className="tr-empty">Загрузка…</p>
  if (list.length === 0) return <p className="tr-empty">Пока никто не зашёл в приложение</p>

  return (
    <div className="tr-list">
      {list.map((r) => (
        <div key={r.id} className={`tr-card${r.is_self ? ' tr-card--me' : ''}`}>
          <div className="tr-top">
            <div className="tr-id">
              <span className="tr-name">
                {r.name}
                {r.is_self && <span className="tr-you"> · вы</span>}
              </span>
              <span className="tr-role">{r.role}</span>
            </div>
            <span className="tr-pct">{r.pct}%</span>
          </div>

          <div className="tr-meta">
            <span>Блок {r.block} из {r.total}</span>
            <span>·</span>
            <span>осталось {r.days_left} дн.</span>
            <span>·</span>
            <span>
              {r.streak} {pluralDays(r.streak)} подряд
            </span>
          </div>

          <div className="tr-bar">
            <span className="tr-bar__fill" style={{ width: `${r.pct}%` }} />
          </div>

          <div className="tr-cal">
            {r.days.map((on, i) => (
              <span key={i} className={`tr-dot${on ? ' tr-dot--on' : ''}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
