'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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
}

interface UploadResult {
  ok: boolean
  date?: string
  day_index?: number
  submitted?: boolean
  storage_path: string | null
  photo_url: string | null
  completed_count?: number
}

const BIBLE_QUOTES: { text: string; ref: string }[] = [
  { text: 'Верный в малом и во многом верен, а неверный в малом неверен и во многом.', ref: 'Лк 16:10' },
  { text: 'Делая добро, да не унываем, ибо в своё время пожнём, если не ослабеем.', ref: 'Гал 6:9' },
  { text: 'Терпение нужно вам, чтобы, исполнив волю Божию, получить обещанное.', ref: 'Евр 10:36' },
  {
    text: 'Не бойся ничего, что тебе надобно будет претерпеть. Вот, диавол будет ввергать из среды вас в темницу, чтобы искусить вас, и будете иметь скорбь дней десять. Будь верен до смерти, и дам тебе венец жизни.',
    ref: 'Откр 2:10',
  },
  { text: 'Утешайтесь надеждою; в скорби будьте терпеливы, в молитве постоянны.', ref: 'Рим 12:12' },
  {
    text: 'Блажен человек, который переносит искушение, потому что, быв испытан, он получит венец жизни, который обещал Господь любящим Его.',
    ref: 'Иак 1:12',
  },
  { text: 'Подвигом добрым я подвизался, течение совершил, веру сохранил.', ref: '2 Тим 4:7' },
]

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface DayCardProps {
  day: DayEntry
  isToday: boolean
  blockId: number
  onUploaded: (result: UploadResult) => void
}

function DayCard({ day, isToday, blockId, onUploaded }: DayCardProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const quote = BIBLE_QUOTES[day.day_index - 1]

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
        <span className="cp-day-card__date">{day.date}</span>
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

      {quote && (
        <blockquote className="cp-quote">
          {quote.text}
          <cite className="cp-quote__ref">— {quote.ref}</cite>
        </blockquote>
      )}

      {isToday && !day.submitted && (
        <div>
          <label
            className={`cp-upload-label${uploading ? ' cp-upload-label--disabled' : ''}`}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {uploading ? 'Загружаем…' : 'Загрузить фото на сегодня'}
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
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

      {days.map((day) => (
        <DayCard
          key={day.day_index}
          day={day}
          isToday={day.day_index === todayIndex}
          blockId={blockId}
          onUploaded={handleUploaded}
        />
      ))}
    </div>
  )
}
