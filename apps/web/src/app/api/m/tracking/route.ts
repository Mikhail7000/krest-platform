/**
 * POST /api/m/tracking  { initData }
 *
 * Рейтинг-лидерборд учеников.
 *
 * Алгоритм очков:
 *   - Берём все «закрытые даты» ученика (closed_dates_all RPC).
 *   - Сортируем по возрастанию. Идём по ним: run=1 если первая дата или
 *     разрыв с предыдущей > 1 день, иначе run=prev+1. points += run.
 *   - Серия 3 подряд = 1+2+3 = 6; 7 разрозненных = 7.
 *
 * Производительность: 1 RPC closed_dates_all + 1 SELECT profiles +
 *   1 SELECT student_block_progress. Нет N-запросов на ученика.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const AVATARS_BUCKET = 'avatars'

function avatarUrl(path: string | null): string | null {
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`
}

/** Утро UTC вчера. */
function utcYesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Сегодня UTC. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Разница в днях между двумя YYYY-MM-DD (b - a). */
function daysDiff(a: string, b: string): number {
  return (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000
}

interface ClosedDateRow {
  user_id: string
  d: string // DATE → строка 'YYYY-MM-DD'
}

interface ProfileRow {
  id: string
  full_name: string | null
  contact_info: string | null
  avatar_path: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cities: { name_ru: string } | null | any
}

interface BlockProgressRow {
  user_id: string
  block_passed_at: string | null
  block_id: number
}

type Tier = 'gold' | 'silver' | 'bronze' | 'normal'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const supabase = createServiceSupabase()

  // 1. Профили видимых участников трекинга
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profsRaw, error: profsErr } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, contact_info, avatar_path, cities(name_ru)')
    .eq('role', 'student')
    .eq('hidden_from_tracking', false)

  if (profsErr) {
    console.error('[tracking] profiles fetch error:', profsErr)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Ошибка загрузки участников' } }, { status: 500 })
  }

  const profiles = (profsRaw ?? []) as ProfileRow[]
  if (profiles.length === 0) {
    return NextResponse.json({ ok: true, list: [] })
  }

  const ids = profiles.map((p) => p.id)

  // 2. Все закрытые даты по всем ученикам (одним RPC)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: closedRaw, error: closedErr } = await (supabase as any).rpc('closed_dates_all')
  if (closedErr) {
    console.error('[tracking] closed_dates_all error:', closedErr)
    return NextResponse.json({ error: { code: 'RPC_ERROR', message: 'Ошибка подсчёта закрытых дней' } }, { status: 500 })
  }

  // Строим Map<userId, sortedDates[]>
  const closedByUser = new Map<string, string[]>()
  for (const row of (closedRaw ?? []) as unknown as ClosedDateRow[]) {
    if (!ids.includes(row.user_id)) continue
    const dateStr = typeof row.d === 'string' ? row.d.slice(0, 10) : ''
    if (!dateStr) continue
    const arr = closedByUser.get(row.user_id) ?? []
    arr.push(dateStr)
    closedByUser.set(row.user_id, arr)
  }
  // Сортируем даты по возрастанию для каждого
  for (const [uid, dates] of closedByUser) {
    closedByUser.set(uid, dates.sort())
  }

  // 3. Прогресс блоков (батч по всем ученикам)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bpRaw } = await (supabase as any)
    .from('student_block_progress')
    .select('user_id, block_id, block_passed_at')
    .in('user_id', ids)

  // blocksPassed = кол-во блоков с block_passed_at IS NOT NULL
  // currentBlock = max block_id с любой записью прогресса (или 1 если нет)
  const passedCountByUser = new Map<string, number>()
  const maxBlockByUser = new Map<string, number>()

  for (const row of (bpRaw ?? []) as BlockProgressRow[]) {
    if (row.block_passed_at) {
      passedCountByUser.set(row.user_id, (passedCountByUser.get(row.user_id) ?? 0) + 1)
    }
    const cur = maxBlockByUser.get(row.user_id) ?? 0
    if (row.block_id > cur) maxBlockByUser.set(row.user_id, row.block_id)
  }

  // 4. Считаем очки и стрики по закрытым датам (в TS, без доп. запросов)
  const today = utcToday()
  const yesterday = utcYesterday()

  interface Entry {
    id: string
    name: string
    telegram: string | null
    city: string | null
    avatar_url: string | null
    is_self: boolean
    closedDays: number
    points: number
    currentStreak: number
    blocksPassed: number
    currentBlock: number
    achievements: string[]
  }

  const list: Entry[] = profiles.map((p) => {
    const dates = closedByUser.get(p.id) ?? []
    const closedDays = dates.length

    // Считаем очки: run-логика по отсортированным датам
    let points = 0
    let run = 0
    let prevDate = ''
    for (const d of dates) {
      if (!prevDate || daysDiff(prevDate, d) !== 1) {
        run = 1
      } else {
        run += 1
      }
      points += run
      prevDate = d
    }

    // currentStreak — длина серии, заканчивающейся сегодня или вчера
    let currentStreak = 0
    if (dates.length > 0) {
      const last = dates[dates.length - 1]
      if (last === today || last === yesterday) {
        // Идём с конца назад пока серия не прерывается
        currentStreak = 1
        for (let i = dates.length - 2; i >= 0; i--) {
          if (daysDiff(dates[i], dates[i + 1]) === 1) {
            currentStreak++
          } else {
            break
          }
        }
      }
    }

    const blocksPassed = passedCountByUser.get(p.id) ?? 0
    const currentBlock = maxBlockByUser.get(p.id) ?? 1

    // Ачивки
    const achievements: string[] = []
    if (currentStreak >= 3) achievements.push(`🔥 ${currentStreak} дней подряд`)
    achievements.push(`📘 Блок ${currentBlock}`)
    if (blocksPassed > 0) achievements.push(`✅ Сдал ${blocksPassed} бл.`)

    // Нормализуем cities (Supabase может вернуть объект или массив)
    const c = p.cities
    const city: string | null = Array.isArray(c)
      ? (c[0]?.name_ru ?? null)
      : (c?.name_ru ?? null)

    return {
      id: p.id,
      name: p.full_name?.trim() || p.contact_info || 'Ученик',
      telegram: p.contact_info ?? null,
      city,
      avatar_url: avatarUrl(p.avatar_path ?? null),
      is_self: p.id === auth.userId,
      closedDays,
      points,
      currentStreak,
      blocksPassed,
      currentBlock,
      achievements,
    }
  })

  // 5. Сортировка и ранги
  list.sort((a, b) => b.points - a.points || b.closedDays - a.closedDays)

  const ranked = list.map((entry, i) => {
    const rank = i + 1
    let tier: Tier
    if (rank === 1) tier = 'gold'
    else if (rank <= 3) tier = 'silver'
    else if (rank <= 10) tier = 'bronze'
    else tier = 'normal'

    const { id: _id, ...rest } = entry
    return { rank, tier, ...rest }
  })

  return NextResponse.json({ ok: true, list: ranked })
}
