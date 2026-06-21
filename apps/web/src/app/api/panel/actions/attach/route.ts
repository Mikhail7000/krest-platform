import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { parseHandles, attachStudentsToCurator } from '@/lib/access/attach'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/attach  { curatorId: string, usernames: string }
 * Массово привязывает учеников (по никам Telegram) к куратору.
 *  - Если профиль уже существует → сразу ставим curator_id.
 *  - Если нет → слот в testing_whitelist, привяжется при входе.
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    curatorId?: string
    usernames?: string
  }

  const curatorId = body.curatorId?.trim()
  const rawUsernames = body.usernames ?? ''

  if (!curatorId) {
    return NextResponse.json({ ok: false, error: 'Не указан curatorId' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Проверяем, что curatorId существует и имеет подходящую роль
  const { data: curator } = await supabase
    .from('profiles')
    .select('id, role, full_name, contact_info')
    .eq('id', curatorId)
    .maybeSingle()

  if (!curator) {
    return NextResponse.json({ ok: false, error: 'Куратор не найден' }, { status: 400 })
  }

  const curatorRole = (curator as { role: string }).role
  if (!['curator', 'admin', 'super_admin'].includes(curatorRole)) {
    return NextResponse.json(
      { ok: false, error: 'Пользователь не является куратором' },
      { status: 400 },
    )
  }

  const handles = parseHandles(rawUsernames)
  if (handles.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Не найдено ни одного корректного ника (мин. 4 символа, латиница)' },
      { status: 400 },
    )
  }

  const { attached, pending } = await attachStudentsToCurator(
    supabase,
    curatorId,
    handles,
    session.uid,
  )

  const total = attached.length + pending.length
  const curatorLabel =
    (curator as { full_name?: string | null; contact_info?: string | null }).full_name ||
    (curator as { full_name?: string | null; contact_info?: string | null }).contact_info ||
    curatorId

  await notifyAdmins(
    supabase,
    `🔗 ${session.name ?? 'Админ'} привязал учеников к куратору ${curatorLabel} (${total})`,
  )

  return NextResponse.json({ ok: true, attached, pending })
}
