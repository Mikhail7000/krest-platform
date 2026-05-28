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

type Theme = 'light' | 'dark'

// Две палитры. Тёмная — звёздное небо; светлая (по умолчанию) — в стиле референсов.
// Тема Telegram/ОС намеренно игнорируется: выбор ручной (см. ThemeProvider).
const PALETTES: Record<Theme, { bg: string; vars: Record<string, string> }> = {
  dark: {
    bg: '#05060A',
    vars: {
      '--tg-bg': '#05060A',
      '--tg-text': '#E5E7EB',
      '--tg-hint': '#9CA3AF',
      '--tg-link': '#8B5CF6',
      '--tg-button': '#7C5CF0',
      '--tg-button-text': '#FFFFFF',
      '--tg-secondary-bg': '#1A1C1F',
      '--tg-section-bg': '#1A1C1F',
      '--tg-section-separator': 'rgba(127, 127, 140, 0.18)',
      '--tg-destructive': '#EF4444',
    },
  },
  light: {
    bg: '#EEF0F3',
    vars: {
      '--tg-bg': '#EEF0F3',
      '--tg-text': '#16181D',
      '--tg-hint': '#6B7280',
      '--tg-link': '#6366F1',
      '--tg-button': '#16181D',
      '--tg-button-text': '#FFFFFF',
      '--tg-secondary-bg': '#FFFFFF',
      '--tg-section-bg': '#FFFFFF',
      '--tg-section-separator': 'rgba(0, 0, 0, 0.08)',
      '--tg-destructive': '#DC2626',
    },
  },
}

function resolveTheme(theme?: Theme): Theme {
  if (theme) return theme
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

// Применяет палитру --tg-* и красит нативную обвязку Telegram под выбранную тему.
// Без аргумента — читает текущую тему из data-theme на <html>.
export function applyTelegramTheme(theme?: Theme): void {
  const t = resolveTheme(theme)
  const palette = PALETTES[t]
  const root = document.documentElement

  Object.entries(palette.vars).forEach(([k, v]) => root.style.setProperty(k, v))

  // Нативная обвязка Telegram (шапка, фон, нижняя панель).
  // Старые версии не поддерживают hex — оборачиваем в try/catch.
  const tg = getTg()
  try {
    tg?.setHeaderColor?.(palette.bg)
    tg?.setBackgroundColor?.(palette.bg)
    tg?.setBottomBarColor?.(palette.bg)
  } catch {
    /* версия Telegram не поддерживает hex-цвета — игнорируем */
  }
}

// Telegram прислал смену темы ОС — мы её игнорируем и повторно применяем
// НАШУ выбранную тему (из data-theme), а не палитру Telegram.
export function listenThemeChanges(): () => void {
  const tg = getTg()
  if (!tg?.onEvent) return () => undefined

  const handler = () => applyTelegramTheme()
  tg.onEvent('themeChanged', handler)
  return () => tg.offEvent?.('themeChanged', handler)
}
