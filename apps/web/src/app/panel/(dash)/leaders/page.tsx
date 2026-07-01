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

  // Ожидающие входа: добавлены в whitelist как city_leader, но ещё не заходили
  // (claimed_chat_id пуст) и профиля-лидера с таким ником ещё нет.
  const activeHandles = new Set(leaders.map((l) => (l.nick ?? '').toLowerCase()))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingWl } = await (supabase as any)
    .from('testing_whitelist')
    .select('telegram_username, assigned_city_id')
    .eq('assign_role', 'city_leader')
    .is('claimed_chat_id', null)
  const pending: LeaderRow[] = ((pendingWl ?? []) as { telegram_username: string; assigned_city_id: number | null }[])
    .filter((w) => !activeHandles.has((w.telegram_username ?? '').toLowerCase()))
    .map((w) => {
      const city = w.assigned_city_id != null ? cityById.get(w.assigned_city_id) ?? null : null
      return {
        id: `pending:${w.telegram_username}`,
        name: null,
        nick: w.telegram_username,
        isProtected: false,
        city: city?.name ?? null,
        cityId: w.assigned_city_id ?? null,
        country: city?.country ?? null,
        curatorsCount: 0,
        curators: [],
        pending: true,
      }
    })
    .sort((a, b) => (a.nick ?? '').localeCompare(b.nick ?? ''))
  leaders.push(...pending)

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
          <span className="panel-stat__value">{leaders.filter((l) => !l.pending).length}</span>
          {leaders.some((l) => l.pending) ? (
            <span className="panel-stat__hint">
              +{leaders.filter((l) => l.pending).length} ждут первого входа
            </span>
          ) : null}
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
