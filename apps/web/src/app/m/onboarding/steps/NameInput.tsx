'use client'

import { useEffect, useState } from 'react'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    if (user?.first_name) {
      const telegramName = [user.first_name, user.last_name]
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
          <Input
            type="text"
            placeholder="Введите ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="text-lg"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="w-full"
        >
          {loading ? 'Продолжить...' : 'Продолжить'}
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="w-full"
        >
          Назад
        </Button>
      </div>
    </div>
  )
}
