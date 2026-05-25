type TgWebApp = {
  themeParams?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  onEvent?: (event: string, handler: () => void) => void
  offEvent?: (event: string, handler: () => void) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
}

function getTg(): TgWebApp | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Telegram?: { WebApp: TgWebApp } }).Telegram?.WebApp ?? null
}

// Цвет звёздного неба — фон приложения.
const DARK_BG = '#05060A'

// Приложение всегда в тёмной теме, независимо от настроек телефона/Telegram.
// Telegram themeParams игнорируем — иначе в светлой теме карточки и фон
// становятся белыми. Палитра зафиксирована под звёздный фон.
export function applyTelegramTheme(): void {
  const root = document.documentElement

  const cssVars: Record<string, string> = {
    '--tg-bg': DARK_BG,
    '--tg-text': '#E5E7EB',
    '--tg-hint': '#9CA3AF',
    '--tg-link': '#8B5CF6',
    '--tg-button': '#7C5CF0',
    '--tg-button-text': '#FFFFFF',
    '--tg-secondary-bg': '#1A1C1F',
    '--tg-section-bg': '#1A1C1F',
    '--tg-section-separator': 'rgba(127, 127, 140, 0.18)',
    '--tg-destructive': '#EF4444',
  }

  Object.entries(cssVars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.classList.add('dark')

  // Нативная обвязка Telegram (шапка, фон, нижняя панель) — тоже тёмная.
  // Старые версии не поддерживают hex — оборачиваем в try/catch.
  const tg = getTg()
  try {
    tg?.setHeaderColor?.(DARK_BG)
    tg?.setBackgroundColor?.(DARK_BG)
    tg?.setBottomBarColor?.(DARK_BG)
  } catch {
    /* версия Telegram не поддерживает hex-цвета — игнорируем */
  }
}

// Если Telegram пришлёт смену темы — снова форсим тёмную.
export function listenThemeChanges(): () => void {
  const tg = getTg()
  if (!tg?.onEvent) return () => undefined

  tg.onEvent('themeChanged', applyTelegramTheme)
  return () => tg.offEvent?.('themeChanged', applyTelegramTheme)
}
