'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '@/components/telegram/TelegramProvider'

const tapScale = { scale: 0.98 }

/**
 * Шаг «ваш наставник»: ученик вводит ник Telegram своего куратора.
 * Заявка уходит владельцу в бот (+ автопривязка curator_id, если ник совпал
 * с кем-то из кураторов). См. /api/m/curator-request.
 * cityId оставлен в сигнатуре для совместимости с вызовом онбординга.
 */
export function CuratorSelect({
  onSelect,
  onBack,
}: {
  cityId: string
  onSelect: (curatorId: string | null) => void
  onBack: () => void
}) {
  const { initData } = useTelegram()
  const [nick, setNick] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    const clean = nick.trim().replace(/^@+/, '')
    if (clean.length < 1) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/m/curator-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, curator_nick: clean }),
      })
      if (!res.ok) {
        setError('Проверь ник и попробуй ещё раз')
        setLoading(false)
        return
      }
      // curator_id ставится на сервере (если ник нашёлся); продолжаем онбординг
      onSelect(null)
    } catch {
      setError('Не удалось отправить. Попробуй ещё раз')
      setLoading(false)
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto"
      >
        <h1 className="text-3xl font-extrabold text-[#16181D] dark:text-white text-center mb-2 tracking-tight">
          Ваш наставник
        </h1>
        <p className="text-gray-500 dark:text-white/55 text-center mb-8">
          Введите ник Telegram вашего куратора
        </p>

        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400 dark:text-white/40">
            @
          </span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="username"
            value={nick}
            onChange={(e) => setNick(e.target.value.replace(/^@+/, ''))}
            disabled={loading}
            className="w-full pl-9 pr-4 py-3.5 text-lg rounded-2xl border border-gray-200 bg-white text-[#16181D] shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#16181D] disabled:opacity-50 dark:border-white/12 dark:bg-white/5 dark:text-white dark:shadow-none dark:placeholder:text-white/40 dark:focus:border-white/30"
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <motion.button
          type="button"
          onClick={handleContinue}
          disabled={loading || nick.trim().length < 1}
          whileTap={tapScale}
          className="onb-cta w-full px-4 py-3.5 rounded-2xl font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 mb-3"
        >
          {loading ? 'Отправляю…' : 'Продолжить'}
        </motion.button>
        <motion.button
          type="button"
          onClick={onBack}
          disabled={loading}
          whileTap={tapScale}
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-medium text-gray-600 hover:border-gray-300 disabled:opacity-50 dark:border-white/15 dark:text-white/80 dark:hover:border-white/30 transition-colors"
        >
          Назад
        </motion.button>
      </motion.div>
    </div>
  )
}
