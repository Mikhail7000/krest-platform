'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { SupportRequestScreen } from './SupportRequestScreen'

export function MiniAppGate({ children }: { children: React.ReactNode }) {
  const { status, initData } = useTelegram()
  const router = useRouter()
  const [checkedOnboarding, setCheckedOnboarding] = useState(false)

  useEffect(() => {
    if (status !== 'ready' || !initData) return

    // Отметить ежедневную активность (заход в приложение) — fire-and-forget
    fetch('/api/m/activity/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    }).catch(() => {})

    const checkOnboarding = async () => {
      try {
        const res = await fetch('/api/miniapp/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        })
        if (!res.ok) {
          console.error('Failed to fetch profile')
          setCheckedOnboarding(true)
          return
        }

        const data = await res.json() as { onboarding_done: boolean }
        if (!data.onboarding_done) {
          router.push('/m/onboarding')
        }
      } catch (err) {
        console.error('Profile check error:', err)
      }
      setCheckedOnboarding(true)
    }

    checkOnboarding()
  }, [status, initData, router])

  // Show support screen when access is denied
  if (status === 'forbidden') {
    return <SupportRequestScreen />
  }

  // Wait for onboarding check to complete before rendering children
  if (status === 'ready' && !checkedOnboarding) {
    return null
  }

  // Pass through to children for all other states
  return <>{children}</>
}
