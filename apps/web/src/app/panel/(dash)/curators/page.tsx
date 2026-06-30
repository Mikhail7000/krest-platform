import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'
import { resolveIsOwner } from '@/lib/admin/owner'
import { CuratorsView } from './CuratorsView'
import type { CuratorRow, CuratorStudent } from './types'

export const dynamic = 'force-dynamic'

/**
 * /panel/curators — кураторы платформы: роль, город, страна, число учеников, разворот
 * со списком учеников + (для админов) смена роли / привязка / view-as / перепривязка.
 *  - admin/super_admin — все кураторы, лидеры городов и админы.
 *  - city_leader — только кураторы его города + их ученики (read-only обзор + добавление).
 *  - curator — нет доступа (404).
 * Данные через service-role (сервер админа, обход RLS).
 */
async function loadCurators(opts: { leaderScoped: boolean; cityId: number | null }): Promise<{
  curators: CuratorRow[]
  totalCurators: number
  totalLeaders: number
  totalAdmins: number
  totalStudents: number
}> {
  const supabase = createServiceSupabase()
  const empty = { curators: [], totalCurators: 0, totalLeaders: 0, totalAdmins: 0, totalStudents: 0 }

  // Лидер города видит только кураторов своего города; админ — кураторов и админов
  // (лидеры городов — на отдельной странице /panel/leaders).
  const wantedRoles = opts.leaderScoped ? ['curator'] : ['curator', 'admin']
  let curatorsQuery = supabase
    .from('profiles')
    .select('id, full_name, contact_info, city_id, role, is_protected')
    .in('role', wantedRoles)
  if (opts.leaderScoped) {
    if (opts.cityId == null) return empty
    curatorsQuery = curatorsQuery.eq('city_id', opts.cityId)
  }

  const [curatorsRes, citiesRes, countriesRes] = await Promise.all([
    curatorsQuery,
    supabase.from('cities').select('id, name_ru, country_id'),
    supabase.from('countries').select('id, name_ru'),
  ])
  if (curatorsRes.error || citiesRes.error || countriesRes.error) return empty

  const curatorIds = (curatorsRes.data ?? []).map((c) => c.id)
  // Ученики, привязанные к этим кураторам (для leader-scope — только город).
  const { data: studentsData } =
    curatorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, contact_info, curator_id')
          .eq('role', 'student')
          .in('curator_id', curatorIds)
      : { data: [] as { id: string; full_name: string | null; contact_info: string | null; curator_id: string | null }[] }

  const countryById = new Map<number, string>()
  for (const c of countriesRes.data ?? []) countryById.set(c.id, c.name_ru)

  const cityById = new Map<number, { name: string; country: string | null }>()
  for (const c of citiesRes.data ?? []) {
    cityById.set(c.id, {
      name: c.name_ru,
      country: c.country_id != null ? countryById.get(c.country_id) ?? null : null,
    })
  }

  const studentsByCurator = new Map<string, CuratorStudent[]>()
  let totalStudents = 0
  for (const s of studentsData ?? []) {
    if (!s.curator_id) continue
    const list = studentsByCurator.get(s.curator_id) ?? []
    list.push({ id: s.id, name: s.full_name, nick: s.contact_info })
    studentsByCurator.set(s.curator_id, list)
    totalStudents += 1
  }

  const curators: CuratorRow[] = (curatorsRes.data ?? []).map((cu) => {
    const city = cu.city_id != null ? cityById.get(cu.city_id) ?? null : null
    const students = studentsByCurator.get(cu.id) ?? []
    return {
      id: cu.id,
      name: cu.full_name,
      nick: cu.contact_info,
      role: (cu as { role: string }).role,
      isProtected: !!(cu as { is_protected: boolean | null }).is_protected,
      city: city?.name ?? null,
      cityId: cu.city_id ?? null,
      country: city?.country ?? null,
      studentsCount: students.length,
      students,
    }
  })

  // Порядок: кураторы → лидеры городов → админы; внутри — по числу учеников.
  const order = (r: string) => (r === 'curator' ? 0 : r === 'city_leader' ? 1 : 2)
  curators.sort(
    (a, b) =>
      order(a.role) - order(b.role) ||
      b.studentsCount - a.studentsCount ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  )

  return {
    curators,
    totalCurators: curators.filter((c) => c.role === 'curator').length,
    totalLeaders: curators.filter((c) => c.role === 'city_leader').length,
    totalAdmins: curators.filter((c) => c.role === 'admin').length,
    totalStudents,
  }
}

export default async function CuratorsPage() {
  const session = await getPanelSession()
  const role = session?.role
  // Доступ: admin/super_admin (все) и city_leader (свой город). Куратор — 404.
  if (role !== 'admin' && role !== 'super_admin' && role !== 'city_leader') notFound()

  const isLeader = role === 'city_leader'
  const canManage = role === 'admin' || role === 'super_admin'
  const isSuperAdmin = role === 'super_admin'

  // View-as доступен только реальному админу/владельцу и только когда он НЕ внутри
  // режима view-as (session.via пуст). Внутри view-as — никакого вложенного входа.
  const impersonating = !!session?.via
  const realCanViewAs = !impersonating && canManage
  const isOwner =
    realCanViewAs && session ? await resolveIsOwner(createServiceSupabase(), session.uid) : false

  const { curators, totalCurators, totalAdmins, totalStudents } = await loadCurators({
    leaderScoped: isLeader,
    cityId: session?.city ?? null,
  })

  // Города нужны админу для выбора при добавлении куратора/лидера.
  let cities: { id: number; name: string }[] = []
  if (canManage) {
    const { data } = await createServiceSupabase()
      .from('cities')
      .select('id, name_ru')
      .order('name_ru')
    cities = ((data ?? []) as { id: number; name_ru: string }[]).map((c) => ({
      id: c.id,
      name: c.name_ru,
    }))
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="panel-page__title">Кураторы</h1>
          <p className="panel-page__subtitle">
            {isLeader
              ? 'Кураторы вашего города и их ученики.'
              : 'Кураторы и администраторы — города, ученики, смена роли и доступ. Лидеры городов — на отдельной странице.'}
          </p>
        </div>
        {canManage ? (
          <Link href="/panel/curators/reassign" className="panel-btn">
            ⇄ Перепривязка по городам
          </Link>
        ) : null}
      </div>

      <div className="panel-grid">
        <div className="panel-stat">
          <span className="panel-stat__label">Всего кураторов</span>
          <span className="panel-stat__value">{totalCurators}</span>
        </div>
        {!isLeader ? (
          <div className="panel-stat">
            <span className="panel-stat__label">Администраторов</span>
            <span className="panel-stat__value">{totalAdmins}</span>
          </div>
        ) : null}
        <div className="panel-stat">
          <span className="panel-stat__label">
            {isLeader ? 'Учеников у кураторов' : 'Привязанных учеников'}
          </span>
          <span className="panel-stat__value">{totalStudents}</span>
        </div>
      </div>

      <CuratorsView
        curators={curators}
        canManage={canManage}
        isSuperAdmin={isSuperAdmin}
        canViewAs={realCanViewAs}
        isOwner={isOwner}
        cities={cities}
      />
    </div>
  )
}
