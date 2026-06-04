'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase-browser'

const tapScale = { scale: 0.98 }

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
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#16181D] dark:border-white/15 dark:border-t-primary mx-auto mb-4" />
          <p className="text-gray-500 dark:text-white/55">Загрузка кураторов…</p>
        </div>
      </div>
    )
  }

  if (curators.length === 0) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col justify-center px-5 py-8">
        <div className="w-full max-w-sm mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold text-[#16181D] dark:text-white mb-2 tracking-tight">
              Кураторы не найдены
            </h1>
            <p className="text-gray-500 dark:text-white/55 leading-relaxed">
              В вашем городе пока нет куратора. Напишите в поддержку, и мы поможем найти для вас
              наставника.
            </p>
          </div>

          <motion.button
            type="button"
            onClick={handleSupportClick}
            whileTap={tapScale}
            className="onb-cta w-full mb-3 px-4 py-3.5 rounded-2xl font-semibold transition-opacity hover:opacity-90"
          >
            Написать в поддержку
          </motion.button>
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

  return (
    <div className="relative z-10 min-h-screen flex flex-col px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto"
      >
        <h1 className="text-3xl font-extrabold text-[#16181D] dark:text-white text-center mb-2 tracking-tight">
          Выберите куратора
        </h1>
        <p className="text-gray-500 dark:text-white/55 text-center mb-8">Кто будет вашим наставником?</p>

        <div className="space-y-3">
          {curators.map((curator) => (
            <motion.button
              key={curator.id}
              onClick={() => onSelect(curator.id)}
              whileTap={tapScale}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 bg-white shadow-sm text-left transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm dark:hover:border-white/30"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16181D] font-semibold text-white dark:border dark:border-white/12 dark:bg-white/10">
                {curator.full_name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[#16181D] dark:text-white">{curator.full_name}</span>
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
