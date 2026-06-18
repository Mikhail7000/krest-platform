'use client'

import { useEffect, useState } from 'react'
import { LeaderboardCard } from './LeaderboardCard'
import type { LeaderRow } from './leaderboard.types'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      ?.Telegram?.WebApp?.initData ?? ''
  )
}

function SkeletonCard({ big }: { big?: boolean }) {
  return (
    <div className={`lb-skeleton${big ? ' lb-skeleton--big' : ''}`} aria-hidden />
  )
}

export function TrackingClient() {
  const [list, setList] = useState<LeaderRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/m/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x: { list: LeaderRow[] }) => {
        if (!cancelled) setList(x.list ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="lb-empty">
        <span className="lb-empty__icon">⚠️</span>
        <p className="lb-empty__text">Не удалось загрузить рейтинг</p>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="lb-list">
        <SkeletonCard big />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="lb-empty">
        <span className="lb-empty__icon">🏆</span>
        <p className="lb-empty__text">Пока никто не набрал очков</p>
        <p className="lb-empty__hint">Закрывай дни подряд — будь первым!</p>
      </div>
    )
  }

  return (
    <div className="lb-list">
      {list.map((row) => (
        <LeaderboardCard key={`${row.rank}-${row.name}`} row={row} />
      ))}
    </div>
  )
}
