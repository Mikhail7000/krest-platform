import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { ownerLockedHandles, OWNER_LOCKED_ERROR } from '@/lib/admin/locked'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/add  { username, role? }
 * Заносит @ник в testing_whitelist — как ученика (role='student'/по умолчанию,
 * assign_role=null) или как куратора (role='curator', assign_role='curator').
 * Если уже есть — обновляем assign_role и освобождаем слот.
 * Для куратора: если профиль с этим ником уже есть и он ученик — сразу повышаем.
 * Права (canAdd): admin/super_admin → любую роль; city_leader → куратора/ученика
 * (в свой город; ученик — только к куратору своего города); curator → ученика (к себе).
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    username?: string
    role?: string
    cityId?: number | string
    curatorId?: string
  }
  const raw = (body.username ?? '').trim().replace(/^@+/, '').toLowerCase()
  if (!/^[a-z0-9_]{4,32}$/.test(raw)) {
    return NextResponse.json(
      { ok: false, error: 'Ник: 4–32 символа, латиница, цифры, _' },
      { status: 400 },
    )
  }
  const handle = `@${raw}`

  // Целевая роль добавляемого.
  const reqRole = body.role
  const assignRole: 'student' | 'curator' | 'city_leader' =
    reqRole === 'curator' || reqRole === 'city_leader' ? reqRole : 'student'

  // Кто кого может добавлять: admin/super_admin — любого; лидер города — куратора и
  // ученика (не лидера); куратор — только ученика.
  const r = session.role
  const canAdd =
    r === 'admin' || r === 'super_admin'
      ? true
      : r === 'city_leader'
        ? assignRole === 'student' || assignRole === 'curator'
        : r === 'curator'
          ? assignRole === 'student'
          : false
  if (!canAdd) {
    return NextResponse.json(
      { ok: false, error: 'Недостаточно прав для добавления этой роли' },
      { status: 403 },
    )
  }

  // Город и куратор по роли добавляющего.
  let assignedCity: number | null = null
  let assignedCurator: string | null = null
  if (r === 'curator') {
    assignedCurator = session.uid // ученик куратора — сразу к нему
    assignedCity = session.city ?? null
  } else if (r === 'city_leader') {
    assignedCity = session.city ?? null // в город лидера
    if (assignRole === 'student' && body.curatorId) assignedCurator = body.curatorId
  } else {
    // admin/super_admin — задают город/куратора явно
    if (body.cityId != null && body.cityId !== '') assignedCity = Number(body.cityId)
    if (assignRole === 'student' && body.curatorId) assignedCurator = body.curatorId
  }
  if (assignRole === 'city_leader' && assignedCity == null) {
    return NextResponse.json(
      { ok: false, error: 'Для лидера города укажите город' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Замкнутый владельцем профиль: ни менять его роль/город/куратора, ни трогать
  // его whitelist-слот не-владельцу нельзя.
  if ((await ownerLockedHandles(supabase, session.uid, [handle])).length > 0) {
    return NextResponse.json({ ok: false, error: OWNER_LOCKED_ERROR }, { status: 403 })
  }

  // Лидер города не может привязать ученика к куратору ЧУЖОГО города (scope-эскалация
  // через прямой API: body.curatorId не ограничен UI). Куратор обязан быть из его города.
  if (r === 'city_leader' && assignedCurator) {
    const { data: cur } = await supabase
      .from('profiles')
      .select('id, role, city_id')
      .eq('id', assignedCurator)
      .maybeSingle()
    if (!cur || cur.role !== 'curator' || cur.city_id !== session.city) {
      return NextResponse.json(
        { ok: false, error: 'Куратор должен быть из вашего города' },
        { status: 403 },
      )
    }
  }

  // Если профиль уже есть и это ученик — повышаем сразу + ставим город/куратора.
  const profUpdate: Record<string, unknown> = { role: assignRole }
  if (assignedCity != null) profUpdate.city_id = assignedCity
  if (assignedCurator) profUpdate.curator_id = assignedCurator
  await supabase.from('profiles').update(profUpdate).ilike('contact_info', handle).eq('role', 'student')

  // Whitelist: assign_role null=ученик (как было); город/куратор — для применения при входе.
  const wl = {
    assign_role: assignRole === 'student' ? null : assignRole,
    assigned_city_id: assignedCity,
    assigned_curator_id: assignedCurator,
  }
  const roleWord =
    assignRole === 'city_leader' ? 'лидера города' : assignRole === 'curator' ? 'куратора' : 'ученика'
  const notify = () =>
    notifyAdmins(
      supabase,
      `👤 ${escapeHtml(session.name ?? 'Админ')} добавил ${roleWord} ${escapeHtml(handle)} (дашборд)`,
    )

  const { data: existing } = await supabase
    .from('testing_whitelist')
    .select('id')
    .ilike('telegram_username', handle)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('testing_whitelist')
      .update({ claimed_chat_id: null, ...wl })
      .eq('id', (existing as { id: number }).id)
    if (error) {
      console.error('[panel/actions/add] update', error)
      return NextResponse.json({ ok: false, error: 'Не удалось обновить' }, { status: 500 })
    }
    await notify()
    return NextResponse.json({ ok: true, already: true, handle })
  }

  const { error } = await supabase
    .from('testing_whitelist')
    .insert({ telegram_username: handle, added_by: session.uid, ...wl })
  if (error) {
    console.error('[panel/actions/add] insert', error)
    return NextResponse.json({ ok: false, error: 'Не удалось добавить' }, { status: 500 })
  }

  await notify()
  return NextResponse.json({ ok: true, handle })
}
