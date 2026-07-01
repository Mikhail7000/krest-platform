'use client'

import { useState } from 'react'

/**
 * «Напомнить в Telegram» — кнопка у молчащего/застрявшего ученика.
 * Шлёт POST /api/panel/actions/notify-student; после успеха гаснет («Отправлено»),
 * при повторе в тот же день сервер вернёт 429 — показываем это честно.
 */
export function ReminderButton({ studentId }: { studentId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'already' | 'error'>('idle')

  const send = async () => {
    if (state === 'busy' || state === 'sent') return
    setState('busy')
    try {
      const res = await fetch('/api/panel/actions/notify-student', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      if (res.ok) setState('sent')
      else if (res.status === 429) setState('already')
      else setState('error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') return <span className="panel-badge panel-badge--ok">Отправлено ✓</span>
  if (state === 'already') return <span className="panel-badge">Уже сегодня</span>

  return (
    <button
      type="button"
      className="panel-btn"
      style={{ fontSize: '0.78rem', padding: '3px 10px' }}
      onClick={send}
      disabled={state === 'busy'}
    >
      {state === 'busy' ? 'Шлём…' : state === 'error' ? 'Ошибка — ещё раз' : '✈️ Напомнить'}
    </button>
  )
}
