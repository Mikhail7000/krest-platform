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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
    // Запасное имя, если поле пустое — чтобы кнопка всегда работала
    const finalName = name.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Ученик'

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
    <div className="min-h-screen bg-white text-gray-900 p-6">
      <div className="pt-16 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center mb-2">Как вас зовут?</h1>
        <p className="text-gray-600 text-center mb-8">Можете изменить имя из Telegram, если нужно</p>

        <input
          type="text"
          placeholder="Введите ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 mb-4"
        />

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Кнопка всегда активна (имя имеет запасное значение), сразу под полем */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 mb-3"
        >
          {loading ? 'Сохранение…' : 'Продолжить'}
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
