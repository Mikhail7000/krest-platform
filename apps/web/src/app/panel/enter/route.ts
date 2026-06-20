import { NextRequest, NextResponse } from 'next/server'
import {
  verifySession,
  signSession,
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAXAGE,
} from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

/**
 * GET /panel/enter?token=<signLoginToken>
 * Вход в дашборд по одноразовой ссылке из Telegram-бота (для админов).
 * Проверяет короткоживущий токен → ставит полноценную cookie-сессию → /panel.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const base = req.nextUrl.origin
  const sess = verifySession(token)

  if (!sess) {
    return NextResponse.redirect(`${base}/panel/login`)
  }

  const res = NextResponse.redirect(`${base}/panel`)
  const fresh = signSession({ uid: sess.uid, role: sess.role, name: sess.name })
  res.cookies.set(ADMIN_COOKIE, fresh, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: ADMIN_COOKIE_MAXAGE,
  })
  return res
}
