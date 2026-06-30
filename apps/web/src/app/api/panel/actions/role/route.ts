import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['student', 'curator', 'admin'] as const
type Role = (typeof ALLOWED_ROLES)[number]

/**
 * POST /api/panel/actions/role  { userId, role }
 * Смена роли: student | curator | admin.
 *  - is_protected и super_admin менять нельзя → 403.
 *  - Свою роль менять нельзя → 400 (защита от самоблокировки).
 *  - Управлять админ-уровнем (target=admin ИЛИ role=admin) — только super_admin → 403.
 *  - При понижении до ученика — отвязываем его учеников (curator_id → null).
 *  - Любая смена пишется в role_change_log (audit, по спеке).
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }
  // Менять роли может только admin/super_admin (куратор и лидер города — нет).
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string; role?: string }
  const userId = body.userId?.trim()
  const role = body.role?.trim() as Role | undefined

  if (!userId || !role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: 'Неверные параметры' }, { status: 400 })
  }
  if (userId === session.uid) {
    return NextResponse.json(
      { ok: false, error: 'Нельзя сменить собственную роль' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: target } = await supabase
    .from('profiles')
    .select('id, is_protected, role, full_name, contact_info')
    .eq('id', userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ ok: false, error: 'Пользователь не найден' }, { status: 404 })
  }
  if (target.is_protected) {
    return NextResponse.json(
      { ok: false, error: 'Этот пользователь защищён от изменений' },
      { status: 403 },
    )
  }
  if (target.role === 'super_admin') {
    return NextResponse.json(
      { ok: false, error: 'Нельзя менять роль супер-админа здесь' },
      { status: 403 },
    )
  }
  // Админ-уровнем (назначить админа или менять админа) управляет только супер-админ.
  if ((target.role === 'admin' || role === 'admin') && session.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, error: 'Только супер-админ может управлять администраторами' },
      { status: 403 },
    )
  }

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) {
    console.error('[panel/actions/role]', error)
    return NextResponse.json({ ok: false, error: 'Не удалось сменить роль' }, { status: 500 })
  }

  // Понижение до ученика — отвязываем его учеников, чтобы не осталось «висящих» curator_id.
  if (role === 'student' && target.role !== 'student') {
    await supabase.from('profiles').update({ curator_id: null }).eq('curator_id', userId)
    await supabase
      .from('testing_whitelist')
      .update({ assigned_curator_id: null })
      .eq('assigned_curator_id', userId)
  }

  // Аудит (по спеке: все изменения роли → role_change_log). changed_by = id админа.
  if (target.role !== role) {
    const { error: logErr } = await supabase.from('role_change_log').insert({
      changed_user_id: userId,
      old_role: target.role,
      new_role: role,
      changed_by: session.uid,
      reason: 'panel:actions/role',
    })
    if (logErr) console.error('[panel/actions/role] audit', logErr)
  }

  const roleLabel = role === 'curator' ? 'куратор' : role === 'admin' ? 'админ' : 'ученик'
  const who = target.full_name || target.contact_info || 'пользователь'
  await notifyAdmins(supabase, `🔧 ${escapeHtml(session.name ?? 'Админ')} сменил роль: ${escapeHtml(who)} → ${roleLabel}`)

  return NextResponse.json({ ok: true })
}
