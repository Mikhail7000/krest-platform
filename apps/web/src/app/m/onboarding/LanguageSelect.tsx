'use client'

import { motion } from 'framer-motion'

interface LanguageSelectProps {
  onSelect: (lang: 'ru' | 'en') => void
}

export function LanguageSelect({ onSelect }: LanguageSelectProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-12">
          <h1
            className="text-6xl font-extrabold mb-3 tracking-tighter"
            style={{
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              width: 'fit-content',
              margin: '0 auto 0.75rem',
            }}
          >
            КРЕСТ
          </h1>
          <p className="text-gray-500 dark:text-white/55">Выберите язык / Choose a language</p>
        </div>

        <div className="space-y-3.5">
          <motion.button
            onClick={() => onSelect('ru')}
            whileTap={{ scale: 0.98 }}
            className="w-full p-5 rounded-2xl border border-gray-200 bg-white shadow-sm text-center transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm dark:hover:border-white/30"
          >
            <div className="text-2xl mb-1.5">🇷🇺</div>
            <div className="text-lg font-bold text-[#16181D] dark:text-white">Русский</div>
            <div className="text-sm text-gray-500 dark:text-white/50 mt-0.5">Начать обучение</div>
          </motion.button>

          <motion.button
            onClick={() => onSelect('en')}
            whileTap={{ scale: 0.98 }}
            className="w-full p-5 rounded-2xl border border-gray-200 bg-white shadow-sm text-center transition-colors hover:border-gray-300 dark:border-white/12 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm dark:hover:border-white/30"
          >
            <div className="text-2xl mb-1.5">🇬🇧</div>
            <div className="text-lg font-bold text-[#16181D] dark:text-white">English</div>
            <div className="text-sm text-gray-500 dark:text-white/50 mt-0.5">Coming soon…</div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
