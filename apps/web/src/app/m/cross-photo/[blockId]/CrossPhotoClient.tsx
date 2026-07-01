'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { formatRuDate } from '@/lib/time/format'
import { invalidateBlockStatus } from '@/lib/m/block-status-cache'
import { compressImage } from '@/lib/m/compress-image'
import { IconCheck, IconClock, IconLock, IconCamera } from '@/app/m/_components/icons'

type DayState = 'done' | 'today' | 'waiting' | 'future'

interface DayRow {
  index: number
  state: DayState
  date: string | null
  photo_url: string | null
  closed?: boolean
}

interface CrossPhotoApiResponse {
  ok: boolean
  closed_days: number
  target: number
  block_complete: boolean
  today: string
  today_done: boolean
  can_submit_today: boolean
  next_day_locked: boolean
  photo_days: number
  days: DayRow[]
  test_mode?: boolean
}

interface UploadResult {
  ok: boolean
  date?: string
  ai_feedback?: string | null
  ai_matched?: boolean | null
  error?: { code: string; message: string }
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface Props { blockId: number }

export function CrossPhotoClient({ blockId }: Props) {
  const [view, setView] = useState<'loading' | 'error' | 'idle'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [data, setData] = useState<CrossPhotoApiResponse | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmDate, setConfirmDate] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      setData(await res.json() as CrossPhotoApiResponse)
      setView('idle')
    } catch {
      setErrorMsg('Не удалось загрузить данные.')
      setView('error')
    }
  }, [blockId])

  useEffect(() => { load() }, [load])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    if (!raw) return
    setUploading(true)
    setUploadError(null)
    // Сжатие на клиенте: телефонные фото 3–10 МБ упирались в лимит тела Vercel
    // (~4.5 МБ) и падали с невнятной ошибкой; HEIC на iPhone перекодируется в JPEG.
    const file = await compressImage(raw)
    if (file.size > 4_300_000) {
      setUploadError('Фото слишком большое даже после сжатия — попробуй другое.')
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const fd = new FormData()
    fd.append('initData', getInitData())
    fd.append('block_id', String(blockId))
    fd.append('file', file, file.name)
    try {
      const res = await fetch('/api/m/cross-photo/upload', { method: 'POST', body: fd })
      const result = await res.json().catch(() => ({})) as UploadResult
      if (!res.ok) {
        setUploadError(result?.error?.message ?? `Ошибка ${res.status}`)
        return
      }
      if (result.ai_feedback) setFeedback(result.ai_feedback)
      // День мог закрыться — сбросить кэш статуса блока (урок/дашборд).
      invalidateBlockStatus(blockId)
      // Перечитываем состояние: сервер — источник истины (дни/гейт/счётчик).
      await load()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(date: string) {
    setDeleting(true)
    setUploadError(null)
    try {
      const res = await fetch('/api/m/cross-photo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), blockId, date }),
      })
      if (!res.ok) {
        const r = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        setUploadError(r?.error?.message ?? `Ошибка ${res.status}`)
        return
      }
      setConfirmDate(null)
      setFeedback(null)
      invalidateBlockStatus(blockId)
      await load()
    } catch {
      setUploadError('Не удалось удалить. Попробуй ещё раз.')
    } finally {
      setDeleting(false)
    }
  }

  if (view === 'loading') {
    return (
      <>
        <p className="cp-loading-hint">Загружаем дни…</p>
        {[1, 2, 3].map((n) => <div key={n} className="cp-skeleton" />)}
      </>
    )
  }

  if (view === 'error' || !data) {
    return (
      <div className="cp-error">
        <p className="cp-error__title">Ошибка загрузки</p>
        <p className="cp-error__desc">{errorMsg}</p>
        <button type="button" className="cp-btn" onClick={load}>Повторить</button>
      </div>
    )
  }

  const progressPct = Math.min(100, Math.round((data.closed_days / data.target) * 100))
  // Последний день с фото (реальная дата) — на нём показываем кнопку удаления.
  const doneDates = data.days.filter((d) => d.state === 'done' && d.date).map((d) => d.date as string)
  const lastDoneDate = doneDates.length ? doneDates[doneDates.length - 1] : null

  return (
    <div>
      <div className="cp-header__progress">Закрыто дней: {data.closed_days} / {data.target}</div>
      <div className="cp-progress-bar">
        <div className="cp-progress-bar__fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="cp-uploading-hint" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
        Фото — 1 из 4 заданий дня. День закрывается, когда за дату сделаны все 4 (фото, молитва, местописания, пересказ).
      </p>

      {data.test_mode && (
        <div className="cp-test-banner">
          🧪 Тестовый режим: система засчитала вам всю неделю автоматически.
        </div>
      )}

      {data.block_complete && (
        <div className="cp-day-card cp-day-card--done">
          <div className="cp-day-card__header">
            <span className="cp-day-card__num">Готово</span>
            <span className="cp-day-card__status">
              <IconCheck className="cp-status-icon cp-status-icon--done" />
            </span>
          </div>
          <p className="cp-uploading-hint">Все 7 дней закрыты — фото креста сдано.</p>
        </div>
      )}

      {data.days.map((day) => {
        // «День не закрыт» показываем ТОЛЬКО для ПРОШЛЫХ дней (сутки закончились, не всё
        // сдано). Для сегодняшнего дня фото просто принято (день ещё идёт) → зелёная ✓.
        const pastUnclosed =
          day.state === 'done' && !day.closed && day.date != null && day.date < data.today
        const cardClass =
          day.state === 'done'
            ? pastUnclosed
              ? 'cp-day-card cp-day-card--photo-only'
              : 'cp-day-card cp-day-card--done'
            : day.state === 'today'
            ? 'cp-day-card cp-day-card--today'
            : 'cp-day-card cp-day-card--future'

        return (
          <div className={cardClass} key={day.index}>
            <div className="cp-day-card__header">
              <span className="cp-day-card__num">День {day.index}</span>
              <span className="cp-day-card__date">{day.date ? formatRuDate(day.date) : ''}</span>
              <span className="cp-day-card__status">
                {day.state === 'done' ? (
                  pastUnclosed ? (
                    <IconCamera className="cp-status-icon cp-status-icon--photo" />
                  ) : (
                    <IconCheck className="cp-status-icon cp-status-icon--done" />
                  )
                ) : day.state === 'today' ? (
                  <IconClock className="cp-status-icon cp-status-icon--today" />
                ) : day.state === 'waiting' ? (
                  <IconLock className="cp-status-icon cp-status-icon--lock" />
                ) : null}
              </span>
            </div>

            {day.state === 'done' && day.photo_url && (
              <img
                src={day.photo_url}
                alt={`Крест день ${day.index}`}
                className="cp-photo-thumb"
                loading="lazy"
              />
            )}

            {pastUnclosed && (
              <p className="cp-photo-only-note">
                Фото есть · день не закрыт — осталось: молитва, местописания, пересказ
              </p>
            )}

            {day.state === 'done' && day.date && day.date === lastDoneDate && (
              <div className="cp-del-row">
                {confirmDate === day.date ? (
                  <>
                    <span className="cp-del-confirm">Удалить фото за этот день?</span>
                    <button
                      type="button"
                      className="cp-del-btn cp-del-btn--danger"
                      onClick={() => handleDelete(day.date as string)}
                      disabled={deleting}
                    >
                      {deleting ? 'Удаляем…' : 'Да, удалить'}
                    </button>
                    <button
                      type="button"
                      className="cp-del-btn"
                      onClick={() => setConfirmDate(null)}
                      disabled={deleting}
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cp-del-btn cp-del-link"
                    onClick={() => setConfirmDate(day.date as string)}
                  >
                    Удалить фото
                  </button>
                )}
              </div>
            )}

            {day.state === 'today' && feedback && (
              <div className="cp-ai-feedback">
                <span className="cp-ai-feedback__label">Комментарий AI</span>
                <p>{feedback}</p>
              </div>
            )}

            {day.state === 'today' && (
              <div>
                <label
                  className={`cp-upload-label${uploading ? ' cp-upload-label--disabled' : ''}`}
                  onClick={() => !uploading && fileRef.current?.click()}
                >
                  {uploading ? 'Загружаем…' : 'Загрузить фото (камера или галерея)'}
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="cp-file-input"
                  onChange={handleFile}
                  disabled={uploading}
                />
                {uploading && <p className="cp-uploading-hint">Отправляем фото…</p>}
                {uploadError && <p className="cp-upload-error">{uploadError}</p>}
              </div>
            )}

            {day.state === 'waiting' && (
              <p className="cp-uploading-hint">Следующий день откроется в 00:00 по твоему времени.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
