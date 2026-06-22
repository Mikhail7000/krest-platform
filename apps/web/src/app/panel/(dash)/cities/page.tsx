import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'
import { CitiesView } from './CitiesView'

export const dynamic = 'force-dynamic'

type CityStatus = 'active' | 'coming_soon' | 'inactive'

function normStatus(raw: string | null): CityStatus {
  return raw === 'active' || raw === 'coming_soon' || raw === 'inactive' ? raw : 'inactive'
}

/** /panel/cities — города и страны, проходящие Крест. Кураторы не имеют доступа → 404. */
export default async function CitiesPage() {
  const session = await getPanelSession()
  if (session?.role === 'curator') notFound()

  const supabase = createServiceSupabase()

  const [citiesRes, countriesRes, profilesRes] = await Promise.all([
    supabase.from('cities').select('id, name_ru, country_id, status'),
    supabase.from('countries').select('id, name_ru'),
    supabase.from('profiles').select('role, city_id'),
  ])

  const dbError = Boolean(citiesRes.error || countriesRes.error || profilesRes.error)

  const countryName = new Map<number, string>()
  for (const c of countriesRes.data ?? []) countryName.set(c.id, c.name_ru)

  const students = new Map<number, number>()
  const curators = new Map<number, number>()
  for (const p of profilesRes.data ?? []) {
    if (p.city_id == null) continue
    if (p.role === 'student') students.set(p.city_id, (students.get(p.city_id) ?? 0) + 1)
    else if (p.role === 'curator') curators.set(p.city_id, (curators.get(p.city_id) ?? 0) + 1)
  }

  const cities = (citiesRes.data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name_ru,
      country: countryName.get(c.country_id) ?? '—',
      status: normStatus(c.status),
      students: students.get(c.id) ?? 0,
      curators: curators.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name, 'ru'))

  const byCountry = new Map<
    number,
    { id: number; name: string; cities: number; activeCities: number; students: number; curators: number }
  >()
  for (const c of citiesRes.data ?? []) {
    let row = byCountry.get(c.country_id)
    if (!row) {
      row = {
        id: c.country_id,
        name: countryName.get(c.country_id) ?? '—',
        cities: 0,
        activeCities: 0,
        students: 0,
        curators: 0,
      }
      byCountry.set(c.country_id, row)
    }
    row.cities += 1
    if (normStatus(c.status) === 'active') row.activeCities += 1
    row.students += students.get(c.id) ?? 0
    row.curators += curators.get(c.id) ?? 0
  }
  const countries = [...byCountry.values()].sort(
    (a, b) => b.students - a.students || a.name.localeCompare(b.name, 'ru'),
  )

  const totals = {
    activeCities: cities.filter((c) => c.status === 'active').length,
    countries: countries.length,
    students: cities.reduce((s, c) => s + c.students, 0),
    curators: cities.reduce((s, c) => s + c.curators, 0),
  }

  return (
    <>
      <h1 className="panel-page__title">Города, проходящие Крест</h1>
      <p className="panel-page__subtitle">
        География учеников и кураторов по странам и городам.
      </p>

      <div className="panel-grid">
        <div className="panel-stat">
          <div className="panel-stat__label">Активных городов</div>
          <div className="panel-stat__value">{totals.activeCities}</div>
          <div className="panel-stat__hint">из {cities.length} всего</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Стран</div>
          <div className="panel-stat__value">{totals.countries}</div>
          <div className="panel-stat__hint">с городами на платформе</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Всего учеников</div>
          <div className="panel-stat__value">{totals.students}</div>
          <div className="panel-stat__hint">{totals.curators} кураторов</div>
        </div>
      </div>

      {dbError ? (
        <div className="panel-empty">Не удалось загрузить данные. Попробуйте обновить страницу.</div>
      ) : (
        <CitiesView cities={cities} countries={countries} />
      )}
    </>
  )
}
