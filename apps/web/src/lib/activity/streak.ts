import { addDaysStr, baliToday } from '@/lib/time/bali'

export interface ActivityDay {
  date: string
  on: boolean
}

export interface ActivitySummary {
  streak: number
  total: number
  openedToday: boolean
  lastActive: string | null
  days: ActivityDay[]
}

/**
 * Считает прогресс активности из списка дат заходов (YYYY-MM-DD, по Бали).
 * streak — дней подряд (включая сегодня или заканчивая вчера, если сегодня ещё не заходил).
 * days — последние windowDays дней (для календаря), последний элемент = сегодня.
 */
export function computeActivity(openedDates: string[], windowDays = 14): ActivitySummary {
  const set = new Set(openedDates)
  const today = baliToday()

  const days: ActivityDay[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = addDaysStr(today, -i)
    days.push({ date: d, on: set.has(d) })
  }

  let streak = 0
  let cursor = set.has(today) ? today : addDaysStr(today, -1)
  if (set.has(cursor)) {
    while (set.has(cursor)) {
      streak++
      cursor = addDaysStr(cursor, -1)
    }
  }

  let lastActive: string | null = null
  for (const d of set) if (!lastActive || d > lastActive) lastActive = d

  return { streak, total: set.size, openedToday: set.has(today), lastActive, days }
}

export function pluralDays(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'день'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня'
  return 'дней'
}
