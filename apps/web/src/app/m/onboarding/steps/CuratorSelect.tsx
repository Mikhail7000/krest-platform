'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'

interface Curator {
  id: string
  full_name: string
}

export function CuratorSelect({
  cityId,
  onSelect,
  onBack,
}: {
  cityId: string
  onSelect: (curatorId: string) => void
  onBack: () => void
}) {
  const [curators, setCurators] = useState<Curator[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadCurators = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'curator')
          .eq('city_id', cityId)
          .order('full_name')

        if (error) {
          console.error('Failed to load curators:', error)
          return
        }

        setCurators(data || [])
      } catch (err) {
        console.error('Curators load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCurators()
  }, [cityId])

  const handleSupportClick = () => {
    router.push('/m/support')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Загрузка кураторов...</p>
        </div>
      </div>
    )
  }

  if (curators.length === 0) {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Кураторы не найдены</h1>
          <p className="text-gray-600">
            В вашем городе пока нет куратора. Напишите в поддержку, и мы поможем найти для вас наставника.
          </p>
        </div>

        <Button onClick={handleSupportClick} className="w-full mb-3">
          Написать в поддержку
        </Button>
        <Button variant="outline" onClick={onBack} className="w-full">
          Назад
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-bold text-center mb-2">Выберите куратора</h1>
        <p className="text-gray-600 text-center mb-8">Кто будет вашим наставником?</p>

        <div className="space-y-3">
          {curators.map((curator) => (
            <button
              key={curator.id}
              onClick={() => onSelect(curator.id)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-blue-50 transition text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                  {curator.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{curator.full_name}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button variant="outline" onClick={onBack} className="w-full mt-6">
        Назад
      </Button>
    </div>
  )
}
