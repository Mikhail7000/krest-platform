'use client'

import { useEffect } from 'react'

type MainButtonApi = {
  setText: (text: string) => void
  show: () => void
  hide: () => void
  enable: () => void
  disable: () => void
  showProgress: () => void
  hideProgress: () => void
  onClick: (handler: () => void) => void
  offClick: (handler: () => void) => void
}

type Props = {
  text: string
  onClick: () => void
  visible?: boolean
  disabled?: boolean
  loading?: boolean
}

function getMainButton(): MainButtonApi | null {
  if (typeof window === 'undefined') return null
  const tg = (window as unknown as { Telegram?: { WebApp?: { MainButton?: MainButtonApi } } })
    .Telegram?.WebApp
  return tg?.MainButton ?? null
}

export function MainButton({ text, onClick, visible = true, disabled = false, loading = false }: Props) {
  useEffect(() => {
    const button = getMainButton()
    if (!button) return

    button.setText(text)
    if (visible) button.show()
    else button.hide()
    if (disabled) button.disable()
    else button.enable()
    if (loading) button.showProgress()
    else button.hideProgress()

    button.onClick(onClick)
    return () => {
      button.offClick(onClick)
      button.hide()
    }
  }, [text, onClick, visible, disabled, loading])

  return null
}
