'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase-browser'
import { LocationRequestButton } from './LocationRequestButton'

const tapScale = { scale: 0.98 }

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
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#16181D] dark:border-white/15 dark:border-t-primary mx-auto mb-4" />
          <p className="text-gray-500 dark:text-white/55">Загрузка городов…</p>
        </div>
      </div>
    )
  }

  if (cities.length === 0) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col justify-center px-5 py-8">
        <div className="w-full max-w-sm mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold text-[#16181D] dark:text-white mb-2 tracking-tight">
              Нет активных городов
            </h1>
            <p className="text-gray-500 dark:text-white/55 leading-relaxed">
              В выбранной стране пока нет активных локаций. Напишите в поддержку, и мы добавим ваш
              город.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSupportClick}
            className="onb-cta w-full mb-3 px-4 py-3.5 rounded-2xl font-semibold transition-opacity hover:opacity-90"
          >
            Написать в поддержку
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-medium text-gray-600 hover:border-gray-300 dark:border-white/15 dark:text-white/80 dark:hover:border-white/30 transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto"
      >
        <h1 className="text-3xl font-extrabold text-[#16181D] dark:text-white text-center mb-2 tracking-tight">
          Выберите город
        </h1>
        <p className="text-gray-500 dark:text-white/55 text-center mb-8">Где вы находитесь?</p>

        <div className="space-y-3">
          {cities.map((city) => (
            <motion.button
              key={city.id}
              onClick={() => onSelect(city.id)}
              whileTap={tapScale}
              className="w-full p-4 rounded-2xl border border-gray-200 bg-white shadow-sm text-left font-semibold text-[#16181D] transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm dark:text-white dark:hover:border-white/30"
            >
              {city.name_ru}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <div className="w-full max-w-sm mx-auto mt-6 space-y-3">
        <LocationRequestButton kind="city" />
        <motion.button
          type="button"
          onClick={onBack}
          whileTap={tapScale}
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-medium text-gray-600 hover:border-gray-300 dark:border-white/15 dark:text-white/80 dark:hover:border-white/30 transition-colors"
        >
          Назад
        </motion.button>
      </div>
    </div>
  )
}
