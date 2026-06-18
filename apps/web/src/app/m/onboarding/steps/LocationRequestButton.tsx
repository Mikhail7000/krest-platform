'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '@/components/telegram/TelegramProvider'

const tapScale = { scale: 0.98 }

/**
 * «Нет моей страны/города» в онбординге.
 * По клику разворачивает поле ввода названия локации → шлёт заявку с ником
 * пользователя И введённым названием владельцу платформы в бот
 * (см. /api/m/location-request). Показывает инлайн-подтверждение.
 */
export function LocationRequestButton({ kind }: { kind: 'country' | 'city' }) {
  const { initData } = useTelegram()
  const [state, setState] = useState<'idle' | 'input' | 'sending' | 'sent'>('idle')
  const [text, setText] = useState('')

  const label = kind === 'country' ? 'Моей страны нет в списке' : 'Моего города нет в списке'
  const prompt =
    kind === 'country'
      ? 'Введите название страны, где вы находитесь'
      : 'Введите название города, где вы находитесь'

  const handleSend = async () => {
    const value = text.trim()
    if (!value) return
    setState('sending')
    try {
      const res = await fetch('/api/m/location-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, kind, location_text: value }),
      })
      setState(res.ok ? 'sent' : 'input')
    } catch {
      setState('input')
    }
  }

  if (state === 'sent') {
    return (
      <div className="w-full px-4 py-2.5 rounded-2xl bg-green-50 border border-green-200 text-sm text-green-700 text-center dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
        ✅ Заявка отправлена — добавим твою локацию
      </div>
    )
  }

  if (state === 'idle') {
    return (
      <motion.button
        type="button"
        onClick={() => setState('input')}
        whileTap={tapScale}
        className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 font-medium text-sm text-gray-600 hover:border-gray-300 dark:border-white/15 dark:text-white/70 dark:hover:border-white/30 transition-colors"
      >
        {label}
      </motion.button>
    )
  }

  // input / sending
  return (
    <div className="w-full space-y-2">
      <input
        type="text"
        autoFocus
        placeholder={prompt}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={state === 'sending'}
        className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[#16181D] shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#16181D] disabled:opacity-50 dark:border-white/12 dark:bg-white/5 dark:text-white dark:shadow-none dark:placeholder:text-white/40 dark:focus:border-white/30"
      />
      <motion.button
        type="button"
        onClick={handleSend}
        disabled={state === 'sending' || text.trim().length < 1}
        whileTap={tapScale}
        className="onb-cta w-full px-4 py-2.5 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state === 'sending' ? 'Отправляю…' : 'Отправить заявку'}
      </motion.button>
    </div>
  )
}
