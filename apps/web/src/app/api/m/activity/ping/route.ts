/**
 * POST /api/m/activity/ping
 * Отмечает, что ученик заходил сегодня (по дате Бали). Вызывается при входе
 * в miniapp. Используется для ежедневных напоминаний и прогресса.
 *
 * Body: { initData: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const supabase = createServiceSupabase()
  const today = baliToday()
  const nowIso = new Date().toISOString()

  // upsert: помечаем день открытым; reminded_* не трогаем (нет в payload)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('student_daily_activity')
    .upsert(
      { user_id: auth.userId, activity_date: today, opened: true, opened_at: nowIso, updated_at: nowIso },
      { onConflict: 'user_id,activity_date' },
    )

  if (error) {
    console.error('[activity/ping] upsert error:', error)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'failed' } }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
