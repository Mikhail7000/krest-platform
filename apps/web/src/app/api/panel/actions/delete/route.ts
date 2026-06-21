import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { notifyAdmins } from '@/lib/telegram/admin-recipients'
import { escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/delete  { userId }
 * Полное удаление ученика: снимаем блокирующие NO-ACTION ссылки → удаляем профиль
 * → удаляем auth-пользователя. Защищённого (is_protected) удалять нельзя → 403.
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string }
  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Не указан ученик' }, { status: 400 })
  }
  if (userId === session.uid) {
    return NextResponse.json({ ok: false, error: 'Нельзя удалить себя' }, { status: 400 })
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
      { ok: false, error: 'Этот пользователь защищён от удаления' },
      { status: 403 },
    )
  }
  if (target.role === 'super_admin') {
    return NextResponse.json(
      { ok: false, error: 'Нельзя удалить супер-админа здесь' },
      { status: 403 },
    )
  }

  // Снимаем NO-ACTION ссылки, которые могут заблокировать удаление профиля.
  // (CASCADE / SET NULL Postgres снимет сам.)
  try {
    await supabase.from('profiles').update({ curator_id: null }).eq('curator_id', userId)
  } catch (e) {
    console.error('[panel/actions/delete] detach students', e)
  }

  // Удаляем auth-пользователя — каскад снимет профиль и дочерние строки.
  let authDeleted = false
  try {
    const res = await supabase.auth.admin.deleteUser(userId)
    if (res?.error) {
      console.error('[panel/actions/delete] auth.deleteUser', res.error)
    } else {
      authDeleted = true
    }
  } catch (e) {
    console.error('[panel/actions/delete] auth.deleteUser threw', e)
  }

  // На случай если профиль не привязан к auth-пользователю — удаляем явно.
  const { error: delErr } = await supabase.from('profiles').delete().eq('id', userId)
  if (delErr && !authDeleted) {
    console.error('[panel/actions/delete] profiles.delete', delErr)
    return NextResponse.json(
      { ok: false, error: 'Не удалось удалить пользователя' },
      { status: 500 },
    )
  }

  const who = target.full_name || target.contact_info || 'пользователь'
  await notifyAdmins(supabase, `🗑 ${escapeHtml(session.name ?? 'Админ')} удалил: ${escapeHtml(who)}`)

  return NextResponse.json({ ok: true })
}
