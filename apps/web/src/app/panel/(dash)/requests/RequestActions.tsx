'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'approve_student' | 'approve_curator' | 'approve_leader' | 'reject'

/**
 * Кнопки решения по заявке: впустить учеником / куратором (города) / лидером города /
 * отклонить. Для куратора город необязателен, для лидера — обязателен (раскрывается
 * выбор города). После успеха — router.refresh() (заявка уезжает из ожидающих).
 * Ошибки/предупреждения — инлайн (без alert/confirm — правила проекта).
 */
export function RequestActions({
  requestId,
  cities,
}: {
  requestId: string
  cities: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  // Раскрытый выбор города: для куратора или лидера.
  const [pick, setPick] = useState<null | 'approve_curator' | 'approve_leader'>(null)
  const [cityId, setCityId] = useState('')

  const decide = async (action: Action, withCity?: number | null) => {
    if (busy || warn) return
    setBusy(action)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/access-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, action, cityId: withCity ?? undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка')
      if (action !== 'reject' && json.notified === false) {
        setWarn('Доступ открыт, но уведомление в Telegram не доставлено — пользователь ещё не открывал бота. Он увидит доступ при первом входе.')
        setBusy(null)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setBusy(null)
    }
  }

  if (warn) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        <span className="panel-badge panel-badge--warn">✓ Одобрен · {warn}</span>
        <button type="button" className="panel-btn" onClick={() => router.refresh()}>
          Обновить
        </button>
      </div>
    )
  }

  // Раскрытый выбор города (куратор/лидер).
  if (pick) {
    const isLeader = pick === 'approve_leader'
    const cancel = () => {
      setPick(null)
      setCityId('')
      setError(null)
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        {error && <span className="panel-badge panel-badge--err">{error}</span>}
        <span className="panel-muted" style={{ fontSize: '0.85rem' }}>
          {isLeader ? 'Лидер города:' : 'Куратор города:'}
        </span>
        <select
          className="panel-select"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">{isLeader ? 'Город (обязательно)' : 'Город (необязательно)'}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="panel-btn panel-btn--primary"
          disabled={!!busy || (isLeader && !cityId)}
          onClick={() => decide(pick, cityId ? Number(cityId) : null)}
        >
          {busy === pick ? '…' : 'Подтвердить'}
        </button>
        <button type="button" className="panel-btn" disabled={!!busy} onClick={cancel}>
          Отмена
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {error && <span className="panel-badge panel-badge--err">{error}</span>}
      <button
        type="button"
        className="panel-btn panel-btn--primary"
        disabled={!!busy}
        onClick={() => decide('approve_student')}
      >
        {busy === 'approve_student' ? '…' : '✅ Учеником'}
      </button>
      <button
        type="button"
        className="panel-btn"
        disabled={!!busy}
        onClick={() => {
          setError(null)
          setPick('approve_curator')
        }}
      >
        👤 Куратором
      </button>
      <button
        type="button"
        className="panel-btn"
        disabled={!!busy}
        onClick={() => {
          setError(null)
          setPick('approve_leader')
        }}
      >
        👑 Лидером города
      </button>
      <button
        type="button"
        className="panel-btn panel-btn--danger"
        disabled={!!busy}
        onClick={() => decide('reject')}
      >
        {busy === 'reject' ? '…' : '✖️ Отклонить'}
      </button>
    </div>
  )
}
