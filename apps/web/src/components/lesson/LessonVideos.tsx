'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { KinescopePlayerNoSkip } from './KinescopePlayerNoSkip'

interface VideoResource {
  id: string
  kinescope_id: string
  title_ru: string
  description_ru: string | null
  is_required: boolean
  summary_md: string | null
}

interface ProgressEntry {
  maxWatchedSeconds: number
  totalSeconds: number | null
  completedAt: string | null
}

type ProgressMap = Record<string, ProgressEntry>

export function LessonVideos({ videos }: { videos: VideoResource[] }) {
  const [progress, setProgress] = useState<ProgressMap>({})
  const [canSkip, setCanSkip] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData
    if (!initData) {
      setLoaded(true)
      return
    }
    let cancelled = false
    fetch('/api/m/video-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => r.json())
      .then((d: { progress?: ProgressMap; canSkip?: boolean }) => {
        if (!cancelled) {
          setProgress(d.progress ?? {})
          setCanSkip(Boolean(d.canSkip))
        }
      })
      .catch(() => { /* без прогресса — на клиенте no-skip всё равно работает */ })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded) {
    return <div className="lesson-videos-loading">Загрузка прогресса…</div>
  }

  return (
    <>
      {videos.map((v) => {
        const p = progress[v.id]
        return (
          <section key={v.id} className="lesson-card">
            <h2 className="lesson-card__title">
              {v.title_ru}
              {v.is_required && <span className="lesson-badge">обязательно</span>}
            </h2>
            {v.description_ru && <p className="lesson-card__desc">{v.description_ru}</p>}
            <div className="lesson-video">
              <KinescopePlayerNoSkip
                blockResourceId={v.id}
                videoId={v.kinescope_id}
                initialMaxWatched={p?.maxWatchedSeconds ?? 0}
                initialTotal={p?.totalSeconds ?? null}
                initialCompleted={!!p?.completedAt}
                showWatchedButton={canSkip}
              />
            </div>
            {v.summary_md ? (
              <details className="lesson-details">
                <summary>Конспект</summary>
                <div className="lesson-summary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{v.summary_md}</ReactMarkdown>
                </div>
              </details>
            ) : (
              <p className="lesson-summary-pending">Конспект готовится…</p>
            )}
          </section>
        )
      })}
    </>
  )
}
