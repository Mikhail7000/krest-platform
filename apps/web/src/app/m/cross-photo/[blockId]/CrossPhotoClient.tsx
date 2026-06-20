'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { formatRuDate } from '@/lib/time/format'

interface DayEntry {
  day_index: number
  date: string
  submitted: boolean
  storage_path: string | null
  photo_url: string | null
}

interface CrossPhotoApiResponse {
  ok: boolean
  block_unlocked_at: string | null
  today_index: number
  days: DayEntry[]
  completed_count: number
  test_mode?: boolean
}

interface UploadResult {
  ok: boolean
  date?: string
  day_index?: number
  submitted?: boolean
  storage_path: string | null
  photo_url: string | null
  completed_count?: number
  ai_feedback?: string | null
  ai_matched?: boolean | null
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface DayCardProps {
  day: DayEntry
  isToday: boolean
  blockId: number
  feedback?: string | null
  onUploaded: (result: UploadResult) => void
}

function DayCard({ day, isToday, blockId, feedback, onUploaded }: DayCardProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const initData = getInitData()
    const fd = new FormData()
    fd.append('initData', initData)
    fd.append('block_id', String(blockId))
    fd.append('file', file, file.name)
    try {
      const res = await fetch('/api/m/cross-photo/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as UploadResult
      onUploaded(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const isFuture = !isToday && !day.submitted
  const cardClass = day.submitted
    ? 'cp-day-card cp-day-card--done'
    : isToday
    ? 'cp-day-card cp-day-card--today'
    : isFuture
    ? 'cp-day-card cp-day-card--future'
    : 'cp-day-card'

  return (
    <div className={cardClass}>
      <div className="cp-day-card__header">
        <span className="cp-day-card__num">День {day.day_index}</span>
        <span className="cp-day-card__date">{formatRuDate(day.date)}</span>
        <span className="cp-day-card__status">
          {day.submitted ? '✅' : isToday ? '⏳' : ''}
        </span>
      </div>

      {day.submitted && day.photo_url && (
        <img
          src={day.photo_url}
          alt={`Крест день ${day.day_index}`}
          className="cp-photo-thumb"
          loading="lazy"
        />
      )}

      {feedback && (
        <div className="cp-ai-feedback">
          <span className="cp-ai-feedback__label">Комментарий AI</span>
          <p>{feedback}</p>
        </div>
      )}

      {isToday && !day.submitted && (
        <div>
          <label
            className={`cp-upload-label${uploading ? ' cp-upload-label--disabled' : ''}`}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {uploading ? 'Загружаем…' : 'Загрузить фото (камера или галерея)'}
          </label>
          {/* Без capture — пользователь сам выбирает камеру или существующее фото из галереи */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="cp-file-input"
            onChange={handleFile}
            disabled={uploading}
          />
          {uploading && <p className="cp-uploading-hint">Отправляем фото…</p>}
          {error && <p className="cp-upload-error">{error}</p>}
        </div>
      )}
    </div>
  )
}

interface Props { blockId: number }

export function CrossPhotoClient({ blockId }: Props) {
  const [view, setView] = useState<'loading' | 'error' | 'idle'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [todayIndex, setTodayIndex] = useState(0)
  const [days, setDays] = useState<DayEntry[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [testMode, setTestMode] = useState(false)
  const [feedbackByDate, setFeedbackByDate] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setView('loading')
    const initData = getInitData()
    try {
      const res = await fetch(`/api/m/cross-photo/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      if (!res.ok) { setErrorMsg(`Ошибка ${res.status}`); setView('error'); return }
      const data = await res.json() as CrossPhotoApiResponse
      setTodayIndex(data.today_index)
      setDays(data.days)
      setCompletedCount(data.completed_count)
      setTestMode(Boolean(data.test_mode))
      setView('idle')
    } catch {
      setErrorMsg('Не удалось загрузить данные.')
      setView('error')
    }
  }, [blockId])

  useEffect(() => { load() }, [load])

  function handleUploaded(result: UploadResult) {
    setDays((prev) =>
      prev.map((d) =>
        d.date === result.date
          ? {
              ...d,
              submitted: result.submitted ?? true,
              storage_path: result.storage_path,
              photo_url: result.photo_url,
            }
          : d,
      ),
    )
    if (result.completed_count !== undefined) setCompletedCount(result.completed_count)
    else if (result.submitted ?? true) setCompletedCount((c) => c + 1)
    if (result.date && result.ai_feedback) {
      setFeedbackByDate((m) => ({ ...m, [result.date as string]: result.ai_feedback as string }))
    }
    // Перечитываем состояние: тестировщику после первого фото засчитается вся неделя
    void load()
  }

  if (view === 'loading') {
    return (
      <>
        <p className="cp-loading-hint">Загружаем дни…</p>
        {[1, 2, 3].map((n) => <div key={n} className="cp-skeleton" />)}
      </>
    )
  }

  if (view === 'error') {
    return (
      <div className="cp-error">
        <p className="cp-error__title">Ошибка загрузки</p>
        <p className="cp-error__desc">{errorMsg}</p>
        <button type="button" className="cp-btn" onClick={load}>Повторить</button>
      </div>
    )
  }

  const progressPct = Math.min(100, Math.round((completedCount / 7) * 100))

  return (
    <div>
      <div className="cp-header__progress">{completedCount} / 7 дней</div>
      <div className="cp-progress-bar">
        <div className="cp-progress-bar__fill" style={{ width: `${progressPct}%` }} />
      </div>

      {testMode && (
        <div className="cp-test-banner">
          🧪 Тестовый режим: система засчитала вам всю неделю автоматически.
        </div>
      )}

      {days.map((day) => (
        <DayCard
          key={day.day_index}
          day={day}
          isToday={day.day_index === todayIndex}
          blockId={blockId}
          feedback={feedbackByDate[day.date]}
          onUploaded={handleUploaded}
        />
      ))}
    </div>
  )
}
