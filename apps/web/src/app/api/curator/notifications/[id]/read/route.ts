import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorAuth } from '@/lib/curator-auth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PUT /api/curator/notifications/{notification_id}/read
 * Отметить уведомление как прочитанное. Идемпотентно.
 * Авторизация: curator (только свои уведомления) / admin / super_admin
 *
 * Ответ 200: { ok: true, data: { read_at: string } }
 * Ответ 404: уведомление не найдено
 * Ответ 403: уведомление принадлежит другому куратору
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCuratorAuth()
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, role, supabase } = auth.curator

  const { id: notificationId } = await params

  if (!UUID_RE.test(notificationId)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid notification_id (must be UUID)' } },
      { status: 400 },
    )
  }

  // Fetch notification to verify ownership and current state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notification, error: fetchError } = await (supabase as any)
    .from('notifications_log')
    .select('id, curator_id, read_at')
    .eq('id', notificationId)
    .maybeSingle()

  if (fetchError || !notification) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Notification not found' } },
      { status: 404 },
    )
  }

  // Ownership check (curator can only mark their own; admin/super_admin can mark any)
  if (role === 'curator' && notification.curator_id !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Notification does not belong to you' } },
      { status: 403 },
    )
  }

  // Idempotent: already read — return existing read_at
  if (notification.read_at) {
    return NextResponse.json({
      ok: true,
      data: { read_at: notification.read_at },
    })
  }

  const readAt = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('notifications_log')
    .update({ read_at: readAt })
    .eq('id', notificationId)

  if (updateError) {
    console.error('[curator/notifications/read] update error', updateError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to mark notification as read' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    data: { read_at: readAt },
  })
}
