'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface NextCourse {
  slug: string
  title: string
  status: string
}

interface CompletedData {
  completed: boolean
  completed_at?: string | null
  final_score?: number | null
  next_course?: NextCourse | null
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
    ?.Telegram?.WebApp?.initData ?? ''
}

export function CompletedClient() {
  const router = useRouter()
  const [data, setData] = useState<CompletedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initData = getInitData()
    fetch('/api/m/completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Ошибка ${res.status}`)
        return res.json() as Promise<CompletedData>
      })
      .then((d) => {
        if (!d.completed) {
          router.replace('/m/dashboard')
          return
        }
        setData(d)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="miniapp-container completed-page">
        <p className="miniapp-hint" style={{ paddingTop: '3rem' }}>Загрузка…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="miniapp-container completed-page">
        <p style={{ color: 'var(--tg-destructive, #EF4444)', paddingTop: '2rem' }}>{error}</p>
        <Link href="/m/dashboard" className="completed-btn" style={{ marginTop: '1rem', maxWidth: '18rem' }}>
          К дашборду
        </Link>
      </div>
    )
  }

  if (!data) return null

  const nextUnlocked = data.next_course?.status === 'unlocked'

  return (
    <div className="miniapp-container completed-page">
      {/* Hero */}
      <div className="completed-hero">
        <p className="completed-hero__eyebrow">Курс «КРЕСТ» завершён</p>
        <h1 className="completed-hero__title">Курс Креста сдан</h1>
        <p className="completed-hero__subtitle">Теперь — сдача креста наставнику, очно или онлайн.</p>
        {data.final_score !== null && data.final_score !== undefined && (
          <span className="completed-hero__score">
            Финальный экзамен: {data.final_score}%
          </span>
        )}
      </div>

      {/* Scripture */}
      <blockquote className="completed-scripture">
        <p className="completed-scripture__text">
          «Я написал вам, юноши, потому что вы сильны, и слово Божие пребывает
          в вас, и вы победили лукавого.»
        </p>
        <cite className="completed-scripture__ref">— 1 Иоанна 2:14</cite>
      </blockquote>

      {/* Congratulation text */}
      <div className="completed-congrats">
        <p>
          Ты прошёл весь путь: от Малого Креста и принципа сотворения
          до пяти уверенностей. Структура, писания и личный стиль
          теперь у тебя в руках.
        </p>
        <p>
          Дальше — практика, эпоха пятницы и собственные ученики.
        </p>
      </div>

      {/* Next course */}
      {data.next_course && (
        <div className="completed-next">
          <p className="completed-next__label">Следующий курс</p>
          <p className="completed-next__title">{data.next_course.title}</p>
          <p className={`completed-next__status${nextUnlocked ? ' completed-next__status--unlocked' : ''}`}>
            {nextUnlocked ? 'Открыт — скоро доступен' : 'Скоро откроется'}
          </p>
        </div>
      )}

      {/* Action */}
      <Link href="/m/dashboard" className="completed-btn">
        К списку блоков
      </Link>
    </div>
  )
}
