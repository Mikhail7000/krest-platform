import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { getPanelStats } from './stats-data'
import { resolveIsOwner } from '@/lib/admin/owner'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * GET/POST /api/panel/stats — агрегированная статистика обзора дашборда.
 * Гард: cookie-сессия админа (getPanelSessionFromReq), иначе 401.
 * Владелец (is_protected) видит всех учеников включая скрытых.
 */
async function handle(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const isOwner = await resolveIsOwner(supabase, session.uid)
    const stats = await getPanelStats(isOwner)
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    console.error('[panel/stats]', e)
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки статистики' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
