'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// TODO: replace with import from @/types when database-architect adds these tables
interface VideoEntry {
  id: string
  ai_comment: string | null
  passed: boolean
  created_at: string
}

interface RecitationApiResponse {
  ok: boolean
  audio: { passed: boolean; ai_comment: string | null; ai_score: number | null } | null
  videos: VideoEntry[]
  audio_passed_at: string | null
  videos_passed_at: string | null
}

interface UploadResult {
  ok: boolean
  passed: boolean
  transcript: string
  ai_comment: string
  ai_score: number
}

type RecordingState = 'idle' | 'recording' | 'submitting'

const AUDIO_MAX_SECS = 600 // 10 min
const VIDEO_MAX_SECS = 60

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) { setSecs(0); return }
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return secs
}

function formatTimer(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface RecordBlockProps {
  blockId: number
  medium: 'audio' | 'video_note'
  maxSecs: number
  onResult: (res: UploadResult) => void
  label: string
  accept: string
  captureAttr?: string
}

function RecordBlock({ blockId, medium, maxSecs, onResult, label, accept, captureAttr }: RecordBlockProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const timerSecs = useTimer(state === 'recording')
  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices

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
      setTimeout(() => { if (mediaRef.current?.state === 'recording') mediaRef.current.stop() }, maxSecs * 1000)
    } catch {
      setError('Нет доступа к микрофону/камере. Используйте загрузку файла.')
    }
  }

  function stopRecording() { mediaRef.current?.stop() }

  async function submitBlob(fileBlob: Blob, filename: string) {
    setState('submitting')
    setError(null)
    const initData = getInitData()
    const fd = new FormData()
    fd.append('initData', initData)
    fd.append('block_id', String(blockId))
    fd.append('medium', medium)
    fd.append('file', fileBlob, filename)
    try {
      const res = await fetch('/api/m/recitation/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as UploadResult
      onResult(data)
      setState('idle')
      setBlob(null)
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
        <div className="recitation-recording-timer">
          <span className="recitation-recording-dot" />
          {formatTimer(timerSecs)} / {formatTimer(maxSecs)}
        </div>
      )}
      <div className="recitation-btn-row">
        {hasMediaDevices ? (
          isRecording ? (
            <button type="button" className="recitation-btn recitation-btn--danger" onClick={stopRecording}>
              Остановить
            </button>
          ) : (
            <button type="button" className="recitation-btn" onClick={startRecording} disabled={isSubmitting}>
              {label}
            </button>
          )
        ) : null}
        {!isRecording && (
          <>
            <button
              type="button"
              className="recitation-btn recitation-btn--ghost"
              onClick={() => fileRef.current?.click()}
              disabled={isSubmitting}
            >
              Загрузить файл
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="recitation-file-input"
              onChange={handleFileChange}
              {...(captureAttr ? { capture: captureAttr as 'environment' | 'user' } : {})}
            />
          </>
        )}
        {blob && !isRecording && !isSubmitting && (
          <button type="button" className="recitation-btn" onClick={() => submitBlob(blob, `rec.${ext}`)}>
            Отправить запись
          </button>
        )}
      </div>
      {isSubmitting && <p className="recitation-loading-hint">Отправляем…</p>}
      {error && <p style={{ color: 'var(--tg-destructive,#EF4444)', fontSize: '0.8125rem', marginTop: '0.375rem' }}>{error}</p>}
    </div>
  )
}

interface Props { blockId: number }

export function RecitationClient({ blockId }: Props) {
  const [view, setView] = useState<'loading' | 'error' | 'idle'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [audioPassed, setAudioPassed] = useState(false)
  const [audioComment, setAudioComment] = useState<string | null>(null)
  const [videos, setVideos] = useState<VideoEntry[]>([])

  const load = useCallback(async () => {
    setView('loading')
    const initData = getInitData()
    try {
      const res = await fetch(`/api/m/recitation/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      if (!res.ok) { setErrorMsg(`Ошибка ${res.status}`); setView('error'); return }
      const data = await res.json() as RecitationApiResponse
      setAudioPassed(!!data.audio?.passed)
      setAudioComment(data.audio?.ai_comment ?? null)
      setVideos(data.videos)
      setView('idle')
    } catch {
      setErrorMsg('Не удалось загрузить данные.')
      setView('error')
    }
  }, [blockId])

  useEffect(() => { load() }, [load])

  function handleAudioResult(res: UploadResult) {
    if (res.passed) setAudioPassed(true)
    if (res.ai_comment) setAudioComment(res.ai_comment)
  }

  function handleVideoResult(res: UploadResult) {
    setVideos((prev) => [
      ...prev,
      { id: Date.now().toString(), ai_comment: res.ai_comment || null, passed: res.passed, created_at: new Date().toISOString() },
    ])
  }

  if (view === 'loading') {
    return (
      <>
        <p className="recitation-loading-hint">Загрузка…</p>
        {[1, 2].map((n) => <div key={n} className="recitation-skeleton" />)}
      </>
    )
  }

  if (view === 'error') {
    return (
      <div className="recitation-error">
        <p className="recitation-error__title">Ошибка загрузки</p>
        <p className="recitation-error__desc">{errorMsg}</p>
        <button type="button" className="recitation-btn" onClick={load}>Повторить</button>
      </div>
    )
  }

  return (
    <div>
      <div className="recitation-progress">
        <span className={`recitation-progress__item${audioPassed ? ' recitation-progress__item--pass' : ''}`}>
          {audioPassed ? '✓' : '—'} Аудио
        </span>
        <span className={`recitation-progress__item${videos.length > 0 ? ' recitation-progress__item--pass' : ''}`}>
          Кружки: {videos.length}
        </span>
      </div>

      {/* Audio section */}
      <div className="recitation-card">
        <p className="recitation-card__title">Аудио-пересказ</p>
        <p className="recitation-card__desc">
          Расскажи своими словами, что понял из блока — что узнал нового, что вдохновило, что берёшь в практику. До 10 минут.
        </p>
        {audioPassed ? (
          <div className="recitation-status-row">
            <span className="recitation-status-dot recitation-status-dot--pass" />
            <span style={{ color: '#4ADE80', fontWeight: 700, fontSize: '0.875rem' }}>Аудио принято</span>
          </div>
        ) : (
          <RecordBlock
            blockId={blockId}
            medium="audio"
            maxSecs={AUDIO_MAX_SECS}
            onResult={handleAudioResult}
            label="Записать аудио"
            accept="audio/*"
          />
        )}
        {audioComment && (
          <div className="recitation-feedback">
            <span className="recitation-feedback__label">Комментарий AI</span>
            <p>{audioComment}</p>
          </div>
        )}
      </div>

      {/* Video notes section */}
      <div className="recitation-card">
        <p className="recitation-card__title">Видеокружки</p>
        <p className="recitation-card__desc">
          Можно записать несколько кружков — по одному, до 60 секунд каждый. Говори свободно, своими словами.
        </p>
        {videos.length > 0 && (
          <div className="recitation-video-list">
            {videos.map((v, i) => (
              <div key={v.id} className="recitation-video-item">
                <span className="recitation-video-item__num">#{i + 1}</span>
                <span className="recitation-video-item__comment">
                  {v.ai_comment ?? (v.passed ? 'Принято' : 'Загружено')}
                </span>
                {v.passed && <span style={{ color: '#4ADE80', fontSize: '0.875rem' }}>✓</span>}
              </div>
            ))}
          </div>
        )}
        <RecordBlock
          blockId={blockId}
          medium="video_note"
          maxSecs={VIDEO_MAX_SECS}
          onResult={handleVideoResult}
          label="Записать кружок"
          accept="video/*"
        />
      </div>
    </div>
  )
}
