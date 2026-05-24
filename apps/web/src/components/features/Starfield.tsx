'use client'

import { useEffect, useRef } from 'react'
import './starfield.css'

interface Props {
  /** Плотность звёзд (по умолчанию средняя) */
  density?: number
}

interface Star {
  x: number
  y: number
  r: number
  baseAlpha: number
  speed: number
  twinklePhase: number
  twinkleSpeed: number
}

// Звёзды рисуются на canvas (а не box-shadow) — длинные box-shadow строки
// молча обрезаются в Telegram WebView (WKWebView). Canvas работает везде.
export function Starfield({ density = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let stars: Star[] = []

    const init = () => {
      const parent = canvas.parentElement
      width = parent?.clientWidth ?? window.innerWidth
      height = parent?.clientHeight ?? window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round(((width * height) / 1400) * density)
      stars = []
      for (let i = 0; i < count; i++) {
        const big = Math.random() > 0.82
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: big ? 1.1 + Math.random() * 0.9 : 0.5 + Math.random() * 0.5,
          baseAlpha: 0.35 + Math.random() * 0.65,
          speed: 2 + Math.random() * 6, // px/сек — медленный дрейф вверх
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.4 + Math.random() * 1.4,
        })
      }
    }

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height)
      for (const s of stars) {
        if (!reduceMotion) {
          s.y -= s.speed * dt
          if (s.y < -2) {
            s.y = height + 2
            s.x = Math.random() * width
          }
          s.twinklePhase += s.twinkleSpeed * dt
        }
        const twinkle = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(s.twinklePhase)
        ctx.globalAlpha = Math.min(1, s.baseAlpha * twinkle)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      draw(dt)
      if (!reduceMotion) raf = requestAnimationFrame(frame)
    }

    init()
    raf = requestAnimationFrame(frame)

    const onResize = () => init()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [density])

  return <canvas ref={canvasRef} aria-hidden="true" className="starfield-canvas" />
}
