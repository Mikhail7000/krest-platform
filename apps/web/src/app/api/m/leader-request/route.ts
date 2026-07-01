import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/m/leader-request  { initData, leader_nick }
 *
 * Онбординг КУРАТОРА: он указывает ник своего лидера города. Куратор привязывается
 * к лидеру по ГОРОДУ — ставим куратору город (и страну) лидера. Лидер ищется по
 * профилю (уже вошёл) либо по whitelist (ещё не вошёл, но с assigned_city_id).
 * Возвращает country_id/city_id лидера — их онбординг сохранит финально.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string; leader_nick?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }
  const nick = (body.leader_nick ?? '').trim().replace(/^@+/, '').toLowerCase()
  if (!/^[a-z0-9_]{3,32}$/.test(nick)) {
    return NextResponse.json({ error: { code: 'BAD_NICK', message: 'Проверь ник лидера' } }, { status: 400 })
  }
  const handle = `@${nick}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // 1. Лидер уже вошёл — берём его город/страну из профиля.
  const { data: leaderProf } = await supabase
    .from('profiles')
    .select('city_id, country_id')
    .eq('role', 'city_leader')
    .ilike('contact_info', handle)
    .maybeSingle()

  let cityId: number | null = leaderProf?.city_id ?? null
  let countryId: number | null = leaderProf?.country_id ?? null

  // 2. Ещё не вошёл — ищем в whitelist (assigned_city_id), страну берём из города.
  if (cityId == null) {
    const { data: wl } = await supabase
      .from('testing_whitelist')
      .select('assigned_city_id')
      .eq('assign_role', 'city_leader')
      .ilike('telegram_username', handle)
      .maybeSingle()
    cityId = (wl as { assigned_city_id: number | null } | null)?.assigned_city_id ?? null
  }

  if (cityId == null) {
    return NextResponse.json(
      { error: { code: 'LEADER_NOT_FOUND', message: 'Лидер не найден. Проверь ник или спроси у наставника.' } },
      { status: 404 },
    )
  }

  if (countryId == null) {
    const { data: city } = await supabase.from('cities').select('country_id').eq('id', cityId).maybeSingle()
    countryId = (city as { country_id: number | null } | null)?.country_id ?? null
  }

  // Привязываем куратора к городу (= к лидеру этого города).
  const patch: Record<string, unknown> = { city_id: cityId }
  if (countryId != null) patch.country_id = countryId
  const { error } = await supabase.from('profiles').update(patch).eq('id', auth.userId)
  if (error) {
    console.error('[leader-request] update error:', error)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Не удалось привязать' } }, { status: 500 })
  }

  return NextResponse.json({ ok: true, country_id: countryId, city_id: cityId })
}
