'use client'

import { useEffect, useRef, useState } from 'react'
import { useRecorder, extFor } from '@/app/m/trainer/[blockId]/useRecorder'
import type { FeedPost } from './types'

type ComposerMode = 'text' | 'audio' | 'video_note' | 'photo'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      ?.Telegram?.WebApp?.initData ?? ''
  )
}

interface Props {
  onPosted: (post: FeedPost) => void
}

export function PostComposer({ onPosted }: Props) {
  const [mode, setMode] = useState<ComposerMode>('text')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const liveRef = useRef<HTMLVideoElement | null>(null)

  const isVideo = mode === 'video_note'
  const isAudio = mode === 'audio'
  const rec = useRecorder(isVideo || isAudio ? isVideo : false, 60)

  // Live-превью кружка
  useEffect(() => {
    const el = liveRef.current
    if (!el || !rec.stream) return
    el.srcObject = rec.stream
    el.play().catch(() => undefined)
    return () => {
      try {
        el.srcObject = null
      } catch {
        /* noop */
      }
    }
  }, [rec.stream])

  // Сброс рекордера при смене режима
  useEffect(() => {
    rec.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const switchMode = (m: ComposerMode) => {
    setMode(m)
    setError(null)
  }

  const postText = async () => {
    if (text.trim().length < 1) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/m/community/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), kind: 'text', content_text: text.trim() }),
      })
      if (!res.ok) throw new Error('server')
      const data = (await res.json()) as { ok: boolean; post?: FeedPost; id?: string }
      if (data.ok && data.post) {
        onPosted(data.post)
        setText('')
      }
    } catch {
      setError('Не удалось отправить. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const postMedia = async (kind: 'audio' | 'video_note', blob: Blob, mime: string) => {
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('kind', kind)
      const file = new File([blob], `post.${extFor(mime)}`, { type: blob.type })
      fd.append('media', file, file.name)
      if (text.trim()) fd.append('content_text', text.trim())
      const res = await fetch('/api/m/community/post', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('server')
      const data = (await res.json()) as { ok: boolean; post?: FeedPost }
      if (data.ok && data.post) {
        onPosted(data.post)
        setText('')
        rec.reset()
        switchMode('text')
      }
    } catch {
      setError('Не удалось отправить. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const postPhoto = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('kind', 'photo')
      fd.append('media', file, file.name)
      if (text.trim()) fd.append('content_text', text.trim())
      const res = await fetch('/api/m/community/post', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('server')
      const data = (await res.json()) as { ok: boolean; post?: FeedPost }
      if (data.ok && data.post) {
        onPosted(data.post)
        setText('')
        switchMode('text')
      }
    } catch {
      setError('Не удалось отправить. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    postPhoto(file)
    // сброс input чтобы можно было выбрать снова
    e.target.value = ''
  }

  const isRecMode = mode === 'audio' || mode === 'video_note'

  return (
    <div className="cm-composer">
      {/* Переключатели режимов */}
      <div className="cm-modes">
        <button
          type="button"
          className={`cm-mode-btn${mode === 'text' ? ' cm-mode-btn--active' : ''}`}
          onClick={() => switchMode('text')}
        >
          Текст
        </button>
        <button
          type="button"
          className={`cm-mode-btn${mode === 'audio' ? ' cm-mode-btn--active' : ''}`}
          onClick={() => switchMode('audio')}
        >
          Голос
        </button>
        <button
          type="button"
          className={`cm-mode-btn${mode === 'video_note' ? ' cm-mode-btn--active' : ''}`}
          onClick={() => switchMode('video_note')}
        >
          Кружок
        </button>
        <button
          type="button"
          className={`cm-mode-btn${mode === 'photo' ? ' cm-mode-btn--active' : ''}`}
          onClick={() => { switchMode('photo'); photoRef.current?.click() }}
        >
          Фото
        </button>
      </div>

      {/* Текстовое поле */}
      {mode === 'text' && (
        <>
          <textarea
            className="cm-textarea"
            placeholder="Напиши, что пережил, что Бог открыл…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            disabled={busy}
          />
          <button
            type="button"
            className="cm-submit"
            onClick={postText}
            disabled={busy || text.trim().length < 1}
          >
            {busy ? 'Отправляем…' : 'Поделиться'}
          </button>
        </>
      )}

      {/* Режим записи (аудио или видео-кружок) */}
      {isRecMode && (
        <div className="cm-rec">
          {mode === 'video_note' && (rec.state === 'recording' || rec.blobUrl) && (
            <div className="em-circle">
              {rec.state === 'recording' ? (
                <video
                  ref={liveRef}
                  className="em-circle__video em-circle__video--live"
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <video
                  key={rec.blobUrl ?? ''}
                  className="em-circle__video"
                  src={rec.blobUrl ?? undefined}
                  playsInline
                  controls
                />
              )}
            </div>
          )}

          {rec.state === 'recording' && (
            <p className="em-rec-timer">
              <span className="em-rec-dot" />
              {rec.secs}с / 60с
            </p>
          )}

          {mode === 'audio' && rec.blobUrl && rec.state === 'recorded' && (
            <audio className="cm-audio-preview" src={rec.blobUrl} controls />
          )}

          <div className="cm-rec-actions">
            {rec.state === 'idle' && (
              <button type="button" className="cm-submit" onClick={rec.start} disabled={busy}>
                {mode === 'video_note' ? 'Записать кружок' : 'Записать голосовое'}
              </button>
            )}
            {rec.state === 'recording' && (
              <button type="button" className="cm-submit cm-submit--danger" onClick={rec.stop}>
                Остановить
              </button>
            )}
            {rec.state === 'recorded' && rec.blob && (
              <>
                <button
                  type="button"
                  className="cm-submit"
                  onClick={() => postMedia(mode as 'audio' | 'video_note', rec.blob!, rec.mime)}
                  disabled={busy}
                >
                  {busy ? 'Отправляем…' : 'Поделиться'}
                </button>
                <button type="button" className="cm-ghost-btn" onClick={rec.reset} disabled={busy}>
                  Перезаписать
                </button>
              </>
            )}
          </div>

          {(rec.error ?? error) && (
            <p className="cm-error">{rec.error ?? error}</p>
          )}
        </div>
      )}

      {/* Фото — скрытый input */}
      {mode === 'photo' && (
        <>
          <p className="cm-hint">Открываем галерею…</p>
          <button
            type="button"
            className="cm-ghost-btn"
            onClick={() => photoRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Загружаем…' : 'Выбрать фото'}
          </button>
        </>
      )}

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="cm-hidden-input"
        onChange={handlePhotoChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      {error && mode !== 'audio' && mode !== 'video_note' && (
        <p className="cm-error">{error}</p>
      )}
    </div>
  )
}
