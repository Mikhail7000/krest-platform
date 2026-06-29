'use client'

import { useState } from 'react'
import { LeaderboardCard } from './LeaderboardCard'
import { useSwrCache } from '@/lib/m/swr-cache'
import type { LeaderRow } from './leaderboard.types'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      ?.Telegram?.WebApp?.initData ?? ''
  )
}

function fetchTracking(): Promise<LeaderRow[] | null> {
  return fetch('/api/m/tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: getInitData() }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((x: { list?: LeaderRow[] } | null) => x?.list ?? null)
    .catch(() => null)
}

function SkeletonCard({ big }: { big?: boolean }) {
  return (
    <div className={`lb-skeleton${big ? ' lb-skeleton--big' : ''}`} aria-hidden />
  )
}

export function TrackingClient() {
  // SWR-кэш: повторное открытие рейтинга — мгновенно, фоном обновляется.
  const { data: list, loading } = useSwrCache<LeaderRow[]>('m:tracking', fetchTracking, 300_000)
  const [query, setQuery] = useState('')

  if (!list && loading) {
    return (
      <div className="lb-list">
        <SkeletonCard big />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="lb-empty">
        <span className="lb-empty__icon">⚠️</span>
        <p className="lb-empty__text">Не удалось загрузить рейтинг</p>
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

  const q = query.trim().toLowerCase()
  const filtered = q
    ? list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.telegram ?? '').toLowerCase().includes(q),
      )
    : list

  return (
    <>
      <input
        className="lb-search"
        type="search"
        inputMode="search"
        placeholder="Поиск по имени или нику…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Поиск учеников"
      />
      {filtered.length === 0 ? (
        <div className="lb-empty">
          <span className="lb-empty__icon">🔍</span>
          <p className="lb-empty__text">Никого не нашли</p>
        </div>
      ) : (
        <div className="lb-list">
          {filtered.map((row, i) => (
            <LeaderboardCard key={`${row.rank}-${row.name}`} row={row} index={i} />
          ))}
        </div>
      )}
    </>
  )
}
