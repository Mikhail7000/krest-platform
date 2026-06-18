'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecorder, extFor } from '@/app/m/trainer/[blockId]/useRecorder'

interface EmotionItem {
  id: string
  kind: string
  content_text: string | null
  media_url: string | null
  created_at: string
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

type Medium = 'audio' | 'video_note'

interface Props { blockId: number }

export function EmotionsClient({ blockId }: Props) {
  const [items, setItems] = useState<EmotionItem[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [medium, setMedium] = useState<Medium | null>(null)
  const isVideo = medium === 'video_note'
  const rec = useRecorder(isVideo, 60)
  const liveRef = useRef<HTMLVideoElement | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/m/emotions/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData() }),
      })
      if (res.ok) {
        const data = await res.json() as { items: EmotionItem[] }
        setItems(data.items ?? [])
      }
    } catch { /* пусто */ }
  }, [blockId])

  useEffect(() => { load() }, [load])

  // live-превью кружка
  useEffect(() => {
    const el = liveRef.current
    if (!el || !rec.stream) return
    el.srcObject = rec.stream
    el.play().catch(() => undefined)
    return () => { try { el.srcObject = null } catch { /* noop */ } }
  }, [rec.stream])

  const submitText = async () => {
    if (text.trim().length < 1) return
    setBusy(true)
    try {
      const res = await fetch(`/api/m/emotions/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), text }),
      })
      if (res.ok) {
        const data = await res.json() as { items: EmotionItem[] }
        setItems(data.items ?? [])
        setText('')
      }
    } finally {
      setBusy(false)
    }
  }

  const sendRecording = async () => {
    if (!rec.blob || !medium) return
    setBusy(true)
    try {
      const file = new File([rec.blob], `emotion.${extFor(rec.mime)}`, { type: rec.blob.type })
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('kind', medium)
      fd.append('file', file, file.name)
      const res = await fetch(`/api/m/emotions/${blockId}`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json() as { items: EmotionItem[] }
        setItems(data.items ?? [])
      }
      rec.reset()
      setMedium(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <textarea
        className="emotions-textarea"
        placeholder="Напиши, что прожил…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={busy}
      />
      <button type="button" className="emotions-btn" onClick={submitText} disabled={busy || text.trim().length < 1}>
        Отправить текст
      </button>

      {medium === null ? (
        <div className="emotions-media-row">
          <button type="button" className="emotions-media-btn" onClick={() => setMedium('audio')} disabled={busy}>
            Голосовое
          </button>
          <button type="button" className="emotions-media-btn" onClick={() => setMedium('video_note')} disabled={busy}>
            Кружок
          </button>
        </div>
      ) : (
        <div className="em-recorder">
          {isVideo && (rec.state === 'recording' || rec.blobUrl) && (
            <div className="em-circle">
              {rec.state === 'recording' ? (
                <video ref={liveRef} className="em-circle__video em-circle__video--live" autoPlay muted playsInline />
              ) : (
                <video key={rec.blobUrl} className="em-circle__video" src={rec.blobUrl ?? undefined} playsInline controls />
              )}
            </div>
          )}
          {rec.state === 'recording' && (
            <p className="em-rec-timer"><span className="em-rec-dot" />{rec.secs}с / 60с</p>
          )}
          {!isVideo && rec.blobUrl && rec.state === 'recorded' && (
            <audio className="emotions-item__media" src={rec.blobUrl} controls />
          )}

          <div className="emotions-media-row">
            {rec.state === 'recording' ? (
              <button type="button" className="emotions-media-btn" onClick={rec.stop}>Остановить</button>
            ) : rec.state === 'recorded' ? (
              <>
                <button type="button" className="emotions-media-btn" onClick={rec.reset} disabled={busy}>Перезаписать</button>
                <button type="button" className="emotions-btn" onClick={sendRecording} disabled={busy}>Отправить</button>
              </>
            ) : (
              <>
                <button type="button" className="emotions-btn" onClick={rec.start}>
                  {isVideo ? 'Записать кружок' : 'Записать голосовое'}
                </button>
                <button type="button" className="emotions-media-btn" onClick={() => { rec.reset(); setMedium(null) }}>Отмена</button>
              </>
            )}
          </div>
          {rec.error && <p className="emotions-busy" style={{ color: 'var(--color-error, #dc2626)' }}>{rec.error}</p>}
        </div>
      )}

      {busy && <p className="emotions-busy">Отправляем…</p>}

      {items.length > 0 && (
        <div className="emotions-list">
          <p className="emotions-list__title">Отправлено</p>
          {items.map((it) => (
            <div key={it.id} className="emotions-item">
              {it.kind === 'text' && <p className="emotions-item__text">{it.content_text}</p>}
              {it.kind === 'audio' && it.media_url && (
                <audio controls preload="none" src={it.media_url} className="emotions-item__media" />
              )}
              {it.kind === 'video_note' && it.media_url && (
                <video controls preload="none" src={it.media_url} className="emotions-item__media" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
