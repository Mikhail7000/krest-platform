'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaderPick } from './types'

/**
 * Назначить куратору лидера города = перевести куратора в город лидера
 * (связь лидер↔куратор идёт по городу). POST /api/panel/actions/city.
 */
export function AssignLeaderModal({
  curatorId,
  curatorName,
  leaders,
  onClose,
}: {
  curatorId: string
  curatorName: string
  leaders: LeaderPick[]
  onClose: () => void
}) {
  const router = useRouter()
  const [leaderId, setLeaderId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const leader = leaders.find((l) => l.id === leaderId)
    if (!leader) {
      setError('Выберите лидера')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: curatorId, cityId: leader.cityId }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok || !b.ok) throw new Error(b.error || 'Не удалось назначить')
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
        <div className="panel-section-title">Назначить лидера города</div>
        <div className="panel-muted" style={{ fontSize: '0.88rem' }}>
          Куратор <strong>{curatorName}</strong> перейдёт в город выбранного лидера.
        </div>
        {leaders.length === 0 ? (
          <div className="panel-muted">Нет лидеров с заданным городом. Сначала добавьте лидера города.</div>
        ) : (
          <select className="panel-select" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
            <option value="">Выберите лидера</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.city ?? '—'}
              </option>
            ))}
          </select>
        )}
        {error ? <div style={{ color: 'var(--pl-err)', fontSize: '0.85rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="panel-btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className="panel-btn panel-btn--primary"
            onClick={submit}
            disabled={busy || !leaderId}
          >
            {busy ? '…' : 'Назначить'}
          </button>
        </div>
      </div>
    </div>
  )
}
