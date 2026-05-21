'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnglishPlaceholder } from './EnglishPlaceholder'
import { LanguageSelect } from './LanguageSelect'

export default function OnboardingPage() {
  const router = useRouter()
  const [selectedLanguage, setSelectedLanguage] = useState<'ru' | 'en' | null>(null)

  const handleLanguageSelect = (lang: 'ru' | 'en') => {
    setSelectedLanguage(lang)
  }

  const handleBack = () => {
    setSelectedLanguage(null)
  }

  // English selected → show "Still Cooking" placeholder
  if (selectedLanguage === 'en') {
    return <EnglishPlaceholder onBack={handleBack} />
  }

  // Russian selected → continue to country selection (future)
  if (selectedLanguage === 'ru') {
    // TODO: Navigate to country selection or create OnboardingFlow component
    return <div className="min-h-screen flex items-center justify-center">Russian onboarding coming soon...</div>
  }

  // Show language selection
  return <LanguageSelect onSelect={handleLanguageSelect} />
}
