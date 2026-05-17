'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// TODO: replace with import from @/types when database-architect adds these tables
export type PracticeMode = 'daily_understanding' | 'single_understanding' | null

export interface LocationItem {
  id: string
  reference: string
  exact_text: string
  check_mode: string
  topic_label: string | null
  order_index: number
  max_record_seconds: number
  practice_mode: PracticeMode
  audio_passed: boolean
  video_passed: boolean
  audio_attempts: number
  video_attempts: number
  daily_days_passed: number
  daily_days_required: number | null
  today_done: boolean
}

interface UploadResult {
  ok: boolean
  passed: boolean
  transcript: string
  similarity_score: number
  ai_comment: string
  attempts: { audio: number; video: number }
}

type RecordingState = 'idle' | 'recording' | 'submitting' | 'done'

const AUDIO_HINTS = [
  'Открой Библию рядом — пусть текст отложится в памяти, пока произносишь.',
  'Можно подсматривать. Главное — проговорить вслух, чтобы стих закрепился.',
  'Глаза в текст, голос в микрофон. Так писание и запоминается.',
  'Не экзамен — тренировка. Читай с открытой Библии и слушай, как оно звучит твоим голосом.',
]

const VIDEO_HINTS = [
  'А вот теперь — наизусть. Это нужно не мне, а тебе.',
  'Закрой Библию. Проверим, что уже легло в память.',
  'Без листа. Пусть стих звучит изнутри, а не с экрана.',
  'Твоё писание — твоим голосом, своими глазами. Без помощи.',
]

const DEFAULT_MAX_RECORD_SECS = 60

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) { setSecs(0); return }
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return secs
}

function pickMimeType(video: boolean): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = video
    ? ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    : ['audio/mp4', 'audio/webm']
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch { /* noop */ }
  }
  return ''
}

interface StageProps {
  locationId: string
  medium: 'audio' | 'video_note'
  maxRecordSecs: number
  onResult: (res: UploadResult) => void
  accept: string
  label: string
  captureAttr?: string
}

function RecordStage({ locationId, medium, maxRecordSecs, onResult, accept, label, captureAttr }: StageProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null)
  const [recordedMime, setRecordedMime] = useState<string>('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const livePreviewRef = useRef<HTMLVideoElement | null>(null)
  const timerSecs = useTimer(state === 'recording')
  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices
  const isVideo = medium === 'video_note'

  // Stream привязывается к <video> только ПОСЛЕ рендера элемента —
  // иначе livePreviewRef.current=null и preview остаётся чёрным.
  useEffect(() => {
    const el = livePreviewRef.current
    if (!el || !activeStream) return
    el.srcObject = activeStream
    el.play().catch(() => undefined)
    return () => {
      try { el.srcObject = null } catch { /* noop */ }
    }
  }, [activeStream])

  useEffect(() => () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }, [blobUrl])

  function stopRecording() {
    mediaRef.current?.stop()
  }

  async function startRecording() {
    setError(null)
    setBlob(null)
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
    }
    try {
      const constraints: MediaStreamConstraints = isVideo
        ? { audio: true, video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' } }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const mimeType = pickMimeType(isVideo)
      setRecordedMime(mimeType)
      // Лимит body на Vercel serverless — 4.5 MB. Считаем: 60 сек * (500+64) kbps / 8 ≈ 4.2 MB → c запасом.
      const recorderOptions: MediaRecorderOptions = isVideo
        ? { videoBitsPerSecond: 500_000, audioBitsPerSecond: 64_000, ...(mimeType ? { mimeType } : {}) }
        : { audioBitsPerSecond: 64_000, ...(mimeType ? { mimeType } : {}) }
      const recorder = new MediaRecorder(stream, recorderOptions)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setActiveStream(null)
        const finalMime = mimeType || (isVideo ? 'video/webm' : 'audio/webm')
        const newBlob = new Blob(chunksRef.current, { type: finalMime })
        setBlob(newBlob)
        setBlobUrl(URL.createObjectURL(newBlob))
        setState('idle')
      }
      recorder.start()
      mediaRef.current = recorder
      if (isVideo) setActiveStream(stream)
      setState('recording')
      setTimeout(() => { if (mediaRef.current?.state === 'recording') mediaRef.current.stop() }, maxRecordSecs * 1000)
    } catch {
      setError('Нет доступа к микрофону/камере. Используйте загрузку файла.')
    }
  }

  async function submitBlob(fileBlob: Blob, filename: string) {
    setError(null)
    const sizeKb = Math.round(fileBlob.size / 1024)
    // Vercel serverless body limit ~4.5 MB. Берём 4.2 MB с запасом на multipart-обёртку.
    if (fileBlob.size > 4_200_000) {
      setError(`Файл слишком большой (${sizeKb} KB). Перезапиши короче или загрузи файлом отдельно.`)
      return
    }
    setState('submitting')
    const initData = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
    const fd = new FormData()
    fd.append('initData', initData)
    fd.append('location_id', locationId)
    fd.append('medium', medium)
    fd.append('file', fileBlob, filename)
    try {
      const res = await fetch('/api/m/locations/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        let serverMsg = ''
        let serverCode = ''
        try {
          const body = await res.json() as { error?: { code?: string; message?: string } }
          serverCode = body?.error?.code ?? ''
          serverMsg = body?.error?.message ?? ''
        } catch { /* not json */ }
        const detail = serverMsg || serverCode || `HTTP ${res.status}`
        throw new Error(`${detail} (status ${res.status}, ${sizeKb}KB ${fileBlob.type || 'no-mime'})`)
      }
      const data = await res.json() as UploadResult
      onResult(data)
      setState('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки'
      console.error('[locations] submit failed:', msg, { type: fileBlob.type, size: fileBlob.size })
      setError(msg)
      setState('idle')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    submitBlob(file, file.name)
  }

  const isRecording = state === 'recording'
  const isSubmitting = state === 'submitting'
  const ext = recordedMime.startsWith('video/mp4')
    ? 'mp4'
    : recordedMime.startsWith('audio/mp4')
    ? 'm4a'
    : 'webm'

  // ── Видео-кружок: запись и просмотр идут в fullscreen overlay,
  //    чтобы текст местописания был скрыт (антипод-сматривание).
  if (isVideo) {
    const showOverlay = isRecording || isSubmitting || (!!blob && state !== 'done')
    return (
      <>
        {showOverlay && (
          <div className="location-video-fullscreen" role="dialog" aria-modal="true">
            {isRecording ? (
              <video
                ref={livePreviewRef}
                className="location-video-fullscreen__el"
                autoPlay
                muted
                playsInline
              />
            ) : blobUrl ? (
              <video
                key={blobUrl}
                className="location-video-fullscreen__el"
                src={blobUrl}
                playsInline
                controls
              />
            ) : null}

            {isRecording && (
              <div className="location-video-fullscreen__timer">
                <span className="location-recording-dot" />
                {timerSecs}с / {maxRecordSecs}с
              </div>
            )}

            {error && !isRecording && (
              <div className="location-video-fullscreen__error">{error}</div>
            )}

            <div className="location-video-fullscreen__controls">
              {isRecording ? (
                <button
                  type="button"
                  className="location-btn location-btn--danger location-video-fullscreen__btn"
                  onClick={stopRecording}
                >
                  Остановить
                </button>
              ) : isSubmitting ? (
                <div className="location-video-fullscreen__status">Отправляем…</div>
              ) : blob ? (
                <>
                  <button
                    type="button"
                    className="location-btn location-btn--ghost location-video-fullscreen__btn"
                    onClick={startRecording}
                  >
                    Перезаписать
                  </button>
                  <button
                    type="button"
                    className="location-btn location-video-fullscreen__btn"
                    onClick={() => submitBlob(blob, `recording.${ext}`)}
                  >
                    Отправить запись
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {!showOverlay && (
          <div className="location-btn-row">
            {hasMediaDevices && (
              <button type="button" className="location-btn" onClick={startRecording} disabled={isSubmitting}>
                {label}
              </button>
            )}
            <button
              type="button"
              className="location-btn location-btn--ghost"
              onClick={() => fileRef.current?.click()}
              disabled={isSubmitting}
            >
              Загрузить файл
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="location-file-input"
              onChange={handleFileChange}
              {...(captureAttr ? { capture: captureAttr as 'environment' | 'user' } : {})}
            />
          </div>
        )}

        {isSubmitting && <p className="location-loading-hint">Отправляем…</p>}
        {error && <p style={{ color: 'var(--tg-destructive, #EF4444)', fontSize: '0.8125rem', marginTop: '0.375rem' }}>{error}</p>}
      </>
    )
  }

  // ── Аудио-этап: inline, без overlay (подсматривать разрешено по hint)
  return (
    <div>
      {isRecording && (
        <div className="location-recording-timer">
          <span className="location-recording-dot" />
          {timerSecs}с / {maxRecordSecs}с
        </div>
      )}
      <div className="location-btn-row">
        {hasMediaDevices ? (
          isRecording ? (
            <button type="button" className="location-btn location-btn--danger" onClick={stopRecording}>
              Остановить
            </button>
          ) : (
            <button type="button" className="location-btn" onClick={startRecording} disabled={isSubmitting}>
              {label}
            </button>
          )
        ) : null}
        {!isRecording && (
          <>
            <button
              type="button"
              className="location-btn location-btn--ghost"
              onClick={() => fileRef.current?.click()}
              disabled={isSubmitting}
            >
              Загрузить файл
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="location-file-input"
              onChange={handleFileChange}
              {...(captureAttr ? { capture: captureAttr as 'environment' | 'user' } : {})}
            />
          </>
        )}
        {blob && !isRecording && state !== 'submitting' && (
          <button
            type="button"
            className="location-btn"
            onClick={() => submitBlob(blob, `recording.${ext}`)}
          >
            Отправить запись
          </button>
        )}
      </div>
      {isSubmitting && <p className="location-loading-hint">Отправляем…</p>}
      {error && <p style={{ color: 'var(--tg-destructive, #EF4444)', fontSize: '0.8125rem', marginTop: '0.375rem' }}>{error}</p>}
    </div>
  )
}

interface Props {
  item: LocationItem
}

export function LocationCard({ item }: Props) {
  const audioHint = AUDIO_HINTS[item.order_index % 4]
  const videoHint = VIDEO_HINTS[item.order_index % 4]
  const [audioPassed, setAudioPassed] = useState(item.audio_passed)
  const [videoPassed, setVideoPassed] = useState(item.video_passed)
  const [audioAttempts, setAudioAttempts] = useState(item.audio_attempts)
  const [videoAttempts, setVideoAttempts] = useState(item.video_attempts)
  const [lastAudioFeedback, setLastAudioFeedback] = useState<string | null>(null)
  const [lastVideoFeedback, setLastVideoFeedback] = useState<string | null>(null)
  // Локальный счётчик дней для recurring-режима, чтобы UI обновлялся сразу
  const [dailyDaysPassed, setDailyDaysPassed] = useState(item.daily_days_passed)
  const [todayDone, setTodayDone] = useState(item.today_done)

  const practiceMode = item.practice_mode
  const isDaily = practiceMode === 'daily_understanding'
  const isSingle = practiceMode === 'single_understanding'
  const daysRequired = item.daily_days_required ?? 7

  const handleAudioResult = useCallback((res: UploadResult) => {
    setAudioAttempts(res.attempts.audio)
    setVideoAttempts(res.attempts.video)
    if (res.passed) {
      setAudioPassed(true)
      if (isDaily && !todayDone) {
        setDailyDaysPassed((d) => Math.min(d + 1, daysRequired))
        setTodayDone(true)
      }
    }
    if (res.ai_comment) setLastAudioFeedback(res.ai_comment)
  }, [isDaily, todayDone, daysRequired])

  const handleVideoResult = useCallback((res: UploadResult) => {
    setAudioAttempts(res.attempts.audio)
    setVideoAttempts(res.attempts.video)
    if (res.passed) setVideoPassed(true)
    if (res.ai_comment) setLastVideoFeedback(res.ai_comment)
  }, [])

  // Класс карточки: для recurring/single — отдельная логика «complete»
  const dailyComplete = isDaily && dailyDaysPassed >= daysRequired
  const singleComplete = isSingle && audioPassed
  const cardClass =
    dailyComplete || singleComplete || (videoPassed && !isDaily && !isSingle)
      ? 'location-card location-card--complete'
      : audioPassed
      ? 'location-card location-card--audio-done'
      : 'location-card'

  const headerIcon =
    dailyComplete || singleComplete || (videoPassed && !isDaily && !isSingle)
      ? <span className="location-card__status-icon">✅</span>
      : audioPassed
      ? <span className="location-card__status-icon" style={{ color: 'var(--tg-button, #C9A961)' }}>🎤</span>
      : null

  return (
    <div className={cardClass}>
      <div className="location-card__header">
        <div>
          <p className="location-card__ref">{item.reference}</p>
          {item.topic_label && <p className="location-card__topic">{item.topic_label}</p>}
        </div>
        {headerIcon}
      </div>

      <blockquote className="location-card__text">{item.exact_text}</blockquote>

      {/* Daily understanding — ежедневный пересказ 7 дней */}
      {isDaily && (
        <div>
          <p className="location-stage-label location-stage-label--active">Притча — пересказ своими словами</p>
          <p className="location-card__hint">
            Расскажи аудио, что ты понял из этой притчи. Запись каждый день, 7 дней подряд.
          </p>

          <div className="location-daily-progress">
            <div className="location-daily-progress__row">
              {Array.from({ length: daysRequired }).map((_, i) => (
                <span
                  key={i}
                  className={
                    i < dailyDaysPassed
                      ? 'location-daily-progress__dot location-daily-progress__dot--done'
                      : 'location-daily-progress__dot'
                  }
                />
              ))}
            </div>
            <p className="location-daily-progress__label">
              Сдано дней: {dailyDaysPassed} из {daysRequired}
            </p>
          </div>

          {dailyComplete ? (
            <div className="location-pass-row" style={{ marginTop: '0.5rem' }}>
              <span className="location-pass-row__icon">✓</span>
              <span className="location-pass-row__text">Пересказ закрыт — все 7 дней сданы</span>
            </div>
          ) : todayDone ? (
            <div className="location-pass-row" style={{ marginTop: '0.5rem' }}>
              <span className="location-pass-row__icon">✓</span>
              <span className="location-pass-row__text">Сегодня сдано. Возвращайся завтра.</span>
            </div>
          ) : (
            <RecordStage
              locationId={item.id}
              medium="audio"
              maxRecordSecs={item.max_record_seconds || DEFAULT_MAX_RECORD_SECS}
              onResult={handleAudioResult}
              accept="audio/*"
              label="Записать пересказ"
            />
          )}

          {audioAttempts > 0 && !dailyComplete && (
            <p className="location-attempts">Всего попыток: {audioAttempts}</p>
          )}
          {lastAudioFeedback && (
            <div className="location-feedback">
              <span className="location-feedback__label">Комментарий AI</span>
              <p>{lastAudioFeedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Single understanding — один раз освежить притчу */}
      {isSingle && (
        <div>
          <p className="location-stage-label location-stage-label--active">Освежи притчу — расскажи своими словами</p>
          <p className="location-card__hint">
            Один раз перескажи аудио, что ты понял из этой притчи.
          </p>
          {audioPassed ? (
            <div className="location-pass-row" style={{ marginTop: '0.5rem' }}>
              <span className="location-pass-row__icon">✓</span>
              <span className="location-pass-row__text">Пересказ сдан</span>
            </div>
          ) : (
            <RecordStage
              locationId={item.id}
              medium="audio"
              maxRecordSecs={item.max_record_seconds || DEFAULT_MAX_RECORD_SECS}
              onResult={handleAudioResult}
              accept="audio/*"
              label="Записать пересказ"
            />
          )}
          {audioAttempts > 0 && !audioPassed && (
            <p className="location-attempts">Попыток: {audioAttempts}</p>
          )}
          {lastAudioFeedback && (
            <div className="location-feedback">
              <span className="location-feedback__label">Комментарий AI</span>
              <p>{lastAudioFeedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Default — двухэтапная сдача наизусть (короткие стихи) */}
      {!isDaily && !isSingle && (
        <>
          {!audioPassed && (
            <div>
              <p className="location-stage-label location-stage-label--active">Этап А — Аудио</p>
              <p className="location-card__hint">{audioHint}</p>
              <RecordStage
                locationId={item.id}
                medium="audio"
                maxRecordSecs={item.max_record_seconds || DEFAULT_MAX_RECORD_SECS}
                onResult={handleAudioResult}
                accept="audio/*"
                label="Записать голосовое"
              />
              {audioAttempts > 0 && (
                <p className="location-attempts">Попытки аудио: {audioAttempts}</p>
              )}
              {lastAudioFeedback && (
                <div className="location-feedback">
                  <span className="location-feedback__label">Комментарий AI</span>
                  <p>{lastAudioFeedback}</p>
                </div>
              )}
            </div>
          )}

          {audioPassed && !videoPassed && (
            <div>
              <div className="location-pass-row">
                <span className="location-pass-row__icon">✓</span>
                <span className="location-pass-row__text">Аудио сдано</span>
              </div>
              <p className="location-stage-label location-stage-label--active" style={{ marginTop: '0.875rem' }}>
                Этап Б — Видеокружок
              </p>
              <p className="location-card__hint">{videoHint}</p>
              <RecordStage
                locationId={item.id}
                medium="video_note"
                maxRecordSecs={item.max_record_seconds || DEFAULT_MAX_RECORD_SECS}
                onResult={handleVideoResult}
                accept="video/*"
                label="Записать кружок"
              />
              {videoAttempts > 0 && (
                <p className="location-attempts">Попытки видео: {videoAttempts}</p>
              )}
              {lastVideoFeedback && (
                <div className="location-feedback">
                  <span className="location-feedback__label">Комментарий AI</span>
                  <p>{lastVideoFeedback}</p>
                </div>
              )}
            </div>
          )}

          {audioPassed && videoPassed && (
            <div className="location-pass-row" style={{ marginTop: '0.5rem' }}>
              <span className="location-pass-row__icon">✓</span>
              <span className="location-pass-row__text">Видеокружок сдан — местописание закрыто</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
