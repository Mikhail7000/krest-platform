'use client'

import { useTelegram } from '@/components/telegram/TelegramProvider'
import { SupportRequestScreen } from './SupportRequestScreen'

export function MiniAppGate({ children }: { children: React.ReactNode }) {
  const { status } = useTelegram()

  // Show support screen when access is denied
  if (status === 'forbidden') {
    return <SupportRequestScreen />
  }

  // Pass through to children for all other states
  return <>{children}</>
}
