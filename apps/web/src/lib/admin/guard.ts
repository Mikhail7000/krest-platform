import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifySession, type AdminSession } from './session'

/**
 * Серверный гард для дашборда /panel.
 *  - getPanelSession(): для Server Components (через cookies()).
 *  - getPanelSessionFromReq(req): для route handlers (через req.cookies).
 * Возвращает сессию админа или null.
 */

export async function getPanelSession(): Promise<AdminSession | null> {
  const store = await cookies()
  return verifySession(store.get(ADMIN_COOKIE)?.value)
}

export function getPanelSessionFromReq(req: NextRequest): AdminSession | null {
  return verifySession(req.cookies.get(ADMIN_COOKIE)?.value)
}
