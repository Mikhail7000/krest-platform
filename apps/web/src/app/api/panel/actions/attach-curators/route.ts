import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/attach-curators  { leaderId, curatorIds: string[] }
 * Привязать кураторов к лидеру города = перевести их в город лидера (связь
 * лидер↔куратор в системе идёт по городу). Только admin/super_admin.
 * Синхронизируем testing_whitelist.assigned_city_id (триггер apply_whitelist_role).
 */
export async function POST(req: NextRequest) {
  const session = await getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    leaderId?: string
    curatorIds?: string[]
  }
  const leaderId = body.leaderId?.trim()
  const curatorIds = Array.isArray(body.curatorIds) ? body.curatorIds.filter(Boolean) : []
  if (!leaderId || curatorIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Укажите лидера и хотя бы одного куратора' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: leader } = await supabase
    .from('profiles')
    .select('id, role, city_id, full_name, contact_info')
    .eq('id', leaderId)
    .maybeSingle()
  if (!leader || leader.role !== 'city_leader') {
    return NextResponse.json({ ok: false, error: 'Лидер города не найден' }, { status: 404 })
  }
  if (leader.city_id == null) {
    return NextResponse.json(
      { ok: false, error: 'У лидера не задан город — сначала укажите его' },
      { status: 400 },
    )
  }

  // Берём только реальных кураторов из переданных id.
  const { data: curators } = await supabase
    .from('profiles')
    .select('id, contact_info')
    .eq('role', 'curator')
    .in('id', curatorIds)
  const list = (curators ?? []) as { id: string; contact_info: string | null }[]
  if (list.length === 0) {
    return NextResponse.json({ ok: false, error: 'Кураторы не найдены' }, { status: 404 })
  }

  // Whitelist синхронизируем ДО профиля, иначе триггер вернёт старый город.
  for (const c of list) {
    if (c.contact_info) {
      await supabase
        .from('testing_whitelist')
        .update({ assigned_city_id: leader.city_id })
        .ilike('telegram_username', c.contact_info)
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ city_id: leader.city_id })
    .in(
      'id',
      list.map((c) => c.id),
    )
  if (error) {
    console.error('[panel/actions/attach-curators]', error)
    return NextResponse.json({ ok: false, error: 'Не удалось привязать' }, { status: 500 })
  }

  const who = leader.full_name || leader.contact_info || 'лидер'
  await notifyAdmins(
    supabase,
    `🔗 ${escapeHtml(session.name ?? 'Админ')} привязал кураторов (${list.length}) к лидеру ${escapeHtml(who)}`,
  )

  return NextResponse.json({ ok: true, attached: list.length })
}
