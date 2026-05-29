/**
 * POST /api/m/activity/streak
 * Прогресс ученика: стрик (дней подряд), всего дней, активность за 7 дней.
 *
 * Body: { initData: string }
 * Response: { ok, streak, total, openedToday, last7: boolean[] }  (last7[6] = сегодня)
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const supabase = createServiceSupabase()
  const today = baliToday()
  const since = addDaysStr(today, -60)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('student_daily_activity')
    .select('activity_date')
    .eq('user_id', auth.userId)
    .eq('opened', true)
    .gte('activity_date', since)

  const set = new Set<string>(((data ?? []) as { activity_date: string }[]).map((r) => r.activity_date))

  // последние 7 дней: индекс 6 = сегодня
  const last7: boolean[] = []
  for (let i = 6; i >= 0; i--) last7.push(set.has(addDaysStr(today, -i)))

  // стрик: считаем подряд назад от сегодня (или вчера, если сегодня ещё не заходил)
  let streak = 0
  let cursor = set.has(today) ? today : addDaysStr(today, -1)
  if (set.has(cursor)) {
    while (set.has(cursor)) {
      streak++
      cursor = addDaysStr(cursor, -1)
    }
  }

  return NextResponse.json({
    ok: true,
    streak,
    total: set.size,
    openedToday: set.has(today),
    last7,
  })
}
