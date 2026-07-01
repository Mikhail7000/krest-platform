'use client'

/**
 * Кликабельный Telegram-ник: @nick → t.me/nick в новой вкладке.
 * Основной инструмент куратора — личная переписка; раньше ник копировали руками.
 * stopPropagation — чтобы клик не разворачивал строку-аккордеон (кураторы).
 */
export function TgLink({ nick }: { nick: string | null }) {
  if (!nick) return null
  const clean = nick.replace(/^@+/, '')
  return (
    <a
      href={`https://t.me/${clean}`}
      target="_blank"
      rel="noopener noreferrer"
      className="panel-muted"
      style={{ textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
      onClick={(e) => e.stopPropagation()}
    >
      @{clean}
    </a>
  )
}
