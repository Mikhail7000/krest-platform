import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/transfer  { userId, curatorId }
 * Прикрепление ученика к куратору (или отвязка при curatorId=null/'').
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    curatorId?: string | null
  }
  const userId = body.userId?.trim()
  const curatorId = body.curatorId ? body.curatorId.trim() : null

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Не указан ученик' }, { status: 400 })
  }
  if (curatorId && curatorId === userId) {
    return NextResponse.json(
      { ok: false, error: 'Ученик не может быть своим куратором' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }

  // Проверяем, что новый куратор существует и имеет подходящую роль.
  if (curatorId) {
    const { data: cur } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', curatorId)
      .maybeSingle()
    if (!cur) {
      return NextResponse.json({ ok: false, error: 'Куратор не найден' }, { status: 404 })
    }
    if (!['curator', 'admin', 'super_admin'].includes(cur.role)) {
      return NextResponse.json(
        { ok: false, error: 'Выбранный пользователь не куратор' },
        { status: 400 },
      )
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ curator_id: curatorId })
    .eq('id', userId)
  if (error) {
    console.error('[panel/actions/transfer]', error)
    return NextResponse.json({ ok: false, error: 'Не удалось назначить куратора' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
