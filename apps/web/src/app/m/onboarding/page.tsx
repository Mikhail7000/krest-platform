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

type OnboardingStep = 'language' | 'english' | 'country' | 'city' | 'curator' | 'name' | 'saving' | 'done'

export default function OnboardingPage() {
  const router = useRouter()
  const { initData } = useTelegram()

  const [step, setStep] = useState<OnboardingStep>('language')
  const [countryId, setCountryId] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)
  const [curatorId, setCuratorId] = useState<string | null>(null)

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

  const handleCuratorSelect = useCallback((cId: string) => {
    setCuratorId(cId)
    setStep('name')
  }, [])

  const handleNameSubmit = useCallback(
    async (name: string) => {
      if (!countryId || !cityId || !curatorId || !initData) {
        console.error('Missing required fields')
        return
      }

      setStep('saving')

      try {
        const res = await fetch('/api/miniapp/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData,
            country_id: countryId,
            city_id: cityId,
            curator_id: curatorId,
            full_name: name,
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || 'Failed to save onboarding')
        }

        setStep('done')
        setTimeout(() => {
          router.push('/m/dashboard')
        }, 500)
      } catch (err) {
        console.error('Onboarding save error:', err)
        setStep('name')
      }
    },
    [countryId, cityId, curatorId, initData, router]
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

  // Curator selection
  if (step === 'curator' && cityId) {
    return (
      <CuratorSelect cityId={cityId} onSelect={handleCuratorSelect} onBack={handleBack} />
    )
  }

  // Name input
  if (step === 'name') {
    return (
      <NameInput onSubmit={handleNameSubmit} onBack={handleBack} />
    )
  }

  // Saving
  if (step === 'saving') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Сохранение данных...</p>
        </div>
      </div>
    )
  }

  return null
}
