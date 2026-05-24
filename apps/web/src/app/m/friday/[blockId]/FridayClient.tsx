'use client'

import { useCallback, useEffect, useState } from 'react'

interface FridayApiResponse {
  ok: boolean
  submitted: boolean
  impressions: string
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface Props { blockId: number }

export function FridayClient({ blockId }: Props) {
  const [view, setView] = useState<'loading' | 'error' | 'idle'>('loading')
  const [submitted, setSubmitted] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setView('loading')
    try {
      const res = await fetch(`/api/m/friday/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData() }),
      })
      if (!res.ok) { setView('error'); return }
      const data = await res.json() as FridayApiResponse
      setSubmitted(data.submitted)
      setText(data.impressions)
      setView('idle')
    } catch {
      setView('error')
    }
  }, [blockId])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (text.trim().length < 3) return
    setSaving(true)
    try {
      const res = await fetch(`/api/m/friday/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), impressions: text }),
      })
      if (res.ok) {
        const data = await res.json() as FridayApiResponse
        setSubmitted(data.submitted)
        setText(data.impressions)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (view === 'loading') return <p className="friday-loading">Загрузка…</p>
  if (view === 'error') {
    return (
      <div className="friday-error">
        <p>Не удалось загрузить.</p>
        <button type="button" className="friday-btn" onClick={load}>Повторить</button>
      </div>
    )
  }

  if (submitted && !editing) {
    return (
      <div className="friday-done">
        <div className="friday-done__badge">✓ Впечатления записаны</div>
        <p className="friday-done__text">{text}</p>
        <button type="button" className="friday-edit-btn" onClick={() => setEditing(true)}>
          Изменить
        </button>
      </div>
    )
  }

  return (
    <div>
      <textarea
        className="friday-textarea"
        placeholder="Расскажи, как прошла практика, что почувствовал, как откликнулись люди…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        disabled={saving}
      />
      <button
        type="button"
        className="friday-submit-btn"
        onClick={submit}
        disabled={saving || text.trim().length < 3}
      >
        {saving ? 'Отправляем…' : 'Отправить впечатления'}
      </button>
    </div>
  )
}
