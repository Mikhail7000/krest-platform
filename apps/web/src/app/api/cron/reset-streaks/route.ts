import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron: сброс streak_count для пользователей, не активных >7 дней.
 * Расписание: ежедневно в 00:00 UTC (vercel.json).
 *
 * Защита: ожидает заголовок Authorization: Bearer ${CRON_SECRET}
 * (Vercel автоматически добавляет CRON_SECRET к cron-запросам).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ streak_count: 0 })
      .lt('last_active_date', cutoffStr)
      .gt('streak_count', 0)
      .select('id')

    if (error) {
      console.error('reset-streaks error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reset_count: data?.length || 0 })
  } catch (e) {
    console.error('reset-streaks exception', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
