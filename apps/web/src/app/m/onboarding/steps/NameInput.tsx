'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '@/components/telegram/TelegramProvider'

const tapScale = { scale: 0.98 }

export function NameInput({
  onSubmit,
  onBack,
}: {
  onSubmit: (name: string) => Promise<void>
  onBack: () => void
}) {
  const { user } = useTelegram()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Предзаполняем именем из Telegram
    if (user?.firstName) {
      const telegramName = [user.firstName, user.lastName].filter(Boolean).join(' ')
      setName(telegramName)
    }
  }, [user])

  const handleSubmit = async () => {
    // Запасное имя, если поле пустое — чтобы кнопка всегда работала
    const finalName =
      name.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Ученик'

    setErrorMessage(null)
    setLoading(true)
    try {
      await onSubmit(finalName)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось сохранить. Попробуйте ещё раз.')
    } finally {
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
          Как вас зовут?
        </h1>
        <p className="text-gray-500 dark:text-white/55 text-center mb-8">
          Можете изменить имя из Telegram, если нужно
        </p>

        <input
          type="text"
          placeholder="Введите ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3.5 text-lg rounded-2xl border border-gray-200 bg-white text-[#16181D] shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#16181D] disabled:opacity-50 mb-4 dark:border-white/12 dark:bg-white/5 dark:text-white dark:shadow-none dark:placeholder:text-white/40 dark:focus:border-white/30"
        />

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Кнопка всегда активна (имя имеет запасное значение) */}
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          whileTap={tapScale}
          className="onb-cta w-full px-4 py-3.5 rounded-2xl font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 mb-3"
        >
          {loading ? 'Сохранение…' : 'Продолжить'}
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
