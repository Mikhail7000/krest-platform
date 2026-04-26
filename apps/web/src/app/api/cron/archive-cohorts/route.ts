import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron: архивация closed/open cohorts старше 14 дней.
 * Логика:
 *  - status='open' и created_at > 14 дней назад → перевод в 'closed'
 *  - status='closed' и closed_at > 14 дней назад → перевод в 'archived'
 * Расписание: ежедневно в 01:00 UTC.
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
    const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Open → Closed (если стоит больше 14 дней без 12 человек)
    const { data: closed } = await supabaseAdmin
      .from('cohorts')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('status', 'open')
      .lt('created_at', cutoff14)
      .select('id')

    // Closed → Archived (если закрыта 14+ дней назад)
    const { data: archived } = await supabaseAdmin
      .from('cohorts')
      .update({ status: 'archived' })
      .eq('status', 'closed')
      .lt('closed_at', cutoff14)
      .select('id')

    return NextResponse.json({
      ok: true,
      closed: closed?.length || 0,
      archived: archived?.length || 0,
    })
  } catch (e) {
    console.error('archive-cohorts exception', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
