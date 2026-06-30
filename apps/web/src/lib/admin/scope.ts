import { resolveIsOwner } from './owner'
import type { AdminSession } from './session'

/**
 * Видимость в /panel по роли:
 *  - curator     → только свои ученики (scopeCuratorId = его uid)
 *  - city_leader → весь свой город (scopeCityId = его city)
 *  - admin/super_admin → все (isAdmin); владелец (Михаил) дополнительно видит скрытых
 *
 * Использовать в read-роутах вместо разрозненных проверок роли.
 */

export interface PanelScope {
  scopeCuratorId: string | null
  scopeCityId: number | null
  isOwner: boolean
  isAdmin: boolean
}

export async function resolvePanelScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  session: AdminSession,
): Promise<PanelScope> {
  if (session.role === 'curator') {
    return { scopeCuratorId: session.uid, scopeCityId: null, isOwner: false, isAdmin: false }
  }
  if (session.role === 'city_leader') {
    return { scopeCuratorId: null, scopeCityId: session.city ?? null, isOwner: false, isAdmin: false }
  }
  const isOwner = await resolveIsOwner(supabase, session.uid)
  return { scopeCuratorId: null, scopeCityId: null, isOwner, isAdmin: true }
}

/** Множество id кураторов/лидеров города (для scope лидера города). */
export function cityCuratorIds(
  profiles: Array<{ id: string; role: string | null; city_id: number | null }>,
  cityId: number,
): Set<string> {
  const ids = new Set<string>()
  for (const p of profiles) {
    if ((p.role === 'curator' || p.role === 'city_leader') && p.city_id === cityId) ids.add(p.id)
  }
  return ids
}

/**
 * Виден ли этот ученик/профиль в текущем scope.
 * cityCurators — id кураторов города (нужно только для city-scope; иначе null).
 */
export function studentInScope(
  p: { curator_id?: string | null; city_id?: number | null; hidden_from_tracking?: boolean | null },
  scope: PanelScope,
  cityCurators: Set<string> | null,
): boolean {
  if (scope.scopeCuratorId) return p.curator_id === scope.scopeCuratorId
  if (scope.scopeCityId != null) {
    return (
      p.city_id === scope.scopeCityId ||
      (!!p.curator_id && !!cityCurators && cityCurators.has(p.curator_id))
    )
  }
  return scope.isOwner || !p.hidden_from_tracking
}
