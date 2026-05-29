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
  const today = baliToday()
  const since = addDaysStr(today, -60)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('student_daily_activity')
    .select('activity_date')
    .eq('user_id', auth.userId)
    .eq('opened', true)
    .gte('activity_date', since)
  const opened = ((data ?? []) as { activity_date: string }[]).map((r) => r.activity_date)

  // дни, когда что-то сдавал — для «зелёных» кубиков (последняя неделя)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (supabase as any)
    .from('submissions')
    .select('submission_date')
    .eq('user_id', auth.userId)
    .gte('submission_date', addDaysStr(today, -8))
  const worked = ((subs ?? []) as { submission_date: string | null }[])
    .map((s) => (s.submission_date ? String(s.submission_date).slice(0, 10) : ''))
    .filter(Boolean)

  const activity = computeActivity(opened, worked, 7)

  return NextResponse.json({ ok: true, ...activity })
}
