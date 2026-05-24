'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const KINESCOPE_SDK_URL = 'https://player.kinescope.io/latest/iframe.player.js'
const POLL_INTERVAL_MS = 500
const SAVE_THROTTLE_MS = 5000
const SKIP_TOLERANCE_SECONDS = 2
const COMPLETED_THRESHOLD = 0.95

interface KinescopePlayer {
  getCurrentTime(): Promise<number> | number
  getDuration(): Promise<number> | number
  seekTo(seconds: number): Promise<void> | void
  destroy?(): void | Promise<void>
}

interface KinescopeFactory {
  create(elementId: string, options: Record<string, unknown>): Promise<KinescopePlayer>
}

declare global {
  interface Window {
    Kinescope?: { IframePlayer?: KinescopeFactory }
    KinescopeIframeApiReadyHandlers?: Array<() => void>
    Telegram?: { WebApp?: { initData?: string } }
  }
}

let sdkPromise: Promise<KinescopeFactory | null> | null = null

function loadKinescopeSdk(): Promise<KinescopeFactory | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.Kinescope?.IframePlayer) return Promise.resolve(window.Kinescope.IframePlayer)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<KinescopeFactory | null>((resolve) => {
    const handlers = window.KinescopeIframeApiReadyHandlers ?? []
    window.KinescopeIframeApiReadyHandlers = handlers
    handlers.push(() => resolve(window.Kinescope?.IframePlayer ?? null))

    if (!document.querySelector(`script[src="${KINESCOPE_SDK_URL}"]`)) {
      const s = document.createElement('script')
      s.src = KINESCOPE_SDK_URL
      s.async = true
      document.head.appendChild(s)
    }
  })
  return sdkPromise
}

interface Props {
  blockResourceId: string
  videoId: string
  initialMaxWatched: number
  initialTotal: number | null
  initialCompleted: boolean
  disableNoSkip?: boolean
}

export function KinescopePlayerNoSkip({
  blockResourceId,
  videoId,
  initialMaxWatched,
  initialTotal,
  initialCompleted,
  disableNoSkip = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<KinescopePlayer | null>(null)
  const maxWatchedRef = useRef(initialMaxWatched)
  const totalRef = useRef<number | null>(initialTotal)
  const completedRef = useRef(initialCompleted)
  const lastSaveRef = useRef(0)

  const [completed, setCompleted] = useState(initialCompleted)
  const [progressPercent, setProgressPercent] = useState(
    initialTotal ? Math.min(100, (initialMaxWatched / initialTotal) * 100) : 0,
  )
  const [error, setError] = useState<string | null>(null)

  const saveProgress = useCallback(
    async (force: boolean) => {
      const initData = window.Telegram?.WebApp?.initData
      if (!initData) return
      const now = Date.now()
      if (!force && now - lastSaveRef.current < SAVE_THROTTLE_MS) return
      lastSaveRef.current = now
      try {
        await fetch('/api/m/video-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData,
            save: {
              blockResourceId,
              maxWatchedSeconds: Math.floor(maxWatchedRef.current),
              totalSeconds: totalRef.current ?? undefined,
            },
          }),
          keepalive: force,
        })
      } catch {
        // Транзиентная ошибка сети — попробуем на следующем тике.
      }
    },
    [blockResourceId],
  )

  useEffect(() => {
    let destroyed = false
    let pollHandle: ReturnType<typeof setInterval> | null = null

    const init = async () => {
      const factory = await loadKinescopeSdk()
      if (destroyed || !factory || !containerRef.current) return

      const elementId = `kp-${blockResourceId}`
      containerRef.current.id = elementId

      let player: KinescopePlayer
      try {
        player = await factory.create(elementId, {
          url: `https://kinescope.io/${videoId}`,
          size: { width: '100%', height: '100%' },
          behavior: { playsInline: true, preload: 'metadata' },
        })
      } catch (e) {
        setError(`Ошибка плеера: ${(e as Error).message}`)
        return
      }
      if (destroyed) {
        player.destroy?.()
        return
      }
      playerRef.current = player

      // Тестировщик: видео сразу засчитано (без досмотра), перемотка свободна
      if (disableNoSkip && !completedRef.current) {
        completedRef.current = true
        setCompleted(true)
        void saveProgress(true)
      }

      pollHandle = setInterval(async () => {
        try {
          const current = await Promise.resolve(player.getCurrentTime())
          const duration = await Promise.resolve(player.getDuration())
          if (typeof duration === 'number' && duration > 0) {
            totalRef.current = Math.round(duration)
          }

          // No-skip откат — только если функция не отключена (тестировщикам можно перематывать)
          if (!disableNoSkip && !completedRef.current && current > maxWatchedRef.current + SKIP_TOLERANCE_SECONDS) {
            await Promise.resolve(player.seekTo(maxWatchedRef.current))
            return
          }
          if (current > maxWatchedRef.current) maxWatchedRef.current = current

          if (totalRef.current && totalRef.current > 0) {
            setProgressPercent(Math.min(100, (maxWatchedRef.current / totalRef.current) * 100))
          }

          if (
            !completedRef.current
            && totalRef.current
            && maxWatchedRef.current / totalRef.current >= COMPLETED_THRESHOLD
          ) {
            completedRef.current = true
            setCompleted(true)
            await saveProgress(true)
          } else {
            void saveProgress(false)
          }
        } catch {
          // Плеер ещё не готов — следующий тик попробует снова.
        }
      }, POLL_INTERVAL_MS)
    }

    init()

    const onVisibility = () => {
      if (document.hidden) void saveProgress(true)
    }
    const onPageHide = () => void saveProgress(true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      destroyed = true
      void saveProgress(true)
      if (pollHandle) clearInterval(pollHandle)
      playerRef.current?.destroy?.()
      playerRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [blockResourceId, videoId, saveProgress, disableNoSkip])

  return (
    <div className="kp">
      <div className="kp__frame" ref={containerRef} />
      {!completed && (
        <div className="kp__progress" aria-hidden="true">
          <div className="kp__progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
      {completed && <div className="kp__badge">✓ Просмотрено — можно перематывать свободно</div>}
      {error && <div className="kp__error">{error}</div>}
    </div>
  )
}
