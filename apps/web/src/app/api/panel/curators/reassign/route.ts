import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/panel/curators/reassign — данные доски перепривязки кураторов по городам.
 * Колонки = города (с именем лидера и страной) + «Без города». Карточки = кураторы.
 * Гард: только admin/super_admin.
 */
export interface ReassignCity {
  id: number
  name: string
  country: string | null
  leaderName: string | null
}
export interface ReassignCurator {
  id: string
  name: string | null
  nick: string | null
  cityId: number | null
  studentsCount: number
}
export interface ReassignPayload {
  cities: ReassignCity[]
  curators: ReassignCurator[]
}

export async function GET(req: NextRequest) {
  const session = await getPanelSessionFromReq(req)
  if (!session) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 })
  }

  const supabase = createServiceSupabase()

  const [citiesRes, countriesRes, profilesRes] = await Promise.all([
    supabase.from('cities').select('id, name_ru, country_id'),
    supabase.from('countries').select('id, name_ru'),
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, role, city_id, curator_id')
      .in('role', ['curator', 'city_leader', 'student']),
  ])
  if (citiesRes.error || countriesRes.error || profilesRes.error) {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }

  const countryById = new Map<number, string>()
  for (const c of countriesRes.data ?? []) countryById.set(c.id, c.name_ru)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profs = (profilesRes.data ?? []) as any[]

  // Имя лидера по городу (один лидер на город).
  const leaderByCity = new Map<number, string | null>()
  for (const p of profs) {
    if (p.role === 'city_leader' && p.city_id != null) leaderByCity.set(p.city_id, p.full_name)
  }

  // Число учеников у каждого куратора.
  const studentsByCurator = new Map<string, number>()
  for (const p of profs) {
    if (p.role === 'student' && p.curator_id) {
      studentsByCurator.set(p.curator_id, (studentsByCurator.get(p.curator_id) ?? 0) + 1)
    }
  }

  const cities: ReassignCity[] = (citiesRes.data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name_ru,
      country: c.country_id != null ? countryById.get(c.country_id) ?? null : null,
      leaderName: leaderByCity.get(c.id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  const curators: ReassignCurator[] = profs
    .filter((p) => p.role === 'curator')
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      nick: p.contact_info,
      cityId: p.city_id ?? null,
      studentsCount: studentsByCurator.get(p.id) ?? 0,
    }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru'))

  const payload: ReassignPayload = { cities, curators }
  return NextResponse.json({ ok: true, ...payload })
}
