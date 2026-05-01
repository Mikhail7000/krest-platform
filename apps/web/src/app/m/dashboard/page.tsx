'use client'

import { useState } from 'react'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { useHaptic } from '@/hooks/useHaptic'
import { MainButton } from '@/components/telegram/MainButton'

export default function DashboardPage() {
  const { status, user, errorMessage, platform } = useTelegram()
  const haptic = useHaptic()
  const [counter, setCounter] = useState(0)

  if (status === 'init') {
    return (
      <div className="miniapp-container">
        <p className="miniapp-hint">Загрузка...</p>
      </div>
    )
  }

  if (status === 'no-tg') {
    return (
      <div className="miniapp-container">
        <h1 className="miniapp-headline">✝️ КРЕСТ</h1>
        <p className="miniapp-status-error" style={{ marginTop: 16 }}>
          {errorMessage}
        </p>
        <p className="miniapp-hint" style={{ marginTop: 12 }}>
          Откройте бота{' '}
          <a href="https://t.me/cross_bot" style={{ color: 'var(--tg-link, #0F8AD2)' }}>
            @cross_bot
          </a>{' '}
          и нажмите кнопку «Открыть КРЕСТ».
        </p>
      </div>
    )
  }

  if (status === 'forbidden') {
    return (
      <div className="miniapp-container">
        <h1 className="miniapp-headline">🛠 Приложение в разработке</h1>
        <p className="miniapp-hint" style={{ marginTop: 16 }}>{errorMessage}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="miniapp-container">
        <h1 className="miniapp-headline">Ошибка</h1>
        <p className="miniapp-status-error" style={{ marginTop: 16 }}>{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="miniapp-container">
      <h1 className="miniapp-headline">✝️ КРЕСТ — PoC Next.js</h1>
      <p className="miniapp-hint" style={{ marginBottom: 16 }}>
        Это тестовая страница на Next.js MiniApp.
      </p>

      <div className="miniapp-card">
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Привет, {user?.firstName ?? 'друг'}!
        </p>
        <p className="miniapp-hint">
          Telegram ID: <code>{user?.id}</code>
          {user?.username && (
            <>
              <br />
              Username: <code>@{user.username}</code>
            </>
          )}
          <br />
          Платформа: <code>{platform ?? 'неизвестно'}</code>
        </p>
      </div>

      <div className="miniapp-card">
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Тест haptic feedback</p>
        <p className="miniapp-hint" style={{ marginBottom: 12 }}>
          Кнопка ниже даёт лёгкую вибрацию (на iOS / Android).
        </p>
        <button
          className="miniapp-button"
          onClick={() => {
            haptic.impact('medium')
            setCounter((c) => c + 1)
          }}
        >
          Нажми меня ({counter})
        </button>
      </div>

      <div className="miniapp-card">
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Что проверяется в этом PoC</p>
        <ul className="miniapp-hint" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
          <li>Telegram WebApp SDK подключён через next/script</li>
          <li>HMAC-валидация initData на сервере (через /api/miniapp/maintenance-check)</li>
          <li>Whitelist по Telegram chat_id работает</li>
          <li>Тема Telegram применяется к CSS-переменным</li>
          <li>HapticFeedback срабатывает</li>
          <li>MainButton снизу отображается и реагирует</li>
        </ul>
      </div>

      <MainButton
        text="Тест MainButton"
        onClick={() => {
          haptic.notification('success')
          alert('MainButton работает! Это нативная кнопка Telegram.')
        }}
      />
    </div>
  )
}
