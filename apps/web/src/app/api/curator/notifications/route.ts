import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorAuth } from '@/lib/curator-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/curator/notifications
 * История уведомлений куратора из notifications_log.
 * Авторизация: curator / admin / super_admin
 *
 * Query params:
 *   unread?  — "true" / "1" — только непрочитанные
 *   limit?   — максимум записей (1–200, default 50)
 */
export async function GET(request: NextRequest) {
  const auth = await requireCuratorAuth()
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, supabase } = auth.curator

  const { searchParams } = new URL(request.url)

  const rawUnread = searchParams.get('unread')
  const unreadOnly = rawUnread === 'true' || rawUnread === '1'

  const rawLimit = searchParams.get('limit') ?? '50'
  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 50, 1), 200)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('notifications_log')
    .select(
      `id,
       student_id,
       block_id,
       notification_type,
       assignment_type,
       created_at,
       read_at,
       profiles:student_id ( full_name )`,
    )
    .eq('curator_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data: notifications, error } = await query

  if (error) {
    console.error('[curator/notifications] query error', error)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to load notifications' } },
      { status: 500 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (notifications ?? []).map((n: any) => ({
    id: n.id,
    student_id: n.student_id,
    student_name: n.profiles?.full_name ?? null,
    block_id: n.block_id ?? null,
    notification_type: n.notification_type,
    assignment_type: n.assignment_type ?? null,
    created_at: n.created_at,
    read_at: n.read_at ?? null,
  }))

  return NextResponse.json({ ok: true, data })
}
