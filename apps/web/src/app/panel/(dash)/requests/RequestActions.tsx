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
  const [warn, setWarn] = useState<string | null>(null)

  const decide = async (action: Action) => {
    if (busy || warn) return
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
      // Одобрен, но Telegram-пуш не доставлен — не прячем строку, сообщаем админу.
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
