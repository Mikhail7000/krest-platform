'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const BOT_USERNAME = 'cross_notify_bot'

/**
 * Вход в дашборд через Telegram Login Widget.
 * Требует, чтобы у бота в BotFather был задан домен (/setdomain).
 */
export default function PanelLoginPage() {
  const widgetRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // глобальный колбэк, который дёргает виджет Telegram
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).onTelegramAuth = async (user: Record<string, unknown>) => {
      setError(null)
      setBusy(true)
      try {
        const res = await fetch('/api/panel/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        })
        if (res.ok) {
          router.replace('/panel')
          router.refresh()
        } else {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Не удалось войти')
        }
      } catch {
        setError('Сеть недоступна')
      } finally {
        setBusy(false)
      }
    }

    const node = widgetRef.current
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    node?.appendChild(script)
    return () => {
      try {
        if (node && script.parentNode === node) node.removeChild(script)
      } catch {
        /* ignore */
      }
    }
  }, [router])

  return (
    <div className="panel-login">
      <div className="panel-login__card">
        <div className="panel-login__logo">КРЕСТ</div>
        <p className="panel-login__eyebrow">Панель администратора</p>
        <p className="panel-login__hint">
          Войдите через Telegram тем же аккаунтом, под которым вы админ платформы.
        </p>
        <div className="panel-login__widget" ref={widgetRef} />
        {busy && <p className="panel-login__busy">Входим…</p>}
        {error && <p className="panel-login__error">{error}</p>}
      </div>
    </div>
  )
}
