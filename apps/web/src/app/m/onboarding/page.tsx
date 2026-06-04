'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { EnglishPlaceholder } from './EnglishPlaceholder'
import { LanguageSelect } from './LanguageSelect'
import { CountrySelect } from './steps/CountrySelect'
import { CitySelect } from './steps/CitySelect'
import { CuratorSelect } from './steps/CuratorSelect'
import { NameInput } from './steps/NameInput'

// Флоу: язык → страна → город → наставник → имя → сохранение.
type OnboardingStep = 'language' | 'english' | 'country' | 'city' | 'curator' | 'name'

export default function OnboardingPage() {
  const router = useRouter()
  const { initData } = useTelegram()

  const [step, setStep] = useState<OnboardingStep>('language')
  const [countryId, setCountryId] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)
  const [curatorId, setCuratorId] = useState<string | null>(null)

  const handleLanguageSelect = (lang: 'ru' | 'en') => {
    setStep(lang === 'en' ? 'english' : 'country')
  }

  const handleBack = useCallback(() => {
    if (step === 'country') {
      setStep('language')
    } else if (step === 'city') {
      setCountryId(null)
      setStep('country')
    } else if (step === 'curator') {
      setCityId(null)
      setStep('city')
    } else if (step === 'name') {
      setCuratorId(null)
      setStep('curator')
    }
  }, [step])

  const handleCountrySelect = useCallback((cId: string) => {
    setCountryId(cId)
    setStep('city')
  }, [])

  const handleCitySelect = useCallback((cId: string) => {
    setCityId(cId)
    setStep('curator')
  }, [])

  const handleCuratorSelect = useCallback((cId: string | null) => {
    setCuratorId(cId)
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
          curator_id: curatorId,
          full_name: fullName,
          lang: 'ru',
        }),
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error?.message || 'Не удалось сохранить данные')
      }

      router.push('/m/dashboard')
    },
    [countryId, cityId, curatorId, initData, router],
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
  } else if (step === 'curator' && cityId) {
    content = <CuratorSelect cityId={cityId} onSelect={handleCuratorSelect} onBack={handleBack} />
  } else if (step === 'name') {
    content = <NameInput onSubmit={handleNameSubmit} onBack={handleBack} />
  }

  return content
}
