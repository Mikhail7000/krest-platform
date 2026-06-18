'use client'

import { useEffect, useState } from 'react'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { STATUS_PHRASES } from './statusPhrases'
import { HeaderProgress } from './HeaderProgress'

const FALLBACK_SUBTITLE = 'Путь от вступления до Мастера Креста'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
    ?.initData ?? ''
}

interface Props {
  /** % завершения курса (0–100), прокидывается из DashboardShell */
  coursePct?: number
  /** ID текущего активного блока */
  currentBlockId?: number | null
}

export function DashboardClient({ coursePct = 0, currentBlockId = null }: Props) {
  const { status, user, errorMessage } = useTelegram()
  const [streak, setStreak] = useState<number | null>(null)
  const [phraseIdx] = useState(() => Math.floor(Math.random() * STATUS_PHRASES.length))

  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    fetch('/api/m/activity/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { streak: number } | null) => {
        if (!cancelled && d) setStreak(d.streak)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status])

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
        <h1 className="miniapp-headline">КРЕСТ</h1>
        <p className="miniapp-status-error" style={{ marginTop: 16 }}>
          {errorMessage}
        </p>
        <p className="miniapp-hint" style={{ marginTop: 12 }}>
          Откройте бота{' '}
          <a href="https://t.me/cross_notify_bot" style={{ color: 'var(--tg-link, #0F8AD2)' }}>
            @cross_notify_bot
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
  const subtitle = STATUS_PHRASES[phraseIdx] ?? FALLBACK_SUBTITLE

  return (
    <div className="miniapp-container" style={{ paddingBottom: 0 }}>
      <header>
        <div className="db-topbar">
          <div className="db-avatar">{initial}</div>
          <div className="db-topbar__text">
            <span className="db-topbar__eyebrow">Курс ученичества</span>
            <span className="db-topbar__greeting">Привет, {name}</span>
          </div>
          {/* Компактный виджет прогресса — правый верхний угол */}
          <HeaderProgress
            coursePct={coursePct}
            currentBlockId={currentBlockId}
            streak={streak}
          />
        </div>
        <div className="db-hero">
          <h1 className="db-hero__title">КРЕСТ</h1>
          <p className="db-hero__subtitle">{subtitle}</p>
        </div>
      </header>
    </div>
  )
}
