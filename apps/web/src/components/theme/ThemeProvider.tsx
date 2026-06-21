'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyTelegramTheme } from '@/lib/telegram/theme'

export type Theme = 'light' | 'dark' | 'stars' | 'pink'

export const THEME_STORAGE_KEY = 'krest-theme'
export const DEFAULT_THEME: Theme = 'light'

// Порядок переключения FAB: солнце → луна → звёзды → солнце.
// Розовая тема НЕ входит в цикл (не даём мужчинам случайно попасть в неё).
const THEME_CYCLE: Theme[] = ['light', 'dark', 'stars']

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

/**
 * Управляет темой MiniApp (light по умолчанию / dark / stars / pink).
 * Приоритет: DB theme_pref > localStorage > gender='female' → pink > light.
 * data-theme проставляется на <html>: анти-flash скрипт ставит его до гидрации,
 * провайдер синхронизирует state и обновляет атрибут при переключении.
 * Розовая тема автоматически применяется для gender='female' при первом входе.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  // Синхронизируемся с тем, что уже выставил анти-flash скрипт на <html>,
  // и приводим палитру --tg-* / нативную обвязку Telegram в соответствие.
  useEffect(() => {
    const current = document.documentElement.dataset.theme
    const resolved: Theme =
      current === 'dark' ? 'dark' : current === 'stars' ? 'stars' : current === 'pink' ? 'pink' : 'light'
    setThemeState(resolved)
    applyTelegramTheme(resolved)

    // Подгружаем gender + theme_pref из профиля для авто-темы.
    // Выполняем только если в localStorage ещё нет явного выбора.
    const stored =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(THEME_STORAGE_KEY)
        : null

    const initData = getInitData()
    // Даже без initData делаем запрос — в dev-режиме DEV_BYPASS_USER_ID сработает.
    fetch('/api/miniapp/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { theme_pref?: string | null; gender?: string | null } | null) => {
        if (!data) return

        let next: Theme | null = null

        if (
          data.theme_pref === 'light' ||
          data.theme_pref === 'dark' ||
          data.theme_pref === 'stars' ||
          data.theme_pref === 'pink'
        ) {
          // DB explicit preference beats everything
          next = data.theme_pref as Theme
        } else if (!stored && data.gender === 'female') {
          // Auto-pink: только если пользователь никогда сам не выбирал тему
          next = 'pink'
        }

        if (next && next !== resolved) {
          setThemeState(next)
          document.documentElement.dataset.theme = next
          applyTelegramTheme(next)
          try {
            localStorage.setItem(THEME_STORAGE_KEY, next)
          } catch {
            // localStorage недоступен — не критично
          }
        }
      })
      .catch(() => {
        // Не блокируем рендер при ошибке сети
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    applyTelegramTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // localStorage может быть недоступен в некоторых WebView — это не критично
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const idx = THEME_CYCLE.indexOf(theme)
    const cycleIdx = idx === -1 ? 0 : idx
    const next = THEME_CYCLE[(cycleIdx + 1) % THEME_CYCLE.length]
    setTheme(next)
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/**
 * Инлайн-скрипт: ставит data-theme на <html> до первой отрисовки (без вспышки).
 * Читает сохранённый выбор из localStorage; по умолчанию — светлая тема.
 * Принимает dark / stars / pink; всё остальное → light.
 */
export const themeNoFlashScript = `
(function() {
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}');
    document.documentElement.dataset.theme = (t === 'dark' || t === 'stars' || t === 'pink') ? t : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`
