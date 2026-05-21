'use client'

import { useEffect, useState } from 'react'
import { useTelegram } from '@/components/telegram/TelegramProvider'

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

  useEffect(() => {
    // Pre-fill with Telegram name
    if (user?.firstName) {
      const telegramName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(' ')
      setName(telegramName)
    }
  }, [user])

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(trimmedName)
    } finally {
      setLoading(false)
    }
  }

  const isValid = name.trim().length > 0

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-bold text-center mb-2">Как вас зовут?</h1>
        <p className="text-gray-600 text-center mb-8">Можете изменить имя из Telegram, если нужно</p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Введите ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Продолжить...' : 'Продолжить'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          Назад
        </button>
      </div>
    </div>
  )
}
