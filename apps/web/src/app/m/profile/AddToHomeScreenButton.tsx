'use client'

import { useEffect, useState } from 'react'

// Кнопка «Добавить на главный экран» — Telegram Mini App API (Bot API 8.0+).
// Иконка на экране = аватар бота (настраивается в BotFather).
export function AddToHomeScreenButton() {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any)?.Telegram?.WebApp
    setSupported(typeof tg?.addToHomeScreen === 'function')
  }, [])

  if (!supported) return null

  const onClick = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any)?.Telegram?.WebApp
    try {
      tg?.addToHomeScreen?.()
    } catch {
      /* старая версия Telegram — метод недоступен */
    }
  }

  return (
    <button type="button" className="pf-card pf-linkrow" onClick={onClick}>
      <span className="pf-row__label">Добавить на главный экран</span>
      <span className="pf-linkrow__arrow">›</span>
    </button>
  )
}
