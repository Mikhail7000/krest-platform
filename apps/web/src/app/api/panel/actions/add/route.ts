import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/add  { username }
 * Заносит @ник в testing_whitelist как ученика (assign_role=null) — как бот-команда /add.
 * Если уже есть — освобождаем слот (claimed_chat_id=null), чтобы вошёл как впервые.
 * Гард: только admin/super_admin, иначе 401.
 */
export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { username?: string }
  const raw = (body.username ?? '').trim().replace(/^@+/, '').toLowerCase()

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

  if (existing) {
    const { error } = await supabase
      .from('testing_whitelist')
      .update({ claimed_chat_id: null })
      .eq('id', (existing as { id: number }).id)
    if (error) {
      console.error('[panel/actions/add] update', error)
      return NextResponse.json({ ok: false, error: 'Не удалось обновить' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, already: true, handle })
  }

  const { error } = await supabase
    .from('testing_whitelist')
    .insert({ telegram_username: handle, assign_role: null, added_by: session.uid })
  if (error) {
    console.error('[panel/actions/add] insert', error)
    return NextResponse.json({ ok: false, error: 'Не удалось добавить' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, handle })
}
