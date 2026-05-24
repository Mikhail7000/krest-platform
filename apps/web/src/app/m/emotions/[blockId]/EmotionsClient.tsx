'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

interface Props { blockId: number }

export function EmotionsClient({ blockId }: Props) {
  const [items, setItems] = useState<EmotionItem[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const audioRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

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

  const uploadMedia = async (kind: 'audio' | 'video_note', file: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('kind', kind)
      fd.append('file', file, file.name)
      const res = await fetch(`/api/m/emotions/${blockId}`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json() as { items: EmotionItem[] }
        setItems(data.items ?? [])
      }
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

      <div className="emotions-media-row">
        <button type="button" className="emotions-media-btn" onClick={() => audioRef.current?.click()} disabled={busy}>
          🎙️ Аудио
        </button>
        <button type="button" className="emotions-media-btn" onClick={() => videoRef.current?.click()} disabled={busy}>
          🎥 Кружок
        </button>
      </div>
      <input
        ref={audioRef}
        type="file"
        accept="audio/*"
        capture
        className="emotions-file-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia('audio', f) }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="user"
        className="emotions-file-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia('video_note', f) }}
      />

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
