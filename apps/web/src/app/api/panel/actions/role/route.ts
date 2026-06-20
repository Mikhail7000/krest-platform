import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['student', 'curator', 'admin'] as const
type Role = (typeof ALLOWED_ROLES)[number]

/**
 * POST /api/panel/actions/role  { userId, role }
 * Смена роли ученика: student | curator | admin.
 * Защищённого пользователя (is_protected) менять нельзя → 403.
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string; role?: string }
  const userId = body.userId?.trim()
  const role = body.role?.trim() as Role | undefined

  if (!userId || !role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: 'Неверные параметры' }, { status: 400 })
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

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) {
    console.error('[panel/actions/role]', error)
    return NextResponse.json({ ok: false, error: 'Не удалось сменить роль' }, { status: 500 })
  }

  const roleLabel = role === 'curator' ? 'куратор' : role === 'admin' ? 'админ' : 'ученик'
  const who = target.full_name || target.contact_info || 'пользователь'
  await notifyAdmins(supabase, `🔧 ${session.name ?? 'Админ'} сменил роль: ${who} → ${roleLabel}`)

  return NextResponse.json({ ok: true })
}
