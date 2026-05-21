'use client'

import { motion } from 'framer-motion'

interface LanguageSelectProps {
  onSelect: (lang: 'ru' | 'en') => void
}

export function LanguageSelect({ onSelect }: LanguageSelectProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-2">КРЕСТ</h1>
          <p className="text-slate-600">Выберите язык / Choose a language</p>
        </div>

        <div className="space-y-4">
          {/* Russian */}
          <motion.button
            onClick={() => onSelect('ru')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-6 bg-white rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:shadow-lg transition-all"
          >
            <div className="text-2xl mb-2">🇷🇺</div>
            <div className="text-lg font-bold text-slate-900">Русский</div>
            <div className="text-sm text-slate-500 mt-1">Начать обучение</div>
          </motion.button>

          {/* English */}
          <motion.button
            onClick={() => onSelect('en')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-6 bg-white rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all"
          >
            <div className="text-2xl mb-2">🇬🇧</div>
            <div className="text-lg font-bold text-slate-900">English</div>
            <div className="text-sm text-slate-500 mt-1">Coming soon...</div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
