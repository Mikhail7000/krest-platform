import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { ownerLockBlocksIds, OWNER_LOCKED_ERROR } from '@/lib/admin/locked'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/curator-city  { userId, cityId }
 * Перепривязка куратора к другому городу/лидеру: меняем profiles.city_id.
 * Лидер города 1-к-1 с городом, поэтому смена города = переход под нужного лидера.
 * Ученики куратора остаются за ним (видимость для нового лидера — через членство
 * куратора в городе, см. studentInScope). Гард: только admin/super_admin.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string; cityId?: number | string | null }
  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Не указан куратор' }, { status: 400 })
  }
  const cityId =
    body.cityId == null || body.cityId === '' ? null : Number(body.cityId)
  if (cityId != null && !Number.isInteger(cityId)) {
    return NextResponse.json({ ok: false, error: 'Неверный город' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, full_name, contact_info, is_protected')
    .eq('id', userId)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ ok: false, error: 'Куратор не найден' }, { status: 404 })
  }
  if (target.is_protected) {
    return NextResponse.json({ ok: false, error: 'Этот пользователь защищён' }, { status: 403 })
  }
  if (await ownerLockBlocksIds(supabase, session.uid, [userId])) {
    return NextResponse.json({ ok: false, error: OWNER_LOCKED_ERROR }, { status: 403 })
  }
  // Перепривязываем только кураторов (лидер города привязан к городу 1-к-1 отдельно).
  if (target.role !== 'curator') {
    return NextResponse.json({ ok: false, error: 'Перепривязать можно только куратора' }, { status: 400 })
  }

  let cityLabel = 'без города'
  if (cityId != null) {
    const { data: city } = await supabase
      .from('cities')
      .select('id, name_ru')
      .eq('id', cityId)
      .maybeSingle()
    if (!city) {
      return NextResponse.json({ ok: false, error: 'Город не найден' }, { status: 404 })
    }
    cityLabel = city.name_ru
  }

  const { error } = await supabase.from('profiles').update({ city_id: cityId }).eq('id', userId)
  if (error) {
    console.error('[panel/actions/curator-city]', error)
    return NextResponse.json({ ok: false, error: 'Не удалось сменить город' }, { status: 500 })
  }

  const who = target.full_name || target.contact_info || 'куратор'
  await notifyAdmins(
    supabase,
    `🗺️ ${escapeHtml(session.name ?? 'Админ')}: куратор ${escapeHtml(who)} → город ${escapeHtml(cityLabel)}`,
  )

  return NextResponse.json({ ok: true })
}
