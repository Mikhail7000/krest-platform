'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { EnglishPlaceholder } from './EnglishPlaceholder'
import { LanguageSelect } from './LanguageSelect'
import { CountrySelect } from './steps/CountrySelect'
import { CitySelect } from './steps/CitySelect'
import { NameInput } from './steps/NameInput'

// Шаг 'curator' временно убран на период теста (кураторов ещё нет).
type OnboardingStep = 'language' | 'english' | 'country' | 'city' | 'name'

export default function OnboardingPage() {
  const router = useRouter()
  const { initData } = useTelegram()

  const [step, setStep] = useState<OnboardingStep>('language')
  const [countryId, setCountryId] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)

  const handleLanguageSelect = (lang: 'ru' | 'en') => {
    if (lang === 'en') {
      setStep('english')
    } else {
      setStep('country')
    }
  }

  const handleBack = useCallback(() => {
    if (step === 'country') {
      setStep('language')
    } else if (step === 'city') {
      setCountryId(null)
      setStep('country')
    } else if (step === 'name') {
      setCityId(null)
      setStep('city')
    }
  }, [step])

  const handleCountrySelect = useCallback((cId: string) => {
    setCountryId(cId)
    setStep('city')
  }, [])

  const handleCitySelect = useCallback((cId: string) => {
    setCityId(cId)
    setStep('name')
  }, [])

  const handleNameSubmit = useCallback(
    async (name: string) => {
      // Ошибки пробрасываем наружу — NameInput их покажет (без молчаливого провала)
      if (!countryId || !cityId) {
        throw new Error('Не выбраны страна или город. Вернитесь назад.')
      }
      if (!initData) {
        throw new Error('Нет данных Telegram. Откройте приложение через бота заново.')
      }

      const res = await fetch('/api/miniapp/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          country_id: countryId,
          city_id: cityId,
          curator_id: null,
          full_name: name,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error?.error?.message || 'Не удалось сохранить данные')
      }

      router.push('/m/dashboard')
    },
    [countryId, cityId, initData, router]
  )

  // Language selection
  if (step === 'language') {
    return <LanguageSelect onSelect={handleLanguageSelect} />
  }

  // English placeholder ("Still Cooking")
  if (step === 'english') {
    return <EnglishPlaceholder onBack={() => setStep('language')} />
  }

  // Country selection
  if (step === 'country') {
    return (
      <CountrySelect onSelect={handleCountrySelect} onBack={handleBack} />
    )
  }

  // City selection
  if (step === 'city' && countryId) {
    return (
      <CitySelect countryId={countryId} onSelect={handleCitySelect} onBack={handleBack} />
    )
  }

  // Name input
  if (step === 'name') {
    return (
      <NameInput onSubmit={handleNameSubmit} onBack={handleBack} />
    )
  }

  return null
}
