'use client'

type HapticApi = {
  impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
  selectionChanged?: () => void
}

function getHaptic(): HapticApi | null {
  if (typeof window === 'undefined') return null
  const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: HapticApi } } })
    .Telegram?.WebApp
  return tg?.HapticFeedback ?? null
}

export function useHaptic() {
  return {
    impact: (style: 'light' | 'medium' | 'heavy' = 'medium') => {
      getHaptic()?.impactOccurred?.(style)
    },
    notification: (type: 'error' | 'success' | 'warning') => {
      getHaptic()?.notificationOccurred?.(type)
    },
    selection: () => {
      getHaptic()?.selectionChanged?.()
    },
  }
}
