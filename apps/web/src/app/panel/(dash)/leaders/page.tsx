import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'
import { resolveIsOwner } from '@/lib/admin/owner'
import { LeadersView } from './LeadersView'
import type { LeaderRow } from './types'

export const dynamic = 'force-dynamic'

/**
 * /panel/leaders — лидеры городов: город, число кураторов в городе, смена роли,
 * вход в их панель (view-as), добавление нового лидера. Только admin/super_admin.
 * Данные — через service-role (сервер админа, обход RLS).
 */
export interface PickCurator {
  id: string
  name: string | null
  nick: string | null
  city: string | null
}

async function loadLeaders(): Promise<{
  leaders: LeaderRow[]
  cities: { id: number; name: string }[]
  allCurators: PickCurator[]
}> {
  const supabase = createServiceSupabase()
  const [leadersRes, citiesRes, countriesRes, curatorsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, contact_info, city_id, is_protected').eq('role', 'city_leader'),
    supabase.from('cities').select('id, name_ru, country_id').order('name_ru'),
    supabase.from('countries').select('id, name_ru'),
    supabase.from('profiles').select('id, full_name, contact_info, city_id').eq('role', 'curator'),
  ])

  const countryById = new Map<number, string>()
  for (const c of countriesRes.data ?? []) countryById.set(c.id, c.name_ru)

  const cityById = new Map<number, { name: string; country: string | null }>()
  for (const c of citiesRes.data ?? []) {
    cityById.set(c.id, {
      name: c.name_ru,
      country: c.country_id != null ? countryById.get(c.country_id) ?? null : null,
    })
  }

  // Кураторы по городам — для счётчика и разворота у лидера.
  const curatorsByCity = new Map<number, { id: string; name: string | null; nick: string | null }[]>()
  for (const cu of curatorsRes.data ?? []) {
    if (cu.city_id == null) continue
    const list = curatorsByCity.get(cu.city_id) ?? []
    list.push({ id: cu.id, name: cu.full_name, nick: cu.contact_info })
    curatorsByCity.set(cu.city_id, list)
  }

  const leaders: LeaderRow[] = (leadersRes.data ?? []).map((l) => {
    const city = l.city_id != null ? cityById.get(l.city_id) ?? null : null
    const curators = l.city_id != null ? curatorsByCity.get(l.city_id) ?? [] : []
    return {
      id: l.id,
      name: l.full_name,
      nick: l.contact_info,
      isProtected: !!(l as { is_protected: boolean | null }).is_protected,
      city: city?.name ?? null,
      cityId: l.city_id ?? null,
      country: city?.country ?? null,
      curatorsCount: curators.length,
      curators,
    }
  })
  leaders.sort(
    (a, b) => b.curatorsCount - a.curatorsCount || (a.name ?? '').localeCompare(b.name ?? ''),
  )

  const cities = ((citiesRes.data ?? []) as { id: number; name_ru: string }[]).map((c) => ({
    id: c.id,
    name: c.name_ru,
  }))

  // Все кураторы — для модалки «Привязать кураторов» (с текущим городом).
  const allCurators: PickCurator[] = (
    (curatorsRes.data ?? []) as { id: string; full_name: string | null; contact_info: string | null; city_id: number | null }[]
  )
    .map((cu) => ({
      id: cu.id,
      name: cu.full_name,
      nick: cu.contact_info,
      city: cu.city_id != null ? cityById.get(cu.city_id)?.name ?? null : null,
    }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru'))

  return { leaders, cities, allCurators }
}

export default async function LeadersPage() {
  const session = await getPanelSession()
  const role = session?.role
  // Доступ — только admin/super_admin (куратор и лидер города — 404).
  if (role !== 'admin' && role !== 'super_admin') notFound()

  const isSuperAdmin = role === 'super_admin'
  // View-as доступен реальному админу вне режима view-as.
  const impersonating = !!session?.via
  const realCanViewAs = !impersonating
  const isOwner =
    realCanViewAs && session ? await resolveIsOwner(createServiceSupabase(), session.uid) : false

  const { leaders, cities, allCurators } = await loadLeaders()

  return (
    <div>
      <h1 className="panel-page__title">Лидеры городов</h1>
      <p className="panel-page__subtitle">
        Лидеры городов, их города и кураторы. Добавление, смена роли и вход в их панель.
      </p>

      <div className="panel-grid">
        <div className="panel-stat">
          <span className="panel-stat__label">Лидеров городов</span>
          <span className="panel-stat__value">{leaders.length}</span>
        </div>
      </div>

      <LeadersView
        leaders={leaders}
        cities={cities}
        allCurators={allCurators}
        isSuperAdmin={isSuperAdmin}
        canViewAs={realCanViewAs}
        isOwner={isOwner}
      />
    </div>
  )
}
