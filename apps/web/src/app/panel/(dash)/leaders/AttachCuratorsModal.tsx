'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PickCurator } from './page'

/**
 * Привязка кураторов к лидеру = перевод их в город лидера.
 * POST /api/panel/actions/attach-curators. Имена/города — React-текст.
 */
export function AttachCuratorsModal({
  leaderId,
  leaderName,
  leaderCity,
  curators,
  onClose,
}: {
  leaderId: string
  leaderName: string
  leaderCity: string | null
  curators: PickCurator[]
  onClose: () => void
}) {
  const router = useRouter()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    if (sel.size === 0) {
      setError('Отметьте кураторов')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/attach-curators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId, curatorIds: [...sel] }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok || !b.ok) throw new Error(b.error || 'Не удалось привязать')
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
      <div className="panel-card" style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="panel-section-title">Привязать кураторов</div>
        <div className="panel-muted" style={{ fontSize: '0.88rem' }}>
          К лидеру <strong>{leaderName}</strong> — кураторы перейдут в город{' '}
          <strong>{leaderCity ?? '—'}</strong>.
        </div>
        {curators.length === 0 ? (
          <div className="panel-muted">Кураторов нет</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {curators.map((c) => (
              <label
                key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                <span>
                  <span style={{ fontWeight: 600 }}>{c.name ?? 'Без имени'}</span>
                  {c.nick ? <span className="panel-muted"> {c.nick}</span> : null}
                  <span className="panel-muted"> · {c.city ?? 'без города'}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {error ? <div style={{ color: 'var(--pl-err)', fontSize: '0.85rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="panel-btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="panel-btn panel-btn--primary" onClick={submit} disabled={busy || sel.size === 0}>
            {busy ? '…' : `Привязать (${sel.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
