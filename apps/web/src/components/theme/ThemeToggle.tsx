'use client'

import { useTheme, type Theme } from './ThemeProvider'

/**
 * Переключатель темы. Три режима по кругу: солнце (светлая) → луна (тёмная) →
 * звезда (звёздное небо). Иконка показывает текущую тему.
 * variant="floating" — круглая кнопка для угла. variant="row" — строка настроек.
 */
const NEXT_LABEL: Record<Theme, string> = {
  light: 'Тёмная тема',
  dark: 'Звёздная тема',
  stars: 'Светлая тема',
}
const CURRENT_LABEL: Record<Theme, string> = {
  light: 'Светлая',
  dark: 'Тёмная',
  stars: 'Звёзды',
}

export function ThemeToggle({ variant = 'floating' }: { variant?: 'floating' | 'row' }) {
  const { theme, toggleTheme } = useTheme()

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={NEXT_LABEL[theme]}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:hover:border-white/30"
      >
        <span className="flex items-center gap-3">
          <ThemeIcon theme={theme} />
          <span className="font-medium text-[#16181D] dark:text-white">Оформление</span>
        </span>
        <span className="text-sm text-gray-500 dark:text-white/55">{CURRENT_LABEL[theme]}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={NEXT_LABEL[theme]}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-[#16181D] backdrop-blur-sm transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/10 dark:text-white dark:hover:border-white/30"
    >
      <ThemeIcon theme={theme} />
    </button>
  )
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    // Солнце
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    )
  }
  if (theme === 'dark') {
    // Луна
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  }
  // Звезда
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z" />
    </svg>
  )
}
