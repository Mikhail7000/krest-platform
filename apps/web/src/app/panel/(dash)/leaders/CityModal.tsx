'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Смена города у лидера/куратора. POST /api/panel/actions/city.
 * Дефолт селекта — текущий город. Имена городов — React-текст (auto-escape).
 */
export function CityModal({
  userId,
  name,
  currentCityId,
  cities,
  onClose,
}: {
  userId: string
  name: string
  currentCityId: number | null
  cities: { id: number; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [cityId, setCityId] = useState(currentCityId ? String(currentCityId) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!cityId) {
      setError('Выберите город')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cityId: Number(cityId) }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok || !b.ok) throw new Error(b.error || 'Не удалось сменить город')
      onClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setBusy(false)
    }
  }

  return (
    <div
      className="panel-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="panel-card" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel-section-title">Сменить город</div>
        <div className="panel-muted" style={{ fontSize: '0.88rem' }}>{name}</div>
        <select className="panel-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
          <option value="">Город</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {error ? <div style={{ color: 'var(--pl-err)', fontSize: '0.85rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="panel-btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="panel-btn panel-btn--primary" onClick={submit} disabled={busy}>
            {busy ? '…' : 'Сменить'}
          </button>
        </div>
      </div>
    </div>
  )
}
