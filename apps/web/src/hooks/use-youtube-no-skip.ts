'use client'

import { useEffect, useRef, useCallback } from 'react'

// Inline YT types (no @types/youtube needed)
declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLDivElement, opts: YTPlayerOptions) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayerOptions {
  videoId: string
  width?: string
  height?: string
  playerVars?: { controls?: number; rel?: number; modestbranding?: number }
  events?: {
    onReady?: () => void
    onStateChange?: (e: { data: number }) => void
  }
}

interface YTPlayer {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  destroy(): void
}

interface UseYouTubeNoSkipOptions {
  videoId: string
  onComplete: () => void
}

export function useYouTubeNoSkip({ videoId, onComplete }: UseYouTubeNoSkipOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const maxWatchedRef = useRef(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const startPolling = useCallback(() => {
    if (pollingRef.current) return

    pollingRef.current = setInterval(() => {
      const player = playerRef.current
      if (!player) return

      try {
        if (player.getPlayerState() !== 1) return // 1 = PLAYING

        const current = player.getCurrentTime()
        const duration = player.getDuration()

        if (current > maxWatchedRef.current + 2) {
          player.seekTo(maxWatchedRef.current, true)
        } else {
          maxWatchedRef.current = Math.max(maxWatchedRef.current, current)
        }

        if (!completedRef.current && duration > 0 && maxWatchedRef.current / duration >= 0.95) {
          completedRef.current = true
          onCompleteRef.current()
        }
      } catch {
        // player not ready
      }
    }, 500)
  }, [])

  useEffect(() => {
    maxWatchedRef.current = 0
    completedRef.current = false

    const initPlayer = () => {
      if (!containerRef.current) return

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: startPolling,
          onStateChange: (e) => {
            if (e.data === 1) startPolling()
          },
        },
      })
    }

    if (typeof window !== 'undefined' && window.YT?.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId, startPolling])

  return { containerRef }
}
