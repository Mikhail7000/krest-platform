'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { EnglishPlaceholder } from './EnglishPlaceholder'
import { LanguageSelect } from './LanguageSelect'
import { CountrySelect } from './steps/CountrySelect'
import { CitySelect } from './steps/CitySelect'
import { CuratorSelect } from './steps/CuratorSelect'
import { LeaderSelect } from './steps/LeaderSelect'
import { NameInput } from './steps/NameInput'

// Флоу по роли:
//  ученик:  язык → страна → город → куратор → имя
//  куратор: язык → страна → город → лидер города → имя
//  лидер/админ: язык → страна → город → имя (без привязки)
type OnboardingStep = 'language' | 'english' | 'country' | 'city' | 'attach' | 'name'

export default function OnboardingPage() {
  const router = useRouter()
  const { initData } = useTelegram()

  const [role, setRole] = useState<string>('student')
  const [step, setStep] = useState<OnboardingStep>('language')
  const [countryId, setCountryId] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)
  const [curatorId, setCuratorId] = useState<string | null>(null)

  // Роль определяет ветку привязки. Ставит whitelist при /start; читаем из профиля.
  useEffect(() => {
    if (!initData) return
    fetch('/api/miniapp/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.role) setRole(d.role as string)
      })
      .catch(() => {})
  }, [initData])

  const isCurator = role === 'curator'
  const skipsAttach = role === 'city_leader' || role === 'admin' || role === 'super_admin'

  const handleLanguageSelect = (lang: 'ru' | 'en') => {
    setStep(lang === 'en' ? 'english' : 'country')
  }

  const handleBack = useCallback(() => {
    if (step === 'country') setStep('language')
    else if (step === 'city') {
      setCountryId(null)
      setStep('country')
    } else if (step === 'attach') {
      setCityId(null)
      setStep('city')
    } else if (step === 'name') {
      // Назад из имени: лидер/админ → город; остальные → шаг привязки.
      if (skipsAttach) setStep('city')
      else {
        setCuratorId(null)
        setStep('attach')
      }
    }
  }, [step, skipsAttach])

  const handleCountrySelect = useCallback((cId: string) => {
    setCountryId(cId)
    setStep('city')
  }, [])

  const handleCitySelect = useCallback(
    (cId: string) => {
      setCityId(cId)
      // Лидер/админ — без привязки: сразу имя. Остальные — шаг привязки.
      setStep(skipsAttach ? 'name' : 'attach')
    },
    [skipsAttach],
  )

  // Ученик: указал куратора (curator_id ставится на сервере). Идём к имени.
  const handleCuratorSelect = useCallback((cId: string | null) => {
    setCuratorId(cId)
    setStep('name')
  }, [])

  // Куратор: указал лидера — страну/город берём от лидера (перекрывают выбранные).
  const handleLeaderSelect = useCallback((geo: { countryId: string; cityId: string }) => {
    if (geo.countryId) setCountryId(geo.countryId)
    if (geo.cityId) setCityId(geo.cityId)
    setStep('name')
  }, [])

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
  } else if (step === 'attach' && cityId) {
    content = isCurator ? (
      <LeaderSelect onSelect={handleLeaderSelect} onBack={handleBack} />
    ) : (
      <CuratorSelect cityId={cityId} onSelect={handleCuratorSelect} onBack={handleBack} />
    )
  } else if (step === 'name') {
    content = <NameInput onSubmit={handleNameSubmit} onBack={handleBack} />
  }

  return content
}
