'use client'

import { useTheme, type Theme } from '@/components/theme/ThemeProvider'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

interface ThemeOption {
  value: Theme
  label: string
  desc: string
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Светлая', desc: 'Чистый белый фон' },
  { value: 'dark', label: 'Тёмная', desc: 'Ночной режим' },
  { value: 'stars', label: 'Звёзды', desc: 'Стеклянные карточки' },
  { value: 'pink', label: 'Розовая', desc: 'Мягкий розовый фон' },
]

/**
 * Карточка «Оформление» в профиле ученика — явный выбор темы (включая розовую).
 * Выбор сохраняется в DB (theme_pref), чтобы тема следовала пользователю по устройствам.
 */
export function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  const handleThemeSelect = (t: Theme) => {
    setTheme(t)
    // Сохраняем явный выбор в DB (best-effort — UI уже обновлён)
    fetch('/api/m/profile/update-theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData(), theme_pref: t }),
    }).catch(() => {})
  }

  return (
    <>
      <p className="pf-section">Оформление</p>
      <div className="pf-card ts-card">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`ts-option${theme === opt.value ? ' ts-option--active' : ''}`}
            onClick={() => handleThemeSelect(opt.value)}
            aria-pressed={theme === opt.value}
          >
            <span className="ts-option__dot" style={{ background: getThemeAccent(opt.value) }} />
            <span className="ts-option__info">
              <span className="ts-option__label">{opt.label}</span>
              <span className="ts-option__desc">{opt.desc}</span>
            </span>
            {theme === opt.value && <span className="ts-option__check">✓</span>}
          </button>
        ))}
      </div>
    </>
  )
}

function getThemeAccent(t: Theme): string {
  switch (t) {
    case 'dark':
      return '#7C5CF0'
    case 'stars':
      return '#8B5CF6'
    case 'pink':
      return '#EC4899'
    default:
      return '#7C5CF0'
  }
}
