'use client'

import { useState } from 'react'
import { useYouTubeNoSkip } from '@/hooks/use-youtube-no-skip'
import type { Block, Lesson } from '@/lib/supabase-server'

interface LessonClientProps {
  block: Block
  lesson: Lesson
  userId: string
  hasExistingEntry: boolean
}

export function LessonClient({ block, lesson, userId, hasExistingEntry }: LessonClientProps) {
  const [videoComplete, setVideoComplete] = useState(false)
  const [forumText, setForumText] = useState('')
  const [submitted, setSubmitted] = useState(hasExistingEntry)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { containerRef } = useYouTubeNoSkip({
    videoId: lesson.youtube_url ?? '',
    onComplete: () => setVideoComplete(true),
  })

  const canSubmit = videoComplete && forumText.trim().length >= 20

  async function handleSubmit() {
    if (!canSubmit || saving) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/student/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          blockId: block.id,
          lessonId: lesson.id,
          content: forumText.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message ?? 'Ошибка сохранения')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Ошибка сети. Попробуйте снова.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Video */}
      <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {!videoComplete && (
        <p className="text-sm text-gray-500 text-center">
          Посмотрите видео полностью (95%), чтобы продолжить
        </p>
      )}

      {/* Forum — visible only after video */}
      {videoComplete && !submitted && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Поделитесь размышлениями</h2>
          <p className="text-sm text-gray-500">Минимум 20 символов</p>

          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={5}
            placeholder="Что вас затронуло в этом уроке?"
            value={forumText}
            onChange={(e) => setForumText(e.target.value)}
            maxLength={5000}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{forumText.trim().length} / мин. 20</span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              {saving ? 'Сохранение...' : 'Отправить лидеру'}
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* Notes — shown after submission, next block locked until admin_approved */}
      {submitted && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-3">
              Конспект — {block.title_ru}
            </h2>
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: block.content_ru }}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-sm font-medium text-amber-900">Ожидание одобрения лидера</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Следующий блок откроется после того, как лидер проверит ваш ответ
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
