'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

interface City {
  id: string
  name_ru: string
}

export function CitySelect({
  countryId,
  onSelect,
  onBack,
}: {
  countryId: string
  onSelect: (cityId: string) => void
  onBack: () => void
}) {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadCities = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('cities')
          .select('id, name_ru')
          .eq('country_id', countryId)
          .eq('status', 'active')
          .order('name_ru')

        if (error) {
          console.error('Failed to load cities:', error)
          return
        }

        setCities(data || [])
      } catch (err) {
        console.error('Cities load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCities()
  }, [countryId])

  const handleSupportClick = () => {
    router.push('/m/support')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Загрузка городов...</p>
        </div>
      </div>
    )
  }

  if (cities.length === 0) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-6 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Нет активных городов</h1>
          <p className="text-gray-600">
            В выбранной стране пока нет активных локаций. Напишите в поддержку, и мы добавим ваш город.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSupportClick}
          className="w-full mb-3 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition"
        >
          Написать в поддержку
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Назад
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-bold text-center mb-2">Выберите город</h1>
        <p className="text-gray-600 text-center mb-8">Где вы находитесь?</p>

        <div className="space-y-3">
          {cities.map((city) => (
            <button
              key={city.id}
              onClick={() => onSelect(city.id)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-blue-50 transition text-left font-medium"
            >
              {city.name_ru}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full mt-6 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        Назад
      </button>
    </div>
  )
}
