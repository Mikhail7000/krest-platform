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
        // Get all verses
        const { data, error } = await supabase
          .from('placeholder_bible_verses')
          .select('reference, text, testament')

        if (error || !data || data.length === 0) {
          console.error('Failed to load verses:', error)
          return
        }

        // Pick random verse
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg text-center"
      >
        {/* Cooking Animation */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="inline-block mb-8"
        >
          <div className="text-6xl">🍳</div>
        </motion.div>

        <h1 className="text-5xl font-black text-slate-900 mb-2">Still Cooking</h1>
        <p className="text-lg text-slate-600 mb-12">
          We're preparing something special for you...
        </p>

        {/* Verse Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="bg-white rounded-2xl p-8 shadow-lg border border-indigo-100 mb-8"
        >
          {loading ? (
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto animate-pulse" />
              <div className="h-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto animate-pulse" />
            </div>
          ) : verse ? (
            <>
              <div className="text-4xl mb-6 text-indigo-600">✨</div>
              <p className="text-2xl font-bold text-slate-900 mb-4">{verse.reference}</p>
              <p className="text-lg leading-relaxed text-slate-700 italic mb-4">
                "{verse.text}"
              </p>
              <p className="text-sm text-slate-500 font-medium">
                {verse.testament === 'Old Testament' ? 'Old Testament' : 'New Testament'}
              </p>
            </>
          ) : (
            <p className="text-slate-600">Unable to load verse. Please try again.</p>
          )}
        </motion.div>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-slate-600 mb-8 text-sm"
        >
          In the meantime, enjoy this verse of inspiration.
        </motion.p>

        {/* Back Button */}
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-6 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          ← Choose a different language
        </motion.button>
      </motion.div>

      {/* Animated Background Circles */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-20 left-10 w-32 h-32 bg-blue-200 rounded-full opacity-20 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
        className="absolute bottom-20 right-10 w-40 h-40 bg-indigo-200 rounded-full opacity-20 blur-3xl"
      />
    </div>
  )
}
