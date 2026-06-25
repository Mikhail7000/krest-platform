import { NextResponse } from 'next/server'
import { VIEW_AS_COOKIE } from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/view-as/exit — выйти из режима view-as.
 * Просто удаляем cookie-наложение krest_view_as; реальная сессия super_admin
 * (krest_admin) остаётся нетронутой → возвращаемся к себе.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(VIEW_AS_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
