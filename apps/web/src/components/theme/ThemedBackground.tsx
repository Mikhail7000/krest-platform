'use client'

import { Starfield } from '@/components/features/Starfield'
import { useTheme } from './ThemeProvider'

/**
 * Глобальный фон MiniApp. В теме «звёзды» — звёздное небо (canvas).
 * В светлой и чистой тёмной — фон рисует .miniapp-root, canvas не нужен.
 */
export function ThemedBackground() {
  const { theme } = useTheme()
  if (theme !== 'stars') return null
  return <Starfield fullscreen />
}
