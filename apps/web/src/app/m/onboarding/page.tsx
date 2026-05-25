'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { EnglishPlaceholder } from './EnglishPlaceholder'
import { LanguageSelect } from './LanguageSelect'
import { CountrySelect } from './steps/CountrySelect'
import { CitySelect } from './steps/CitySelect'

// Шаги 'curator' и 'name' убраны на период теста: куратора ещё нет, имя берём
// из Telegram автоматически. Флоу: язык → страна → город → сохранение.
type OnboardingStep = 'language' | 'english' | 'country' | 'city' | 'saving'

export default function OnboardingPage() {
  const router = useRouter()
  const { initData } = useTelegram()

  const [step, setStep] = useState<OnboardingStep>('language')
  const [countryId, setCountryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLanguageSelect = (lang: 'ru' | 'en') => {
    setStep(lang === 'en' ? 'english' : 'country')
  }

  const handleBack = useCallback(() => {
    if (step === 'country') {
      setStep('language')
    } else if (step === 'city') {
      setCountryId(null)
      setStep('country')
    }
  }, [step])

  const handleCountrySelect = useCallback((cId: string) => {
    setCountryId(cId)
    setStep('city')
  }, [])

  // Город выбран → сразу сохраняем онбординг (имя берётся из профиля/Telegram)
  const handleCitySelect = useCallback(
    async (cId: string) => {
      setError(null)
      setStep('saving')
      try {
        if (!countryId) throw new Error('Не выбрана страна. Вернитесь назад.')
        if (!initData) throw new Error('Нет данных Telegram. Откройте приложение через бота заново.')

        const res = await fetch('/api/miniapp/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData,
            country_id: countryId,
            city_id: cId,
            curator_id: null,
          }),
        })

        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e?.error?.message || 'Не удалось сохранить данные')
        }

        router.push('/m/dashboard')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения')
      }
    },
    [countryId, initData, router],
  )

  if (step === 'language') {
    return <LanguageSelect onSelect={handleLanguageSelect} />
  }

  if (step === 'english') {
    return <EnglishPlaceholder onBack={() => setStep('language')} />
  }

  if (step === 'country') {
    return <CountrySelect onSelect={handleCountrySelect} onBack={handleBack} />
  }

  if (step === 'city' && countryId) {
    return <CitySelect countryId={countryId} onSelect={handleCitySelect} onBack={handleBack} />
  }

  if (step === 'saving') {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-xs w-full">
          {error ? (
            <>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-300 text-sm">
                {error}
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep('city')
                }}
                className="w-full px-4 py-3 rounded-2xl border border-white/15 font-medium text-white/80 hover:border-white/30 transition-colors"
              >
                Назад
              </button>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/15 border-t-primary mx-auto mb-4" />
              <p className="text-white/55">Сохранение…</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
