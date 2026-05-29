'use client'

import { useEffect, useRef, useState } from 'react'
import { extFor, useRecorder } from './useRecorder'
import { FavStar } from './FavStar'
import type { TrainerVerse } from './types'

type Medium = 'audio' | 'video_note'
const MAX_SECS = 60

interface Result {
  transcript: string
  similarity_score: number
  ai_comment: string
  passed: boolean
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
    ?.initData ?? ''
}

export function ReciteExercise({ verses }: { verses: TrainerVerse[] }) {
  const [index, setIndex] = useState(0)
  const [medium, setMedium] = useState<Medium>('audio')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const isVideo = medium === 'video_note'
  const rec = useRecorder(isVideo, MAX_SECS)
  const liveRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setIndex(0)
  }, [verses])

  // Сброс при смене стиха или формата
  useEffect(() => {
    setResult(null)
    setSendError(null)
    rec.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, medium, verses])

  // Привязать live-поток к видео-превью
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

  const verse = verses[Math.min(index, verses.length - 1)]
  if (!verse) return null

  const analyze = async () => {
    if (!rec.blob) return
    if (rec.blob.size > 4_200_000) {
      setSendError('Запись слишком длинная. Запиши короче.')
      return
    }
    setSendError(null)
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('location_id', verse.id)
      fd.append('medium', medium)
      fd.append('file', rec.blob, `recite.${extFor(rec.mime)}`)
      const res = await fetch('/api/m/trainer/analyze', { method: 'POST', body: fd })
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new Error(b?.error?.message ?? `HTTP ${res.status}`)
      }
      setResult((await res.json()) as Result)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Не удалось разобрать запись')
    } finally {
      setAnalyzing(false)
    }
  }

  const goto = (d: number) => setIndex((i) => Math.max(0, Math.min(verses.length - 1, i + d)))
  const score = result ? Math.round(result.similarity_score) : 0

  // Текст скрываем во время записи (и голос, и кружок). Кружок — скрыт всегда
  // до разбора. После «Разобрать» эталон раскрываем, чтобы сверить.
  const showVerse = result != null || (!isVideo && rec.state === 'idle')

  return (
    <>
      <div className="trainer-progress">
        <span>
          {index + 1} / {verses.length}
        </span>
        <span className="trainer-progress__right">
          {verse.reference}
          <FavStar verseId={verse.id} />
        </span>
      </div>

      <div className="trainer-card">
        {/* Во время записи текст скрыт (и голос, и кружок) — без подсмотра.
            Кружок скрыт всегда до разбора. После «Разобрать» эталон раскрываем. */}
        {showVerse ? (
          <blockquote className="tq-text" style={{ marginBottom: '1rem' }}>
            {verse.exact_text}
          </blockquote>
        ) : (
          <p className="tr-hidden-hint">
            Текст скрыт — произнеси <b>{verse.reference}</b> по памяти. После проверки покажем эталон.
          </p>
        )}

        <div className="trainer-modes" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`trainer-mode trainer-mode--strong${!isVideo ? ' trainer-mode--active' : ''}`}
            onClick={() => setMedium('audio')}
            disabled={rec.state === 'recording'}
          >
            Голос
          </button>
          <button
            type="button"
            className={`trainer-mode trainer-mode--strong${isVideo ? ' trainer-mode--active' : ''}`}
            onClick={() => setMedium('video_note')}
            disabled={rec.state === 'recording'}
          >
            Кружок
          </button>
        </div>

        {isVideo && (rec.state === 'recording' || rec.blobUrl) && (
          <div className="tr-circle">
            {rec.state === 'recording' ? (
              <video ref={liveRef} className="tr-circle__video" autoPlay muted playsInline />
            ) : (
              <video key={rec.blobUrl} className="tr-circle__video" src={rec.blobUrl ?? undefined} playsInline controls />
            )}
          </div>
        )}

        {rec.state === 'recording' && (
          <div className="tr-rec-timer">
            <span className="tr-rec-dot" />
            {rec.secs}с / {MAX_SECS}с
          </div>
        )}

        {!isVideo && rec.blobUrl && rec.state === 'recorded' && (
          <audio className="tr-audio" src={rec.blobUrl} controls />
        )}

        <div className="trainer-nav" style={{ marginTop: '0.875rem' }}>
          {rec.state === 'recording' ? (
            <button type="button" className="trainer-btn trainer-btn--primary" onClick={rec.stop}>
              Остановить
            </button>
          ) : rec.state === 'recorded' ? (
            <>
              <button type="button" className="trainer-btn" onClick={rec.reset} disabled={analyzing}>
                Перезаписать
              </button>
              <button
                type="button"
                className="trainer-btn trainer-btn--primary"
                onClick={analyze}
                disabled={analyzing}
              >
                {analyzing ? 'Проверяю…' : 'Проверить'}
              </button>
            </>
          ) : (
            <button type="button" className="trainer-btn trainer-btn--primary" onClick={rec.start}>
              {isVideo ? 'Записать кружок' : 'Записать голос'}
            </button>
          )}
        </div>

        {(rec.error || sendError) && (
          <p className="tr-error">{rec.error ?? sendError}</p>
        )}

        {result && (
          <div className={`tr-result${result.passed ? ' tr-result--pass' : ''}`}>
            <div className="tr-score">
              <span className="tr-score__num">{score}%</span>
              <span className="tr-score__label">{result.passed ? 'Отлично!' : 'Ещё разок'}</span>
            </div>
            <div className="tr-bar">
              <div className="tr-bar__fill" style={{ width: `${score}%` }} />
            </div>
            {result.transcript && (
              <p className="tr-transcript">
                <b>Ты сказал:</b> {result.transcript}
              </p>
            )}
            {result.ai_comment && <p className="tr-comment">{result.ai_comment}</p>}
          </div>
        )}
      </div>

      <div className="trainer-nav">
        <button type="button" className="trainer-btn" onClick={() => goto(-1)} disabled={index === 0}>
          Назад
        </button>
        <button
          type="button"
          className="trainer-btn trainer-btn--primary"
          onClick={() => goto(1)}
          disabled={index >= verses.length - 1}
        >
          Дальше
        </button>
      </div>
    </>
  )
}
