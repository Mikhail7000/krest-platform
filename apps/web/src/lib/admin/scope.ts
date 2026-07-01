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
 * Доступ к КАРТОЧКЕ одного ученика (и её под-ресурсам: фото, сдачи) по scope.
 * Скрытых видит только владелец; лидер города — по city_id ученика ИЛИ по городу
 * его куратора (один доп. запрос). Использовать во всех /api/panel/student/[id]/*.
 */
export async function studentCardAllowed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  scope: PanelScope,
  profile: {
    curator_id?: string | null
    city_id?: number | null
    hidden_from_tracking?: boolean | null
  },
): Promise<boolean> {
  if (profile.hidden_from_tracking && !scope.isOwner) return false
  if (scope.isAdmin) return true
  if (scope.scopeCuratorId) return profile.curator_id === scope.scopeCuratorId
  if (scope.scopeCityId != null) {
    if (profile.city_id === scope.scopeCityId) return true
    if (profile.curator_id) {
      const { data: cur } = await supabase
        .from('profiles')
        .select('city_id')
        .eq('id', profile.curator_id)
        .maybeSingle()
      return (cur as { city_id: number | null } | null)?.city_id === scope.scopeCityId
    }
  }
  return false
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
  // Скрытых (hidden_from_tracking) видит ТОЛЬКО владелец — в любом scope
  // (куратор/лидер города/админ). Иначе скрытый ученик «утекал» лидеру города.
  if (p.hidden_from_tracking && !scope.isOwner) return false
  if (scope.scopeCuratorId) return p.curator_id === scope.scopeCuratorId
  if (scope.scopeCityId != null) {
    return (
      p.city_id === scope.scopeCityId ||
      (!!p.curator_id && !!cityCurators && cityCurators.has(p.curator_id))
    )
  }
  // Сюда доходим только без заданного scope. Для НЕ-админа (scoped роль с
  // неразрешённым scope, напр. city_leader без city) — fail-closed, чтобы не
  // показать всех учеников платформы. Открытая ветка — только для админа/владельца.
  if (!scope.isAdmin) return false
  return scope.isOwner || !p.hidden_from_tracking
}
