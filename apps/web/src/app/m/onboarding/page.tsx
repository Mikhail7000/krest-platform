'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { EnglishPlaceholder } from './EnglishPlaceholder'
import { LanguageSelect } from './LanguageSelect'
import { CountrySelect } from './steps/CountrySelect'
import { CitySelect } from './steps/CitySelect'
import { NameInput } from './steps/NameInput'

// Флоу: язык → страна → город → имя → сохранение.
// Шаг 'curator' (CuratorSelect) готов под обе темы, но отвязан на период теста:
// кураторов в Бали ещё нет, иначе новый ученик упирается в «Кураторов не найдено».
// Включить, когда появятся кураторы: вернуть шаг между 'city' и 'name'.
type OnboardingStep = 'language' | 'english' | 'country' | 'city' | 'name'

export default function OnboardingPage() {
  const router = useRouter()
  const { initData } = useTelegram()

  const [step, setStep] = useState<OnboardingStep>('language')
  const [countryId, setCountryId] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)

  const handleLanguageSelect = (lang: 'ru' | 'en') => {
    setStep(lang === 'en' ? 'english' : 'country')
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

  // Имя введено — финальный шаг: сохраняем весь онбординг.
  // Бросаем ошибку при неудаче, чтобы NameInput показал её и оставил на шаге.
  const handleNameSubmit = useCallback(
    async (fullName: string) => {
      if (!countryId || !cityId) throw new Error('Не выбраны страна/город. Вернитесь назад.')
      if (!initData) throw new Error('Нет данных Telegram. Откройте приложение через бота заново.')

      const res = await fetch('/api/miniapp/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          country_id: countryId,
          city_id: cityId,
          curator_id: null, // шаг куратора отвязан на период теста (см. коммент выше)
          full_name: fullName,
        }),
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error?.message || 'Не удалось сохранить данные')
      }

      router.push('/m/dashboard')
    },
    [countryId, cityId, initData, router],
  )

  let content: React.ReactNode = null
  if (step === 'language') {
    content = <LanguageSelect onSelect={handleLanguageSelect} />
  } else if (step === 'english') {
    content = <EnglishPlaceholder onBack={() => setStep('language')} />
  } else if (step === 'country') {
    content = <CountrySelect onSelect={handleCountrySelect} onBack={handleBack} />
  } else if (step === 'city' && countryId) {
    content = <CitySelect countryId={countryId} onSelect={handleCitySelect} onBack={handleBack} />
  } else if (step === 'name') {
    content = <NameInput onSubmit={handleNameSubmit} onBack={handleBack} />
  }

  return content
}
