import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export type CityStatus = 'active' | 'coming_soon' | 'inactive'

export interface CityRow {
  id: number
  name: string
  country: string
  status: CityStatus
  students: number
  curators: number
}

export interface CountryRow {
  id: number
  name: string
  cities: number
  activeCities: number
  students: number
  curators: number
}

export interface CitiesPayload {
  cities: CityRow[]
  countries: CountryRow[]
  totals: {
    activeCities: number
    countries: number
    students: number
    curators: number
  }
}

function normStatus(raw: string | null): CityStatus {
  return raw === 'active' || raw === 'coming_soon' || raw === 'inactive' ? raw : 'inactive'
}

/** GET /api/panel/cities — города/страны с числом учеников и кураторов. */
export async function GET(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  if (session.role === 'curator') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const supabase = createServiceSupabase()

  const [citiesRes, countriesRes, profilesRes] = await Promise.all([
    supabase.from('cities').select('id, name_ru, country_id, status'),
    supabase.from('countries').select('id, name_ru'),
    supabase.from('profiles').select('role, city_id'),
  ])

  if (citiesRes.error || countriesRes.error || profilesRes.error) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const countryName = new Map<number, string>()
  for (const c of countriesRes.data ?? []) countryName.set(c.id, c.name_ru)

  // Счётчики учеников/кураторов по городам
  const students = new Map<number, number>()
  const curators = new Map<number, number>()
  for (const p of profilesRes.data ?? []) {
    if (p.city_id == null) continue
    if (p.role === 'student') students.set(p.city_id, (students.get(p.city_id) ?? 0) + 1)
    else if (p.role === 'curator') curators.set(p.city_id, (curators.get(p.city_id) ?? 0) + 1)
  }

  const cities: CityRow[] = (citiesRes.data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name_ru,
      country: countryName.get(c.country_id) ?? '—',
      status: normStatus(c.status),
      students: students.get(c.id) ?? 0,
      curators: curators.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name, 'ru'))

  // Агрегат по странам
  const byCountry = new Map<number, CountryRow>()
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

  const countries: CountryRow[] = [...byCountry.values()].sort(
    (a, b) => b.students - a.students || a.name.localeCompare(b.name, 'ru'),
  )

  const totals = {
    activeCities: cities.filter((c) => c.status === 'active').length,
    countries: countries.length,
    students: cities.reduce((s, c) => s + c.students, 0),
    curators: cities.reduce((s, c) => s + c.curators, 0),
  }

  const payload: CitiesPayload = { cities, countries, totals }
  return NextResponse.json(payload)
}
