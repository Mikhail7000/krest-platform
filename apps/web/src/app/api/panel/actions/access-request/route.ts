import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { decideAccessRequest, type DecideAction } from '@/lib/admin/access-requests'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

const ACTIONS: DecideAction[] = ['approve_student', 'approve_curator', 'reject']

/**
 * POST /api/panel/actions/access-request  { requestId, action }
 * Решение по заявке на доступ из веб-панели (зеркало Telegram inline-кнопок).
 * Гард: только admin/super_admin (cookie-сессия панели).
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { requestId?: string; action?: string }
  const requestId = body.requestId?.trim()
  const action = body.action as DecideAction | undefined

  if (!requestId || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: 'Неверные параметры' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // chat_id решающего админа (для decided_by) — из его профиля
  const { data: me } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', session.uid)
    .maybeSingle()
  const rawChatId = (me as { telegram_chat_id: number | string | null } | null)?.telegram_chat_id
  const deciderChatId = rawChatId != null && Number.isFinite(Number(rawChatId)) ? Number(rawChatId) : null

  const result = await decideAccessRequest(supabase, { requestId, action, deciderChatId })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  const verb =
    action === 'reject'
      ? 'отклонил(а) заявку'
      : action === 'approve_curator'
        ? 'одобрил(а) как куратора'
        : 'одобрил(а) как ученика'
  // notifyAdmins шлёт с parse_mode=HTML — экранируем имя заявителя (может содержать < > &)
  await notifyAdmins(supabase, `📥 ${escapeHtml(session.name ?? 'Админ')} ${verb}: ${escapeHtml(result.name)}`)

  return NextResponse.json({ ok: true })
}
