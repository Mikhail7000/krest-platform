'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyTelegramTheme, listenThemeChanges } from '@/lib/telegram/theme'

type TgWebApp = {
  ready: () => void
  expand: () => void
  initData: string
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; last_name?: string; username?: string }
  }
  platform?: string
  version?: string
  colorScheme?: 'light' | 'dark'
}

export type TelegramUser = {
  id: number
  firstName: string
  lastName?: string
  username?: string
}

export type TelegramStatus = 'init' | 'no-tg' | 'forbidden' | 'ready' | 'error'

type ContextValue = {
  status: TelegramStatus
  user: TelegramUser | null
  errorMessage: string | null
  platform: string | null
}

const Ctx = createContext<ContextValue>({
  status: 'init',
  user: null,
  errorMessage: null,
  platform: null,
})

export const useTelegram = () => useContext(Ctx)

function getTg(): TgWebApp | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Telegram?: { WebApp: TgWebApp } }).Telegram?.WebApp ?? null
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TelegramStatus>('init')
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [platform, setPlatform] = useState<string | null>(null)

  useEffect(() => {
    const tg = getTg()

    if (!tg || !tg.initData) {
      setStatus('no-tg')
      setErrorMessage('Откройте приложение через Telegram-бота @cross_bot')
      return
    }

    tg.ready()
    tg.expand()
    applyTelegramTheme()
    const stopThemeListener = listenThemeChanges()
    setPlatform(tg.platform ?? null)

    const ac = new AbortController()

    fetch('/api/miniapp/maintenance-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
      cache: 'no-store',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data: { allowed: boolean; maintenance?: boolean; reason?: string }) => {
        if (!data.allowed) {
          setStatus('forbidden')
          setErrorMessage('Приложение в разработке. Доступ откроется позже.')
          return
        }
        const tgUser = tg.initDataUnsafe?.user
        if (tgUser) {
          setUser({
            id: tgUser.id,
            firstName: tgUser.first_name ?? 'Друг',
            lastName: tgUser.last_name,
            username: tgUser.username,
          })
        }
        setStatus('ready')
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return
        setStatus('error')
        setErrorMessage('Ошибка соединения. Попробуйте позже.')
      })

    return () => {
      ac.abort()
      stopThemeListener()
    }
  }, [])

  return (
    <Ctx.Provider value={{ status, user, errorMessage, platform }}>
      {children}
    </Ctx.Provider>
  )
}
