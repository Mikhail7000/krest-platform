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
 * Инлайн-скрипт: ставит data-theme на <html> до первой отрисовки.
 *
 * СЕЙЧАС: тёмная тема убрана из miniapp — всегда светлая (форсим 'light',
 * localStorage игнорируем). Инфраструктура темы (ThemeProvider/ThemeToggle/
 * ThemedBackground/dark-токены в CSS) сохранена для быстрого возврата dark.
 * Чтобы вернуть переключение: читать localStorage здесь, рендерить
 * <ThemedBackground/> в layout и <ThemeToggle/> где нужно.
 */
export const themeNoFlashScript = `
(function() {
  document.documentElement.dataset.theme = 'light';
})();
`
