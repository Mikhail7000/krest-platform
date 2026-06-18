'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '@/components/telegram/TelegramProvider'

const tapScale = { scale: 0.98 }

/**
 * Кнопка «нет моей страны/города» в онбординге.
 * По клику шлёт заявку с ником пользователя владельцу платформы в Telegram-бот
 * (см. /api/m/location-request). Показывает инлайн-подтверждение.
 */
export function LocationRequestButton({ kind }: { kind: 'country' | 'city' }) {
  const { initData } = useTelegram()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const label = kind === 'country' ? 'Моей страны нет в списке' : 'Моего города нет в списке'

  const handleClick = async () => {
    if (state !== 'idle') return
    setState('sending')
    try {
      const res = await fetch('/api/m/location-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, kind }),
      })
      setState(res.ok ? 'sent' : 'idle')
    } catch {
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div className="w-full px-4 py-2.5 rounded-2xl bg-green-50 border border-green-200 text-sm text-green-700 text-center dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
        ✅ Заявка отправлена — добавим твою локацию
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={state === 'sending'}
      whileTap={tapScale}
      className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 font-medium text-sm text-gray-600 hover:border-gray-300 disabled:opacity-50 dark:border-white/15 dark:text-white/70 dark:hover:border-white/30 transition-colors"
    >
      {state === 'sending' ? 'Отправляю…' : label}
    </motion.button>
  )
}
