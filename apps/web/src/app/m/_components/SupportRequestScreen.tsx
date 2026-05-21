'use client'

import { useState } from 'react'

export function SupportRequestScreen() {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!message || message.length < 10) {
      setErrorMessage('Message must be at least 10 characters')
      return
    }

    setStatus('loading')
    setErrorMessage(null)

    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp

      if (!tg?.initData) {
        setErrorMessage('Telegram data not available')
        setStatus('error')
        return
      }

      const res = await fetch('/api/support/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          initData: tg.initData,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message ?? 'Failed to send request')
      }

      setStatus('success')
      setMessage('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center">
        <div className="mb-4 text-4xl">✅</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Запрос отправлен</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Спасибо! Мы свяжемся с вами в ближайшее время.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          Закрыть
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <div className="mb-6 text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Доступ запрещён</h1>
        <p className="text-sm text-muted-foreground">
          Обратитесь к вашему наставнику или напишите нам:
        </p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Расскажите о вашем вопросе или проблеме..."
          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          rows={4}
          disabled={status === 'loading'}
        />

        <button
          onClick={handleSubmit}
          disabled={status === 'loading' || !message.trim()}
          className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 font-medium text-sm active:scale-95 transition disabled:opacity-50"
        >
          {status === 'loading' ? '⏳ Отправляю...' : 'Отправить запрос'}
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Минимум 10 символов | Обязательно прочитайте нас
      </p>
    </div>
  )
}
