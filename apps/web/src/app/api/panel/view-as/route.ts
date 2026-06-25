import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-service'
import {
  ADMIN_COOKIE,
  VIEW_AS_COOKIE,
  VIEW_AS_MAXAGE,
  signViewAs,
  verifySession,
  type AdminRole,
} from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/view-as  { userId }
 * Включает режим «смотреть как» (view-as): super_admin открывает панель куратора
 * или админа и видит ровно то, что видят они. Реальная сессия (krest_admin) НЕ
 * трогается — ставим отдельную подписанную cookie krest_view_as. Гард применит её
 * только если реальная роль super_admin и `by` совпадает (см. lib/admin/guard.ts).
 * Доступно ТОЛЬКО super_admin. Цель — роль curator/admin, не защищённый владелец.
 */
export async function POST(req: NextRequest) {
  // Реальная сессия (НЕ эффективная) — читаем напрямую из krest_admin.
  const real = verifySession(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!real) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  if (real.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Только для супер-админа' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string }
  const userId = (body.userId ?? '').trim()
  if (!userId) return NextResponse.json({ ok: false, error: 'userId обязателен' }, { status: 400 })
  if (userId === real.uid) {
    return NextResponse.json({ ok: false, error: 'Это вы сами' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_protected')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return NextResponse.json({ ok: false, error: 'Пользователь не найден' }, { status: 404 })
  if (target.is_protected) {
    return NextResponse.json({ ok: false, error: 'Защищённого пользователя нельзя открыть' }, { status: 403 })
  }
  if (target.role !== 'curator' && target.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Открыть можно только панель куратора или админа' },
      { status: 400 },
    )
  }

  const token = signViewAs({
    tuid: target.id,
    trole: target.role as AdminRole,
    tname: target.full_name ?? null,
    by: real.uid,
    byName: real.name ?? null,
  })

  // Аудит (best-effort: не валим запрос, если таблицы ещё нет)
  try {
    await supabase.from('view_as_log').insert({
      actor_id: real.uid,
      target_id: target.id,
      target_role: target.role,
    })
  } catch {
    /* no-op */
  }

  const res = NextResponse.json({ ok: true, name: target.full_name ?? null, role: target.role })
  res.cookies.set(VIEW_AS_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: VIEW_AS_MAXAGE,
  })
  return res
}
