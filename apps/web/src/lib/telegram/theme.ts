type TgWebApp = {
  themeParams?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  onEvent?: (event: string, handler: () => void) => void
  offEvent?: (event: string, handler: () => void) => void
}

function getTg(): TgWebApp | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Telegram?: { WebApp: TgWebApp } }).Telegram?.WebApp ?? null
}

export function applyTelegramTheme(): void {
  const tg = getTg()
  if (!tg) return

  const t = tg.themeParams ?? {}
  const root = document.documentElement

  const cssVars: Record<string, string> = {
    '--tg-bg': t.bg_color ?? '#0F1114',
    '--tg-text': t.text_color ?? '#E5E7EB',
    '--tg-hint': t.hint_color ?? '#9CA3AF',
    '--tg-link': t.link_color ?? '#0F8AD2',
    '--tg-button': t.button_color ?? '#C9A961',
    '--tg-button-text': t.button_text_color ?? '#FFFFFF',
    '--tg-secondary-bg': t.secondary_bg_color ?? '#1A1C1F',
    '--tg-section-bg': t.section_bg_color ?? '#1A1C1F',
    '--tg-destructive': t.destructive_text_color ?? '#EF4444',
  }

  Object.entries(cssVars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.classList.toggle('dark', tg.colorScheme === 'dark')
}

export function listenThemeChanges(): () => void {
  const tg = getTg()
  if (!tg?.onEvent) return () => undefined

  tg.onEvent('themeChanged', applyTelegramTheme)
  return () => tg.offEvent?.('themeChanged', applyTelegramTheme)
}
