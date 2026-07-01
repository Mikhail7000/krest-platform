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
 * Включает режим «смотреть как» (view-as): admin/super_admin открывает панель
 * куратора/лидера города (super_admin — также админа) и видит ровно то, что видят
 * они. Реальная сессия (krest_admin) НЕ трогается — ставим отдельную подписанную
 * cookie krest_view_as. Гард применит её только если реальная роль admin/super_admin
 * и `by` совпадает (см. lib/admin/guard.ts).
 *
 * Правила цели (защищённого владельца нельзя открыть никому):
 *  - super_admin → curator / city_leader / admin;
 *  - admin       → curator / city_leader (не админа и не супер-админа — без эскалации).
 */
export async function POST(req: NextRequest) {
  // Реальная сессия (НЕ эффективная) — читаем напрямую из krest_admin.
  const real = verifySession(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!real) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Роль актора — из БД, не из cookie: разжалованный admin не должен включать
  // view-as до истечения cookie (7 дней).
  const { data: actorRow } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', real.uid)
    .maybeSingle()
  const actorRole = (actorRow as { role: string } | null)?.role ?? null
  if (actorRole !== 'super_admin' && actorRole !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Только для админа' }, { status: 403 })
  }
  real.role = actorRole as AdminRole

  const body = (await req.json().catch(() => ({}))) as { userId?: string }
  const userId = (body.userId ?? '').trim()
  if (!userId) return NextResponse.json({ ok: false, error: 'userId обязателен' }, { status: 400 })
  if (userId === real.uid) {
    return NextResponse.json({ ok: false, error: 'Это вы сами' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_protected, city_id')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return NextResponse.json({ ok: false, error: 'Пользователь не найден' }, { status: 404 })
  if (target.is_protected) {
    return NextResponse.json({ ok: false, error: 'Защищённого пользователя нельзя открыть' }, { status: 403 })
  }
  // Кого можно открыть: super_admin — куратора/лидера/админа; admin — только
  // куратора/лидера (никогда другого админа или супер-админа — защита от эскалации).
  const allowedTargets =
    real.role === 'super_admin'
      ? ['curator', 'city_leader', 'admin']
      : ['curator', 'city_leader']
  if (!allowedTargets.includes(target.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          real.role === 'super_admin'
            ? 'Открыть можно панель куратора, лидера города или админа'
            : 'Открыть можно только панель куратора или лидера города',
      },
      { status: 400 },
    )
  }

  const token = signViewAs({
    tuid: target.id,
    trole: target.role as AdminRole,
    tname: target.full_name ?? null,
    tcity: target.city_id ?? null,
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
