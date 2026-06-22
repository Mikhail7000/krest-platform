import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/add  { username, role? }
 * Заносит @ник в testing_whitelist — как ученика (role='student'/по умолчанию,
 * assign_role=null) или как куратора (role='curator', assign_role='curator').
 * Если уже есть — обновляем assign_role и освобождаем слот.
 * Для куратора: если профиль с этим ником уже есть и он ученик — сразу повышаем.
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  if (session.role === 'curator') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { username?: string; role?: string }
  const raw = (body.username ?? '').trim().replace(/^@+/, '').toLowerCase()
  const assignRole = body.role === 'curator' ? 'curator' : null

  if (!/^[a-z0-9_]{4,32}$/.test(raw)) {
    return NextResponse.json(
      { ok: false, error: 'Ник: 4–32 символа, латиница, цифры, _' },
      { status: 400 },
    )
  }
  const handle = `@${raw}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: existing } = await supabase
    .from('testing_whitelist')
    .select('id')
    .ilike('telegram_username', handle)
    .maybeSingle()

  // Для куратора: если профиль уже есть и он ученик — сразу повышаем до куратора
  if (assignRole === 'curator') {
    await supabase.from('profiles').update({ role: 'curator' }).ilike('contact_info', handle).eq('role', 'student')
  }

  const roleWord = assignRole === 'curator' ? 'куратора' : 'ученика'
  const notify = () =>
    notifyAdmins(supabase, `👤 ${escapeHtml(session.name ?? 'Админ')} добавил ${roleWord} ${escapeHtml(handle)} (дашборд)`)

  if (existing) {
    const { error } = await supabase
      .from('testing_whitelist')
      .update({ claimed_chat_id: null, assign_role: assignRole })
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
    .insert({ telegram_username: handle, assign_role: assignRole, added_by: session.uid })
  if (error) {
    console.error('[panel/actions/add] insert', error)
    return NextResponse.json({ ok: false, error: 'Не удалось добавить' }, { status: 500 })
  }

  await notify()
  return NextResponse.json({ ok: true, handle })
}
