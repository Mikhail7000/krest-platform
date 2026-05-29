'use client'

import { useEffect, useState } from 'react'

// Мотивационные статусы — СТРОГО по списку Михаила (своё не добавлять).
const STATUS_PHRASES = [
  'Ещё чуть-чуть — и ты станешь Мастером Креста.',
  'Ещё чуть-чуть — и ты станешь частью команды.',
  'Ещё чуть-чуть — и будет проповедано Евангелие от края до края земли.',
  'Ещё чуть-чуть — и случится Второе Пришествие Христа.',
  'Ещё чуть-чуть — и через тебя начнут спасаться люди.',
  'Ещё чуть-чуть — и ты приблизишься на шаг к Вечному Завету с Богом.',
  'Ещё чуть-чуть — и ты станешь эпохальным учеником.',
  'Ещё чуть-чуть — и тебе откроется 25-й час.',
]

interface Streak {
  streak: number
  total: number
  openedToday: boolean
  last7: boolean[]
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
    ?.initData ?? ''
}

export function StreakCard() {
  const [data, setData] = useState<Streak | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/m/activity/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Streak | null) => {
        if (!cancelled && d) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null
  const phrase = STATUS_PHRASES[data.streak % STATUS_PHRASES.length]

  return (
    <div className="db-streak">
      <div className="db-streak__top">
        <span className="db-streak__num">🔥 {data.streak}</span>
        <span className="db-streak__label">{plural(data.streak, 'день', 'дня', 'дней')} подряд</span>
      </div>
      <div className="db-streak__flames">
        {data.last7.map((on, i) => (
          <span key={i} className={`db-streak__flame${on ? ' db-streak__flame--on' : ''}`} />
        ))}
      </div>
      <p className="db-streak__phrase">{phrase}</p>
    </div>
  )
}
