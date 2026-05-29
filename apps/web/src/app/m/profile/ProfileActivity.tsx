'use client'

import { useEffect, useState } from 'react'
import { pluralDays } from '@/lib/activity/streak'

interface Data {
  streak: number
  total: number
  openedToday: boolean
  lastActive: string | null
  days: { date: string; on: boolean; state: 'green' | 'yellow' | 'off' | 'red' }[]
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
    ?.initData ?? ''
}

export function ProfileActivity() {
  const [d, setD] = useState<Data | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/m/activity/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((x: Data | null) => {
        if (!cancelled && x) setD(x)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!d) return null

  return (
    <div className="pf-card pf-activity">
      <div className="pf-activity__head">
        <div>
          <span className="pf-activity__num">{d.streak}</span>
          <span className="pf-activity__cap"> {pluralDays(d.streak)} подряд</span>
        </div>
        <div className="pf-activity__today">
          <span className={`pf-dot${d.openedToday ? ' pf-dot--on' : ''}`} />
          {d.openedToday ? 'Сегодня заходил' : 'Сегодня ещё нет'}
        </div>
      </div>

      <div className="pf-cal">
        {d.days.map((x) => (
          <span key={x.date} title={x.date} className={`pf-cube pf-cube--${x.state}`} />
        ))}
      </div>
      <div className="pf-legend">
        <span><i className="pf-cube pf-cube--green" /> прошёл</span>
        <span><i className="pf-cube pf-cube--yellow" /> заходил</span>
        <span><i className="pf-cube pf-cube--red" /> пропуск</span>
      </div>

      <div className="pf-activity__foot">
        Всего дней в КРЕСТ: {d.total}
        {d.lastActive && (
          <>
            {' · '}
            последний вход{' '}
            {new Date(d.lastActive).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </>
        )}
      </div>
    </div>
  )
}
