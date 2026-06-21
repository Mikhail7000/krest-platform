'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'approve_student' | 'approve_curator' | 'reject'

/**
 * Кнопки решения по заявке: впустить учеником / куратором / отклонить.
 * После успеха — router.refresh() (заявка уезжает из списка ожидающих).
 * Ошибка показывается инлайн (без alert/confirm — правила проекта).
 */
export function RequestActions({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  const decide = async (action: Action) => {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/access-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setBusy(null)
    }
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
        onClick={() => decide('approve_curator')}
      >
        {busy === 'approve_curator' ? '…' : '👤 Куратором'}
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
