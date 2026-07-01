import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'
import { resolveIsOwner } from '@/lib/admin/owner'
import { CuratorsView } from './CuratorsView'
import type { CuratorRow, CuratorStudent, LeaderPick } from './types'

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
  leaders: LeaderPick[]
  totalCurators: number
  totalLeaders: number
  totalAdmins: number
  totalStudents: number
}> {
  const supabase = createServiceSupabase()
  const empty = { curators: [], leaders: [], totalCurators: 0, totalLeaders: 0, totalAdmins: 0, totalStudents: 0 }

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

  const [curatorsRes, citiesRes, countriesRes, leadersRes, closedRes] = await Promise.all([
    curatorsQuery,
    supabase.from('cities').select('id, name_ru, country_id, timezone'),
    supabase.from('countries').select('id, name_ru'),
    supabase.from('profiles').select('id, full_name, contact_info, city_id').eq('role', 'city_leader'),
    supabase.rpc('closed_dates_all'),
  ])
  if (curatorsRes.error || citiesRes.error || countriesRes.error) return empty

  const leadersData = (leadersRes.data ?? []) as {
    id: string
    full_name: string | null
    contact_info: string | null
    city_id: number | null
  }[]

  // Лидер города по городу (если в городе несколько — через запятую).
  const leaderByCity = new Map<number, string>()
  for (const l of leadersData) {
    if (l.city_id == null) continue
    const nm = l.full_name || l.contact_info || 'Лидер'
    leaderByCity.set(l.city_id, leaderByCity.has(l.city_id) ? `${leaderByCity.get(l.city_id)}, ${nm}` : nm)
  }

  const curatorIds = (curatorsRes.data ?? []).map((c) => c.id)
  // Ученики, привязанные к этим кураторам (для leader-scope — только город).
  const { data: studentsData } =
    curatorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, contact_info, curator_id, city_id, course_started_at')
          .eq('role', 'student')
          .in('curator_id', curatorIds)
      : {
          data: [] as {
            id: string
            full_name: string | null
            contact_info: string | null
            curator_id: string | null
            city_id: number | null
            course_started_at: string | null
          }[],
        }

  // Активность за сегодня (по локальному дню ученика — activity_date уже локальная).
  const studentIds = (studentsData ?? []).map((s) => s.id)
  const { data: actData } =
    studentIds.length > 0
      ? await supabase
          .from('student_daily_activity')
          .select('user_id, activity_date')
          .eq('opened', true)
          .gte('activity_date', new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10))
          .in('user_id', studentIds)
      : { data: [] as { user_id: string; activity_date: string }[] }

  const countryById = new Map<number, string>()
  for (const c of countriesRes.data ?? []) countryById.set(c.id, c.name_ru)

  const cityById = new Map<number, { name: string; country: string | null; tz: string | null }>()
  for (const c of citiesRes.data ?? []) {
    cityById.set(c.id, {
      name: c.name_ru,
      country: c.country_id != null ? countryById.get(c.country_id) ?? null : null,
      tz: (c as { timezone?: string | null }).timezone ?? null,
    })
  }

  // ── Метрики групп: активны сегодня / закрытые дни за 7 суток / застряли ──
  const DEFAULT_TZ = 'Asia/Makassar'
  const todayByTz = new Map<string, string>()
  const localToday = (tz: string) => {
    let d = todayByTz.get(tz)
    if (!d) {
      d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      todayByTz.set(tz, d)
    }
    return d
  }
  const dayIdx = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000)
  const todayIdx = Math.floor(Date.now() / 86_400_000)
  const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)

  const closedByUser = new Map<string, string[]>()
  for (const r of (closedRes.data ?? []) as { user_id: string; d: string }[]) {
    if (r.d.startsWith('2000-')) continue // виртуальные тест-даты accel-режима
    const arr = closedByUser.get(r.user_id) ?? []
    arr.push(r.d)
    closedByUser.set(r.user_id, arr)
  }
  const actByUser = new Map<string, Set<string>>()
  for (const a of (actData ?? []) as { user_id: string; activity_date: string }[]) {
    const set = actByUser.get(a.user_id) ?? new Set<string>()
    set.add(a.activity_date)
    actByUser.set(a.user_id, set)
  }

  const studentsByCurator = new Map<string, CuratorStudent[]>()
  const metrics = new Map<string, { activeToday: number; closed7: number; stuck: number }>()
  let totalStudents = 0
  for (const s of studentsData ?? []) {
    if (!s.curator_id) continue
    const list = studentsByCurator.get(s.curator_id) ?? []
    list.push({ id: s.id, name: s.full_name, nick: s.contact_info })
    studentsByCurator.set(s.curator_id, list)
    totalStudents += 1

    const m = metrics.get(s.curator_id) ?? { activeToday: 0, closed7: 0, stuck: 0 }
    const tz = (s.city_id != null ? cityById.get(s.city_id)?.tz : null) ?? DEFAULT_TZ
    if (actByUser.get(s.id)?.has(localToday(tz))) m.activeToday++
    const dates = closedByUser.get(s.id) ?? []
    m.closed7 += dates.filter((d) => d >= weekAgo).length
    const lastIdx = dates.length > 0 ? Math.max(...dates.map(dayIdx)) : null
    if (lastIdx === null ? !!s.course_started_at : todayIdx - lastIdx > 3) m.stuck++
    metrics.set(s.curator_id, m)
  }

  const curators: CuratorRow[] = (curatorsRes.data ?? []).map((cu) => {
    const city = cu.city_id != null ? cityById.get(cu.city_id) ?? null : null
    const students = studentsByCurator.get(cu.id) ?? []
    const m = metrics.get(cu.id) ?? { activeToday: 0, closed7: 0, stuck: 0 }
    return {
      activeToday: m.activeToday,
      closed7: m.closed7,
      stuck: m.stuck,
      id: cu.id,
      name: cu.full_name,
      nick: cu.contact_info,
      role: (cu as { role: string }).role,
      isProtected: !!(cu as { is_protected: boolean | null }).is_protected,
      city: city?.name ?? null,
      cityId: cu.city_id ?? null,
      country: city?.country ?? null,
      leaderName:
        (cu as { role: string }).role === 'curator' && cu.city_id != null
          ? leaderByCity.get(cu.city_id) ?? null
          : null,
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

  // Лидеры с городом — для пикера «Назначить лидера» у куратора.
  const leaderPicks: LeaderPick[] = leadersData
    .filter((l) => l.city_id != null)
    .map((l) => ({
      id: l.id,
      name: l.full_name || l.contact_info || 'Лидер',
      cityId: l.city_id as number,
      city: cityById.get(l.city_id as number)?.name ?? null,
    }))

  return {
    curators,
    leaders: leaderPicks,
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

  const { curators, leaders, totalCurators, totalAdmins, totalStudents } = await loadCurators({
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
        leaders={leaders}
      />
    </div>
  )
}
