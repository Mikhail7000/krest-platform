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

// «Крест Капсула Тест» — тестовый аккаунт. Показываем в трекинге, но ВНЕ рейтинга и
// всегда последним: он закрывает дни в ходе тестов и иначе занимал бы первое место.
// Матчим по id (неизменный) и по нику (на случай пересоздания).
const OUT_OF_RANKING_IDS = new Set(['e1b752b0-4729-475e-8e82-87a30965cc2e'])
const OUT_OF_RANKING_HANDLES = new Set(['@krest777237'])
function isOutOfRanking(p: { id: string; contact_info: string | null }): boolean {
  return (
    OUT_OF_RANKING_IDS.has(p.id) ||
    (p.contact_info != null && OUT_OF_RANKING_HANDLES.has(p.contact_info.toLowerCase()))
  )
}

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
  leaderboard_bg_path: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cities: { name_ru: string } | null | any
}

type Tier = 'gold' | 'silver' | 'bronze' | 'blue' | 'green' | 'normal'

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
    .select('id, full_name, contact_info, avatar_path, leaderboard_bg_path, cities(name_ru)')
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

  // 3. Реально сданные блоки по дневной модели (rpc, без block_passed_at)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: passedRaw } = await (supabase as any).rpc('passed_blocks_all')
  const passedCountByUser = new Map<string, number>()
  for (const row of (passedRaw ?? []) as { user_id: string; blocks_passed: number }[]) {
    passedCountByUser.set(row.user_id, row.blocks_passed)
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
    const currentBlock = Math.min(blocksPassed + 1, 10)

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
      // contact_info хранится как «@ник» — снимаем ведущий @, чтобы карточка
      // (она сама добавляет @) не показывала «@@ник».
      telegram: p.contact_info ? p.contact_info.replace(/^@+/, '') : null,
      city,
      avatar_url: avatarUrl(p.avatar_path ?? null),
      bg_url: avatarUrl(p.leaderboard_bg_path ?? null),
      is_self: p.id === auth.userId,
      closedDays,
      points,
      currentStreak,
      blocksPassed,
      currentBlock,
      achievements,
    }
  })

  // 5. Тестовый аккаунт «Крест Капсула Тест» — отделяем: он вне рейтинга, всегда последним.
  const outOfRankingIds = new Set(profiles.filter(isOutOfRanking).map((p) => p.id))
  const competitors = list.filter((e) => !outOfRankingIds.has(e.id))
  const pinned = list.filter((e) => outOfRankingIds.has(e.id))

  // Сортировка и ранги — только для реальных участников
  competitors.sort((a, b) => b.points - a.points || b.closedDays - a.closedDays)

  const ranked = competitors.map((entry, i) => {
    const rank = i + 1
    // Призовые: 1 золото, 2 серебро, 3 бронза; 4-6 — небесно-голубой, 7-10 — зелёный.
    let tier: Tier
    if (rank === 1) tier = 'gold'
    else if (rank === 2) tier = 'silver'
    else if (rank === 3) tier = 'bronze'
    else if (rank <= 6) tier = 'blue'
    else if (rank <= 10) tier = 'green'
    else tier = 'normal'

    const { id: _id, ...rest } = entry
    return { rank, tier, ...rest }
  })

  // Тестовый аккаунт(ы) — в самом конце, без места (rank=0, outOfRanking)
  const pinnedRanked = pinned.map((entry) => {
    const { id: _id, ...rest } = entry
    return { rank: 0, tier: 'normal' as Tier, outOfRanking: true, ...rest }
  })

  return NextResponse.json({ ok: true, list: [...ranked, ...pinnedRanked] })
}
