import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { decideAccessRequest, type DecideAction } from '@/lib/admin/access-requests'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

const ACTIONS: DecideAction[] = ['approve_student', 'approve_curator', 'approve_leader', 'reject']

/**
 * POST /api/panel/actions/access-request  { requestId, action, cityId? }
 * Решение по заявке на доступ из веб-панели. Можно одобрить как ученика, куратора
 * (города) или лидера города. Для лидера город обязателен.
 * Гард: только admin/super_admin (cookie-сессия панели).
 */
export async function POST(req: NextRequest) {
  const session = await getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  // Решать по заявкам на доступ может только admin/super_admin.
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    requestId?: string
    action?: string
    cityId?: number | string | null
  }
  const requestId = body.requestId?.trim()
  const action = body.action as DecideAction | undefined

  if (!requestId || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: 'Неверные параметры' }, { status: 400 })
  }

  const cityId =
    body.cityId == null || body.cityId === '' ? null : Number(body.cityId)
  if (cityId != null && !Number.isInteger(cityId)) {
    return NextResponse.json({ ok: false, error: 'Неверный город' }, { status: 400 })
  }
  // Лидеру города город обязателен (он привязан к городу 1-к-1).
  if (action === 'approve_leader' && cityId == null) {
    return NextResponse.json({ ok: false, error: 'Для лидера города выберите город' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Город должен существовать (cityId с FK на cities). Без этой проверки невалидный
  // (но целочисленный) id уронил бы FK уже ПОСЛЕ создания профиля — полу-созданный
  // аккаунт + заявка зависает в pending. Проверяем заранее → чистая 400.
  if (cityId != null) {
    const { data: city } = await supabase.from('cities').select('id').eq('id', cityId).maybeSingle()
    if (!city) {
      return NextResponse.json({ ok: false, error: 'Город не найден' }, { status: 400 })
    }
  }

  // chat_id решающего админа (для decided_by) — из его профиля
  const { data: me } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', session.uid)
    .maybeSingle()
  const rawChatId = (me as { telegram_chat_id: number | string | null } | null)?.telegram_chat_id
  const deciderChatId = rawChatId != null && Number.isFinite(Number(rawChatId)) ? Number(rawChatId) : null

  const result = await decideAccessRequest(supabase, { requestId, action, deciderChatId, cityId })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  const verb =
    action === 'reject'
      ? 'отклонил(а) заявку'
      : action === 'approve_leader'
        ? 'одобрил(а) как лидера города'
        : action === 'approve_curator'
          ? 'одобрил(а) как куратора'
          : 'одобрил(а) как ученика'
  // notifyAdmins шлёт с parse_mode=HTML — экранируем имя заявителя (может содержать < > &)
  await notifyAdmins(supabase, `📥 ${escapeHtml(session.name ?? 'Админ')} ${verb}: ${escapeHtml(result.name)}`)

  // notified=false → одобрен, но Telegram-пуш заявителю не доставлен (не открыл бота)
  return NextResponse.json({ ok: true, notified: result.notified })
}
