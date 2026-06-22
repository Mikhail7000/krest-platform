import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'
import { CuratorsView } from './CuratorsView'
import type { CuratorRow, CuratorStudent } from './types'

export const dynamic = 'force-dynamic'

/**
 * /panel/curators — кураторы и администраторы платформы: роль, город, страна,
 * число учеников, разворот со списком учеников + смена роли (curator↔admin↔student).
 * Данные через service-role (сервер админа, обход RLS).
 * Кураторы не имеют доступа к этой странице → 404.
 */
async function loadCurators(): Promise<{
  curators: CuratorRow[]
  totalCurators: number
  totalStudents: number
}> {
  const supabase = createServiceSupabase()

  const [curatorsRes, studentsRes, citiesRes, countriesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, city_id, role, is_protected')
      .in('role', ['curator', 'admin']),
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, curator_id')
      .eq('role', 'student')
      .not('curator_id', 'is', null),
    supabase.from('cities').select('id, name_ru, country_id'),
    supabase.from('countries').select('id, name_ru'),
  ])

  if (curatorsRes.error || studentsRes.error || citiesRes.error || countriesRes.error) {
    return { curators: [], totalCurators: 0, totalStudents: 0 }
  }

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
  for (const s of studentsRes.data ?? []) {
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
      country: city?.country ?? null,
      studentsCount: students.length,
      students,
    }
  })

  // Кураторы выше админов (страница про кураторов), внутри — по числу учеников.
  const order = (r: string) => (r === 'curator' ? 0 : 1)
  curators.sort(
    (a, b) =>
      order(a.role) - order(b.role) ||
      b.studentsCount - a.studentsCount ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  )

  const totalCurators = curators.filter((c) => c.role === 'curator').length
  return { curators, totalCurators, totalStudents }
}

export default async function CuratorsPage() {
  const [{ curators, totalCurators, totalStudents }, session] = await Promise.all([
    loadCurators(),
    getPanelSession(),
  ])
  if (session?.role === 'curator') notFound()

  const totalAdmins = curators.filter((c) => c.role === 'admin').length
  const isSuperAdmin = session?.role === 'super_admin'

  return (
    <div>
      <h1 className="panel-page__title">Кураторы</h1>
      <p className="panel-page__subtitle">
        Кураторы и администраторы платформы, их города и ученики. Здесь же — смена роли.
      </p>

      <div className="panel-grid">
        <div className="panel-stat">
          <span className="panel-stat__label">Всего кураторов</span>
          <span className="panel-stat__value">{totalCurators}</span>
        </div>
        <div className="panel-stat">
          <span className="panel-stat__label">Администраторов</span>
          <span className="panel-stat__value">{totalAdmins}</span>
        </div>
        <div className="panel-stat">
          <span className="panel-stat__label">Привязанных учеников</span>
          <span className="panel-stat__value">{totalStudents}</span>
        </div>
      </div>

      <CuratorsView curators={curators} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
