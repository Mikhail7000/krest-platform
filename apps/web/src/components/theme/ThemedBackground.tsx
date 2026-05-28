'use client'

import { Starfield } from '@/components/features/Starfield'
import { useTheme } from './ThemeProvider'

/**
 * Глобальный фон MiniApp. В тёмной теме — звёздное небо (canvas),
 * в светлой — чистый светлый фон (рисует .miniapp-root, canvas не нужен).
 */
export function ThemedBackground() {
  const { theme } = useTheme()
  if (theme !== 'dark') return null
  return <Starfield fullscreen />
}
