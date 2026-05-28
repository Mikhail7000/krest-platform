'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase-browser'

interface Verse {
  reference: string
  text: string
  testament: string
}

interface EnglishPlaceholderProps {
  onBack: () => void
}

export function EnglishPlaceholder({ onBack }: EnglishPlaceholderProps) {
  const [verse, setVerse] = useState<Verse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRandomVerse = async () => {
      try {
        const { data, error } = await supabase
          .from('placeholder_bible_verses')
          .select('reference, text, testament')

        if (error || !data || data.length === 0) {
          console.error('Failed to load verses:', error)
          return
        }

        const randomVerse = data[Math.floor(Math.random() * data.length)]
        setVerse(randomVerse)
      } catch (e) {
        console.error('Error loading verse:', e)
      } finally {
        setLoading(false)
      }
    }

    loadRandomVerse()
  }, [])

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-8 overflow-hidden">
      {/* Фиолетовое свечение поверх звёзд */}
      <div className="pointer-events-none absolute top-16 left-6 w-40 h-40 rounded-full bg-[#8B5CF6]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 right-6 w-48 h-48 rounded-full bg-[#6366F1]/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="inline-block mb-6"
        >
          <div className="text-6xl">🍳</div>
        </motion.div>

        <h1 className="text-4xl font-extrabold text-[#16181D] dark:text-white mb-2 tracking-tight">Still Cooking</h1>
        <p className="text-gray-500 dark:text-white/55 mb-10">We&apos;re preparing something special for you…</p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="rounded-2xl border border-gray-200 bg-white shadow-sm p-7 mb-8 dark:border-white/12 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm"
        >
          {loading ? (
            <div className="space-y-4">
              <div className="h-4 bg-gray-100 dark:bg-white/10 rounded w-3/4 mx-auto animate-pulse" />
              <div className="h-20 bg-gray-50 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 dark:bg-white/10 rounded w-1/2 mx-auto animate-pulse" />
            </div>
          ) : verse ? (
            <>
              <div
                className="text-3xl mb-5"
                style={{
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                ✦
              </div>
              <p className="text-xl font-bold text-[#16181D] dark:text-white mb-4">{verse.reference}</p>
              <p className="text-base leading-relaxed text-gray-600 dark:text-white/75 italic mb-4">
                &ldquo;{verse.text}&rdquo;
              </p>
              <p className="text-sm text-gray-400 dark:text-white/40 font-medium">
                {verse.testament === 'Old Testament' ? 'Old Testament' : 'New Testament'}
              </p>
            </>
          ) : (
            <p className="text-gray-500 dark:text-white/55">Unable to load verse. Please try again.</p>
          )}
        </motion.div>

        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.97 }}
          className="text-sm font-medium text-gray-500 hover:text-[#16181D] dark:text-white/60 dark:hover:text-white transition-colors"
        >
          ← Choose a different language
        </motion.button>
      </motion.div>
    </div>
  )
}
