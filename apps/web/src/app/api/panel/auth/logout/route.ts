import { NextResponse } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

/** POST /api/panel/auth/logout — снимает cookie-сессию админа. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', httpOnly: true, maxAge: 0 })
  return res
}
