/**
 * POST /api/m/activity/streak
 * Прогресс ТЕКУЩЕГО ученика: стрик, всего дней, заход сегодня, календарь 14 дней.
 *
 * Body: { initData: string }
 * Response: { ok, streak, total, openedToday, lastActive, days: {date,on}[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { computeActivity } from '@/lib/activity/streak'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const supabase = createServiceSupabase()
  const since = addDaysStr(baliToday(), -60)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('student_daily_activity')
    .select('activity_date')
    .eq('user_id', auth.userId)
    .eq('opened', true)
    .gte('activity_date', since)

  const dates = ((data ?? []) as { activity_date: string }[]).map((r) => r.activity_date)
  const activity = computeActivity(dates, 14)

  return NextResponse.json({ ok: true, ...activity })
}
