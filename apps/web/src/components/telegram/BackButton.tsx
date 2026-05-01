'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type BackButtonApi = {
  show: () => void
  hide: () => void
  onClick: (handler: () => void) => void
  offClick: (handler: () => void) => void
}

type Props = {
  onClick?: () => void
}

function getBackButton(): BackButtonApi | null {
  if (typeof window === 'undefined') return null
  const tg = (window as unknown as { Telegram?: { WebApp?: { BackButton?: BackButtonApi } } })
    .Telegram?.WebApp
  return tg?.BackButton ?? null
}

export function BackButton({ onClick }: Props) {
  const router = useRouter()

  useEffect(() => {
    const button = getBackButton()
    if (!button) return

    const handler = onClick ?? (() => router.back())
    button.show()
    button.onClick(handler)

    return () => {
      button.offClick(handler)
      button.hide()
    }
  }, [router, onClick])

  return null
}
