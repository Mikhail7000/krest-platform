import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import {
  ADMIN_COOKIE,
  VIEW_AS_COOKIE,
  verifySession,
  verifyViewAs,
  type AdminSession,
} from './session'

/**
 * Серверный гард для дашборда /panel.
 *  - getPanelSession(): для Server Components (через cookies()).
 *  - getPanelSessionFromReq(req): для route handlers (через req.cookies).
 * Возвращает эффективную сессию (с учётом view-as) или null.
 */

/**
 * Накладывает view-as поверх реальной сессии. Применяется ТОЛЬКО если реальная
 * роль = super_admin или admin, view-as токен подписан и его `by` совпадает с
 * реальным uid. Иначе возвращает реальную сессию без изменений (защита от подделки).
 *
 * Эскалация прав исключена: admin может «смотреть как» только scoped-роли
 * (curator/city_leader) — никогда как admin/super_admin. super_admin — как любого,
 * кого выдал роут view-as (curator/city_leader/admin). Токен подписан сервером, но
 * проверку дублируем здесь (defense in depth).
 */
function applyViewAs(real: AdminSession, vaToken: string | undefined): AdminSession {
  if ((real.role !== 'super_admin' && real.role !== 'admin') || !vaToken) return real
  const va = verifyViewAs(vaToken)
  if (!va || va.by !== real.uid) return real
  if (real.role === 'admin' && va.trole !== 'curator' && va.trole !== 'city_leader') return real
  return {
    uid: va.tuid,
    role: va.trole,
    name: va.tname,
    city: va.tcity ?? null,
    exp: real.exp,
    via: real.uid,
    viaName: real.name,
  }
}

export async function getPanelSession(): Promise<AdminSession | null> {
  const store = await cookies()
  const real = verifySession(store.get(ADMIN_COOKIE)?.value)
  if (!real) return null
  return applyViewAs(real, store.get(VIEW_AS_COOKIE)?.value)
}

export function getPanelSessionFromReq(req: NextRequest): AdminSession | null {
  const real = verifySession(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!real) return null
  return applyViewAs(real, req.cookies.get(VIEW_AS_COOKIE)?.value)
}
