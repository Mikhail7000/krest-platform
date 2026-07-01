'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '@/components/telegram/TelegramProvider'

const tapScale = { scale: 0.98 }

/**
 * Шаг онбординга КУРАТОРА: он вводит ник Telegram своего лидера города.
 * Куратор привязывается к лидеру по городу (см. /api/m/leader-request).
 * onSelect возвращает страну/город лидера — их онбординг сохранит финально.
 */
export function LeaderSelect({
  onSelect,
  onBack,
}: {
  onSelect: (geo: { countryId: string; cityId: string }) => void
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
      const res = await fetch('/api/m/leader-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, leader_nick: clean }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok || !b.ok) {
        setError(b?.error?.message || 'Проверь ник и попробуй ещё раз')
        setLoading(false)
        return
      }
      onSelect({ countryId: String(b.country_id ?? ''), cityId: String(b.city_id ?? '') })
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
          Ваш лидер города
        </h1>
        <p className="text-gray-500 dark:text-white/55 text-center mb-8">
          Введите ник Telegram вашего лидера города
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

        {/* Куратора мог завести админ напрямую, без лидера — тогда шаг пропускается. */}
        <button
          type="button"
          onClick={() => onSelect({ countryId: '', cityId: '' })}
          disabled={loading}
          className="mt-4 w-full text-sm text-gray-400 underline underline-offset-4 hover:text-gray-600 disabled:opacity-50 dark:text-white/40 dark:hover:text-white/70"
        >
          У меня нет лидера города — пропустить
        </button>
      </motion.div>
    </div>
  )
}
