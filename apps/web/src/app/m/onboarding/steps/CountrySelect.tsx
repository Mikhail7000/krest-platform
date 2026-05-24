'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Загрузка стран...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-bold text-center mb-2">Выберите страну</h1>
        <p className="text-gray-600 text-center mb-8">Где вы живёте?</p>

        <div className="space-y-3">
          {countries.map((country) => (
            <button
              key={country.id}
              onClick={() => onSelect(country.id)}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-blue-50 transition"
            >
              <span className="text-2xl">{flagEmoji(country.code)}</span>
              <span className="text-left font-medium">{country.name_ru}</span>
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
