'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyTelegramTheme } from '@/lib/telegram/theme'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'krest-theme'
export const DEFAULT_THEME: Theme = 'light'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Управляет темой MiniApp (light по умолчанию / dark — звёздное небо).
 * Выбор хранится в localStorage и НЕ завязан на тему Telegram/ОС.
 * data-theme проставляется на <html>: анти-flash скрипт ставит его до гидрации,
 * провайдер синхронизирует state и обновляет атрибут при переключении.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  // Синхронизируемся с тем, что уже выставил анти-flash скрипт на <html>,
  // и приводим палитру --tg-* / нативную обвязку Telegram в соответствие.
  useEffect(() => {
    const current = document.documentElement.dataset.theme
    const resolved: Theme = current === 'dark' ? 'dark' : 'light'
    setThemeState(resolved)
    applyTelegramTheme(resolved)
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
    setTheme(theme === 'dark' ? 'light' : 'dark')
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
 * Тёмная — чистый тёмный фон (без орбов/звёзд), переключается кнопкой солнце/луна.
 */
export const themeNoFlashScript = `
(function() {
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}');
    document.documentElement.dataset.theme = (t === 'dark') ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`
