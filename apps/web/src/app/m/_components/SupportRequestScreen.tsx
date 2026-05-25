'use client'

import { useState } from 'react'

export function SupportRequestScreen() {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!message || message.length < 10) {
      setErrorMessage('Сообщение должно содержать минимум 10 символов')
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
      <div className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center px-5 py-12 text-center">
        <div className="w-full max-w-xs">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="text-xl font-bold text-white mb-2 wrap-break-word">Запрос отправлен</h1>
          <p className="text-sm text-white/55 mb-6">
            Спасибо! Мы свяжемся с вами в ближайшее время.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent-gradient)' }}
          >
            Закрыть
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-xs">
        <div className="mb-6 text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2 wrap-break-word">Доступ запрещён</h1>
          <p className="text-sm text-white/55 wrap-break-word">
            Обратитесь к вашему наставнику или напишите нам:
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-300 text-sm wrap-break-word">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Расскажите о вашем вопросе или проблеме…"
            className="w-full rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary"
            rows={4}
            disabled={status === 'loading'}
          />

          <button
            onClick={handleSubmit}
            disabled={status === 'loading' || !message.trim()}
            className="w-full rounded-2xl px-4 py-3.5 font-semibold text-white text-sm active:scale-95 transition disabled:opacity-50"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {status === 'loading' ? 'Отправляю…' : 'Отправить запрос'}
          </button>
        </div>

        <p className="text-xs text-white/40 text-center mt-4 wrap-break-word">Минимум 10 символов</p>
      </div>
    </div>
  )
}
