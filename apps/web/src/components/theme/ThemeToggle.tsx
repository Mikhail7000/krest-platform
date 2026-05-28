'use client'

import { useTheme } from './ThemeProvider'

/**
 * Переключатель темы. Иконка солнца/луны.
 * variant="floating" — компактная круглая кнопка для угла онбординга.
 * variant="row" — широкая строка для экрана профиля/настроек.
 */
export function ThemeToggle({ variant = 'floating' }: { variant?: 'floating' | 'row' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Светлая тема' : 'Тёмная тема'

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:hover:border-white/30"
      >
        <span className="flex items-center gap-3">
          <ThemeIcon isDark={isDark} />
          <span className="font-medium text-[#16181D] dark:text-white">Оформление</span>
        </span>
        <span className="text-sm text-gray-500 dark:text-white/55">
          {isDark ? 'Тёмная' : 'Светлая'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-[#16181D] backdrop-blur-sm transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:text-white dark:hover:border-white/30"
    >
      <ThemeIcon isDark={isDark} />
    </button>
  )
}

function ThemeIcon({ isDark }: { isDark: boolean }) {
  // В тёмной теме показываем солнце (предложение переключиться на светлую), и наоборот
  return isDark ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
