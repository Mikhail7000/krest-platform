'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// TODO: replace with import from @/types when database-architect adds these tables
export interface LocationItem {
  id: string
  reference: string
  exact_text: string
  check_mode: string
  topic_label: string | null
  order_index: number
  audio_passed: boolean
  video_passed: boolean
  audio_attempts: number
  video_attempts: number
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

const MAX_RECORD_SECS = 60

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) { setSecs(0); return }
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return secs
}

interface StageProps {
  locationId: string
  medium: 'audio' | 'video_note'
  onResult: (res: UploadResult) => void
  accept: string
  label: string
  captureAttr?: string
}

function RecordStage({ locationId, medium, onResult, accept, label, captureAttr }: StageProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const timerSecs = useTimer(state === 'recording')
  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices

  function stopRecording() {
    mediaRef.current?.stop()
  }

  async function startRecording() {
    setError(null)
    setBlob(null)
    try {
      const constraints = medium === 'video_note'
        ? { audio: true, video: { width: 480, height: 480, facingMode: 'user' } }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const mimeType = medium === 'video_note' ? 'video/webm' : 'audio/webm'
        setBlob(new Blob(chunksRef.current, { type: mimeType }))
        setState('idle')
      }
      recorder.start()
      mediaRef.current = recorder
      setState('recording')
      setTimeout(() => { if (mediaRef.current?.state === 'recording') mediaRef.current.stop() }, MAX_RECORD_SECS * 1000)
    } catch {
      setError('Нет доступа к микрофону/камере. Используйте загрузку файла.')
    }
  }

  async function submitBlob(fileBlob: Blob, filename: string) {
    setState('submitting')
    setError(null)
    const initData = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
    const fd = new FormData()
    fd.append('initData', initData)
    fd.append('location_id', locationId)
    fd.append('medium', medium)
    fd.append('file', fileBlob, filename)
    try {
      const res = await fetch('/api/m/locations/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as UploadResult
      onResult(data)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
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
  const ext = medium === 'video_note' ? 'webm' : 'webm'

  return (
    <div>
      {isRecording && (
        <div className="location-recording-timer">
          <span className="location-recording-dot" />
          {timerSecs}с / {MAX_RECORD_SECS}с
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

  const handleAudioResult = useCallback((res: UploadResult) => {
    setAudioAttempts(res.attempts.audio)
    setVideoAttempts(res.attempts.video)
    if (res.passed) setAudioPassed(true)
    if (res.ai_comment) setLastAudioFeedback(res.ai_comment)
  }, [])

  const handleVideoResult = useCallback((res: UploadResult) => {
    setAudioAttempts(res.attempts.audio)
    setVideoAttempts(res.attempts.video)
    if (res.passed) setVideoPassed(true)
    if (res.ai_comment) setLastVideoFeedback(res.ai_comment)
  }, [])

  const cardClass = videoPassed
    ? 'location-card location-card--complete'
    : audioPassed
    ? 'location-card location-card--audio-done'
    : 'location-card'

  return (
    <div className={cardClass}>
      <div className="location-card__header">
        <div>
          <p className="location-card__ref">{item.reference}</p>
          {item.topic_label && <p className="location-card__topic">{item.topic_label}</p>}
        </div>
        {videoPassed ? (
          <span className="location-card__status-icon">✅</span>
        ) : audioPassed ? (
          <span className="location-card__status-icon" style={{ color: 'var(--tg-button, #C9A961)' }}>🎤</span>
        ) : null}
      </div>

      <blockquote className="location-card__text">{item.exact_text}</blockquote>

      {/* Stage A — Audio */}
      {!audioPassed && (
        <div>
          <p className="location-stage-label location-stage-label--active">Этап А — Аудио</p>
          <p className="location-card__hint">{audioHint}</p>
          <RecordStage
            locationId={item.id}
            medium="audio"
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
    </div>
  )
}
