import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/city  { userId, cityId }
 * Сменить город куратора / лидера города. Только admin/super_admin.
 * Синхронизируем testing_whitelist.assigned_city_id ДО профиля, иначе триггер
 * apply_whitelist_role при обновлении вернул бы старый город.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string; cityId?: number | string }
  const userId = body.userId?.trim()
  const cityId = body.cityId != null && body.cityId !== '' ? Number(body.cityId) : null
  if (!userId || cityId == null || !Number.isInteger(cityId)) {
    return NextResponse.json({ ok: false, error: 'Укажите пользователя и город' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, is_protected, full_name, contact_info')
    .eq('id', userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ ok: false, error: 'Пользователь не найден' }, { status: 404 })
  }
  if (target.is_protected) {
    return NextResponse.json({ ok: false, error: 'Этот пользователь защищён' }, { status: 403 })
  }
  if (!['curator', 'city_leader'].includes(target.role)) {
    return NextResponse.json(
      { ok: false, error: 'Город меняется только у куратора или лидера города' },
      { status: 400 },
    )
  }

  // Город должен существовать (иначе FK-ошибка вместо понятного 400).
  const { data: city } = await supabase
    .from('cities')
    .select('id, name_ru')
    .eq('id', cityId)
    .maybeSingle()
  if (!city) {
    return NextResponse.json({ ok: false, error: 'Город не найден' }, { status: 400 })
  }

  if (target.contact_info) {
    await supabase
      .from('testing_whitelist')
      .update({ assigned_city_id: cityId })
      .ilike('telegram_username', target.contact_info)
  }

  const { error } = await supabase.from('profiles').update({ city_id: cityId }).eq('id', userId)
  if (error) {
    console.error('[panel/actions/city]', error)
    return NextResponse.json({ ok: false, error: 'Не удалось сменить город' }, { status: 500 })
  }

  const who = target.full_name || target.contact_info || 'пользователь'
  await notifyAdmins(
    supabase,
    `🌍 ${escapeHtml(session.name ?? 'Админ')} сменил город: ${escapeHtml(who)} → ${escapeHtml(city.name_ru)}`,
  )

  return NextResponse.json({ ok: true })
}
