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

  const name = user?.firstName ?? 'друг'
  const initial = (user?.firstName?.[0] ?? 'У').toUpperCase()

  return (
    <div className="miniapp-container" style={{ paddingBottom: 0 }}>
      <header>
        <div className="db-topbar">
          <div className="db-avatar">{initial}</div>
          <div className="db-topbar__text">
            <span className="db-topbar__eyebrow">Курс ученичества</span>
            <span className="db-topbar__greeting">Привет, {name}</span>
          </div>
        </div>
        <div className="db-hero">
          <h1 className="db-hero__title">КРЕСТ</h1>
          <p className="db-hero__subtitle">Путь от вступления до Мастера Креста</p>
        </div>
      </header>
    </div>
  )
}
