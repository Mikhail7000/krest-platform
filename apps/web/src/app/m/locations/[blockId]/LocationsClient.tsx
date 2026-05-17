'use client'

import { useEffect, useState, useCallback } from 'react'
import { LocationCard, type LocationItem } from './LocationCard'

// TODO: replace with import from @/types when database-architect adds these tables
interface LocationsApiResponse {
  ok: boolean
  block_unlocked: boolean
  can_skip: boolean
  unlock_at?: string
  locked_reason?: string
  locations: LocationItem[]
}

type ViewState = 'loading' | 'error' | 'locked' | 'idle'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

function formatUnlockAt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  blockId: number
}

export function LocationsClient({ blockId }: Props) {
  const [view, setView] = useState<ViewState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [canSkip, setCanSkip] = useState(false)
  const [unlockAt, setUnlockAt] = useState<string | null>(null)
  const [lockedReason, setLockedReason] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationItem[]>([])

  const load = useCallback(async () => {
    setView('loading')
    const initData = getInitData()
    try {
      const res = await fetch(`/api/m/locations/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      if (!res.ok) {
        setErrorMsg(`Ошибка ${res.status}`)
        setView('error')
        return
      }
      const data = await res.json() as LocationsApiResponse
      setCanSkip(data.can_skip)
      if (!data.block_unlocked) {
        setUnlockAt(data.unlock_at ?? null)
        setLockedReason(data.locked_reason ?? null)
        setView('locked')
        return
      }
      setLocations(data.locations)
      setView('idle')
    } catch {
      setErrorMsg('Не удалось загрузить данные. Проверьте соединение.')
      setView('error')
    }
  }, [blockId])

  useEffect(() => { load() }, [load])

  if (view === 'loading') {
    return (
      <>
        <p className="location-loading-hint">Загружаем местописания…</p>
        {[1, 2, 3].map((n) => <div key={n} className="location-skeleton" />)}
      </>
    )
  }

  if (view === 'error') {
    return (
      <div className="location-error">
        <p className="location-error__title">Ошибка загрузки</p>
        <p className="location-error__desc">{errorMsg}</p>
        <button type="button" className="location-btn" onClick={load}>Попробовать снова</button>
      </div>
    )
  }

  if (view === 'locked') {
    return (
      <div className="locations-locked">
        <span className="locations-locked__icon">🔒</span>
        <p className="locations-locked__title">Местописания заблокированы</p>
        {unlockAt && (
          <p className="locations-locked__time">Откроется {formatUnlockAt(unlockAt)}</p>
        )}
        <p className="locations-locked__desc">
          {lockedReason ?? 'Сначала пройди предыдущий блок.'}
        </p>
      </div>
    )
  }

  const isLocationDone = (l: LocationItem): boolean => {
    if (l.practice_mode === 'daily_understanding') {
      return l.daily_days_passed >= (l.daily_days_required ?? 7)
    }
    if (l.practice_mode === 'single_understanding') {
      return l.audio_passed
    }
    return l.video_passed
  }
  const passedCount = locations.filter(isLocationDone).length

  return (
    <div>
      {canSkip && (
        <span className="locations-skip-badge">✓ Тестовый режим — блок доступен</span>
      )}
      <p style={{ color: 'var(--tg-hint, #9CA3AF)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
        Сдано: {passedCount} / {locations.length}
      </p>
      {locations.map((loc) => (
        <LocationCard key={loc.id} item={loc} />
      ))}
    </div>
  )
}
