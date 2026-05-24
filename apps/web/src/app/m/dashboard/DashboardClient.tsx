'use client'

import { useTelegram } from '@/components/telegram/TelegramProvider'

export function DashboardClient() {
  const { status, user, errorMessage } = useTelegram()

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
        <h1 className="miniapp-headline">Приложение в разработке</h1>
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
      <header className="db-hero">
        <p className="db-hero__eyebrow">Курс ученичества</p>
        <h1 className="db-hero__title">КРЕСТ</h1>
        <p className="db-hero__greeting">Привет, {user?.firstName ?? 'друг'}</p>
      </header>
    </div>
  )
}
