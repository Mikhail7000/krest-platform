import { addDaysStr, baliToday } from '@/lib/time/bali'

// Состояние дня для кубиков прогресса:
//  green — заходил и что-то сдавал (продуктивный день)
//  yellow — заходил, но без сдачи (просто зашёл)
//  off — сегодня ещё не заходил (день не закончился) / будущее
//  red — день пропущен (прошёл, не заходил)
export type DayState = 'green' | 'yellow' | 'off' | 'red'

export interface ActivityDay {
  date: string
  on: boolean
  state: DayState
}

export interface ActivitySummary {
  streak: number
  total: number
  openedToday: boolean
  lastActive: string | null
  days: ActivityDay[]
}

/**
 * Считает прогресс активности.
 * openedDates — дни заходов; workedDates — дни, когда что-то сдавал (опционально).
 * streak — дней подряд; days — последние windowDays дней (последний = сегодня).
 */
export function computeActivity(
  openedDates: string[],
  workedDates: string[] = [],
  windowDays = 14,
): ActivitySummary {
  const openedSet = new Set(openedDates)
  const workedSet = new Set(workedDates)
  const today = baliToday()

  const days: ActivityDay[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = addDaysStr(today, -i)
    const opened = openedSet.has(d)
    let state: DayState
    if (opened && workedSet.has(d)) state = 'green'
    else if (opened) state = 'yellow'
    else if (d < today) state = 'red'
    else state = 'off'
    days.push({ date: d, on: opened, state })
  }

  let streak = 0
  let cursor = openedSet.has(today) ? today : addDaysStr(today, -1)
  if (openedSet.has(cursor)) {
    while (openedSet.has(cursor)) {
      streak++
      cursor = addDaysStr(cursor, -1)
    }
  }

  let lastActive: string | null = null
  for (const d of openedSet) if (!lastActive || d > lastActive) lastActive = d

  return { streak, total: openedSet.size, openedToday: openedSet.has(today), lastActive, days }
}

export function pluralDays(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'день'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня'
  return 'дней'
}
