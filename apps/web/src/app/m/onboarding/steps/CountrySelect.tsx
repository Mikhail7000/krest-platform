'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase-browser'

const tapScale = { scale: 0.98 }

interface Country {
  id: string
  name_ru: string
  code: string
}

// ISO alpha-2 код → эмодзи-флаг (regional indicator symbols)
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🌍'
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export function CountrySelect({
  onSelect,
  onBack,
}: {
  onSelect: (countryId: string) => void
  onBack: () => void
}) {
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCountries = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('countries')
          .select('id, name_ru, code')
          .eq('status', 'active')
          .order('name_ru')

        if (error) {
          console.error('Failed to load countries:', error)
          return
        }

        setCountries(data || [])
      } catch (err) {
        console.error('Countries load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCountries()
  }, [])

  if (loading) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#16181D] dark:border-white/15 dark:border-t-primary mx-auto mb-4" />
          <p className="text-gray-500 dark:text-white/55">Загрузка стран…</p>
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
          Выберите страну
        </h1>
        <p className="text-gray-500 dark:text-white/55 text-center mb-8">Где вы живёте?</p>

        <div className="space-y-3">
          {countries.map((country) => (
            <motion.button
              key={country.id}
              onClick={() => onSelect(country.id)}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 bg-white shadow-sm text-left transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm dark:hover:border-white/30"
            >
              <span className="text-2xl">{flagEmoji(country.code)}</span>
              <span className="font-semibold text-[#16181D] dark:text-white">{country.name_ru}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.button
        type="button"
        onClick={onBack}
        whileTap={tapScale}
        className="w-full max-w-sm mx-auto mt-6 px-4 py-3 rounded-2xl border border-gray-200 font-medium text-gray-600 hover:border-gray-300 dark:border-white/15 dark:text-white/80 dark:hover:border-white/30 transition-colors"
      >
        Назад
      </motion.button>
    </div>
  )
}
