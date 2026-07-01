import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-service'
import {
  ADMIN_COOKIE,
  VIEW_AS_COOKIE,
  verifySession,
  verifyViewAs,
  type AdminRole,
  type AdminSession,
} from './session'

/**
 * Серверный гард для дашборда /panel.
 *  - getPanelSession(): для Server Components (через cookies()).
 *  - getPanelSessionFromReq(req): для route handlers (через req.cookies).
 * Возвращает эффективную сессию (с учётом view-as) или null.
 *
 * Роль и город РЕАЛЬНОЙ сессии сверяются с БД на каждый запрос: разжалованный
 * или удалённый сотрудник теряет доступ сразу, а не по истечении cookie (7 дней);
 * смена роли/города подхватывается без перелогина. Cookie остаётся только
 * доказательством личности (uid), а не источником прав.
 */

const PANEL_ROLES: readonly AdminRole[] = ['super_admin', 'admin', 'city_leader', 'curator']

async function refreshFromDb(real: AdminSession): Promise<AdminSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const { data } = (await supabase
    .from('profiles')
    .select('role, city_id')
    .eq('id', real.uid)
    .maybeSingle()) as { data: { role: string | null; city_id: number | null } | null }
  const role = data?.role ?? null
  if (!role || !(PANEL_ROLES as readonly string[]).includes(role)) return null
  const city = data?.city_id ?? null
  if (role === real.role && city === (real.city ?? null)) return real
  return { ...real, role: role as AdminRole, city }
}

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
  const fresh = await refreshFromDb(real)
  if (!fresh) return null
  return applyViewAs(fresh, store.get(VIEW_AS_COOKIE)?.value)
}

export async function getPanelSessionFromReq(req: NextRequest): Promise<AdminSession | null> {
  const real = verifySession(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!real) return null
  const fresh = await refreshFromDb(real)
  if (!fresh) return null
  return applyViewAs(fresh, req.cookies.get(VIEW_AS_COOKIE)?.value)
}
